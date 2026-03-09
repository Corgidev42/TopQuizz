import { useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";
import QRCodeDisplay from "../components/tv/QRCodeDisplay";
import QuestionDisplay from "../components/tv/QuestionDisplay";
import Scoreboard from "../components/tv/Scoreboard";
import PlayerList from "../components/tv/PlayerList";
import Logo from "../components/shared/Logo";
import { MODULE_LABELS, MODULE_ICONS } from "../types";

export default function TVView() {
  const { emit } = useSocket();
  const { gameId, gameState, joinUrl } = useGameStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gid = params.get("game");
    if (gid) {
      emit("tv_join", { game_id: gid.toUpperCase() });
    }
  }, []);

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Logo size="lg" />
        <p className="text-neutral-400 mt-4 text-xl">
          En attente de connexion...
        </p>
        <p className="text-neutral-500 mt-2">
          Ajoute <span className="text-brand-orange">?game=CODE</span> à l'URL
          ou connecte-toi depuis le Host
        </p>
      </div>
    );
  }

  const phase = gameState.phase;

  // LOBBY
  if (phase === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Logo size="lg" />
        <div className="mt-8 flex flex-col md:flex-row gap-12 items-center">
          <QRCodeDisplay url={joinUrl ?? ""} gameId={gameState.id} />
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Joueurs connectés ({Object.keys(gameState.players).length})
            </h2>
            <PlayerList players={gameState.players} />
          </div>
        </div>
      </div>
    );
  }

  // MODULE INTRO
  if (phase === "module_intro") {
    const mod = gameState.current_module;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center animate-bounce-in">
        <div className="text-8xl mb-6">{mod ? MODULE_ICONS[mod] : "🎮"}</div>
        <h1 className="text-5xl font-black">
          {mod ? MODULE_LABELS[mod] : "Module"}
        </h1>
        <p className="text-neutral-400 text-2xl mt-4">
          {gameState.current_module_index + 1} / {gameState.total_modules}
        </p>
        <p className="text-neutral-500 mt-2">
          {gameState.total_questions} questions
        </p>
      </div>
    );
  }

  // QUESTION / BUZZER / ANSWERING
  if (
    phase === "buzzer_open" ||
    phase === "answering" ||
    phase === "question_result"
  ) {
    return (
      <div className="min-h-screen flex flex-col p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-neutral-400">
            {gameState.current_module &&
              MODULE_ICONS[gameState.current_module]}{" "}
            {gameState.current_module &&
              MODULE_LABELS[gameState.current_module]}
          </div>
          <div className="text-sm text-neutral-400">
            Question {gameState.current_question_index + 1}/
            {gameState.total_questions}
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <QuestionDisplay
            question={gameState.current_question}
            phase={phase}
            activeAnswerer={gameState.active_answerer}
            players={gameState.players}
            commuRevealed={gameState.commu_revealed}
          />
        </div>

        {/* Bottom: mini scoreboard */}
        <div className="mt-4">
          <div className="flex flex-wrap justify-center gap-3">
            {gameState.scores.map((s) => (
              <div
                key={s.sid}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  gameState.eliminated_this_question.includes(s.sid)
                    ? "opacity-30"
                    : ""
                } ${gameState.active_answerer === s.sid ? "ring-2 ring-brand-orange" : ""}`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-semibold">{s.pseudo}</span>
                <span className="text-brand-orange font-bold">{s.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // MODULE RESULT
  if (phase === "module_result") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-black mb-8">Résultats du module</h1>
        <Scoreboard scores={gameState.scores} />
      </div>
    );
  }

  // TIEBREAKER
  if (phase === "tiebreaker") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-4 animate-pulse-slow">⚡</div>
        <h1 className="text-4xl font-black text-brand-orange mb-4">
          ÉGALITÉ — Départage !
        </h1>
        <p className="text-neutral-400 mb-8 text-xl">
          10 questions rapides. Le plus de bonnes réponses gagne.
        </p>
        {gameState.current_question && (
          <QuestionDisplay
            question={gameState.current_question}
            phase={phase}
            activeAnswerer={gameState.active_answerer}
            players={gameState.players}
            commuRevealed={[]}
          />
        )}
        <div className="mt-8">
          <div className="flex gap-6">
            {Object.entries(gameState.tiebreaker_scores).map(([sid, sc]) => (
              <div key={sid} className="text-center">
                <div
                  className="w-4 h-4 rounded-full mx-auto mb-1"
                  style={{
                    backgroundColor:
                      gameState.players[sid]?.color ?? "#888",
                  }}
                />
                <div className="font-semibold">
                  {gameState.players[sid]?.pseudo}
                </div>
                <div className="text-3xl font-black text-brand-orange">
                  {sc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // FINAL RESULTS
  if (phase === "final_results") {
    const top3 = gameState.scores.slice(0, 3);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-5xl font-black mb-2 animate-bounce-in">
          🏆 Résultats Finaux
        </h1>

        {/* Podium */}
        <div className="flex items-end gap-8 mt-12 mb-12">
          {top3[1] && (
            <div className="text-center animate-slide-up">
              <div className="text-4xl mb-2">🥈</div>
              <div
                className="w-20 h-20 rounded-full mx-auto mb-2"
                style={{ backgroundColor: top3[1].color }}
              />
              <div className="font-bold text-lg">{top3[1].pseudo}</div>
              <div className="text-2xl font-black text-neutral-300">
                {top3[1].score}pts
              </div>
            </div>
          )}
          {top3[0] && (
            <div className="text-center animate-bounce-in">
              <div className="text-6xl mb-2">🥇</div>
              <div
                className="w-28 h-28 rounded-full mx-auto mb-2 ring-4 ring-brand-orange"
                style={{ backgroundColor: top3[0].color }}
              />
              <div className="font-black text-2xl">{top3[0].pseudo}</div>
              <div className="text-4xl font-black text-brand-orange">
                {top3[0].score}pts
              </div>
            </div>
          )}
          {top3[2] && (
            <div className="text-center animate-slide-up">
              <div className="text-4xl mb-2">🥉</div>
              <div
                className="w-16 h-16 rounded-full mx-auto mb-2"
                style={{ backgroundColor: top3[2].color }}
              />
              <div className="font-bold">{top3[2].pseudo}</div>
              <div className="text-xl font-black text-neutral-400">
                {top3[2].score}pts
              </div>
            </div>
          )}
        </div>

        {/* Full scoreboard */}
        <Scoreboard scores={gameState.scores} />
      </div>
    );
  }

  // Default fallback
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="md" />
    </div>
  );
}
