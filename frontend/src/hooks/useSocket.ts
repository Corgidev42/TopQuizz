import { useEffect, useCallback } from "react";
import { connectSocket, getSocket } from "../socket";
import { useGameStore } from "../stores/gameStore";
import { pickBestJoinUrl } from "../utils/network";

export function useSocket() {
  useEffect(() => {
    const socket = connectSocket();
    const store = useGameStore.getState;

    const onConnect = () => {
      useGameStore.setState({ connected: true, mySid: socket.id ?? null });

      const { gameId, playerToken, role } = store();
      if (gameId && playerToken && role) {
        socket.emit("rejoin_game", {
          game_id: gameId,
          token: playerToken,
          role,
        });
      }
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
      const origin = window.location.origin.replace(/\/$/, "");
      const joinUrlBase =
        data?.game_id != null
          ? `${origin}/play?game=${String(data.game_id).toUpperCase()}`
          : data.join_url;

      useGameStore.setState({
        gameId: data.game_id,
        joinUrl: joinUrlBase,
        presets: data.presets ?? [],
        playerToken: data.token ?? null,
      });

      if (data?.game_id) {
        pickBestJoinUrl(data.game_id, joinUrlBase)
          .then((better) => {
            if (better) useGameStore.setState({ joinUrl: better });
          })
          .catch(() => {});
      }
    };

    const onTvConnected = (data: any) => {
      const origin = window.location.origin.replace(/\/$/, "");
      const joinUrlBase =
        data?.game_id != null
          ? `${origin}/play?game=${String(data.game_id).toUpperCase()}`
          : data.join_url;

      useGameStore.setState({
        gameId: data.game_id,
        joinUrl: joinUrlBase,
        playerToken: data.token ?? null,
      });

      if (data?.game_id) {
        pickBestJoinUrl(data.game_id, joinUrlBase)
          .then((better) => {
            if (better) useGameStore.setState({ joinUrl: better });
          })
          .catch(() => {});
      }
    };

    const onJoined = (data: any) => {
      useGameStore.setState({
        gameId: data.game_id,
        myPlayer: data.player,
        playerToken: data.token ?? null,
      });
    };

    const onRejoinSuccess = (data: any) => {
      const updates: any = {
        gameId: data.game_id,
        role: data.role,
        playerToken: data.token,
      };
      if (data.player) {
        updates.myPlayer = data.player;
      }
      if (data.join_url) {
        updates.joinUrl = data.join_url;
      }
      if (data.presets) {
        updates.presets = data.presets;
      }
      useGameStore.setState(updates);
    };

    const onRejoinFailed = () => {
      useGameStore.setState({
        gameId: null,
        playerToken: null,
        role: null,
        myPlayer: null,
        gameState: null,
      });
    };

    const onGameCancelled = () => {
      useGameStore.getState().reset();
      window.location.href = "/";
    };

    const onError = (data: any) => {
      useGameStore.setState({
        notification: { type: "error", message: data.message },
        lastErrorAt: Date.now(),
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
    socket.on("rejoin_success", onRejoinSuccess);
    socket.on("rejoin_failed", onRejoinFailed);
    socket.on("game_cancelled", onGameCancelled);
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
      socket.off("rejoin_success", onRejoinSuccess);
      socket.off("rejoin_failed", onRejoinFailed);
      socket.off("game_cancelled", onGameCancelled);
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
