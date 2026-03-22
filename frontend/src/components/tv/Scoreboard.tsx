import type { ScoreEntry } from "../../types";

interface Props {
  scores: ScoreEntry[];
}

export default function Scoreboard({ scores }: Props) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-2">
      {scores.map((entry, i) => (
        <div
          key={entry.sid}
          className={`flex items-center justify-between px-5 py-3 rounded-xl animate-slide-up ${
            i === 0
              ? "bg-brand-orange/20 border border-brand-orange"
              : "bg-surface-light"
          }`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 text-center font-bold text-neutral-400">
              #{i + 1}
            </span>
            {entry.avatar_emoji ? (
              <span className="text-2xl leading-none" aria-hidden>
                {entry.avatar_emoji}
              </span>
            ) : null}
            <div
              className="w-5 h-5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-bold">{entry.pseudo}</span>
          </div>
          <span
            className={`font-black text-xl ${
              i === 0 ? "text-brand-orange" : "text-white"
            }`}
          >
            {entry.score}
          </span>
        </div>
      ))}
    </div>
  );
}
