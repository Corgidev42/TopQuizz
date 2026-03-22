import uuid
import random
import asyncio

from app.models.enums import (
    GamePhase,
    ModuleType,
    Difficulty,
    DilemmeSubMode,
    MODULE_LABELS,
)
from app.models.player import Player, PLAYER_COLORS
from app.models.question import Question, ModuleConfig, GamePreset


class GameSession:
    def __init__(self, game_id: str):
        self.id = game_id
        self.phase = GamePhase.LOBBY
        self.players: dict[str, Player] = {}
        self.host_sid: str | None = None
        self.tv_sid: str | None = None
        self.host_token: str = uuid.uuid4().hex
        self.tv_token: str = uuid.uuid4().hex

        self.modules: list[ModuleConfig] = []
        self.current_module_index: int = -1
        self.current_module_questions: list[Question] = []
        self.current_question_index: int = -1
        self.current_question: Question | None = None

        self.buzzer_queue: list[str] = []
        self.active_answerer: str | None = None
        self.eliminated_this_question: list[str] = []
        self.buzzer_open: bool = False

        self.commu_revealed: list[str] = []
        self.commu_answers: list[dict] = []

        self.memory_preview: dict | None = None
        self._prefetched_modules: dict[int, dict] = {}
        self._prefetch_tasks: dict[int, asyncio.Task] = {}

        self.tiebreaker_scores: dict[str, int] = {}
        self._color_index = 0

        # Dilemme Parfait state
        self.dilemme_submissions: list[dict] = []
        self.dilemme_current_submission_index: int = -1
        self.dilemme_votes: dict[str, bool] = {}
        self.dilemme_sub_mode: str | None = None
        self.dilemme_prompt: str | None = None
        self.dilemme_round_index: int = -1
        self.dilemme_rounds: list[dict] = []

        # AI config (selected by host at start)
        self.ai_provider: str = "gemini"  # "gemini" | "ollama"
        self.ollama_model: str | None = None

        # Stats persistantes (comptes joueurs) — une seule fois par partie
        self.stats_recorded: bool = False

    def add_player(
        self,
        sid: str,
        pseudo: str,
        user_id: str | None = None,
        avatar_emoji: str | None = None,
    ) -> Player:
        color = PLAYER_COLORS[self._color_index % len(PLAYER_COLORS)]
        self._color_index += 1
        player = Player(
            sid=sid,
            pseudo=pseudo,
            color=color,
            user_id=user_id,
            avatar_emoji=avatar_emoji,
        )
        self.players[sid] = player
        return player

    def remove_player(self, sid: str):
        if sid in self.players:
            self.players[sid].is_connected = False

    def reset_question_state(self):
        self.buzzer_queue = []
        self.active_answerer = None
        self.eliminated_this_question = []
        self.buzzer_open = False
        for player in self.players.values():
            player.is_eliminated = False

    def handle_buzz(self, sid: str) -> bool:
        if not self.buzzer_open:
            return False
        if sid in self.eliminated_this_question:
            return False
        if sid in self.buzzer_queue:
            return False
        if sid not in self.players:
            return False

        self.buzzer_queue.append(sid)

        if self.active_answerer is None:
            self.active_answerer = sid
            self.buzzer_open = False
            return True
        return False

    def handle_wrong_answer(self, sid: str) -> str | None:
        """Eliminate player, return 'buzzer_reopened' or None if all failed."""
        self.eliminated_this_question.append(sid)
        self.players[sid].is_eliminated = True
        self.active_answerer = None
        self.buzzer_queue = []  # Clear queue so players can buzz again

        active_players = [
            p.sid
            for p in self.players.values()
            if p.is_connected and p.sid not in self.eliminated_this_question
        ]

        if not active_players:
            return None

        self.buzzer_open = True
        return "buzzer_reopened"

    def handle_correct_answer(self, sid: str) -> int:
        if self.current_question:
            points = self.current_question.points
            self.players[sid].score += points
            if self.phase == GamePhase.TIEBREAKER:
                self.tiebreaker_scores[sid] = self.tiebreaker_scores.get(sid, 0) + 1
            return points
        return 0

    def get_scores(self) -> list[dict]:
        return sorted(
            [
                {
                    "sid": p.sid,
                    "pseudo": p.pseudo,
                    "color": p.color,
                    "score": p.score,
                    "avatar_emoji": p.avatar_emoji,
                }
                for p in self.players.values()
            ],
            key=lambda x: x["score"],
            reverse=True,
        )

    def check_tiebreak_needed(self) -> list[str]:
        scores = self.get_scores()
        if len(scores) < 2:
            return []
        top_score = scores[0]["score"]
        tied = [s["sid"] for s in scores if s["score"] == top_score]
        return tied if len(tied) > 1 else []

    def question_for_clients(self) -> dict | None:
        if not self.current_question:
            return None
        q = self.current_question
        data: dict = {
            "id": q.id,
            "text": q.text,
            "module_type": q.module_type.value,
            "difficulty": q.difficulty.value,
            "points": q.points,
            "correct_answer": q.correct_answer,
        }
        if q.options:
            data["options"] = q.options
        if q.image_url:
            data["image_url"] = q.image_url
        if q.blur_level is not None:
            data["blur_level"] = q.blur_level
        if q.media_path:
            data["media_path"] = q.media_path
        if q.extra_data:
            data["extra_data"] = q.extra_data
        return data

    def to_dict(self) -> dict:
        current_mod = None
        if 0 <= self.current_module_index < len(self.modules):
            current_mod = self.modules[self.current_module_index].module_type.value

        data = {
            "id": self.id,
            "phase": self.phase.value,
            "players": {
                sid: {
                    "pseudo": p.pseudo,
                    "color": p.color,
                    "score": p.score,
                    "is_eliminated": p.is_eliminated,
                    "is_connected": p.is_connected,
                    "avatar_emoji": p.avatar_emoji,
                }
                for sid, p in self.players.items()
            },
            "current_module": current_mod,
            "current_module_index": self.current_module_index,
            "total_modules": len(self.modules),
            "current_question_index": self.current_question_index,
            "total_questions": len(self.current_module_questions),
            "current_question": self.question_for_clients(),
            "scores": self.get_scores(),
            "active_answerer": self.active_answerer,
            "buzzer_open": self.buzzer_open,
            "eliminated_this_question": self.eliminated_this_question,
            "commu_revealed": self.commu_revealed,
            "memory_preview": self.memory_preview,
            "tiebreaker_scores": self.tiebreaker_scores,
            "ai": {
                "provider": self.ai_provider,
                "ollama_model": self.ollama_model,
            },
        }

        if self.dilemme_submissions or self.dilemme_sub_mode:
            data["dilemme"] = {
                "sub_mode": self.dilemme_sub_mode,
                "prompt": self.dilemme_prompt,
                "submissions": self.dilemme_submissions,
                "current_submission_index": self.dilemme_current_submission_index,
                "votes": self.dilemme_votes,
                "round_index": self.dilemme_round_index,
                "total_rounds": len(self.dilemme_rounds),
            }

        return data

    def to_json(self) -> dict:
        """Full serialization for Redis persistence (includes tokens, modules, questions)."""
        return {
            "id": self.id,
            "phase": self.phase.value,
            "players": {
                sid: p.model_dump() for sid, p in self.players.items()
            },
            "host_sid": self.host_sid,
            "tv_sid": self.tv_sid,
            "host_token": self.host_token,
            "tv_token": self.tv_token,
            "modules": [m.model_dump() for m in self.modules],
            "current_module_index": self.current_module_index,
            "current_module_questions": [q.model_dump() for q in self.current_module_questions],
            "current_question_index": self.current_question_index,
            "current_question": self.current_question.model_dump() if self.current_question else None,
            "buzzer_queue": self.buzzer_queue,
            "active_answerer": self.active_answerer,
            "eliminated_this_question": self.eliminated_this_question,
            "buzzer_open": self.buzzer_open,
            "commu_revealed": self.commu_revealed,
            "commu_answers": self.commu_answers,
            "memory_preview": self.memory_preview,
            "tiebreaker_scores": self.tiebreaker_scores,
            "_color_index": self._color_index,
            "ai_provider": self.ai_provider,
            "ollama_model": self.ollama_model,
            "dilemme_submissions": self.dilemme_submissions,
            "dilemme_current_submission_index": self.dilemme_current_submission_index,
            "dilemme_votes": self.dilemme_votes,
            "dilemme_sub_mode": self.dilemme_sub_mode,
            "dilemme_prompt": self.dilemme_prompt,
            "dilemme_round_index": self.dilemme_round_index,
            "dilemme_rounds": self.dilemme_rounds,
            "stats_recorded": self.stats_recorded,
        }

    @classmethod
    def from_json(cls, data: dict) -> "GameSession":
        session = cls(data["id"])
        session.phase = GamePhase(data["phase"])
        session.players = {
            sid: Player(**pdata) for sid, pdata in data.get("players", {}).items()
        }
        session.host_sid = data.get("host_sid")
        session.tv_sid = data.get("tv_sid")
        session.host_token = data.get("host_token", uuid.uuid4().hex)
        session.tv_token = data.get("tv_token", uuid.uuid4().hex)
        session.modules = [ModuleConfig(**m) for m in data.get("modules", [])]
        session.current_module_index = data.get("current_module_index", -1)
        session.current_module_questions = [
            Question(**q) for q in data.get("current_module_questions", [])
        ]
        session.current_question_index = data.get("current_question_index", -1)
        cq = data.get("current_question")
        session.current_question = Question(**cq) if cq else None
        session.buzzer_queue = data.get("buzzer_queue", [])
        session.active_answerer = data.get("active_answerer")
        session.eliminated_this_question = data.get("eliminated_this_question", [])
        session.buzzer_open = data.get("buzzer_open", False)
        session.commu_revealed = data.get("commu_revealed", [])
        session.commu_answers = data.get("commu_answers", [])
        session.memory_preview = data.get("memory_preview")
        session.tiebreaker_scores = data.get("tiebreaker_scores", {})
        session._color_index = data.get("_color_index", 0)
        session.ai_provider = data.get("ai_provider", "gemini")
        session.ollama_model = data.get("ollama_model")
        session.dilemme_submissions = data.get("dilemme_submissions", [])
        session.dilemme_current_submission_index = data.get("dilemme_current_submission_index", -1)
        session.dilemme_votes = data.get("dilemme_votes", {})
        session.dilemme_sub_mode = data.get("dilemme_sub_mode")
        session.dilemme_prompt = data.get("dilemme_prompt")
        session.dilemme_round_index = data.get("dilemme_round_index", -1)
        session.dilemme_rounds = data.get("dilemme_rounds", [])
        session.stats_recorded = data.get("stats_recorded", False)
        return session


