import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/shared/Logo";
import { apiUrl } from "../utils/apiBase";
import { errorMessageFromBody } from "../utils/apiError";
import {
  usePlayerAccountStore,
  type PlayerUser,
} from "../stores/playerAccountStore";

const EMOJI_PRESETS = [
  "🎮", "🦊", "🐱", "🚀", "⭐", "🎵", "🎬", "🏆", "🔥", "💜",
  "🍕", "🎯", "🧠", "🐸", "🦄", "👽", "🤖", "🎨", "⚡", "🌮",
];

async function authFetch(
  token: string,
  path: string,
  options: RequestInit = {},
) {
  return fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
}

export default function AccountView() {
  const { token, user, setAuth, setUser, logout } = usePlayerAccountStore();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("🎮");
  const [history, setHistory] = useState<
    Array<{
      game_id: string;
      pseudo_in_game: string;
      score: number;
      rank: number;
      total_players: number;
      won: boolean;
      at: number;
    }>
  >([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await authFetch(token, "/api/players/me");
      if (cancelled) return;
      if (res.ok) {
        const u = (await res.json()) as PlayerUser;
        setUser(u);
        setEditName(u.display_name);
        setEditEmoji(u.avatar_emoji || "🎮");
      } else {
        logout();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setUser, logout]);

  useEffect(() => {
    if (!token || !user) return;
    (async () => {
      const res = await authFetch(token, "/api/players/history?limit=30");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.games ?? []);
      }
    })();
  }, [token, user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/players/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
        }),
      });
      const text = await res.text();
      let data: { token?: string; user?: PlayerUser };
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        setError(errorMessageFromBody(res, text, "Erreur d'inscription"));
        return;
      }
      if (!res.ok) {
        setError(errorMessageFromBody(res, text, "Erreur d'inscription"));
        return;
      }
      if (!data.token || !data.user) {
        setError("Réponse serveur incomplète.");
        return;
      }
      setAuth(data.token, data.user);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/players/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      let data: { token?: string; user?: PlayerUser };
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        setError(errorMessageFromBody(res, text, "Connexion impossible"));
        return;
      }
      if (!res.ok) {
        setError(errorMessageFromBody(res, text, "Connexion impossible"));
        return;
      }
      if (!data.token || !data.user) {
        setError("Réponse serveur incomplète.");
        return;
      }
      setAuth(data.token, data.user);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch(token, "/api/players/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: editName,
          avatar_emoji: editEmoji,
        }),
      });
      const text = await res.text();
      let data: PlayerUser;
      try {
        data = text ? (JSON.parse(text) as PlayerUser) : ({} as PlayerUser);
      } catch {
        setError(errorMessageFromBody(res, text, "Sauvegarde impossible"));
        return;
      }
      if (!res.ok) {
        setError(errorMessageFromBody(res, text, "Sauvegarde impossible"));
        return;
      }
      setUser(data);
    } finally {
      setLoading(false);
    }
  };

  if (token && user) {
    return (
      <div className="min-h-screen flex flex-col items-center p-6 relative z-10">
        <Link
          to="/"
          className="self-start text-neutral-400 hover:text-brand-orange mb-4"
        >
          ← Accueil
        </Link>
        <Logo size="md" />
        <h1 className="text-2xl font-black mt-4 mb-6">Mon compte</h1>

        <div className="w-full max-w-lg space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl w-20 h-20 flex items-center justify-center rounded-2xl bg-surface-light border border-neutral-700">
                {user.avatar_emoji}
              </div>
              <div>
                <p className="text-neutral-400 text-sm">{user.email}</p>
                <p className="text-xl font-bold">{user.display_name}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-light p-3">
                <div className="text-2xl font-black text-brand-orange">
                  {user.games_played}
                </div>
                <div className="text-xs text-neutral-500">Parties</div>
              </div>
              <div className="rounded-xl bg-surface-light p-3">
                <div className="text-2xl font-black text-brand-orange">
                  {user.total_score}
                </div>
                <div className="text-xs text-neutral-500">Points cumulés</div>
              </div>
              <div className="rounded-xl bg-surface-light p-3">
                <div className="text-2xl font-black text-brand-orange">
                  {user.wins}
                </div>
                <div className="text-xs text-neutral-500">Victoires</div>
              </div>
            </div>
          </motion.div>

          <div className="card-glass space-y-4">
            <h2 className="font-bold text-brand-orange">Profil & avatar</h2>
            <input
              className="input-field"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Pseudo affiché"
            />
            <p className="text-sm text-neutral-400">Choisis un emoji avatar :</p>
            <div className="flex flex-wrap gap-2">
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEditEmoji(em)}
                  className={`text-2xl w-11 h-11 rounded-xl border transition-colors ${
                    editEmoji === em
                      ? "border-brand-orange bg-brand-orange/20"
                      : "border-neutral-700 bg-surface-light hover:border-neutral-500"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={loading}
              className="btn-primary w-full"
            >
              Enregistrer
            </button>
          </div>

          <div className="card-glass">
            <h2 className="font-bold text-brand-orange mb-3">
              Historique des parties
            </h2>
            {history.length === 0 ? (
              <p className="text-neutral-500 text-sm">
                Aucune partie enregistrée. Rejoins une game depuis /play avec
                ton compte connecté !
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
                {history.map((h, i) => (
                  <li
                    key={`${h.game_id}-${h.at}-${i}`}
                    className="flex justify-between items-center py-2 border-b border-neutral-800"
                  >
                    <span>
                      <span className="text-neutral-500">
                        {new Date(h.at * 1000).toLocaleDateString("fr-FR")}
                      </span>{" "}
                      — {h.pseudo_in_game}{" "}
                      {h.won ? "🏆" : ""}
                    </span>
                    <span className="text-brand-orange font-bold">
                      {h.score} pts · #{h.rank}/{h.total_players}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="button"
            onClick={logout}
            className="btn-secondary w-full border-red-500/40 text-red-300"
          >
            Déconnexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative z-10">
      <Link
        to="/"
        className="self-start text-neutral-400 hover:text-brand-orange mb-4"
      >
        ← Accueil
      </Link>
      <Logo size="md" />
      <h1 className="text-2xl font-black mt-4 mb-2">Compte joueur</h1>
      <p className="text-neutral-500 text-sm mb-6 text-center max-w-md">
        Crée un compte pour suivre tes stats, ton classement et l’historique de
        tes parties (connecte-toi avant de rejoindre une partie).
      </p>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("login")}
          className={`px-4 py-2 rounded-xl font-semibold ${
            tab === "login"
              ? "bg-brand-orange text-white"
              : "bg-surface-light text-neutral-400"
          }`}
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={() => setTab("register")}
          className={`px-4 py-2 rounded-xl font-semibold ${
            tab === "register"
              ? "bg-brand-orange text-white"
              : "bg-surface-light text-neutral-400"
          }`}
        >
          Inscription
        </button>
      </div>

      {tab === "login" ? (
        <form
          onSubmit={handleLogin}
          className="card w-full max-w-sm space-y-4"
        >
          <input
            type="email"
            className="input-field"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-field"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "..." : "Se connecter"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleRegister}
          className="card w-full max-w-sm space-y-4"
        >
          <input
            type="email"
            className="input-field"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-field"
            placeholder="Mot de passe (6+ car.)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            className="input-field"
            placeholder="Pseudo / nom affiché"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "..." : "Créer mon compte"}
          </button>
        </form>
      )}
    </div>
  );
}
