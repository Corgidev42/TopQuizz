import { useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";
import JoinView from "./JoinView";
import Buzzer from "../components/player/Buzzer";
import AnswerInput from "../components/player/AnswerInput";
import WaitingScreen from "../components/player/WaitingScreen";
import DilemmeInput from "../components/player/DilemmeInput";
import { MODULE_LABELS, MODULE_ICONS, ModuleType } from "../types";

const getAnswerTimeout = (moduleType: ModuleType | undefined) => {
  switch (moduleType) {
    case "master_face":
      return 8;
    case "master_commu":
      return 10;
    default:
      return 4;
  }
};

export default function PlayerView() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_searchParams] = useSearchParams();
  const { emit } = useSocket();
  const { gameState, mySid, myPlayer } = useGameStore();
  const ANSWER_TIMEOUT_SEC = getAnswerTimeout(gameState?.current_question?.module_type);

  // Answer timer — must be declared before any conditional return
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIMEOUT_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTimedOutRef = useRef(false);
  // Keep a stable ref to gameId so the timeout callback doesn't go stale
  const gameIdRef = useRef<string | null>(gameState?.id ?? null);
  useEffect(() => {
    gameIdRef.current = gameState?.id ?? null;
  }, [gameState?.id]);

  const phase = gameState?.phase ?? null;
  const amAnswering = gameState?.active_answerer === mySid;

  const handleTimedOut = useCallback(() => {
    if (!hasTimedOutRef.current && gameIdRef.current) {
      hasTimedOutRef.current = true;
      // Submit empty answer to trigger wrong answer / buzzer reopen
      emit("submit_answer", { game_id: gameIdRef.current, answer: "" });
    }
  }, [emit]);

  // Start/stop countdown when it's the player's turn to answer
  useEffect(() => {
    const isAnsweringNow = phase === "answering" && amAnswering;

    if (isAnsweringNow) {
      // Reset and start timer
      hasTimedOutRef.current = false;
      setTimeLeft(ANSWER_TIMEOUT_SEC);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            handleTimedOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear timer when no longer answering
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeLeft(ANSWER_TIMEOUT_SEC);
      hasTimedOutRef.current = false;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, amAnswering, handleTimedOut]);

  // If not in a game yet, show join screen
  if (!myPlayer || !gameState) {
    return <JoinView />;
  }

  const amEliminated =
    mySid != null && gameState.eliminated_this_question.includes(mySid);
  const question = gameState.current_question;

  // LOBBY
  if (phase === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            {myPlayer.avatar_emoji ? (
              <span className="text-5xl" aria-hidden>
                {myPlayer.avatar_emoji}
              </span>
            ) : null}
            <div
              className="w-16 h-16 rounded-full shrink-0"
              style={{ backgroundColor: myPlayer.color }}
            />
          </div>
          <h2 className="text-2xl font-bold">{myPlayer.pseudo}</h2>
          <p className="text-neutral-400 mt-2">
            Partie{" "}
            <span className="text-brand-orange font-bold">{gameState.id}</span>
          </p>
          <div className="mt-6 text-neutral-500">
            <div className="animate-pulse-slow text-4xl mb-2">⏳</div>
            <p>En attente du lancement...</p>
            <p className="text-sm mt-2">
              {Object.keys(gameState.players).length} joueur(s) connecté(s)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "memory_preview") {
    const totalLeft = Math.max(
      0,
      Math.ceil(
        (gameState.memory_preview?.started_at ?? Date.now() / 1000) +
          (gameState.memory_preview?.countdown_seconds ?? 5) +
          (gameState.memory_preview?.show_seconds ?? 30) -
          Date.now() / 1000
      )
    );
    return (
      <WaitingScreen
        message={`Regarde l'image sur la TV (${totalLeft}s)`}
        emoji="👁️"
      />
    );
  }

  // MODULE INTRO
  if (phase === "module_intro") {
    const mod = gameState.current_module;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-bounce-in">
        <div className="text-6xl mb-4">{mod ? MODULE_ICONS[mod] : "🎮"}</div>
        <h1 className="text-3xl font-black text-center">
          {mod ? MODULE_LABELS[mod] : "Prochain module"}
        </h1>
        <p className="text-neutral-400 mt-2">Prépare-toi !</p>
      </div>
    );
  }

  // BUZZER OPEN — show buzzer
  if (phase === "buzzer_open") {
    if (amEliminated) {
      return (
        <WaitingScreen
          message="Tu es éliminé pour cette question"
          emoji="😵"
        />
      );
    }

    return (
      <div className="min-h-screen flex flex-col p-4">
        {/* Question preview */}
        {question && (
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className={`badge-${question.difficulty}`}>
                {question.points}pt{question.points > 1 ? "s" : ""}
              </span>
              <span className="text-sm text-neutral-400">
                Q{gameState.current_question_index + 1}/
                {gameState.total_questions}
              </span>
            </div>
            <p className="font-semibold text-lg">{question.text}</p>
          </div>
        )}

        {/* Buzzer */}
        <div className="flex-1 flex items-center justify-center">
          <Buzzer
            onBuzz={() => emit("buzz", { game_id: gameState.id })}
            disabled={amEliminated}
          />
        </div>
      </div>
    );
  }

  // ANSWERING
  if (phase === "answering") {
    if (amAnswering && question) {
      // Progress bar width: goes from 100% to 0% over ANSWER_TIMEOUT_SEC seconds
      const progressPct = (timeLeft / ANSWER_TIMEOUT_SEC) * 100;
      const isUrgent = timeLeft <= 1;

      return (
        <div className="min-h-screen flex flex-col p-4">
          {/* Timer bar */}
          <div className="w-full h-2 bg-neutral-800 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                isUrgent ? "bg-red-500" : "bg-brand-orange"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Timer countdown */}
          <div className="text-center mb-2">
            <span
              className={`text-4xl font-black ${
                isUrgent ? "text-red-500 animate-pulse" : "text-brand-orange"
              }`}
            >
              {timeLeft}
            </span>
          </div>

          <div className="card mb-4">
            <p className="font-semibold text-lg">{question.text}</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <AnswerInput
              question={question}
              onSubmit={(answer) => {
                // Clear timer on manual submit
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                }
                hasTimedOutRef.current = true;
                emit("submit_answer", { game_id: gameState.id, answer });
              }}
            />
          </div>
        </div>
      );
    }

    if (amEliminated) {
      return (
        <WaitingScreen message="Tu es éliminé pour cette question" emoji="😵" />
      );
    }

    const answererPseudo =
      gameState.active_answerer &&
      gameState.players[gameState.active_answerer]?.pseudo;

    return (
      <WaitingScreen
        message={`${answererPseudo ?? "Quelqu'un"} est en train de répondre...`}
        emoji="👀"
      />
    );
  }

  // QUESTION RESULT
  if (phase === "question_result") {
    const myScore =
      mySid && gameState.players[mySid] ? gameState.players[mySid].score : 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center animate-slide-up">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-2">Résultat</h2>
          {question && question.correct_answer && (
            <p className="text-neutral-400 mb-4">
              Réponse :{" "}
              <span className="text-green-400 font-bold">
                {question.correct_answer}
              </span>
            </p>
          )}
          <div className="text-4xl font-black text-brand-orange">
            {myScore} pts
          </div>
          <p className="text-neutral-500 mt-4">
            En attente de la prochaine question...
          </p>
        </div>
      </div>
    );
  }

  // MODULE RESULT
  if (phase === "module_result") {
    const myRank = mySid
      ? gameState.scores.findIndex((s) => s.sid === mySid) + 1
      : 0;
    const myScore =
      mySid && gameState.players[mySid] ? gameState.players[mySid].score : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-bounce-in">
        <div className="text-6xl mb-4">
          {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "📊"}
        </div>
        <h2 className="text-3xl font-black">#{myRank}</h2>
        <div className="text-2xl font-bold text-brand-orange mt-2">
          {myScore} pts
        </div>
        <p className="text-neutral-500 mt-4">Prochain module bientôt...</p>
      </div>
    );
  }

  // FINAL RESULTS
  if (phase === "final_results") {
    const myRank = mySid
      ? gameState.scores.findIndex((s) => s.sid === mySid) + 1
      : 0;
    const myScore =
      mySid && gameState.players[mySid] ? gameState.players[mySid].score : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-bounce-in">
        <div className="text-8xl mb-4">
          {myRank === 1 ? "🏆" : myRank <= 3 ? "🎉" : "👏"}
        </div>
        <h1 className="text-4xl font-black">
          {myRank === 1 ? "VICTOIRE !" : `#${myRank}`}
        </h1>
        <div className="text-3xl font-bold text-brand-orange mt-4">
          {myScore} pts
        </div>
        <p className="text-neutral-400 mt-6">Merci d'avoir joué ! 🎮</p>
      </div>
    );
  }

  // DILEMME PHASES
  if (
    (phase === "dilemme_submit" || phase === "dilemme_vote" || phase === "dilemme_vote_result") &&
    gameState.dilemme
  ) {
    return (
      <DilemmeInput
        dilemme={gameState.dilemme}
        phase={phase}
        mySid={mySid}
        onSubmit={(text) =>
          emit("submit_dilemme", { game_id: gameState.id, text })
        }
        onVote={(vote) =>
          emit("vote_dilemme", { game_id: gameState.id, vote })
        }
      />
    );
  }

  // TIEBREAKER
  if (phase === "tiebreaker") {
    const amInTiebreaker =
      mySid != null && mySid in gameState.tiebreaker_scores;

    if (!amInTiebreaker) {
      return <WaitingScreen message="Départage en cours..." emoji="⚡" />;
    }

    if (amAnswering && question) {
      const progressPct = (timeLeft / ANSWER_TIMEOUT_SEC) * 100;
      const isUrgent = timeLeft <= 1;

      return (
        <div className="min-h-screen flex flex-col p-4">
          {/* Timer bar */}
          <div className="w-full h-2 bg-neutral-800 rounded-full mb-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                isUrgent ? "bg-red-500" : "bg-brand-orange"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="text-center mb-2">
            <span className="text-brand-orange font-bold text-lg">
              ⚡ DÉPARTAGE
            </span>
            <span
              className={`ml-4 text-3xl font-black ${
                isUrgent ? "text-red-500 animate-pulse" : "text-brand-orange"
              }`}
            >
              {timeLeft}
            </span>
          </div>

          <div className="card mb-4">
            <p className="font-semibold text-lg">{question.text}</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <AnswerInput
              question={question}
              onSubmit={(answer) => {
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                }
                hasTimedOutRef.current = true;
                emit("submit_answer", { game_id: gameState.id, answer });
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-4xl animate-pulse-slow mb-4">⚡</div>
        <Buzzer
          onBuzz={() => emit("buzz", { game_id: gameState.id })}
          disabled={amEliminated}
        />
      </div>
    );
  }

  return <WaitingScreen message="Chargement..." emoji="⏳" />;
}
