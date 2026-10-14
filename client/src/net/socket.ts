import { io, type Socket } from "socket.io-client";

// 会话 id 存在 sessionStorage:同一标签页刷新后不变(可接回对局),不同标签页各自独立(可以自己和自己下)。
const CID_KEY = "cs_cid";
export function getCid(): string | undefined {
  try { return sessionStorage.getItem(CID_KEY) ?? undefined; } catch { return undefined; }
}
export function setCid(id: string): void {
  try { sessionStorage.setItem(CID_KEY, id); } catch { /* ignore */ }
}

// 开发与生产都连同源:开发时由 Vite 把 /socket.io 代理到 3001 端口的后端,
// 这样通过外网预览地址打开开发服务器时联机也能用。
export function createSocket(): Socket {
  return io(window.location.origin, {
    transports: ["websocket"],
    forceNew: true,
    auth: (cb) => cb({ cid: getCid() }),
  });
}
