import { useEffect, useCallback } from "react";
import { connectSocket, getSocket } from "../socket";
import { useGameStore } from "../stores/gameStore";

export function useSocket() {
  const store = useGameStore();

  useEffect(() => {
    const socket = connectSocket();

    socket.on("connect", () => {
      store.setConnected(true);
      store.setMySid(socket.id ?? null);
    });

    socket.on("disconnect", () => {
      store.setConnected(false);
    });

    socket.on("game_state", (state) => {
      store.setGameState(state);
    });

    socket.on("game_created", (data) => {
      store.setGameId(data.game_id);
      store.setJoinUrl(data.join_url);
      store.setPresets(data.presets ?? []);
    });

    socket.on("tv_connected", (data) => {
      store.setGameId(data.game_id);
      store.setJoinUrl(data.join_url);
    });

    socket.on("joined", (data) => {
      store.setGameId(data.game_id);
      store.setMyPlayer(data.player);
    });

    socket.on("error", (data) => {
      store.setNotification({ type: "error", message: data.message });
      setTimeout(() => store.setNotification(null), 4000);
    });

    socket.on("answer_correct", (data) => {
      store.setNotification({
        type: "success",
        message: `${data.pseudo} a trouvé ! +${data.points} pts`,
      });
      setTimeout(() => store.setNotification(null), 3000);
    });

    socket.on("answer_wrong", (data) => {
      store.setNotification({
        type: "error",
        message: `${data.pseudo} se trompe !`,
      });
      setTimeout(() => store.setNotification(null), 3000);
    });

    socket.on("question_failed", () => {
      store.setNotification({
        type: "info",
        message: "Personne n'a trouvé !",
      });
      setTimeout(() => store.setNotification(null), 3000);
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket();
    socket.emit(event, data);
  }, []);

  return { emit };
}
