import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import { Server } from "socket.io";
import { io as Client, type Socket } from "socket.io-client";
import { attachGameServer } from "./gameServer";
import { AuthStore } from "./auth";
import { EV, type GameStartMsg, type LobbySnapshot } from "@cs/shared";

describe("game server (两客户端联机)", () => {
  let httpServer: http.Server;
  let port: number;

  beforeAll(async () => {
    httpServer = http.createServer();
    const io = new Server(httpServer, { cors: { origin: "*" } });
    attachGameServer(io, new AuthStore(os.tmpdir()));
    await new Promise<void>((r) => httpServer.listen(0, r));
    port = (httpServer.address() as AddressInfo).port;
  });
  afterAll(() => { httpServer.close(); });

  const connect = (): Socket => Client(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true });
  const once = <T>(s: Socket, ev: string): Promise<T> => new Promise((res) => s.once(ev, res as () => void));

  it("建房+加入 → 双方收到 gameStart;合法着法同步给双方", async () => {
    const a = connect(), b = connect();
    await Promise.all([once(a, "connect"), once(b, "connect")]);

    a.emit(EV.join, { name: "甲" });
    b.emit(EV.join, { name: "乙" });

    const aStart = once<GameStartMsg>(a, EV.gameStart);
    const bStart = once<GameStartMsg>(b, EV.gameStart);

    a.emit(EV.createRoom, { side: "chess" });
    const snap = await new Promise<LobbySnapshot>((res) => {
      const h = (s: LobbySnapshot) => { if (s.rooms.length) { b.off(EV.lobby, h); res(s); } };
      b.on(EV.lobby, h);
    });
    b.emit(EV.joinRoom, { roomId: snap.rooms[0].id });

    const [sa, sb] = await Promise.all([aStart, bStart]);
    expect(sa.mySide).toBe("chess");
    expect(sb.mySide).toBe("shogi");
    expect(sa.opponent.nickname).toBe("乙");

    const aState = once<{ state: GameStartMsg["state"] }>(a, EV.gameState);
    const bState = once<{ state: GameStartMsg["state"] }>(b, EV.gameState);
    // 国象方(甲)走 e 列兵两格
    a.emit(EV.move, { action: { type: "move", from: { file: 4, rank: 7 }, to: { file: 4, rank: 5 } } });
    const [ra, rb] = await Promise.all([aState, bState]);
    expect(ra.state.turn).toBe("shogi");
    expect(rb.state.turn).toBe("shogi");

    a.close(); b.close();
  }, 20000);

  it("拒绝非法着法 / 未轮到的一方", async () => {
    const a = connect(), b = connect();
    await Promise.all([once(a, "connect"), once(b, "connect")]);
    a.emit(EV.join, { name: "甲2" });
    b.emit(EV.join, { name: "乙2" });
    const aStart = once<GameStartMsg>(a, EV.gameStart);
    a.emit(EV.createRoom, { side: "chess" });
    const snap = await new Promise<LobbySnapshot>((res) => {
      const h = (s: LobbySnapshot) => { if (s.rooms.length) { b.off(EV.lobby, h); res(s); } };
      b.on(EV.lobby, h);
    });
    b.emit(EV.joinRoom, { roomId: snap.rooms[0].id });
    await aStart;

    // 将棋方(乙)抢先走 → 应收到 error,且无 gameState
    const err = once<string>(b, EV.errorMsg);
    b.emit(EV.move, { action: { type: "move", from: { file: 4, rank: 2 }, to: { file: 4, rank: 3 } } });
    expect(await err).toContain("轮");

    a.close(); b.close();
  }, 20000);
});
