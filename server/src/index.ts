import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { attachGameServer } from "./gameServer";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
attachGameServer(io);

// 生产环境:同一服务托管构建好的前端
const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => console.log(`[chess-shogi] server listening on :${PORT}`));
