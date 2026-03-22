import { Routes, Route, useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSocket } from "./hooks/useSocket";
import { useGameStore } from "./stores/gameStore";
import TVView from "./views/TVView";
import PlayerView from "./views/PlayerView";
import HostView from "./views/HostView";
import JoinView from "./views/JoinView";
import AccountView from "./views/AccountView";
import AdminView from "./views/AdminView";
import LeaderboardView from "./views/LeaderboardView";
import Logo from "./components/shared/Logo";
import ErrorBoundary from "./components/shared/ErrorBoundary";

function BackgroundEffects() {
  return (
    <>
      <div className="bg-orbs">
        <div className="bg-orb-3" />
      </div>
      <div className="particles">
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
      </div>
      <div className="noise-overlay" />
    </>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Logo size="lg" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-neutral-400 text-lg mt-4 mb-12 text-center"
      >
        La plateforme de quiz événementiel propulsée par l'IA
      </motion.p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        {[
          { href: "/host", icon: "🎮", title: "Host", desc: "Contrôle la partie depuis ton Mac" },
          { href: "/tv", icon: "📺", title: "TV Display", desc: "Affichage HDMI pour tous les joueurs" },
          { href: "/play", icon: "📱", title: "Jouer", desc: "Rejoins une partie depuis ton téléphone" },
        ].map((item, i) => (
          <motion.a
            key={item.href}
            href={item.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
            className="card-glass hover:border-brand-orange/50 transition-all duration-300 group text-center hover:shadow-glow-sm"
          >
            <div className="text-4xl mb-3 group-hover:animate-float transition-transform">
              {item.icon}
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-brand-orange transition-colors">
              {item.title}
            </h2>
            <p className="text-neutral-400 text-sm">{item.desc}</p>
          </motion.a>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl w-full mt-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.45 }}
        >
          <Link
            to="/admin"
            className="card-glass block hover:border-brand-orange/50 transition-all duration-300 text-center py-6 px-4"
          >
            <div className="text-3xl mb-2">🛡️</div>
            <h2 className="text-lg font-bold text-brand-orange">Administration</h2>
            <p className="text-neutral-400 text-sm mt-1">
              Gérer les comptes joueurs
            </p>
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.82, duration: 0.45 }}
        >
          <Link
            to="/leaderboard"
            className="card-glass block hover:border-brand-orange/50 transition-all duration-300 text-center py-6 px-4"
          >
            <div className="text-3xl mb-2">🏆</div>
            <h2 className="text-lg font-bold text-brand-orange">Classement</h2>
            <p className="text-neutral-400 text-sm mt-1">
              All-time : points & victoires
            </p>
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-12 card-glass max-w-2xl w-full"
      >
        <h3 className="text-lg font-bold mb-3 text-brand-orange">
          Features à venir
        </h3>
        <ul className="space-y-2 text-neutral-300 text-sm">
          {[
            'Mode « Alibi » — Débat et investigation entre joueurs',
          ].map((feat) => (
            <li key={feat} className="flex items-center gap-2">
              <span className="text-brand-orange">●</span>
              {feat}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

function Notification() {
  const notification = useGameStore((s) => s.notification);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            className={`px-6 py-3 rounded-xl shadow-2xl font-semibold border backdrop-blur-md ${
              notification.type === "success"
                ? "bg-green-600/80 border-green-500/50 shadow-green-500/20"
                : notification.type === "error"
                  ? "bg-red-600/80 border-red-500/50 shadow-red-500/20"
                  : "bg-blue-600/80 border-blue-500/50 shadow-blue-500/20"
            }`}
          >
            {notification.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2 }}
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tv" element={<TVView />} />
          <Route path="/play" element={<PlayerView />} />
          <Route path="/host" element={<HostView />} />
          <Route path="/join" element={<JoinView />} />
          <Route path="/account" element={<AccountView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/leaderboard" element={<LeaderboardView />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  useSocket();

  return (
    <>
      <BackgroundEffects />
      <Notification />
      <ErrorBoundary>
        <AnimatedRoutes />
      </ErrorBoundary>
    </>
  );
}
