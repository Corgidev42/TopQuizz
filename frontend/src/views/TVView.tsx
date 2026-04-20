import { useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";
import QRCodeDisplay from "../components/tv/QRCodeDisplay";
import QuestionDisplay from "../components/tv/QuestionDisplay";
import Scoreboard from "../components/tv/Scoreboard";
import PlayerList from "../components/tv/PlayerList";
import DilemmeDisplay from "../components/tv/DilemmeDisplay";
import Logo from "../components/shared/Logo";
import { MODULE_LABELS, MODULE_ICONS } from "../types";
import MemoryPreview from "../components/tv/MemoryPreview";

export default function TVView() {
  const { emit } = useSocket();
  const { gameId, gameState, joinUrl } = useGameStore();

  useEffect(() => {
    useGameStore.setState({ role: "tv" });
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

  if (phase === "memory_preview") {
    return (
      <MemoryPreview
        data={
          gameState.memory_preview ?? {
            started_at: Date.now() / 1000,
            countdown_seconds: 5,
            show_seconds: 30,
          }
        }
      />
    );
  }

  // DILEMME PHASES
  if (
    (phase === "dilemme_submit" || phase === "dilemme_vote" || phase === "dilemme_vote_result") &&
    gameState.dilemme
  ) {
    return (
      <DilemmeDisplay
        dilemme={gameState.dilemme}
        phase={phase}
        scores={gameState.scores}
      />
    );
  }

  // MODULE INTRO
  if (phase === "module_intro") {
    const mod = gameState.current_module;
    const isDilemme = mod === "dilemme_parfait";
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _isTTMC = mod === "ttmc";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center animate-bounce-in">
        <div className="text-8xl mb-6">{mod ? MODULE_ICONS[mod] : "🎮"}</div>
        <h1 className="text-5xl font-black">
          {mod ? MODULE_LABELS[mod] : "Module"}
        </h1>
        <p className="text-neutral-400 text-2xl mt-4">
          {gameState.current_module_index + 1} / {gameState.total_modules}
        </p>
        {!isDilemme && mod !== "ttmc" && (
          <p className="text-neutral-500 mt-2">
            {gameState.total_questions} questions
          </p>
        )}
        {isDilemme && gameState.dilemme && (
          <p className="text-neutral-500 mt-2">
            {gameState.dilemme.total_rounds} manches
          </p>
        )}
        {mod === "ttmc" && gameState.ttmc && (
          <p className="text-neutral-500 mt-2">
            {gameState.ttmc.total_rounds} rounds
          </p>
        )}
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
                {s.avatar_emoji ? (
                  <span className="text-lg leading-none">{s.avatar_emoji}</span>
                ) : null}
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

  // TTMC PHASES
  if (phase === "ttmc_picking" && gameState.ttmc) {
    const ttmc = gameState.ttmc;
    const totalPlayers = Object.values(gameState.players).filter((p) => p.is_connected).length;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 animate-bounce-in">
        <div className="text-8xl mb-6">🎯</div>
        <h1 className="text-5xl font-black mb-3">Tu te mets combien ?</h1>
        {ttmc.theme && (
          <p className="text-brand-orange text-3xl font-bold mb-8 text-center">{ttmc.theme}</p>
        )}
        <p className="text-neutral-400 text-2xl mb-4">
          Round {ttmc.round_index + 1}/{ttmc.total_rounds}
        </p>
        <div className="text-8xl font-black text-brand-orange mt-4">
          {ttmc.picks_count}
          <span className="text-neutral-500 text-5xl">/{totalPlayers}</span>
        </div>
        <p className="text-neutral-400 text-xl mt-4">joueur(s) ont choisi</p>
      </div>
    );
  }

  if (phase === "ttmc_answering" && gameState.ttmc) {
    const ttmc = gameState.ttmc;
    const totalPlayers = Object.values(gameState.players).filter((p) => p.is_connected).length;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-7xl mb-6 animate-pulse-slow">⏳</div>
        <h1 className="text-4xl font-black mb-2">Chaque joueur répond</h1>
        <p className="text-neutral-400 text-xl mb-8">{ttmc.theme}</p>
        <div className="text-8xl font-black text-brand-orange">
          {ttmc.answers_count}
          <span className="text-neutral-500 text-5xl">/{totalPlayers}</span>
        </div>
        <p className="text-neutral-400 text-xl mt-4">réponse(s) reçue(s)</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {gameState.scores.map((s) => (
            <div key={s.sid} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
              ttmc.answers_count > 0 && Object.values(gameState.players).find(p => p === gameState.players[s.sid])
                ? "border border-green-500/30 bg-green-500/10"
                : "border border-neutral-700 bg-surface-light"
            }`}>
              {s.avatar_emoji && <span className="text-lg">{s.avatar_emoji}</span>}
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-semibold">{s.pseudo}</span>
              <span className="text-brand-orange">{s.score}pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "ttmc_result" && gameState.ttmc) {
    const ttmc = gameState.ttmc;
    const results = ttmc.results ?? [];
    return (
      <div className="min-h-screen flex flex-col items-center p-8">
        <h1 className="text-4xl font-black mb-2 mt-4">Résultats du round</h1>
        <p className="text-brand-orange text-xl mb-8">{ttmc.theme}</p>
        <div className="w-full max-w-3xl space-y-4">
          {results.map((r) => (
            <div
              key={r.sid}
              className={`flex items-start gap-4 p-4 rounded-2xl border ${
                r.is_correct ? "border-green-500/40 bg-green-500/10" : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <span className="text-3xl">{r.is_correct ? "✅" : "❌"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="font-black text-lg">{r.pseudo}</span>
                  <span className="text-neutral-500 text-sm">niveau {r.level}/10</span>
                </div>
                <p className="text-neutral-300 text-sm mb-1">{r.question_text}</p>
                <p className="text-sm">
                  <span className="text-neutral-500">Réponse : </span>
                  <span className={r.is_correct ? "text-green-400 font-bold" : "text-red-400"}>
                    {r.answer || "—"}
                  </span>
                  {!r.is_correct && r.correct_answer && (
                    <span className="text-neutral-400"> → <span className="text-white">{r.correct_answer}</span></span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-brand-orange font-black text-2xl">+{r.points}pts</div>
                <div className="text-neutral-400 text-sm">{r.score} total</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 w-full max-w-3xl">
          <Scoreboard scores={gameState.scores} />
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
