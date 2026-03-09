import { useEffect, useCallback, useRef } from "react";
import { connectSocket, getSocket } from "../socket";
import { useGameStore } from "../stores/gameStore";

export function useSocket() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = connectSocket();
    const store = useGameStore.getState;

    socket.on("connect", () => {
      useGameStore.setState({ connected: true, mySid: socket.id ?? null });
    });

    socket.on("disconnect", () => {
      useGameStore.setState({ connected: false });
    });

    socket.on("game_state", (state) => {
      useGameStore.setState({ gameState: state });
    });

    socket.on("game_created", (data) => {
      useGameStore.setState({
        gameId: data.game_id,
        joinUrl: data.join_url,
        presets: data.presets ?? [],
      });
    });

    socket.on("tv_connected", (data) => {
      useGameStore.setState({ gameId: data.game_id, joinUrl: data.join_url });
    });

    socket.on("joined", (data) => {
      useGameStore.setState({ gameId: data.game_id, myPlayer: data.player });
    });

    socket.on("error", (data) => {
      useGameStore.setState({
        notification: { type: "error", message: data.message },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 4000);
    });

    socket.on("answer_correct", (data) => {
      useGameStore.setState({
        notification: {
          type: "success",
          message: `${data.pseudo} a trouvé ! +${data.points} pts`,
        },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 3000);
    });

    socket.on("answer_wrong", (data) => {
      useGameStore.setState({
        notification: { type: "error", message: `${data.pseudo} se trompe !` },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 3000);
    });

    socket.on("question_failed", () => {
      useGameStore.setState({
        notification: { type: "info", message: "Personne n'a trouvé !" },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 3000);
    });
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket();
    socket.emit(event, data);
  }, []);

  return { emit };
}
