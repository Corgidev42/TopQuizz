import type { Player } from "../../types";

interface Props {
  players: Record<string, Player>;
}

export default function PlayerList({ players }: Props) {
  const entries = Object.entries(players);

  if (entries.length === 0) {
    return (
      <p className="text-neutral-500 italic">Aucun joueur pour l'instant...</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([sid, player]) => (
        <div
          key={sid}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border animate-slide-up ${
            player.is_connected
              ? "bg-surface-light border-neutral-700"
              : "bg-surface border-neutral-800 opacity-40"
          }`}
        >
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: player.color }}
          />
          <span className="font-semibold">{player.pseudo}</span>
        </div>
      ))}
    </div>
  );
}
