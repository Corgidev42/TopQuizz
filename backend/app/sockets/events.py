import uuid
import os
import random
import asyncio

import socketio

from app.services.game_manager import game_manager, GameSession, DEFAULT_PRESETS
from app.services.gemini_engine import get_gemini
from app.services.audio_streamer import get_audio_streamer
from app.services.fuzzy_match import fuzzy_match
from app.models.enums import (
    GamePhase,
    ModuleType,
    Difficulty,
    MODULE_LABELS,
)
from app.models.question import Question, ModuleConfig
from app.config import settings


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
                await sio.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # Host events
    # ------------------------------------------------------------------

    @sio.event
    async def host_create_game(sid, data=None):
        session = game_manager.create_session()
        session.host_sid = sid
        await sio.enter_room(sid, session.id)

        local_ip = settings.local_ip
        join_url = f"http://{local_ip}:3000/play?game={session.id}"

        await sio.emit(
            "game_created",
            {
                "game_id": session.id,
                "join_url": join_url,
                "presets": [p.model_dump() for p in DEFAULT_PRESETS],
            },
            room=sid,
        )
        await sio.emit("game_state", session.to_dict(), room=session.id)

    @sio.event
    async def host_start_game(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
            return

        modules_data = data.get("modules", [])
        preset_name = data.get("preset")

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

        await sio.emit("game_started", {"game_id": session.id}, room=session.id)
        await _advance_module(sio, session)

    @sio.event
    async def host_next_question(sid, data):
        game_id = data.get("game_id")
        session = game_manager.get_session(game_id)
        if not session or session.host_sid != sid:
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
        join_url = f"http://{local_ip}:3000/play?game={session.id}"

        await sio.emit(
            "tv_connected",
            {"game_id": session.id, "join_url": join_url},
            room=sid,
        )
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

        player = session.add_player(sid, pseudo)
        await sio.enter_room(sid, session.id)

        await sio.emit(
            "joined",
            {
                "player": {
                    "sid": player.sid,
                    "pseudo": player.pseudo,
                    "color": player.color,
                },
                "game_id": session.id,
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
            gemini = get_gemini()
            matched = await gemini.check_commu_answer(session.commu_answers, answer)

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
                gemini = get_gemini()
                is_correct = await gemini.check_answer(
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
                # Buzzer reopened — other players can now answer
                session.phase = GamePhase.BUZZER_OPEN

        await sio.emit("game_state", session.to_dict(), room=session.id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _advance_module(sio_server: socketio.AsyncServer, session: GameSession):
        session.current_module_index += 1

        if session.current_module_index >= len(session.modules):
            tied = session.check_tiebreak_needed()
            if tied:
                await _start_tiebreaker(sio_server, session, tied)
            else:
                session.phase = GamePhase.FINAL_RESULTS
                await sio_server.emit(
                    "game_state", session.to_dict(), room=session.id
                )
            return

        module_config = session.modules[session.current_module_index]
        session.phase = GamePhase.MODULE_INTRO
        session.current_question_index = -1
        session.current_module_questions = []

        await sio_server.emit(
            "module_intro",
            {
                "module_type": module_config.module_type.value,
                "module_name": MODULE_LABELS.get(
                    module_config.module_type, module_config.module_type.value
                ),
                "num_questions": module_config.num_questions,
                "theme": module_config.theme,
            },
            room=session.id,
        )

        gemini = get_gemini()

        try:
            if module_config.module_type == ModuleType.MASTER_QUIZ:
                raw = await gemini.generate_quiz_questions(
                    theme=module_config.theme or "Culture Générale",
                    num=module_config.num_questions,
                    difficulties=module_config.difficulty_mix,
                )
                for q in raw:
                    session.current_module_questions.append(
                        Question(
                            id=uuid.uuid4().hex[:8],
                            module_type=ModuleType.MASTER_QUIZ,
                            text=q["question"],
                            options=q.get("options"),
                            correct_answer=q["correct_answer"],
                            difficulty=Difficulty(q.get("difficulty", "medium")),
                        )
                    )

            elif module_config.module_type == ModuleType.MASTER_MEMORY:
                for _ in range(module_config.num_questions):
                    challenge = await gemini.generate_memory_challenge()
                    for mq in challenge.get("questions", [])[:1]:
                        session.current_module_questions.append(
                            Question(
                                id=uuid.uuid4().hex[:8],
                                module_type=ModuleType.MASTER_MEMORY,
                                text=mq["question"],
                                correct_answer=mq["correct_answer"],
                                difficulty=Difficulty(
                                    mq.get("difficulty", "medium")
                                ),
                                image_url=challenge.get("image_url"),
                                extra_data={
                                    "description": challenge.get("description", "")
                                },
                            )
                        )

            elif module_config.module_type == ModuleType.MASTER_FACE:
                celebrities = await gemini.generate_face_challenges(
                    module_config.num_questions
                )
                for celeb in celebrities:
                    if celeb.get("image_url"):
                        session.current_module_questions.append(
                            Question(
                                id=uuid.uuid4().hex[:8],
                                module_type=ModuleType.MASTER_FACE,
                                text="Qui est cette personne ?",
                                correct_answer=celeb["name"],
                                difficulty=Difficulty(
                                    celeb.get("difficulty", "medium")
                                ),
                                image_url=celeb["image_url"],
                                blur_level=30,
                                extra_data={
                                    "fun_fact": celeb.get("fun_fact", ""),
                                    "category": celeb.get("category", ""),
                                },
                            )
                        )

            elif module_config.module_type == ModuleType.MASTER_COMMU:
                commu_qs = await gemini.generate_commu_questions(
                    module_config.num_questions
                )
                for q in commu_qs:
                    session.current_module_questions.append(
                        Question(
                            id=uuid.uuid4().hex[:8],
                            module_type=ModuleType.MASTER_COMMU,
                            text=q["question"],
                            correct_answer="",
                            difficulty=Difficulty(q.get("difficulty", "medium")),
                            extra_data={"answers": q["answers"]},
                        )
                    )

            elif module_config.module_type == ModuleType.BLIND_TEST:
                # 1. Ask Gemini for popular songs
                suggestions = await gemini.generate_blindtest_suggestions(
                    num=module_config.num_questions,
                    theme=module_config.theme
                )

                streamer = get_audio_streamer()
                
                # 2. Download audio for each suggestion
                for i, song in enumerate(suggestions):
                    print(f"[BlindTest] Downloading {song['artist']} - {song['title']}...")
                    
                    # Notify clients about progress without spoiling
                    await sio_server.emit(
                        "module_loading_progress",
                        {"message": f"Préparation du morceau {i + 1}/{len(suggestions)}..."},
                        room=session.id
                    )

                    audio_path = await streamer.search_and_download(song['search_query'])
                    
                    if audio_path:
                        session.current_module_questions.append(
                            Question(
                                id=uuid.uuid4().hex[:8],
                                module_type=ModuleType.BLIND_TEST,
                                text="Quel est ce titre / artiste ?",
                                correct_answer=f"{song['artist']} - {song['title']}",
                                difficulty=Difficulty.MEDIUM,
                                media_path=audio_path,
                                extra_data={
                                    "artist": song['artist'],
                                    "title": song['title']
                                },
                            )
                        )
                    else:
                        print(f"[BlindTest] Failed to download {song['search_query']}")

            # If after all generation, no questions were created, advance again.
            if not session.current_module_questions:
                await _advance_module(sio_server, session)

        except Exception as e:
            print(f"[Error generating questions] {e}")
            await sio_server.emit(
                "error",
                {"message": f"Erreur génération IA : {e}"},
                room=session.id,
            )
            return

        await sio_server.emit(
            "game_state", session.to_dict(), room=session.id
        )

    async def _start_tiebreaker(
        sio_server: socketio.AsyncServer,
        session: GameSession,
        tied_sids: list[str],
    ):
        session.phase = GamePhase.TIEBREAKER
        session.tiebreaker_scores = {s: 0 for s in tied_sids}

        gemini = get_gemini()
        try:
            raw = await gemini.generate_quiz_questions(
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
