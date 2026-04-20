import uuid
import os
import random
import asyncio
import time

import socketio

from app.services.game_manager import game_manager, GameSession, DEFAULT_PRESETS
from app.services import player_accounts
from app.services.ai_router import get_ai_for_session
from app.services.audio_streamer import get_audio_streamer
from app.models.enums import (
    GamePhase,
    ModuleType,
    Difficulty,
    DilemmeSubMode,
    MODULE_LABELS,
    TTMC_LEVEL_DIFFICULTY,
    TTMC_LEVEL_POINTS,
)
from app.models.question import Question, ModuleConfig
from app.config import settings
from app.services.fuzzy_match import fuzzy_match


async def _generate_ttmc_themes(ai, base_theme: str, num: int) -> list[str]:
    """Generate N sub-themes related to base_theme for TTMC rounds."""
    try:
        prompt = f"""Génère exactement {num} sous-thèmes de quiz originaux et amusants liés à "{base_theme}".
Chaque sous-thème doit être une catégorie précise adaptée à un quiz de culture générale.
Exemples : "Les voitures des années 80", "Les super-héros Marvel", "La cuisine italienne"

Retourne UNIQUEMENT un tableau JSON de strings. En français."""
        result = await ai.gemini._generate_json(prompt) if hasattr(ai, "gemini") else []
        if isinstance(result, list) and result:
            return [str(r) for r in result[:num]]
    except Exception:
        pass
    # Fallback: just use the base theme N times
    return [base_theme] * num


async def _record_final_stats_if_needed(session: GameSession):
    """Enregistre scores / victoires / historique pour les joueurs connectés à un compte."""
    if session.stats_recorded:
        return
    session.stats_recorded = True
    scores = session.get_scores()
    if not scores:
        return
    max_score = scores[0]["score"]
    total_players = len(scores)
    for i, row in enumerate(scores):
        sid = row["sid"]
        p = session.players.get(sid)
        if not p or not p.user_id:
            continue
        rank = i + 1
        won = row["score"] == max_score
        await player_accounts.record_game_for_user(
            p.user_id,
            session.id,
            p.pseudo,
            int(row["score"]),
            rank,
            total_players,
            won,
        )


