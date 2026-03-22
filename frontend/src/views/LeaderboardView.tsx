import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/shared/Logo";
import { apiUrl } from "../utils/apiBase";

interface Entry {
  rank: number;
  display_name: string;
  avatar_emoji: string;
  total_score: number;
  wins: number;
  games_played: number;
  sort_value: number;
}

export default function LeaderboardView() {
  const [sort, setSort] = useState<"score" | "wins">("score");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(
        apiUrl(`/api/players/leaderboard?sort=${sort}&limit=50`),
      );
      if (cancelled) return;
      if (!res.ok) {
        setError("Impossible de charger le classement (Redis requis côté serveur).");
        setEntries([]);
        return;
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [sort]);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative z-10">
      <Link
        to="/"
        className="self-start text-neutral-400 hover:text-brand-orange mb-4"
      >
        ← Accueil
      </Link>
      <Logo size="md" />
      <h1 className="text-2xl font-black mt-4 mb-2">Classement</h1>
      <p className="text-neutral-500 text-sm mb-6">
        All-time sur ce serveur TopQuizz
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSort("score")}
          className={`px-4 py-2 rounded-xl font-semibold ${
            sort === "score"
              ? "bg-brand-orange text-white"
              : "bg-surface-light text-neutral-400"
          }`}
        >
          Par points cumulés
        </button>
        <button
          type="button"
          onClick={() => setSort("wins")}
          className={`px-4 py-2 rounded-xl font-semibold ${
            sort === "wins"
              ? "bg-brand-orange text-white"
              : "bg-surface-light text-neutral-400"
          }`}
        >
          Par victoires
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4 text-center max-w-md">{error}</p>
      )}

      <div className="w-full max-w-xl card-glass overflow-hidden">
        {entries.length === 0 && !error ? (
          <p className="p-6 text-neutral-500 text-center text-sm">
            Pas encore de joueurs classés. Termine une partie en étant connecté
            à un compte pour apparaître ici.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {entries.map((e) => (
              <li
                key={`${e.rank}-${e.display_name}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="text-neutral-500 font-bold w-8">#{e.rank}</span>
                <span className="text-2xl w-10 text-center">{e.avatar_emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{e.display_name}</div>
                  <div className="text-xs text-neutral-500">
                    {e.games_played} partie(s)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-brand-orange font-black">
                    {sort === "score" ? e.total_score : e.wins}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {sort === "score" ? "pts cumulés" : "victoires"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link to="/" className="mt-8 text-brand-orange hover:underline">
        ← Retour à l'accueil
      </Link>
    </div>
  );
}