DEFAULT_PRESETS: list[GamePreset] = [
    GamePreset(
        name="Soirée Classique",
        description="Un mix équilibré de tous les modules",
        modules=[
            ModuleConfig(
                module_type=ModuleType.MASTER_QUIZ,
                num_questions=5,
                theme="Culture Générale",
            ),
            ModuleConfig(module_type=ModuleType.MASTER_FACE, num_questions=3),
            ModuleConfig(module_type=ModuleType.MASTER_COMMU, num_questions=3),
            ModuleConfig(module_type=ModuleType.BLIND_TEST, num_questions=5),
        ],
    ),
    GamePreset(
        name="Speed Quiz",
        description="Questions rapides, difficulté croissante",
        modules=[
            ModuleConfig(
                module_type=ModuleType.MASTER_QUIZ,
                num_questions=10,
                theme="Pop Culture",
                difficulty_mix=[Difficulty.EASY, Difficulty.MEDIUM],
            ),
            ModuleConfig(
                module_type=ModuleType.MASTER_QUIZ,
                num_questions=5,
                theme="Science & Tech",
                difficulty_mix=[Difficulty.HARD, Difficulty.EXPERT],
            ),
        ],
    ),
    GamePreset(
        name="Full Experience",
        description="La totale ! Tous les modules, plus de questions",
        modules=[
            ModuleConfig(
                module_type=ModuleType.MASTER_QUIZ,
                num_questions=8,
                theme="Culture Générale",
            ),
            ModuleConfig(module_type=ModuleType.MASTER_MEMORY, num_questions=3),
            ModuleConfig(module_type=ModuleType.MASTER_FACE, num_questions=5),
            ModuleConfig(module_type=ModuleType.MASTER_COMMU, num_questions=4),
            ModuleConfig(module_type=ModuleType.BLIND_TEST, num_questions=5),
        ],
    ),
    GamePreset(
        name="Dilemme Party",
        description="Le Dilemme Parfait : trouvez le 50/50 !",
        modules=[
            ModuleConfig(
                module_type=ModuleType.DILEMME_PARFAIT,
                num_questions=4,
                dilemme_sub_modes=[
                    DilemmeSubMode.AI_START,
                    DilemmeSubMode.VOUS_AIMEZ,
                    DilemmeSubMode.POURRIEZ_VOUS,
                    DilemmeSubMode.LIBRE,
                ],
            ),
        ],
    ),
]


