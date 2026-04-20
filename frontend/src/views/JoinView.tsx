import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";
import {
  usePlayerAccountStore,
  type PlayerUser,
} from "../stores/playerAccountStore";
import { apiUrl } from "../utils/apiBase";
import { errorMessageFromBody } from "../utils/apiError";

const EMOJI_PRESETS = [
  "🎮", "🦊", "🐱", "🚀", "⭐", "🎵", "🎬", "🏆", "🔥", "💜",
  "🍕", "🎯", "🧠", "🐸", "🦄", "👽", "🤖", "🎨", "⚡", "🌮",
];

export default function JoinView() {
  const [searchParams] = useSearchParams();
  const [pseudo, setPseudo] = useState("");
  const [gameCode, setGameCode] = useState(searchParams.get("game") ?? "");
  const { emit } = useSocket();
  const { gameId, myPlayer } = useGameStore();
  const { token, user, setAuth, setUser, logout } = usePlayerAccountStore();
  const seededPseudo = useRef(false);

  // Auth form state
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(!!token);

  // Validate persisted token on mount
  useEffect(() => {
    if (!token) {
      setValidatingToken(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/players/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const u = (await res.json()) as PlayerUser;
          setUser(u);
        } else {
          logout();
        }
      } catch {
        // network error — keep token, maybe offline
      } finally {
        if (!cancelled) setValidatingToken(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setUser, logout]);

  // Pre-fill pseudo from account
  useEffect(() => {
    if (seededPseudo.current) return;
    if (user?.display_name?.trim()) {
      setPseudo(user.display_name.trim());
      seededPseudo.current = true;
    }
  }, [user?.display_name]);

  // --- Already joined a game ---
  if (myPlayer && gameId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center animate-bounce-in">
          <div className="flex justify-center items-center gap-3 mb-4">
            {myPlayer.avatar_emoji ? (
              <span className="text-5xl" aria-hidden>
                {myPlayer.avatar_emoji}
              </span>
            ) : null}
            <div
              className="w-16 h-16 rounded-full shrink-0"
              style={{ backgroundColor: myPlayer.color }}
            />
          </div>
          <h2 className="text-2xl font-bold">{myPlayer.pseudo}</h2>
          <p className="text-neutral-400 mt-2">
            Connecté à la partie{" "}
            <span className="text-brand-orange font-bold">{gameId}</span>
          </p>
          <p className="text-neutral-500 mt-4">En attente du lancement...</p>
        </div>
      </div>
    );
  }

  // Waiting for token validation
  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500 animate-pulse">Vérification du compte...</div>
      </div>
    );
  }

  // --- Not logged in → force login/register ---
  if (!token || !user) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError(null);
      setAuthLoading(true);
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
          if (/<html|DOCTYPE/i.test(text)) {
            setAuthError(
              "Réponse HTML au lieu de l’API — backend ou Redis probablement arrêté.",
            );
          } else {
            setAuthError(
              errorMessageFromBody(res, text, "Connexion impossible"),
            );
          }
          return;
        }
        if (!res.ok) {
          setAuthError(
            errorMessageFromBody(res, text, "Connexion impossible"),
          );
          return;
        }
        if (!data.token || !data.user) {
          setAuthError("Réponse serveur incomplète.");
          return;
        }
        setAuth(data.token, data.user);
      } catch (err) {
        setAuthError(
          err instanceof TypeError
            ? "Réseau ou certificat : Wi‑Fi, HTTPS, et accepte le certificat sur cette page."
            : "Connexion au serveur impossible.",
        );
      } finally {
        setAuthLoading(false);
      }
    };

    const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError(null);
      setAuthLoading(true);
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
          if (/<html|DOCTYPE/i.test(text)) {
            setAuthError(
              "Réponse HTML au lieu de l’API — backend ou Redis probablement arrêté.",
            );
          } else {
            setAuthError(
              errorMessageFromBody(res, text, "Erreur d'inscription"),
            );
          }
          return;
        }
        if (!res.ok) {
          setAuthError(
            errorMessageFromBody(res, text, "Erreur d'inscription"),
          );
          return;
        }
        if (!data.token || !data.user) {
          setAuthError("Réponse serveur incomplète.");
          return;
        }
        setAuth(data.token, data.user);
      } catch (err) {
        setAuthError(
          err instanceof TypeError
            ? "Réseau ou certificat : Wi‑Fi, HTTPS, et accepte le certificat sur cette page."
            : "Connexion au serveur impossible.",
        );
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-black mb-1">
          Top<span className="text-brand-orange">Quizz</span>
        </h1>
        <p className="text-neutral-400 text-sm mb-6 text-center max-w-xs">
          Connecte-toi ou crée un compte pour rejoindre la partie et sauvegarder tes stats.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setAuthTab("login"); setAuthError(null); }}
            className={`px-4 py-2 rounded-xl font-semibold text-sm ${
              authTab === "login"
                ? "bg-brand-orange text-white"
                : "bg-surface-light text-neutral-400"
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => { setAuthTab("register"); setAuthError(null); }}
            className={`px-4 py-2 rounded-xl font-semibold text-sm ${
              authTab === "register"
                ? "bg-brand-orange text-white"
                : "bg-surface-light text-neutral-400"
            }`}
          >
            Inscription
          </button>
        </div>

        {authTab === "login" ? (
          <form onSubmit={handleLogin} className="card w-full max-w-sm space-y-3">
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
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={authLoading}
            >
              {authLoading ? "..." : "Se connecter"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="card w-full max-w-sm space-y-3">
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
              placeholder="Pseudo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={2}
            />
            <p className="text-xs text-neutral-500">
              Choisis un avatar après ton inscription dans le profil.
            </p>
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={authLoading}
            >
              {authLoading ? "..." : "Créer mon compte"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // --- Logged in → join game form ---
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim() || !gameCode.trim()) return;
    useGameStore.setState({ role: "player" });
    emit("join_game", {
      game_id: gameCode.toUpperCase(),
      pseudo: pseudo.trim(),
      auth_token: token,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-black mb-2">
        Top<span className="text-brand-orange">Quizz</span>
      </h1>
      <p className="text-neutral-400 mb-6">Rejoins la partie !</p>

      <div className="flex items-center gap-3 mb-4 text-sm">
        <span className="text-2xl">{user.avatar_emoji}</span>
        <span className="text-green-400">
          {user.display_name}
        </span>
        <button
          type="button"
          onClick={logout}
          className="text-neutral-500 hover:text-red-400 text-xs underline"
        >
          Déconnexion
        </button>
      </div>

      <form onSubmit={handleJoin} className="card w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-neutral-400 mb-1">
            Code de la partie
          </label>
          <input
            type="text"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            placeholder="EX: A1B2C3"
            className="input-field text-center text-2xl font-bold tracking-widest uppercase"
            maxLength={6}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-400 mb-1">
            Ton pseudo (en jeu)
          </label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Pseudo"
            className="input-field text-center text-lg"
            maxLength={20}
          />
        </div>
        <button type="submit" className="btn-primary w-full text-lg">
          Rejoindre
        </button>
      </form>
    </div>
  );
}
