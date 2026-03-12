import { Routes, Route } from "react-router-dom";
import { useSocket } from "./hooks/useSocket";
import { useGameStore } from "./stores/gameStore";
import TVView from "./views/TVView";
import PlayerView from "./views/PlayerView";
import HostView from "./views/HostView";
import JoinView from "./views/JoinView";
import Logo from "./components/shared/Logo";
import ErrorBoundary from "./components/shared/ErrorBoundary";

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <Logo size="lg" />
      <p className="text-neutral-400 text-lg mt-4 mb-12 text-center">
        La plateforme de quiz événementiel propulsée par l'IA
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        <a
          href="/host"
          className="card hover:border-brand-orange transition-colors group text-center"
        >
          <div className="text-4xl mb-3">🎮</div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-brand-orange transition-colors">
            Host
          </h2>
          <p className="text-neutral-400 text-sm">
            Contrôle la partie depuis ton Mac
          </p>
        </a>

        <a
          href="/tv"
          className="card hover:border-brand-orange transition-colors group text-center"
        >
          <div className="text-4xl mb-3">📺</div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-brand-orange transition-colors">
            TV Display
          </h2>
          <p className="text-neutral-400 text-sm">
            Affichage HDMI pour tous les joueurs
          </p>
        </a>

        <a
          href="/play"
          className="card hover:border-brand-orange transition-colors group text-center"
        >
          <div className="text-4xl mb-3">📱</div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-brand-orange transition-colors">
            Jouer
          </h2>
          <p className="text-neutral-400 text-sm">
            Rejoins une partie depuis ton téléphone
          </p>
        </a>
      </div>

      <div className="mt-16 card max-w-2xl w-full">
        <h3 className="text-lg font-bold mb-3 text-brand-orange">
          🚀 Features à venir
        </h3>
        <ul className="space-y-2 text-neutral-300 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-brand-orange">●</span>
            Comptes joueurs avec email + avatar + statistiques
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-orange">●</span>
            Classement all-time et historique des parties
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-orange">●</span>
            Mode "Alibi" (inspiré du concept de Squeezie) — Débat et
            investigation entre joueurs
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-orange">●</span>
            Thèmes visuels personnalisables
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-orange">●</span>
            Avatars et personnalisation du profil joueur
          </li>
        </ul>
      </div>
    </div>
  );
}

function Notification() {
  const notification = useGameStore((s) => s.notification);
  if (!notification) return null;

  const colors = {
    success: "bg-green-600/90 border-green-500",
    error: "bg-red-600/90 border-red-500",
    info: "bg-blue-600/90 border-blue-500",
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div
        className={`${colors[notification.type]} border px-6 py-3 rounded-xl shadow-2xl font-semibold`}
      >
        {notification.message}
      </div>
    </div>
  );
}

export default function App() {
  useSocket();

  return (
    <>
      <Notification />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tv" element={<TVView />} />
          <Route path="/play" element={<PlayerView />} />
          <Route path="/host" element={<HostView />} />
          <Route path="/join" element={<JoinView />} />
        </Routes>
      </ErrorBoundary>
    </>
  );
}
