import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import { Server } from "socket.io";
import { io as Client, type Socket } from "socket.io-client";
import { attachGameServer } from "./gameServer";
import { AuthStore } from "./auth";
import { EV, type GameStartMsg, type GameState, type LobbySnapshot, type DraftStartMsg, type DraftStateMsg } from "@cs/shared";

describe("game server (两客户端联机)", () => {
  let httpServer: http.Server;
  let port: number;

  beforeAll(async () => {
    httpServer = http.createServer();
    const io = new Server(httpServer, { cors: { origin: "*" } });
    attachGameServer(io, new AuthStore(os.tmpdir()), { graceMs: 400, draftStepMs: 120 });
    await new Promise<void>((r) => httpServer.listen(0, r));
    port = (httpServer.address() as AddressInfo).port;
  });
  afterAll(() => { httpServer.close(); });

  const connect = (cid?: string): Socket => Client(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true, auth: cid ? { cid } : {} });
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
  /** 两个游客开局,返回双方 socket、会话 id 和 gameStart 消息(甲执国象) */
  async function startPair(tag: string, mode: "fusion" | "draft" = "fusion") {
    const a = connect(), b = connect();
    const [aid, bid] = await Promise.all([once<string>(a, EV.sessionId), once<string>(b, EV.sessionId)]);
    a.emit(EV.authGuest, { nickname: "甲" + tag, avatar: "wP" });
    b.emit(EV.authGuest, { nickname: "乙" + tag, avatar: "FU" });
    await Promise.all([once(a, EV.authResult), once(b, EV.authResult)]);
    const startEv = mode === "draft" ? EV.draftStart : EV.gameStart;
    const aStart = once<DraftStartMsg>(a, startEv);
    const bStart = once<DraftStartMsg>(b, startEv);
    a.emit(EV.createRoom, { side: "chess", mode });
    const snap = await new Promise<LobbySnapshot>((res) => {
      const h = (s: LobbySnapshot) => { const r = s.rooms.find((x) => x.hostName === "甲" + tag); if (r) { b.off(EV.lobby, h); res({ ...s, rooms: [r] }); } };
      b.on(EV.lobby, h);
    });
    b.emit(EV.joinRoom, { roomId: snap.rooms[0].id });
    const [aMsg, bMsg] = await Promise.all([aStart, bStart]);
    return { a, b, aid, bid, aMsg, bMsg };
  }
  const e2e4 = { type: "move", from: { file: 4, rank: 7 }, to: { file: 4, rank: 5 } };

  it("畸形着法不会让服务崩溃,之后正常着法仍可用", async () => {
    const { a, b } = await startPair("x");
    const errs: string[] = [];
    a.on(EV.errorMsg, (m: string) => errs.push(m));
    for (const bad of [{ type: "move" }, { type: "move", from: { file: 99, rank: -1 }, to: null }, "garbage", null, { type: "drop", kind: 3 }]) {
      a.emit(EV.move, { action: bad });
    }
    a.emit(EV.move, null);
    await new Promise((r) => setTimeout(r, 200));
    expect(errs.length).toBeGreaterThanOrEqual(5);
    const st = once<{ state: GameState }>(b, EV.gameState);
    a.emit(EV.move, { action: e2e4 });
    expect((await st).state.turn).toBe("shogi");
    a.close(); b.close();
  }, 20000);

  it("对局中刷新(同会话 id 重连)→ 回到原对局并拿到棋谱", async () => {
    const { a, b, bid } = await startPair("r");
    const st = once<{ state: GameState }>(b, EV.gameState);
    a.emit(EV.move, { action: e2e4 });
    await st;
    const down = once<{ connected: boolean }>(a, EV.opponentStatus);
    b.close();
    expect((await down).connected).toBe(false);
    const b2 = connect(bid);
    const up = once<{ connected: boolean }>(a, EV.opponentStatus);
    const start = await once<GameStartMsg>(b2, EV.gameStart);
    expect(start.reconnected).toBe(true);
    expect(start.mySide).toBe("shogi");
    expect(start.history?.length).toBe(1);
    expect(start.state.turn).toBe("shogi");
    expect((await up).connected).toBe(true);
    a.close(); b2.close();
  }, 20000);

  it("掉线超过保留时间 → 对手获胜(abandon)", async () => {
    const { a, b } = await startPair("t");
    const st = new Promise<GameState>((res) => a.on(EV.gameState, (d: { state: GameState }) => { if (d.state.result) res(d.state); }));
    b.close();
    const s = await st;
    expect(s.result).toEqual({ kind: "win", winner: "chess", reason: "abandon" });
    a.close();
  }, 20000);

  it("认输 + 再来一局需要双方同意", async () => {
    const { a, b } = await startPair("s");
    const st = once<{ state: GameState }>(a, EV.gameState);
    b.emit(EV.resign);
    expect((await st).state.result).toEqual({ kind: "win", winner: "chess", reason: "resign" });
    let restarted = false;
    a.on(EV.gameStart, () => { restarted = true; });
    const asked = once<{ fromName: string }>(b, EV.rematchRequested);
    a.emit(EV.rematch);
    expect((await asked).fromName).toBe("甲s");
    await new Promise((r) => setTimeout(r, 150));
    expect(restarted).toBe(false);
    const again = once<GameStartMsg>(a, EV.gameStart);
    b.emit(EV.rematch);
    expect((await again).state.result).toBeUndefined();
    a.close(); b.close();
  }, 20000);

  it("大局选将:BP 联机、越权被拒、超时自动操作直到开局", async () => {
    const { a, b, aMsg, bMsg } = await startPair("d", "draft");
    expect(aMsg.mySide).toBe("sente");
    expect(bMsg.mySide).toBe("gote");
    expect(aMsg.draft.pool.length).toBe(24);
    expect(aMsg.deadline).toBeGreaterThan(aMsg.serverNow);
    const errs: string[] = [];
    b.on(EV.errorMsg, (m: string) => errs.push(m));
    b.emit(EV.draftAction, { action: { type: "ban", kind: aMsg.draft.pool[0] } }); // 不是红方的回合
    b.emit(EV.draftAction, { action: { type: "pick", kind: 42 } });                 // 畸形
    const banned = once<DraftStateMsg>(b, EV.draftState);
    a.emit(EV.draftAction, { action: { type: "ban", kind: aMsg.draft.pool[0] } });
    const st = await banned;
    expect(st.draft.step).toBe(1);
    expect(st.draft.bans.blue).toEqual([aMsg.draft.pool[0]]);
    expect(errs.length).toBe(2);
    // 剩下的 19 步 BP + 12 步布阵全部靠超时自动完成
    const play = await new Promise<DraftStateMsg>((res) => b.on(EV.draftState, (m: DraftStateMsg) => { if (m.draft.phase === "play") res(m); }));
    expect(play.deadline).toBeUndefined();
    expect(play.draft.picks.blue.length).toBe(5);
    expect(play.draft.game.board.filter(Boolean).length).toBe(12);
    // 认输
    const over = once<DraftStateMsg>(a, EV.draftState);
    b.emit(EV.resign);
    expect((await over).draft.game.result).toEqual({ kind: "win", winner: "sente", reason: "resign" });
    a.close(); b.close();
  }, 30000);

  it("大局选将:选将途中刷新可接回", async () => {
    const { a, b, bid } = await startPair("e", "draft");
    b.close();
    const b2 = connect(bid);
    const back = await once<DraftStartMsg>(b2, EV.draftStart);
    expect(back.reconnected).toBe(true);
    expect(back.mySide).toBe("gote");
    expect(back.draft.phase).toBe("draft");
    a.close(); b2.close();
  }, 20000);
});