class GameManager:
    def __init__(self):
        self.sessions: dict[str, GameSession] = {}
        self._redis = None

    async def init_redis(self):
        from app.services.redis_store import get_redis_store
        self._redis = await get_redis_store()
        await self._restore_sessions()

    async def _restore_sessions(self):
        if not self._redis or not self._redis.available:
            return
        ids = await self._redis.list_session_ids()
        for gid in ids:
            data = await self._redis.load_session(gid)
            if data:
                try:
                    session = GameSession.from_json(data)
                    self.sessions[gid] = session
                    print(f"[Redis] Restored session {gid}")
                except Exception as e:
                    print(f"[Redis] Failed to restore {gid}: {e}")

    async def persist(self, session: GameSession):
        if self._redis and self._redis.available:
            await self._redis.save_session(session.id, session.to_json())

    def create_session(self) -> GameSession:
        game_id = uuid.uuid4().hex[:6].upper()
        while game_id in self.sessions:
            game_id = uuid.uuid4().hex[:6].upper()
        session = GameSession(game_id)
        self.sessions[game_id] = session
        return session

    def get_session(self, game_id: str) -> GameSession | None:
        return self.sessions.get(game_id)

    async def remove_session(self, game_id: str):
        self.sessions.pop(game_id, None)
        if self._redis and self._redis.available:
            await self._redis.delete_session(game_id)

    def find_session_by_sid(self, sid: str) -> GameSession | None:
        for session in self.sessions.values():
            if (
                sid in session.players
                or sid == session.host_sid
                or sid == session.tv_sid
            ):
                return session
        return None

    def find_player_by_token(self, game_id: str, token: str) -> Player | None:
        session = self.get_session(game_id)
        if not session:
            return None
        for player in session.players.values():
            if player.token == token:
                return player
        return None


game_manager = GameManager()
