import { useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";
import GameSetup from "../components/host/GameSetup";
import QuestionControl from "../components/host/QuestionControl";
import ScoreManager from "../components/host/ScoreManager";
import Logo from "../components/shared/Logo";
import Spinner from "../components/shared/Spinner";
import { MODULE_LABELS, MODULE_ICONS, DILEMME_SUB_MODE_LABELS } from "../types";

export default function HostView() {
  const { emit } = useSocket();
  const { gameId, gameState, joinUrl, presets, connected } = useGameStore();
  const [creatingGame, setCreatingGame] = useState(false);
  const [loadingNextModule, setLoadingNextModule] = useState(false);

  const phase = gameState?.phase ?? null;
  useEffect(() => {
    useGameStore.setState({ role: "host" });
  }, []);
  useEffect(() => {
    if (phase !== "module_result") {
      setLoadingNextModule(false);
    }
  }, [phase]);

  // Not yet hosting
  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Logo size="md" />
        <p className="text-neutral-400 mt-4 mb-8">Panneau Host</p>

        {!connected && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 flex items-center gap-2">
            <span>⚠️ Déconnecté du serveur</span>
          </div>
        )}

        <button
          onClick={() => {
            setCreatingGame(true);
            emit("host_create_game");
            setTimeout(() => setCreatingGame(false), 5000);
          }}
          disabled={!connected || creatingGame}
          className={`btn-primary text-xl px-10 py-4 flex items-center gap-3 ${
            !connected || creatingGame ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {creatingGame ? (
            <>
              <Spinner />
              <span>Création en cours...</span>
            </>
          ) : (
            "Créer une partie 🎮"
          )}
        </button>
      </div>
    );
  }

  const hasNextModule =
    gameState.current_module_index + 1 < gameState.total_modules;

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
        <div className="text-right flex items-center gap-3">
          <button
            onClick={() => {
              const ok = window.confirm(
                "Annuler la partie en cours et retourner à l'accueil ?"
              );
              if (!ok) return;
              emit("host_cancel_game", { game_id: gameState.id });
            }}
            className="btn-secondary border-red-500/50 text-red-300 hover:bg-red-500/10"
          >
            Annuler la game
          </button>
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

      {phase === "memory_preview" && (
        <div className="card text-center">
          <div className="text-6xl mb-4">👁️</div>
          <h2 className="text-3xl font-black mb-4">TopMémoire</h2>
          <p className="text-neutral-400 mb-2">
            Observation en cours sur la TV
          </p>
          <p className="text-neutral-500">
            {Math.max(
              0,
              Math.ceil(
                (gameState.memory_preview?.started_at ?? Date.now() / 1000) +
                  (gameState.memory_preview?.countdown_seconds ?? 5) +
                  (gameState.memory_preview?.show_seconds ?? 30) -
                  Date.now() / 1000
              )
            )}
            s restantes
          </p>
        </div>
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
            {gameState.current_module === "dilemme_parfait"
              ? `${gameState.dilemme?.total_rounds ?? 0} manches`
              : gameState.current_module === "ttmc"
              ? `${gameState.ttmc?.total_rounds ?? 0} rounds`
              : `${gameState.total_questions} questions`}
            {" — Module "}
            {gameState.current_module_index + 1}/{gameState.total_modules}
          </p>
          {gameState.current_module === "dilemme_parfait" ? (
            <button
              onClick={() =>
                emit("host_next_dilemme", { game_id: gameState.id })
              }
              className="btn-primary text-xl px-8"
            >
              Lancer le premier dilemme ▶️
            </button>
          ) : gameState.current_module === "ttmc" ? (
            <button
              onClick={() =>
                emit("host_next_ttmc_round", { game_id: gameState.id })
              }
              className="btn-primary text-xl px-8"
            >
              Lancer le premier round TTMC ▶️
            </button>
          ) : (
            <button
              onClick={() =>
                emit("host_next_question", { game_id: gameState.id })
              }
              className="btn-primary text-xl px-8"
            >
              Lancer la première question ▶️
            </button>
          )}
        </div>
      )}

      {/* TTMC — PICKING phase */}
      {phase === "ttmc_picking" && gameState.ttmc && (
        <div className="card text-center space-y-4">
          <div className="text-5xl">🎯</div>
          <h2 className="text-2xl font-black">Tu te mets combien ?</h2>
          <p className="text-brand-orange font-bold text-lg">{gameState.ttmc.theme}</p>
          <p className="text-neutral-400">
            Round {gameState.ttmc.round_index + 1}/{gameState.ttmc.total_rounds}
          </p>
          <div className="text-4xl font-black">
            {gameState.ttmc.picks_count}
            <span className="text-neutral-500 text-2xl">
              /{Object.keys(gameState.players).length}
            </span>
          </div>
          <p className="text-neutral-500 text-sm">joueur(s) ont choisi leur niveau</p>
          <button
            onClick={() => emit("host_force_ttmc_reveal", { game_id: gameState.id })}
            disabled={gameState.ttmc.picks_count === 0}
            className="btn-secondary"
          >
            Forcer la révélation des questions
          </button>
        </div>
      )}

      {/* TTMC — ANSWERING phase */}
      {phase === "ttmc_answering" && gameState.ttmc && (
        <div className="card text-center space-y-4">
          <div className="text-5xl">⏳</div>
          <h2 className="text-2xl font-black">Les joueurs répondent</h2>
          <p className="text-neutral-400 text-sm">Chaque joueur a sa propre question</p>
          <div className="text-4xl font-black">
            {gameState.ttmc.answers_count}
            <span className="text-neutral-500 text-2xl">
              /{Object.keys(gameState.players).length}
            </span>
          </div>
          <p className="text-neutral-500 text-sm">réponse(s) reçue(s)</p>
          <button
            onClick={() => emit("host_force_ttmc_results", { game_id: gameState.id })}
            className="btn-secondary"
          >
            Afficher les résultats maintenant
          </button>
        </div>
      )}

      {/* TTMC — RESULT phase */}
      {phase === "ttmc_result" && gameState.ttmc && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="text-xl font-black text-center">Résultats du round</h2>
            <p className="text-neutral-400 text-sm text-center">{gameState.ttmc.theme}</p>
            {(gameState.ttmc.results ?? []).map((r) => (
              <div
                key={r.sid}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  r.is_correct ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{r.is_correct ? "✅" : "❌"}</span>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{r.pseudo} <span className="text-neutral-500 font-normal text-xs">niv.{r.level}</span></p>
                    <p className="text-xs text-neutral-500 truncate">
                      {r.answer || "—"}{!r.is_correct && r.correct_answer ? ` → ${r.correct_answer}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-brand-orange font-bold ml-2">+{r.points}pts</span>
              </div>
            ))}
          </div>
          {gameState.ttmc.round_index + 1 < gameState.ttmc.total_rounds ? (
            <button
              onClick={() => emit("host_next_ttmc_round", { game_id: gameState.id })}
              className="btn-primary w-full text-lg"
            >
              Round suivant ▶️
            </button>
          ) : (
            <button
              onClick={() => {
                setLoadingNextModule(true);
                emit("host_next_module", { game_id: gameState.id });
                setTimeout(() => setLoadingNextModule(false), 8000);
              }}
              disabled={loadingNextModule}
              className="btn-primary w-full text-lg"
            >
              {loadingNextModule ? "Chargement..." : hasNextModule ? "Module suivant ▶️" : "Résultats finaux ▶️"}
            </button>
          )}
        </div>
      )}

      {/* DILEMME PARFAIT controls */}
      {phase === "dilemme_submit" && gameState.dilemme && (
        <div className="card text-center">
          <div className="text-4xl mb-4">⚖️</div>
          <h2 className="text-2xl font-bold mb-2">
            {DILEMME_SUB_MODE_LABELS[gameState.dilemme.sub_mode]}
          </h2>
          <p className="text-neutral-400 mb-4">
            Manche {gameState.dilemme.round_index + 1}/{gameState.dilemme.total_rounds}
          </p>
          <p className="text-lg mb-4">
            {gameState.dilemme.submissions.length} soumission(s) reçue(s)
          </p>
          <button
            onClick={() =>
              emit("host_force_dilemme_vote", { game_id: gameState.id })
            }
            disabled={gameState.dilemme.submissions.length === 0}
            className="btn-secondary"
          >
            Forcer le passage au vote
          </button>
        </div>
      )}

      {phase === "dilemme_vote" && gameState.dilemme && (
        <div className="card text-center">
          <div className="text-4xl mb-4">🗳️</div>
          <h2 className="text-2xl font-bold mb-2">Vote en cours</h2>
          <p className="text-neutral-400">
            Dilemme de {gameState.dilemme.submissions[gameState.dilemme.current_submission_index]?.pseudo}
          </p>
          <p className="text-lg text-neutral-300 mt-2">
            {Object.keys(gameState.dilemme.votes).length} vote(s) reçu(s)
          </p>
        </div>
      )}

      {phase === "dilemme_vote_result" && gameState.dilemme && (
        <div className="card text-center space-y-4">
          <h2 className="text-2xl font-bold">Résultat du vote</h2>
          {(() => {
            const sub = gameState.dilemme.submissions[gameState.dilemme.current_submission_index];
            const isLast = gameState.dilemme.current_submission_index >= gameState.dilemme.submissions.length - 1;
            return (
              <>
                <p className="text-lg">
                  {sub?.pseudo}: <span className="font-bold">{sub?.text}</span>
                </p>
                <p className="text-brand-orange text-xl font-black">
                  +{sub?.points ?? 0} pts ({sub?.yes_pct?.toFixed(0)}% OUI)
                </p>
                {isLast ? (
                  <button
                    onClick={() =>
                      emit("host_next_dilemme", { game_id: gameState.id })
                    }
                    className="btn-primary"
                  >
                    Manche suivante ▶️
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      emit("host_next_dilemme_submission", { game_id: gameState.id })
                    }
                    className="btn-primary"
                  >
                    Dilemme suivant ▶️
                  </button>
                )}
              </>
            );
          })()}
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
            onClick={() => {
              setLoadingNextModule(true);
              emit("host_next_module", { game_id: gameState.id });
              setTimeout(() => setLoadingNextModule(false), 8000);
            }}
            disabled={loadingNextModule}
            className="btn-primary text-lg px-8 flex items-center justify-center"
          >
            {loadingNextModule ? (
              <><Spinner /> <span className="ml-3">Chargement...</span></>
            ) : (
              hasNextModule ? "Module suivant ▶️" : "Résultats finaux ▶️"
            )}
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
