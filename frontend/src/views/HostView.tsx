import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";
import GameSetup from "../components/host/GameSetup";
import QuestionControl from "../components/host/QuestionControl";
import ScoreManager from "../components/host/ScoreManager";
import Logo from "../components/shared/Logo";
import { MODULE_LABELS, MODULE_ICONS } from "../types";

export default function HostView() {
  const { emit } = useSocket();
  const { gameId, gameState, joinUrl, presets } = useGameStore();

  // Not yet hosting
  if (!gameId || !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Logo size="md" />
        <p className="text-neutral-400 mt-4 mb-8">Panneau Host</p>
        <button
          onClick={() => emit("host_create_game")}
          className="btn-primary text-xl px-10 py-4"
        >
          Créer une partie 🎮
        </button>
      </div>
    );
  }

  const phase = gameState.phase;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black">
            Top<span className="text-brand-orange">Quizz</span>{" "}
            <span className="text-neutral-500 text-lg">HOST</span>
          </h1>
          <p className="text-sm text-neutral-400">
            Code :{" "}
            <span className="text-brand-orange font-bold text-lg">
              {gameState.id}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-400">
            {Object.keys(gameState.players).length} joueur(s)
          </div>
          <div className="text-xs text-neutral-500">{phase}</div>
        </div>
      </div>

      {/* LOBBY */}
      {phase === "lobby" && (
        <GameSetup
          gameId={gameState.id}
          presets={presets}
          players={gameState.players}
          joinUrl={joinUrl ?? ""}
          onStart={(config) =>
            emit("host_start_game", { game_id: gameState.id, ...config })
          }
        />
      )}

      {/* MODULE INTRO */}
      {phase === "module_intro" && (
        <div className="card text-center">
          <div className="text-6xl mb-4">
            {gameState.current_module
              ? MODULE_ICONS[gameState.current_module]
              : "🎮"}
          </div>
          <h2 className="text-3xl font-black mb-4">
            {gameState.current_module
              ? MODULE_LABELS[gameState.current_module]
              : "Module"}
          </h2>
          <p className="text-neutral-400 mb-6">
            {gameState.total_questions} questions — Module{" "}
            {gameState.current_module_index + 1}/{gameState.total_modules}
          </p>
          <button
            onClick={() =>
              emit("host_next_question", { game_id: gameState.id })
            }
            className="btn-primary text-xl px-8"
          >
            Lancer la première question ▶️
          </button>
        </div>
      )}

      {/* PLAYING — Question control */}
      {(phase === "buzzer_open" ||
        phase === "answering" ||
        phase === "question_result" ||
        phase === "tiebreaker") && (
        <QuestionControl
          gameState={gameState}
          onNextQuestion={() =>
            emit("host_next_question", { game_id: gameState.id })
          }
          onSkip={() =>
            emit("host_skip_question", { game_id: gameState.id })
          }
          onReduceBlur={() =>
            emit("host_reduce_blur", { game_id: gameState.id })
          }
        />
      )}

      {/* MODULE RESULT */}
      {phase === "module_result" && (
        <div className="space-y-6">
          <div className="card text-center">
            <h2 className="text-2xl font-bold mb-4">Module terminé !</h2>
            <div className="space-y-2 mb-6">
              {gameState.scores.slice(0, 5).map((s, i) => (
                <div
                  key={s.sid}
                  className="flex items-center justify-between px-4 py-2 rounded-lg bg-surface-light"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-neutral-400">
                      #{i + 1}
                    </span>
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-semibold">{s.pseudo}</span>
                  </div>
                  <span className="text-brand-orange font-bold">
                    {s.score}pts
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                emit("host_next_module", { game_id: gameState.id })
              }
              className="btn-primary text-lg px-8"
            >
              Module suivant ▶️
            </button>
          </div>
          <ScoreManager
            gameId={gameState.id}
            players={gameState.players}
            scores={gameState.scores}
            emit={emit}
          />
        </div>
      )}

      {/* FINAL RESULTS */}
      {phase === "final_results" && (
        <div className="card text-center">
          <h2 className="text-4xl font-black mb-8">🏆 Partie terminée !</h2>
          <div className="space-y-3 mb-8">
            {gameState.scores.map((s, i) => (
              <div
                key={s.sid}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  i === 0
                    ? "bg-brand-orange/20 border border-brand-orange"
                    : "bg-surface-light"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-bold text-lg">{s.pseudo}</span>
                </div>
                <span className="text-brand-orange font-black text-xl">
                  {s.score}pts
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              useGameStore.getState().reset();
              window.location.reload();
            }}
            className="btn-secondary"
          >
            Nouvelle partie
          </button>
        </div>
      )}
    </div>
  );
}
