import type { GameState } from "../../types";
import { MODULE_LABELS, MODULE_ICONS, DIFFICULTY_LABELS } from "../../types";

interface Props {
  gameState: GameState;
  onNextQuestion: () => void;
  onSkip: () => void;
  onReduceBlur: () => void;
}

export default function QuestionControl({
  gameState,
  onNextQuestion,
  onSkip,
  onReduceBlur,
}: Props) {
  const q = gameState.current_question;
  const phase = gameState.phase;
  const isFace = q?.module_type === "master_face";
  const isCommu = q?.module_type === "master_commu";
  const commuAnswers =
    isCommu && q?.extra_data?.answers
      ? (q.extra_data.answers as Array<{ answer: string; score: number }>)
      : null;

  return (
    <div className="space-y-4">
      {/* Current question info */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-neutral-400">
            {gameState.current_module &&
              `${MODULE_ICONS[gameState.current_module]} ${MODULE_LABELS[gameState.current_module]}`}
          </span>
          <span className="text-sm text-neutral-400">
            Q{gameState.current_question_index + 1}/{gameState.total_questions}
          </span>
        </div>

        {q && (
          <>
            <p className="font-bold text-lg mb-2">{q.text}</p>
            <div className="flex gap-2 mb-3">
              <span className={`badge-${q.difficulty}`}>
                {DIFFICULTY_LABELS[q.difficulty]}
              </span>
              <span className="badge bg-brand-orange/20 text-brand-orange">
                {q.points}pt{q.points > 1 ? "s" : ""}
              </span>
            </div>
            {isCommu ? (
              <div className="text-sm text-neutral-400">
                Réponses possibles ({commuAnswers?.length ?? 0})
              </div>
            ) : (
              <div className="text-sm text-neutral-400">
                Bonne réponse :{" "}
                <span className="text-green-400 font-semibold">
                  {q.correct_answer}
                </span>
              </div>
            )}
          </>
        )}

        {/* Phase indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              phase === "buzzer_open"
                ? "bg-green-500 animate-pulse"
                : phase === "answering"
                  ? "bg-yellow-500 animate-pulse"
                  : phase === "question_result"
                    ? "bg-blue-500"
                    : "bg-neutral-500"
            }`}
          />
          <span className="text-sm text-neutral-400">
            {phase === "buzzer_open"
              ? "Buzzer ouvert — en attente..."
              : phase === "answering"
                ? `${gameState.active_answerer && gameState.players[gameState.active_answerer]?.pseudo} répond...`
                : phase === "question_result"
                  ? "Résultat affiché"
                  : phase}
          </span>
        </div>
      </div>

      {isCommu && commuAnswers && (
        <div className="card">
          <h3 className="text-sm text-neutral-400 font-semibold mb-3">
            Réponses possibles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {commuAnswers.map((a, i) => (
              <div
                key={`${a.answer}-${i}`}
                className="flex items-center justify-between px-4 py-2 rounded-lg bg-surface-light"
              >
                <span className="font-semibold">{a.answer}</span>
                <span className="text-brand-orange font-bold">{a.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player status */}
      <div className="card">
        <h3 className="text-sm text-neutral-400 font-semibold mb-3">
          Joueurs
        </h3>
        <div className="space-y-1.5">
          {gameState.scores.map((s) => {
            const isElim = gameState.eliminated_this_question.includes(s.sid);
            const isActive = gameState.active_answerer === s.sid;
            return (
              <div
                key={s.sid}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${
                  isActive
                    ? "bg-brand-orange/20 border border-brand-orange"
                    : isElim
                      ? "bg-surface-light opacity-40"
                      : "bg-surface-light"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-semibold">{s.pseudo}</span>
                  {isElim && (
                    <span className="text-red-400 text-xs">éliminé</span>
                  )}
                  {isActive && (
                    <span className="text-brand-orange text-xs">
                      répond...
                    </span>
                  )}
                </div>
                <span className="text-brand-orange font-bold">{s.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex gap-3">
        {phase === "question_result" && (
          <button onClick={onNextQuestion} className="btn-primary flex-1">
            Question suivante ▶️
          </button>
        )}
        {(phase === "buzzer_open" || phase === "answering") && (
          <button onClick={onSkip} className="btn-secondary flex-1">
            Passer ⏭️
          </button>
        )}
        {isFace &&
          (phase === "buzzer_open" || phase === "answering") && (
            <button onClick={onReduceBlur} className="btn-secondary">
              Défloutage 👁️
            </button>
          )}
      </div>
    </div>
  );
}
