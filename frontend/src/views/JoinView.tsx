import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useGameStore } from "../stores/gameStore";

export default function JoinView() {
  const [searchParams] = useSearchParams();
  const [pseudo, setPseudo] = useState("");
  const [gameCode, setGameCode] = useState(searchParams.get("game") ?? "");
  const { emit } = useSocket();
  const { gameId, myPlayer } = useGameStore();

  if (myPlayer && gameId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center animate-bounce-in">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4"
            style={{ backgroundColor: myPlayer.color }}
          />
          <h2 className="text-2xl font-bold">{myPlayer.pseudo}</h2>
          <p className="text-neutral-400 mt-2">
            Connecté à la partie{" "}
            <span className="text-brand-orange font-bold">{gameId}</span>
          </p>
          <p className="text-neutral-500 mt-4">
            En attente du lancement...
          </p>
        </div>
      </div>
    );
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim() || !gameCode.trim()) return;
    useGameStore.setState({ role: "player" });
    emit("join_game", { game_id: gameCode.toUpperCase(), pseudo: pseudo.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-black mb-2">
        Top<span className="text-brand-orange">Quizz</span>
      </h1>
      <p className="text-neutral-400 mb-8">Rejoins la partie !</p>

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
            Ton pseudo
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
          Rejoindre 🚀
        </button>
      </form>
    </div>
  );
}
