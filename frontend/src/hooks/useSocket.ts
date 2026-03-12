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

    const onConnect = () => {
      useGameStore.setState({ connected: true, mySid: socket.id ?? null });
    };

    const onDisconnect = () => {
      useGameStore.setState({ connected: false });
    };

    const onGameState = (state: any) => {
      const current = store();
      useGameStore.setState({
        gameState: state,
        gameId: current.gameId ?? state?.id ?? null,
      });
    };

    const onGameCreated = (data: any) => {
      useGameStore.setState({
        gameId: data.game_id,
        joinUrl: data.join_url,
        presets: data.presets ?? [],
      });
    };

    const onTvConnected = (data: any) => {
      useGameStore.setState({ gameId: data.game_id, joinUrl: data.join_url });
    };

    const onJoined = (data: any) => {
      useGameStore.setState({ gameId: data.game_id, myPlayer: data.player });
    };

    const onError = (data: any) => {
      useGameStore.setState({
        notification: { type: "error", message: data.message },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 4000);
    };

    const onAnswerCorrect = (data: any) => {
      useGameStore.setState({
        notification: {
          type: "success",
          message: `${data.pseudo} a trouvé ! +${data.points} pts`,
        },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 3000);
    };

    const onAnswerWrong = (data: any) => {
      useGameStore.setState({
        notification: { type: "error", message: `${data.pseudo} se trompe !` },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 3000);
    };

    const onQuestionFailed = () => {
      useGameStore.setState({
        notification: { type: "info", message: "Personne n'a trouvé !" },
      });
      setTimeout(() => useGameStore.setState({ notification: null }), 3000);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("game_state", onGameState);
    socket.on("game_created", onGameCreated);
    socket.on("tv_connected", onTvConnected);
    socket.on("joined", onJoined);
    socket.on("error", onError);
    socket.on("answer_correct", onAnswerCorrect);
    socket.on("answer_wrong", onAnswerWrong);
    socket.on("question_failed", onQuestionFailed);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("game_state", onGameState);
      socket.off("game_created", onGameCreated);
      socket.off("tv_connected", onTvConnected);
      socket.off("joined", onJoined);
      socket.off("error", onError);
      socket.off("answer_correct", onAnswerCorrect);
      socket.off("answer_wrong", onAnswerWrong);
      socket.off("question_failed", onQuestionFailed);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket();
    socket.emit(event, data);
  }, []);

  return { emit };
}
