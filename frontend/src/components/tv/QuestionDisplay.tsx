import type { Question, GamePhase, Player, ModuleType } from "../../types";
import { DIFFICULTY_LABELS } from "../../types";

interface Props {
  question: Question | null;
  phase: GamePhase | string;
  activeAnswerer: string | null;
  players: Record<string, Player>;
  commuRevealed: string[];
}

export default function QuestionDisplay({
  question,
  phase,
  activeAnswerer,
  players,
  commuRevealed,
}: Props) {
  if (!question) return null;

  const imageUrl: string = question.image_url ?? "";
  const imageBlock =
    imageUrl.length > 0 ? (
      <div className="flex justify-center mb-8">
        <img
          src={imageUrl}
          alt="Question"
          className="max-h-[400px] rounded-2xl object-cover transition-all duration-500 ease-in-out"
          style={{
            imageRendering: question.pixelation_level ? "pixelated" : "auto",
            filter: `blur(${question.blur_level ?? 0}px)`,
            transform: `scale(${question.pixelation_level ? 1.05 : 1})`,
            width: question.pixelation_level
              ? `${100 - question.pixelation_level * 1.5}%`
              : "auto",
          }}
        />
      </div>
    ) : null;

  const answererPlayer = activeAnswerer ? players[activeAnswerer] : null;

  return (
    <div className="w-full max-w-4xl animate-fade-in">
      {/* Difficulty + Points badge */}
      <div className="flex justify-center gap-3 mb-4">
        <span className={`badge-${question.difficulty}`}>
          {DIFFICULTY_LABELS[question.difficulty]}
        </span>
        <span className="badge bg-brand-orange/20 text-brand-orange">
          {question.points}pt{question.points > 1 ? "s" : ""}
        </span>
      </div>

      {/* Question text */}
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
        {question.text}
      </h2>

      {/* Image (Master Memory / Master Face) */}
      {imageBlock as any}

      {/* Media player (Blind Test) */}
      {question.media_path && (
        <div className="flex justify-center mb-8">
          <audio controls className="w-full max-w-lg" autoPlay>
            <source
              src={`http://${window.location.hostname}:8000${question.media_path}`}
              type={
                question.media_path.endsWith(".mp3")
                  ? "audio/mpeg"
                  : "audio/mp4"
              }
            />
          </audio>
        </div>
      )}

      {/* QCM options */}
      {question.options && (
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {question.options.map((opt, i) => (
            <div
              key={i}
              className="card text-center text-xl font-semibold py-6 hover:border-brand-orange transition-colors"
            >
              <span className="text-brand-orange mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}

      {/* Master Commu board */}
      {question.module_type === "master_commu" && question.extra_data?.answers && (
        <div className="max-w-2xl mx-auto space-y-2">
          {(question.extra_data.answers as Array<{ answer: string; score: number }>).map(
            (a, i) => {
              const revealed = commuRevealed.includes(a.answer);
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-6 py-3 rounded-xl transition-all duration-300 ${
                    revealed
                      ? "bg-brand-orange/20 border border-brand-orange"
                      : "bg-surface-light border border-neutral-700"
                  }`}
                >
                  <span className="font-semibold text-lg">
                    {revealed ? a.answer : `Réponse #${i + 1}`}
                  </span>
                  <span
                    className={`font-bold text-lg ${
                      revealed ? "text-brand-orange" : "text-neutral-500"
                    }`}
                  >
                    {revealed ? a.score : "???"}
                  </span>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Who is answering */}
      {phase === "answering" && answererPlayer && (
        <div className="mt-8 text-center animate-slide-up">
          <div className="inline-flex items-center gap-3 bg-surface-light px-6 py-3 rounded-full">
            <div
              className="w-4 h-4 rounded-full animate-pulse"
              style={{ backgroundColor: answererPlayer.color }}
            />
            <span className="font-bold text-lg">
              {answererPlayer.pseudo} répond...
            </span>
          </div>
        </div>
      )}

      {/* Buzzer open indicator */}
      {phase === "buzzer_open" && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 text-brand-orange animate-pulse-slow text-xl font-bold">
            <span className="text-3xl">🔔</span> BUZZEZ !
          </div>
        </div>
      )}
    </div>
  );
}
