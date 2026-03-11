import { io, Socket } from "socket.io-client";

// Decide target based on environment:
// - If served by Vite dev server (port 3000), connect directly to backend:8000
// - Otherwise (served via Nginx on 80/443), use same-origin and let Nginx proxy
const isViteDev = window.location.port === "3000";
const BACKEND_URL = isViteDev
  ? `http://${window.location.hostname}:8000`
  : "/";
const SOCKET_PATH = "/socket.io";

console.log(
  "[Socket] Config -> target:",
  BACKEND_URL,
  "path:",
  SOCKET_PATH,
  "origin:",
  window.location.origin
);

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnectionAttempts: 5,
      timeout: 8000,
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection Error:", err);
    });

    socket.on("connect", () => {
      if (socket) {
        const transport =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (socket as any)?.io?.engine?.transport?.name ?? "unknown";
        console.log("[Socket] Connected OK via:", transport);
      }
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
