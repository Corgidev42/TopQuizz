import uuid
import random

from app.models.enums import (
    GamePhase,
    ModuleType,
    Difficulty,
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

        self.tiebreaker_scores: dict[str, int] = {}
        self._color_index = 0

    def add_player(self, sid: str, pseudo: str) -> Player:
        color = PLAYER_COLORS[self._color_index % len(PLAYER_COLORS)]
        self._color_index += 1
        player = Player(sid=sid, pseudo=pseudo, color=color)
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

        return {
            "id": self.id,
            "phase": self.phase.value,
            "players": {
                sid: {
                    "pseudo": p.pseudo,
                    "color": p.color,
                    "score": p.score,
                    "is_eliminated": p.is_eliminated,
                    "is_connected": p.is_connected,
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
            "tiebreaker_scores": self.tiebreaker_scores,
        }


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
]


class GameManager:
    def __init__(self):
        self.sessions: dict[str, GameSession] = {}

    def create_session(self) -> GameSession:
        game_id = uuid.uuid4().hex[:6].upper()
        while game_id in self.sessions:
            game_id = uuid.uuid4().hex[:6].upper()
        session = GameSession(game_id)
        self.sessions[game_id] = session
        return session

    def get_session(self, game_id: str) -> GameSession | None:
        return self.sessions.get(game_id)

    def remove_session(self, game_id: str):
        self.sessions.pop(game_id, None)

    def find_session_by_sid(self, sid: str) -> GameSession | None:
        for session in self.sessions.values():
            if (
                sid in session.players
                or sid == session.host_sid
                or sid == session.tv_sid
            ):
                return session
        return None


game_manager = GameManager()
