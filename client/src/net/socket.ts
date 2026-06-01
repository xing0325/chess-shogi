import { io, type Socket } from "socket.io-client";

// 开发时前端 5173、后端 3001;生产时同源。
export function createSocket(): Socket {
  const url = import.meta.env.DEV ? "http://localhost:3001" : window.location.origin;
  return io(url, { transports: ["websocket"], forceNew: true });
}
