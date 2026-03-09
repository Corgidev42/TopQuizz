import type { Player, ScoreEntry } from "../../types";

interface Props {
  gameId: string;
  players: Record<string, Player>;
  scores: ScoreEntry[];
  emit: (event: string, data?: unknown) => void;
}

export default function ScoreManager({ gameId, players, scores, emit }: Props) {
  const adjust = (playerSid: string, adjustment: number) => {
    emit("host_adjust_score", {
      game_id: gameId,
      player_sid: playerSid,
      adjustment,
    });
  };

  return (
    <div className="card">
      <h3 className="text-sm text-neutral-400 font-semibold mb-3">
        Ajuster les scores
      </h3>
      <div className="space-y-2">
        {scores.map((s) => (
          <div
            key={s.sid}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-light"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-semibold">{s.pseudo}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjust(s.sid, -1)}
                className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-colors"
              >
                -
              </button>
              <span className="font-bold text-brand-orange w-12 text-center">
                {s.score}
              </span>
              <button
                onClick={() => adjust(s.sid, 1)}
                className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 font-bold hover:bg-green-500/30 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