def register_events(sio: socketio.AsyncServer):

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    @sio.event
    async def connect(sid, environ):
        print(f"[Connect] {sid}")

    @sio.event
    async def disconnect(sid):
        print(f"[Disconnect] {sid}")
        session = game_manager.find_session_by_sid(sid)
        if session:
            if sid in session.players:
                session.players[sid].is_connected = False
                await game_manager.persist(session)
                await sio.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # Rejoin (reconnection after page refresh)
    # ------------------------------------------------------------------

    @sio.event
    async def rejoin_game(sid, data):
        game_id = (data.get("game_id") or "").upper()
        token = data.get("token", "")
        role = data.get("role", "")

        session = game_manager.get_session(game_id)
        if not session:
            await sio.emit("rejoin_failed", {"message": "Partie introuvable"}, room=sid)
            return

        if role == "host" and session.host_token == token:
            old_sid = session.host_sid
            session.host_sid = sid
            await sio.enter_room(sid, session.id)
            local_ip = settings.local_ip
            join_url = f"https://{local_ip}/play?game={session.id}"
            await sio.emit(
                "rejoin_success",
                {
                    "role": "host",
                    "game_id": session.id,
                    "token": session.host_token,
                    "join_url": join_url,
                    "presets": [p.model_dump() for p in DEFAULT_PRESETS],
                },
                room=sid,
            )
            await game_manager.persist(session)
            await sio.emit("game_state", session.to_dict(), room=session.id)
            return

        if role == "tv" and session.tv_token == token:
            session.tv_sid = sid
            await sio.enter_room(sid, session.id)
            local_ip = settings.local_ip
            join_url = f"https://{local_ip}/play?game={session.id}"
            await sio.emit(
                "rejoin_success",
                {"role": "tv", "game_id": session.id, "token": session.tv_token, "join_url": join_url},
                room=sid,
            )
            await game_manager.persist(session)
            await sio.emit("game_state", session.to_dict(), room=session.id)
            return

        if role == "player":
            player = game_manager.find_player_by_token(game_id, token)
            if player:
                old_sid = player.sid
                if old_sid in session.players:
                    session.players[sid] = session.players.pop(old_sid)
                player.sid = sid
                player.is_connected = True
                if session.active_answerer == old_sid:
                    session.active_answerer = sid
                session.buzzer_queue = [sid if s == old_sid else s for s in session.buzzer_queue]
                session.eliminated_this_question = [sid if s == old_sid else s for s in session.eliminated_this_question]
                if old_sid in session.tiebreaker_scores:
                    session.tiebreaker_scores[sid] = session.tiebreaker_scores.pop(old_sid)

                await sio.enter_room(sid, session.id)
                await sio.emit(
                    "rejoin_success",
                    {
                        "role": "player",
                        "game_id": session.id,
                        "token": player.token,
                        "player": {
                            "sid": sid,
                            "pseudo": player.pseudo,
                            "color": player.color,
                            "avatar_emoji": player.avatar_emoji,
                        },
                    },
                    room=sid,
                )
                await game_manager.persist(session)
                await sio.emit("game_state", session.to_dict(), room=session.id)
                return

        await sio.emit("rejoin_failed", {"message": "Token invalide"}, room=sid)

    # ------------------------------------------------------------------
    # Host events
    # ------------------------------------------------------------------

    @sio.event
    async def host_create_game(sid, data=None):
        session = game_manager.create_session()
        session.host_sid = sid
        await sio.enter_room(sid, session.id)

        local_ip = settings.local_ip
        join_url = f"https://{local_ip}/play?game={session.id}"

        await sio.emit(
            "game_created",
            {
                "game_id": session.id,
                "join_url": join_url,
                "presets": [p.model_dump() for p in DEFAULT_PRESETS],
                "token": session.host_token,
            },
            room=sid,
        )
        await game_manager.persist(session)
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def host_cancel_game(sid, data):
        game_id = (data or {}).get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        # Notify everyone in the room before deleting state.
        await sio.emit(
            "game_cancelled",
            {"game_id": session.id, "message": "La partie a été annulée par l'host."},
            room=session.id,
        )
        get_audio_streamer().cleanup_session(session.id)
        await game_manager.remove_session(session.id)

    @sio.event
    async def host_start_game(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        modules_data = data.get("modules", [])
        preset_name = data.get("preset")
        ai = data.get("ai") or {}
        provider = (ai.get("provider") or "gemini").strip().lower()
        if provider not in ("gemini", "ollama"):
            provider = "gemini"
        session.ai_provider = provider
        session.ollama_model = (ai.get("ollama_model") or "").strip() or None

        if preset_name:
            preset = next(
                (p for p in DEFAULT_PRESETS if p.name == preset_name), None
            )
            if preset:
                session.modules = preset.modules
        elif modules_data:
            session.modules = [ModuleConfig(**m) for m in modules_data]
        else:
            session.modules = DEFAULT_PRESETS[0].modules

        session.phase = GamePhase.PLAYING
        session.current_module_index = -1

        await game_manager.persist(session)
        await sio.emit("game_started", {"game_id": session.id}, room=session.id)
        await _advance_module(sio, session)

    @sio.event
    async def host_next_question(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return
        if session.phase == GamePhase.MEMORY_PREVIEW:
            return

        session.current_question_index += 1

        if session.current_question_index >= len(session.current_module_questions):
            session.phase = GamePhase.MODULE_RESULT
            session.current_question = None
            await sio.emit(
                "module_end", {"scores": session.get_scores()}, room=session.id
            )
            await sio.emit("game_state", session.to_dict(), room=session.id)
            return

        session.reset_question_state()
        session.current_question = session.current_module_questions[
            session.current_question_index
        ]
        session.phase = GamePhase.BUZZER_OPEN
        session.buzzer_open = True

        if session.current_question.module_type == ModuleType.MASTER_COMMU:
            session.commu_revealed = []
            session.commu_answers = (
                session.current_question.extra_data.get("answers", [])
                if session.current_question.extra_data
                else []
            )

        if session.current_question.module_type == ModuleType.MASTER_FACE:
            session.current_question.blur_level = 30  # Start with high blur
            session.current_question.pixelation_level = 64 # Or high pixelation

        await sio.emit(
            "new_question",
            session.question_for_clients(),
            room=session.id,
        )
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def host_next_module(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return
        await _advance_module(sio, session)

    @sio.event
    async def host_reduce_blur(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        if session.current_question and session.current_question.blur_level:
            session.current_question.blur_level = max(
                0, session.current_question.blur_level - 5
            )
            await sio.emit(
                "blur_update",
                {"blur_level": session.current_question.blur_level},
                room=session.id,
            )
            await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def host_skip_question(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        session.phase = GamePhase.QUESTION_RESULT
        if session.current_question:
            # Reveal all answers for Master Commu if skipped
            if session.current_question.module_type == ModuleType.MASTER_COMMU:
                await sio.emit(
                    "commu_complete",
                    {"all_answers": session.current_question.extra_data.get("answers", [])},
                    room=session.id,
                )
            else:
                await sio.emit(
                    "question_skipped",
                    {"correct_answer": session.current_question.correct_answer},
                    room=session.id,
                )
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def host_adjust_score(sid, data):
        game_id = data.get("game_id")
        player_sid = data.get("player_sid")
        adjustment = data.get("adjustment", 0)

        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        if player_sid in session.players:
            session.players[player_sid].score += adjustment
            await sio.emit(
                "score_adjusted",
                {
                    "sid": player_sid,
                    "pseudo": session.players[player_sid].pseudo,
                    "new_score": session.players[player_sid].score,
                    "adjustment": adjustment,
                },
                room=session.id,
            )
            await sio.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # Dilemme Parfait events
    # ------------------------------------------------------------------

    @sio.event
    async def host_next_dilemme(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        session.dilemme_round_index += 1
        if session.dilemme_round_index >= len(session.dilemme_rounds):
            session.phase = GamePhase.MODULE_RESULT
            session.dilemme_submissions = []
            session.dilemme_votes = {}
            await sio.emit("module_end", {"scores": session.get_scores()}, room=session.id)
            await game_manager.persist(session)
            await sio.emit("game_state", session.to_dict(), room=session.id)
            return

        current_round = session.dilemme_rounds[session.dilemme_round_index]
        session.dilemme_sub_mode = current_round["sub_mode"]
        session.dilemme_prompt = current_round.get("prompt")
        session.dilemme_submissions = []
        session.dilemme_current_submission_index = -1
        session.dilemme_votes = {}
        session.phase = GamePhase.DILEMME_SUBMIT

        await game_manager.persist(session)
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def submit_dilemme(sid, data):
        game_id = data.get("game_id")
        text = (data.get("text") or "").strip()
        session = game_manager.get_session(game_id)
        if not session or sid not in session.players or not text:
            return
        if session.phase != GamePhase.DILEMME_SUBMIT:
            return

        already = any(s["sid"] == sid for s in session.dilemme_submissions)
        if already:
            return

        player = session.players[sid]
        session.dilemme_submissions.append({
            "sid": sid,
            "pseudo": player.pseudo,
            "color": player.color,
            "text": text,
        })

        await sio.emit(
            "dilemme_submitted",
            {"pseudo": player.pseudo, "count": len(session.dilemme_submissions), "total": len(session.players)},
            room=session.id,
        )

        if len(session.dilemme_submissions) >= len([p for p in session.players.values() if p.is_connected]):
            await _start_dilemme_voting(sio, session)
        else:
            await game_manager.persist(session)

    @sio.event
    async def host_force_dilemme_vote(sid, data):
        """Host can force voting to start even if not all players submitted."""
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return
        if session.phase == GamePhase.DILEMME_SUBMIT and session.dilemme_submissions:
            await _start_dilemme_voting(sio, session)

    @sio.event
    async def vote_dilemme(sid, data):
        game_id = data.get("game_id")
        vote = data.get("vote")  # True = OUI, False = NON
        session = game_manager.get_session(game_id)
        if not session or sid not in session.players:
            return
        if session.phase != GamePhase.DILEMME_VOTE:
            return

        current_sub = session.dilemme_submissions[session.dilemme_current_submission_index]
        if sid == current_sub["sid"]:
            return

        session.dilemme_votes[sid] = bool(vote)

        eligible = [
            p.sid for p in session.players.values()
            if p.is_connected and p.sid != current_sub["sid"]
        ]
        if len(session.dilemme_votes) >= len(eligible):
            await _resolve_dilemme_vote(sio, session)
        else:
            await game_manager.persist(session)

    @sio.event
    async def host_next_dilemme_submission(sid, data):
        """Move to next player's submission for voting."""
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return
        if session.phase == GamePhase.DILEMME_VOTE_RESULT:
            session.dilemme_current_submission_index += 1
            if session.dilemme_current_submission_index >= len(session.dilemme_submissions):
                session.dilemme_current_submission_index = -1
                session.phase = GamePhase.MODULE_INTRO
                await game_manager.persist(session)
                await sio.emit("game_state", session.to_dict(), room=session.id)
                return
            session.dilemme_votes = {}
            session.phase = GamePhase.DILEMME_VOTE
            await game_manager.persist(session)
            await sio.emit("game_state", session.to_dict(), room=session.id)

    async def _start_dilemme_voting(sio_server: socketio.AsyncServer, session: GameSession):
        session.dilemme_current_submission_index = 0
        session.dilemme_votes = {}
        session.phase = GamePhase.DILEMME_VOTE
        await game_manager.persist(session)
        await sio_server.emit("game_state", session.to_dict(), room=session.id)

    async def _resolve_dilemme_vote(sio_server: socketio.AsyncServer, session: GameSession):
        votes = session.dilemme_votes
        total_votes = len(votes)
        yes_count = sum(1 for v in votes.values() if v)
        yes_pct = (yes_count / total_votes * 100) if total_votes > 0 else 0
        points = max(0, round(10 * (1 - abs(yes_pct - 50) / 50)))

        current_sub = session.dilemme_submissions[session.dilemme_current_submission_index]
        author_sid = current_sub["sid"]
        if author_sid in session.players:
            session.players[author_sid].score += points

        current_sub["yes_count"] = yes_count
        current_sub["no_count"] = total_votes - yes_count
        current_sub["yes_pct"] = round(yes_pct, 1)
        current_sub["points"] = points

        session.phase = GamePhase.DILEMME_VOTE_RESULT

        await sio_server.emit(
            "dilemme_vote_result",
            {
                "submission": current_sub,
                "yes_count": yes_count,
                "no_count": total_votes - yes_count,
                "yes_pct": round(yes_pct, 1),
                "points": points,
                "scores": session.get_scores(),
            },
            room=session.id,
        )
        await game_manager.persist(session)
        await sio_server.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # TV events
    # ------------------------------------------------------------------

    @sio.event
    async def tv_join(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session:
            await sio.emit("error", {"message": "Partie introuvable"}, room=sid)
            return

        session.tv_sid = sid
        await sio.enter_room(sid, session.id)

        local_ip = settings.local_ip
        join_url = f"https://{local_ip}/play?game={session.id}"

        await sio.emit(
            "tv_connected",
            {"game_id": session.id, "join_url": join_url, "token": session.tv_token},
            room=sid,
        )
        await game_manager.persist(session)
        await sio.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # Player events
    # ------------------------------------------------------------------

    @sio.event
    async def join_game(sid, data):
        game_id = data.get("game_id", "").upper()
        pseudo = data.get("pseudo", "").strip()

        if not pseudo:
            await sio.emit("error", {"message": "Pseudo requis"}, room=sid)
            return

        session = game_manager.get_session(game_id)
        if not session:
            await sio.emit("error", {"message": "Partie introuvable"}, room=sid)
            return

        if session.phase != GamePhase.LOBBY:
            await sio.emit(
                "error", {"message": "La partie a déjà commencé"}, room=sid
            )
            return

        # Check for duplicate pseudo
        existing_pseudos = [p.pseudo.lower() for p in session.players.values()]
        if pseudo.lower() in existing_pseudos:
            await sio.emit(
                "error", {"message": f'Le pseudo "{pseudo}" est déjà pris'}, room=sid
            )
            return

        auth_token = (data.get("auth_token") or "").strip()
        user_id = None
        avatar_emoji = None
        if auth_token:
            uid = await player_accounts.resolve_auth_token(auth_token)
            if uid:
                u = await player_accounts.get_user_by_id(uid)
                if u:
                    user_id = uid
                    avatar_emoji = u.get("avatar_emoji")

        player = session.add_player(
            sid, pseudo, user_id=user_id, avatar_emoji=avatar_emoji
        )
        await sio.enter_room(sid, session.id)

        await sio.emit(
            "joined",
            {
                "player": {
                    "sid": player.sid,
                    "pseudo": player.pseudo,
                    "color": player.color,
                    "avatar_emoji": player.avatar_emoji,
                },
                "game_id": session.id,
                "token": player.token,
            },
            room=sid,
        )

        await sio.emit(
            "player_joined",
            {
                "pseudo": player.pseudo,
                "color": player.color,
                "total_players": len(session.players),
            },
            room=session.id,
        )

        await game_manager.persist(session)
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def buzz(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session:
            return

        accepted = session.handle_buzz(sid)
        if accepted:
            session.phase = GamePhase.ANSWERING
            player = session.players[sid]
            await sio.emit(
                "buzz_accepted",
                {
                    "sid": sid,
                    "pseudo": player.pseudo,
                    "color": player.color,
                },
                room=session.id,
            )
            await sio.emit("your_turn", {}, room=sid)
            await sio.emit("game_state", session.to_dict(), room=session.id)

            # Backend timeout (5s) to prevent blocking if player disconnects or timer fails
            async def timeout_handler():
                await asyncio.sleep(5.0)
                if session.active_answerer == sid:
                    print(f"[Timeout] Auto-submitting for {player.pseudo}")
                    await _process_submit_answer(sio, sid, {"game_id": game_id, "answer": ""})

            session.answer_timeout_task = asyncio.create_task(timeout_handler())

    @sio.event
    async def submit_answer(sid, data):
        await _process_submit_answer(sio, sid, data)

    async def _process_submit_answer(sio: socketio.AsyncServer, sid: str, data: dict):
        game_id = data.get("game_id")
        answer = data.get("answer", "").strip()
        session = game_manager.get_session(game_id)

        if not session or session.active_answerer != sid:
            return

        # Cancel the timeout task as an answer has been received
        if hasattr(session, "answer_timeout_task") and session.answer_timeout_task and not session.answer_timeout_task.done():
            session.answer_timeout_task.cancel()

        question = session.current_question
        if not question:
            return

        is_correct = False

        # ---- Master Commu special handling ----
        if question.module_type == ModuleType.MASTER_COMMU:
            ai = get_ai_for_session(session)
            matched = await ai.check_commu_answer(session.commu_answers, answer)

            if matched and matched["answer"] not in session.commu_revealed:
                session.commu_revealed.append(matched["answer"])
                points = max(1, matched["score"] // 20)
                session.players[sid].score += points

                await sio.emit(
                    "commu_answer_found",
                    {
                        "sid": sid,
                        "pseudo": session.players[sid].pseudo,
                        "answer": matched["answer"],
                        "score": matched["score"],
                        "points": points,
                        "revealed": session.commu_revealed,
                        "total_answers": len(session.commu_answers),
                    },
                    room=session.id,
                )

                unrevealed = [
                    a
                    for a in session.commu_answers
                    if a["answer"] not in session.commu_revealed
                ]
                if unrevealed:
                    session.active_answerer = None
                    session.buzzer_open = True
                    session.buzzer_queue = []  # Clear queue so players can buzz again
                    session.phase = GamePhase.BUZZER_OPEN
                    for p in session.players.values():
                        p.is_eliminated = False
                    session.eliminated_this_question = []
                else:
                    session.phase = GamePhase.QUESTION_RESULT
                    await sio.emit(
                        "commu_complete",
                        {"all_answers": session.commu_answers},
                        room=session.id,
                    )

                await sio.emit("game_state", session.to_dict(), room=session.id)
                return
            else:
                is_correct = False

        # ---- QCM exact match ----
        elif question.module_type == ModuleType.MASTER_QUIZ and question.options:
            is_correct = answer == question.correct_answer

        # ---- Fuzzy + Gemini for text answers ----
        else:
            is_correct = fuzzy_match(question.correct_answer, answer)
            if not is_correct:
                ai = get_ai_for_session(session)
                is_correct = await ai.check_answer(
                    question.correct_answer, answer
                )

        player = session.players[sid]

        if is_correct:
            points = session.handle_correct_answer(sid)
            session.phase = GamePhase.QUESTION_RESULT

            await sio.emit(
                "answer_correct",
                {
                    "sid": sid,
                    "pseudo": player.pseudo,
                    "answer": answer,
                    "correct_answer": question.correct_answer,
                    "points": points,
                },
                room=session.id,
            )
        else:
            result = session.handle_wrong_answer(sid)

            await sio.emit(
                "answer_wrong",
                {"sid": sid, "pseudo": player.pseudo, "answer": answer},
                room=session.id,
            )

            if result is None:
                session.phase = GamePhase.QUESTION_RESULT
                await sio.emit(
                    "question_failed",
                    {"correct_answer": question.correct_answer},
                    room=session.id,
                )
            else:
                session.phase = GamePhase.BUZZER_OPEN

        await game_manager.persist(session)
        await sio.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # TTMC events
    # ------------------------------------------------------------------

    @sio.event
    async def host_next_ttmc_round(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        session.ttmc_round_index += 1
        if session.ttmc_round_index >= len(session.ttmc_rounds):
            session.phase = GamePhase.MODULE_RESULT
            session.ttmc_theme = None
            await sio.emit("module_end", {"scores": session.get_scores()}, room=session.id)
            await game_manager.persist(session)
            await sio.emit("game_state", session.to_dict(), room=session.id)
            return

        current_round = session.ttmc_rounds[session.ttmc_round_index]
        session.ttmc_theme = current_round["theme"]
        session.ttmc_picks = {}
        session.ttmc_answers = {}
        session.ttmc_player_questions = {}
        session.phase = GamePhase.TTMC_PICKING

        await game_manager.persist(session)
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def ttmc_submit_pick(sid, data):
        game_id = data.get("game_id")
        level = data.get("level")
        session = game_manager.get_session(game_id)
        if not session or sid not in session.players:
            return
        if session.phase != GamePhase.TTMC_PICKING:
            return
        if not isinstance(level, int) or not (1 <= level <= 10):
            return
        if sid in session.ttmc_picks:
            return  # already picked

        session.ttmc_picks[sid] = level
        await sio.emit(
            "ttmc_pick_received",
            {"picks_count": len(session.ttmc_picks), "total": len([
                p for p in session.players.values() if p.is_connected
            ])},
            room=session.id,
        )

        connected = [p.sid for p in session.players.values() if p.is_connected]
        if all(p_sid in session.ttmc_picks for p_sid in connected):
            await _start_ttmc_answering(sio, session)
        else:
            await game_manager.persist(session)

    @sio.event
    async def host_force_ttmc_reveal(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return
        if session.phase == GamePhase.TTMC_PICKING and session.ttmc_picks:
            await _start_ttmc_answering(sio, session)

    async def _start_ttmc_answering(sio_server: socketio.AsyncServer, session: GameSession):
        current_round = session.ttmc_rounds[session.ttmc_round_index]
        questions_by_level = current_round["questions"]  # list of 10 Question objects (index 0 = level 1)

        for sid, level in session.ttmc_picks.items():
            q_index = max(0, min(9, level - 1))
            q = questions_by_level[q_index]
            q_dict = {
                "id": q.id,
                "text": q.text,
                "options": q.options,
                "level": level,
                "points": TTMC_LEVEL_POINTS.get(level, level),
            }
            session.ttmc_player_questions[sid] = {**q_dict, "correct_answer": q.correct_answer}
            # Send each player their private question (without correct_answer)
            await sio_server.emit("ttmc_your_question", q_dict, room=sid)

        # Players who didn't pick get a default level-5 question
        current_round_qs = session.ttmc_rounds[session.ttmc_round_index]["questions"]
        for p in session.players.values():
            if p.is_connected and p.sid not in session.ttmc_picks:
                level = 5
                q = current_round_qs[4]
                q_dict = {
                    "id": q.id,
                    "text": q.text,
                    "options": q.options,
                    "level": level,
                    "points": TTMC_LEVEL_POINTS.get(level, level),
                }
                session.ttmc_picks[p.sid] = level
                session.ttmc_player_questions[p.sid] = {**q_dict, "correct_answer": q.correct_answer}
                await sio_server.emit("ttmc_your_question", q_dict, room=p.sid)

        session.phase = GamePhase.TTMC_ANSWERING
        await game_manager.persist(session)
        await sio_server.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def ttmc_submit_answer(sid, data):
        game_id = data.get("game_id")
        answer = (data.get("answer") or "").strip()
        session = game_manager.get_session(game_id)
        if not session or sid not in session.players:
            return
        if session.phase != GamePhase.TTMC_ANSWERING:
            return
        if sid in session.ttmc_answers:
            return  # already answered

        q_data = session.ttmc_player_questions.get(sid)
        if not q_data:
            return

        correct_answer = q_data.get("correct_answer", "")
        options = q_data.get("options")
        level = session.ttmc_picks.get(sid, 5)

        # Check correctness
        if options:
            is_correct = answer == correct_answer
        else:
            is_correct = fuzzy_match(correct_answer, answer)
            if not is_correct:
                ai = get_ai_for_session(session)
                is_correct = await ai.check_answer(correct_answer, answer)

        points = TTMC_LEVEL_POINTS.get(level, level) if is_correct else 0
        if is_correct:
            session.players[sid].score += points

        session.ttmc_answers[sid] = {
            "answer": answer,
            "is_correct": is_correct,
            "points": points,
        }

        # Notify room of progress
        connected = [p.sid for p in session.players.values() if p.is_connected]
        await sio.emit(
            "ttmc_answer_received",
            {"answers_count": len(session.ttmc_answers), "total": len(connected)},
            room=session.id,
        )

        if all(p_sid in session.ttmc_answers for p_sid in connected):
            await _show_ttmc_results(sio, session)
        else:
            await game_manager.persist(session)

    @sio.event
    async def host_force_ttmc_results(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return
        if session.phase == GamePhase.TTMC_ANSWERING:
            await _show_ttmc_results(sio, session)

    async def _show_ttmc_results(sio_server: socketio.AsyncServer, session: GameSession):
        # Mark all non-answered players as 0
        for p in session.players.values():
            if p.is_connected and p.sid not in session.ttmc_answers:
                session.ttmc_answers[p.sid] = {
                    "answer": "",
                    "is_correct": False,
                    "points": 0,
                }
        session.phase = GamePhase.TTMC_RESULT
        await game_manager.persist(session)
        await sio_server.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _build_module_data(session: GameSession, module_index: int) -> dict:
        module_config = session.modules[module_index]
        ai = get_ai_for_session(session)

        if module_config.module_type == ModuleType.MASTER_QUIZ:
            raw = await ai.generate_quiz_questions(
                theme=module_config.theme or "Culture Générale",
                num=module_config.num_questions,
                difficulties=module_config.difficulty_mix,
            )
            questions: list[Question] = []
            for q in raw:
                questions.append(
                    Question(
                        id=uuid.uuid4().hex[:8],
                        module_type=ModuleType.MASTER_QUIZ,
                        text=q["question"],
                        options=q.get("options"),
                        correct_answer=q["correct_answer"],
                        difficulty=Difficulty(q.get("difficulty", "medium")),
                    )
                )
            return {"module_type": module_config.module_type, "questions": questions}

        if module_config.module_type == ModuleType.MASTER_MEMORY:
            challenge = await ai.generate_memory_challenge()
            qs = challenge.get("questions", []) or []
            questions = [
                Question(
                    id=uuid.uuid4().hex[:8],
                    module_type=ModuleType.MASTER_MEMORY,
                    text=mq["question"],
                    correct_answer=mq["correct_answer"],
                    difficulty=Difficulty(mq.get("difficulty", "medium")),
                    extra_data={"description": challenge.get("description", "")},
                )
                for mq in qs
            ]
            return {
                "module_type": module_config.module_type,
                "questions": questions,
                "memory_image_url": challenge.get("image_url"),
            }

        if module_config.module_type == ModuleType.MASTER_FACE:
            celebrities = await ai.generate_face_challenges(
                module_config.num_questions
            )
            questions: list[Question] = []
            for celeb in celebrities:
                if celeb.get("image_url"):
                    questions.append(
                        Question(
                            id=uuid.uuid4().hex[:8],
                            module_type=ModuleType.MASTER_FACE,
                            text="Qui est cette personne ?",
                            correct_answer=celeb["name"],
                            difficulty=Difficulty(celeb.get("difficulty", "medium")),
                            image_url=celeb["image_url"],
                            blur_level=30,
                            extra_data={
                                "fun_fact": celeb.get("fun_fact", ""),
                                "category": celeb.get("category", ""),
                            },
                        )
                    )
            return {"module_type": module_config.module_type, "questions": questions}

        if module_config.module_type == ModuleType.MASTER_COMMU:
            commu_qs = await ai.generate_commu_questions(
                module_config.num_questions,
                theme=module_config.theme,
            )
            questions: list[Question] = []
            for q in commu_qs:
                questions.append(
                    Question(
                        id=uuid.uuid4().hex[:8],
                        module_type=ModuleType.MASTER_COMMU,
                        text=q["question"],
                        correct_answer="",
                        difficulty=Difficulty(q.get("difficulty", "medium")),
                        extra_data={"answers": q["answers"]},
                    )
                )
            return {"module_type": module_config.module_type, "questions": questions}

        if module_config.module_type == ModuleType.BLIND_TEST:
            suggestions = await ai.generate_blindtest_suggestions(
                num=module_config.num_questions,
                theme=module_config.theme,
            )
            streamer = get_audio_streamer()
            sem = asyncio.Semaphore(3)
            done_count = 0
            total = len(suggestions)

            async def download_one(idx: int, song: dict):
                nonlocal done_count
                async with sem:
                    audio_path = await streamer.search_and_download(
                        song["search_query"], game_id=session.id
                    )
                    if audio_path is None:
                        replacement = await ai.generate_blindtest_suggestions(num=1, theme=module_config.theme)
                        if replacement:
                            audio_path = await streamer.search_and_download(
                                replacement[0]["search_query"], game_id=session.id
                            )
                            if audio_path:
                                song = replacement[0]
                done_count += 1
                await sio.emit(
                    "blindtest_progress",
                    {"done": done_count, "total": total},
                    room=session.id,
                )
                return idx, song, audio_path

            results = await asyncio.gather(
                *[download_one(i, s) for i, s in enumerate(suggestions)],
                return_exceptions=True,
            )

            ordered = sorted(
                [x for x in results if not isinstance(x, Exception)],
                key=lambda x: x[0],
            )

            questions: list[Question] = []
            for _, song, audio_path in ordered:
                if not audio_path:
                    continue
                questions.append(
                    Question(
                        id=uuid.uuid4().hex[:8],
                        module_type=ModuleType.BLIND_TEST,
                        text="Quel est ce titre / artiste ?",
                        correct_answer=f"{song['artist']} - {song['title']}",
                        difficulty=Difficulty.MEDIUM,
                        media_path=audio_path,
                        extra_data={"artist": song["artist"], "title": song["title"]},
                    )
                )
            return {"module_type": module_config.module_type, "questions": questions}

        if module_config.module_type == ModuleType.DILEMME_PARFAIT:
            sub_modes = module_config.dilemme_sub_modes or [
                DilemmeSubMode.AI_START,
                DilemmeSubMode.VOUS_AIMEZ,
                DilemmeSubMode.POURRIEZ_VOUS,
                DilemmeSubMode.LIBRE,
            ]
            num_rounds = module_config.num_questions
            rounds: list[dict] = []

            ai_prompts: list[str] = []
            ai_count = sum(1 for sm in sub_modes[:num_rounds] if sm == DilemmeSubMode.AI_START)
            if ai_count > 0:
                positive = random.choice([True, False])
                ai_prompts = await ai.generate_dilemme_start(positive=positive, count=ai_count)

            ai_idx = 0
            for i in range(num_rounds):
                sm = sub_modes[i % len(sub_modes)]
                round_data: dict = {"sub_mode": sm.value, "prompt": None}
                if sm == DilemmeSubMode.AI_START and ai_idx < len(ai_prompts):
                    round_data["prompt"] = ai_prompts[ai_idx]
                    ai_idx += 1
                rounds.append(round_data)

            return {
                "module_type": module_config.module_type,
                "questions": [],
                "dilemme_rounds": rounds,
            }

        if module_config.module_type == ModuleType.TTMC:
            theme = module_config.theme or "Culture Générale"
            num_rounds = module_config.num_questions
            # Generate sub-themes for each round using AI
            sub_themes = await _generate_ttmc_themes(ai, theme, num_rounds)
            rounds: list[dict] = []
            for sub_theme in sub_themes:
                raw_qs = await ai.generate_ttmc_questions(sub_theme)
                questions: list[Question] = []
                for q in raw_qs:
                    level = int(q.get("level", 5))
                    level = max(1, min(10, level))
                    diff = TTMC_LEVEL_DIFFICULTY.get(level, Difficulty.MEDIUM)
                    questions.append(
                        Question(
                            id=uuid.uuid4().hex[:8],
                            module_type=ModuleType.TTMC,
                            text=q["question"],
                            options=q.get("options"),
                            correct_answer=q["correct_answer"],
                            difficulty=diff,
                            points=TTMC_LEVEL_POINTS.get(level, level),
                        )
                    )
                # Pad to exactly 10 if AI returned fewer
                while len(questions) < 10:
                    questions.append(questions[-1] if questions else Question(
                        id=uuid.uuid4().hex[:8],
                        module_type=ModuleType.TTMC,
                        text="Question bonus",
                        correct_answer="N/A",
                        difficulty=Difficulty.MEDIUM,
                        points=5,
                    ))
                rounds.append({"theme": sub_theme, "questions": questions[:10]})
            return {
                "module_type": module_config.module_type,
                "questions": [],
                "ttmc_rounds": rounds,
            }

        return {"module_type": module_config.module_type, "questions": []}

    async def _prefetch_and_store(session: GameSession, module_index: int) -> dict:
        try:
            data = await _build_module_data(session, module_index)
            session._prefetched_modules[module_index] = data
            return data
        finally:
            session._prefetch_tasks.pop(module_index, None)

    async def _advance_module(sio_server: socketio.AsyncServer, session: GameSession):
        session.current_module_index += 1

        if session.current_module_index >= len(session.modules):
            tied = session.check_tiebreak_needed()
            if tied:
                await _start_tiebreaker(sio_server, session, tied)
            else:
                session.phase = GamePhase.FINAL_RESULTS
                streamer = get_audio_streamer()
                streamer.cleanup_session(session.id)
                await _record_final_stats_if_needed(session)
                await game_manager.persist(session)
                await sio_server.emit(
                    "game_state", session.to_dict(), room=session.id
                )
            return

        module_config = session.modules[session.current_module_index]
        session.phase = GamePhase.MODULE_INTRO
        session.current_question_index = -1
        session.current_module_questions = []
        session.memory_preview = None

        start = time.perf_counter()

        try:
            data = session._prefetched_modules.pop(session.current_module_index, None)
            if data is None:
                task = session._prefetch_tasks.get(session.current_module_index)
                if task is not None:
                    data = await task
                    session._prefetch_tasks.pop(session.current_module_index, None)
                else:
                    data = await _build_module_data(session, session.current_module_index)

            session.current_module_questions = data.get("questions", [])

            if module_config.module_type == ModuleType.DILEMME_PARFAIT:
                session.dilemme_rounds = data.get("dilemme_rounds", [])
                session.dilemme_round_index = -1
                session.phase = GamePhase.MODULE_INTRO
                await sio_server.emit("game_state", session.to_dict(), room=session.id)
                await game_manager.persist(session)
                return

            if module_config.module_type == ModuleType.TTMC:
                session.ttmc_rounds = data.get("ttmc_rounds", [])
                session.ttmc_round_index = -1
                session.ttmc_picks = {}
                session.ttmc_answers = {}
                session.ttmc_player_questions = {}
                session.ttmc_theme = None
                session.phase = GamePhase.MODULE_INTRO
                await sio_server.emit("game_state", session.to_dict(), room=session.id)
                await game_manager.persist(session)
                return

            if not session.current_module_questions:
                await _advance_module(sio_server, session)
                return

            if module_config.module_type == ModuleType.MASTER_MEMORY:
                countdown_seconds = 5
                show_seconds = 30
                session.phase = GamePhase.MEMORY_PREVIEW
                session.memory_preview = {
                    "image_url": data.get("memory_image_url"),
                    "started_at": time.time(),
                    "countdown_seconds": countdown_seconds,
                    "show_seconds": show_seconds,
                }
                await sio_server.emit("game_state", session.to_dict(), room=session.id)

                async def end_preview():
                    await asyncio.sleep(countdown_seconds + show_seconds)
                    if (
                        session.phase == GamePhase.MEMORY_PREVIEW
                        and session.current_module_index < len(session.modules)
                        and session.modules[session.current_module_index].module_type
                        == ModuleType.MASTER_MEMORY
                    ):
                        session.phase = GamePhase.MODULE_INTRO
                        session.memory_preview = None
                        await sio_server.emit("game_state", session.to_dict(), room=session.id)

                asyncio.create_task(end_preview())
            else:
                session.phase = GamePhase.MODULE_INTRO
                await sio_server.emit("game_state", session.to_dict(), room=session.id)

            await game_manager.persist(session)
            next_index = session.current_module_index + 1
            if next_index < len(session.modules):
                if (
                    next_index not in session._prefetched_modules
                    and next_index not in session._prefetch_tasks
                ):
                    session._prefetch_tasks[next_index] = asyncio.create_task(
                        _prefetch_and_store(session, next_index)
                    )

        except Exception as e:
            print(f"[Error generating questions] {e}")
            await sio_server.emit(
                "error",
                {"message": f"Erreur génération IA : {e}"},
                room=session.id,
            )
            return

        elapsed = time.perf_counter() - start
        if elapsed >= 2.0:
            print(
                f"[Module] {module_config.module_type.value} ready in {elapsed:.2f}s"
                f" ({len(session.current_module_questions)}/{module_config.num_questions})"
            )

    async def _start_tiebreaker(
        sio_server: socketio.AsyncServer,
        session: GameSession,
        tied_sids: list[str],
    ):
        session.phase = GamePhase.TIEBREAKER
        session.tiebreaker_scores = {s: 0 for s in tied_sids}

        ai = get_ai_for_session(session)
        try:
            raw = await ai.generate_quiz_questions(
                theme="Culture Générale",
                num=10,
                difficulties=[Difficulty.MEDIUM, Difficulty.HARD],
            )
            session.current_module_questions = [
                Question(
                    id=uuid.uuid4().hex[:8],
                    module_type=ModuleType.MASTER_QUIZ,
                    text=q["question"],
                    options=q.get("options"),
                    correct_answer=q["correct_answer"],
                    difficulty=Difficulty(q.get("difficulty", "medium")),
                )
                for q in raw
            ]
            session.current_question_index = -1
        except Exception as e:
            print(f"[Error generating tiebreaker] {e}")

        tied_players = [
            {
                "sid": s,
                "pseudo": session.players[s].pseudo,
                "color": session.players[s].color,
            }
            for s in tied_sids
            if s in session.players
        ]

        await sio_server.emit(
            "tiebreaker_start",
            {
                "tied_players": tied_players,
                "num_questions": len(session.current_module_questions),
            },
            room=session.id,
        )
        await sio_server.emit(
            "game_state", session.to_dict(), room=session.id
        )
