import type { Server, Socket } from "socket.io";
import { randomBytes } from "node:crypto";
import {
  createInitialState, applyAction, isLegalAction, otherSide,
  EV, tk, isGameMode, type Action, type GameState, type Side, type Profile, type AuthResult,
  type PlayerInfo, type RoomInfo, type LobbySnapshot, type GameStartMsg, type OpponentStatusMsg,
  type GameMode, type DraftStartMsg, type DraftStateMsg,
} from "@cs/shared";
import { AuthStore } from "./auth";

interface Player {
  id: string;              // 稳定会话 id(客户端 sessionStorage 持有,刷新不变)
  socket: Socket;
  connected: boolean;
  authed: boolean;
  profile?: Profile;
  username?: string;       // 注册账号才有(游客为空)
  roomId?: string;
  graceTimer?: ReturnType<typeof setTimeout>;
}

interface Room {
  id: string;
  hostId: string;
  openSide: Side;                          // 客人进房将执的边
  guestId?: string;
  sides: Partial<Record<Side, string>>;    // 边 -> 玩家 id
  profiles: Partial<Record<Side, Profile>>;// 边 -> 档案
  state: GameState;
  history: Action[];                       // 本局着法(重连恢复棋谱)
  rematchVotes: Set<string>;
  mode: GameMode;
  // 大局选将:座位 chess = 蓝方(先手 sente),shogi = 红方(后手 gote)
  draft?: tk.DraftState;
  deadline?: number;
  draftTimer?: ReturnType<typeof setTimeout>;
}
const tSideOfSeat = (s: Side): tk.TSide => (s === "chess" ? "sente" : "gote");

export interface GameServerOptions {
  /** 对局中掉线后保留座位的毫秒数 */
  graceMs?: number;
  /** 大局选将:每个 BP / 布阵步骤的限时(毫秒) */
  draftStepMs?: number;
}

const CID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const newCid = (): string => randomBytes(12).toString("base64url");
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
function pick<T>(a: T, b: T): T { return Math.random() < 0.5 ? a : b; }

export function attachGameServer(io: Server, store: AuthStore, opts: GameServerOptions = {}): void {
  const graceMs = opts.graceMs ?? Number(process.env.RECONNECT_GRACE_MS ?? 60000);
  const draftStepMs = opts.draftStepMs ?? Number(process.env.DRAFT_STEP_MS ?? 30000);
  const players = new Map<string, Player>();
  const rooms = new Map<string, Room>();
  let roomSeq = 0;
  const newRoomId = (): string => `r${++roomSeq}`;

  const finished = (r: Room): boolean => (r.mode === "draft" ? !!r.draft?.game.result : !!r.state.result);
  const isActive = (r: Room): boolean => !!r.guestId && !finished(r);
  const sideOf = (r: Room, pid: string): Side | null =>
    r.sides.chess === pid ? "chess" : r.sides.shogi === pid ? "shogi" : null;
  const opponentOf = (r: Room, pid: string): Player | undefined => {
    const s = sideOf(r, pid);
    const oid = s ? r.sides[otherSide(s)] : undefined;
    return oid ? players.get(oid) : undefined;
  };
  const sendTo = (p: Player | undefined, ev: string, payload?: unknown): void => {
    if (p && p.connected) p.socket.emit(ev, payload);
  };

  function lobbySnapshot(): LobbySnapshot {
    const ps: PlayerInfo[] = [...players.values()]
      .filter((p) => p.authed && p.profile && p.connected)
      .map((p) => ({ id: p.id, name: p.profile!.nickname, avatar: p.profile!.avatar, status: p.roomId ? "playing" : "idle" }));
    const rs: RoomInfo[] = [...rooms.values()]
      .filter((r) => !r.guestId)
      .map((r) => {
        const host = r.profiles[otherSide(r.openSide)];
        return { id: r.id, hostName: host?.nickname ?? "?", hostAvatar: host?.avatar ?? "wP", openSide: r.openSide, mode: r.mode };
      });
    return { players: ps, rooms: rs };
  }
  const broadcastLobby = (): void => { io.emit(EV.lobby, lobbySnapshot()); };

  function startMsg(room: Room, side: Side, reconnected = false): GameStartMsg | null {
    const opp = room.profiles[otherSide(side)];
    if (!opp) return null;
    return { roomId: room.id, mySide: side, opponent: opp, state: room.state, history: room.history, reconnected };
  }

  function draftStart(room: Room, seat: Side, reconnected = false): DraftStartMsg | null {
    const opp = room.profiles[otherSide(seat)];
    if (!opp || !room.draft) return null;
    return { roomId: room.id, mySide: tSideOfSeat(seat), opponent: opp, draft: room.draft, deadline: room.deadline, serverNow: Date.now(), reconnected };
  }

  /** BP / 布阵阶段的步骤计时:超时由服务器代为操作(禁用→空过,选择/布阵→随机) */
  function scheduleDraft(room: Room): void {
    if (room.draftTimer) clearTimeout(room.draftTimer);
    room.draftTimer = undefined;
    room.deadline = undefined;
    const d = room.draft;
    if (!d || d.game.result || d.phase === "play") return;
    room.deadline = Date.now() + draftStepMs;
    room.draftTimer = setTimeout(() => {
      room.draftTimer = undefined;
      if (!rooms.has(room.id) || !room.draft) return;
      const who = tk.actor(room.draft);
      const a = tk.autoAction(room.draft);
      if (who && a) {
        try { room.draft = tk.applyDraft(room.draft, who, a); } catch (err) { console.error("[chess-shogi] auto draft action failed:", err); }
      }
      scheduleDraft(room);
      broadcastState(room);
    }, draftStepMs);
  }

  function startGame(room: Room): void {
    if (room.mode === "draft") {
      room.draft = tk.newDraft();
      room.rematchVotes.clear();
      scheduleDraft(room);
      (["chess", "shogi"] as Side[]).forEach((seat) => {
        const pid = room.sides[seat];
        const msg = draftStart(room, seat);
        if (pid && msg) sendTo(players.get(pid), EV.draftStart, msg);
      });
      broadcastLobby();
      return;
    }
    room.state = createInitialState();
    room.history = [];
    room.rematchVotes.clear();
    (["chess", "shogi"] as Side[]).forEach((side) => {
      const pid = room.sides[side];
      const msg = startMsg(room, side);
      if (pid && msg) sendTo(players.get(pid), EV.gameStart, msg);
    });
    broadcastLobby();
  }

  function broadcastState(room: Room): void {
    if (room.mode === "draft") {
      if (!room.draft) return;
      const msg: DraftStateMsg = { draft: room.draft, deadline: room.deadline, serverNow: Date.now() };
      (["chess", "shogi"] as Side[]).forEach((seat) => {
        const pid = room.sides[seat];
        if (pid) sendTo(players.get(pid), EV.draftState, msg);
      });
      return;
    }
    (["chess", "shogi"] as Side[]).forEach((side) => {
      const pid = room.sides[side];
      if (pid) sendTo(players.get(pid), EV.gameState, { state: room.state });
    });
  }

  function makeRoom(host: Player, hostSide: Side, guest?: Player, mode: GameMode = "fusion"): Room {
    const id = newRoomId();
    const room: Room = {
      id, hostId: host.id, openSide: otherSide(hostSide),
      sides: {}, profiles: {}, state: createInitialState(), history: [], rematchVotes: new Set(), mode,
    };
    room.sides[hostSide] = host.id; room.profiles[hostSide] = host.profile!;
    host.roomId = id;
    if (guest) {
      const gs = otherSide(hostSide);
      room.sides[gs] = guest.id; room.profiles[gs] = guest.profile!;
      room.guestId = guest.id; guest.roomId = id;
    }
    rooms.set(id, room);
    return room;
  }

  /** 对局进行中离开 → 判对方胜(abandon);然后解散房间 */
  function leaveRoom(p: Player): void {
    if (!p.roomId) return;
    const room = rooms.get(p.roomId);
    p.roomId = undefined;
    if (!room) return;
    const mySide = sideOf(room, p.id);
    if (mySide && isActive(room)) {
      if (room.mode === "draft" && room.draft) room.draft = tk.resignDraft(room.draft, tSideOfSeat(mySide), "abandon");
      else room.state = { ...room.state, result: { kind: "win", winner: otherSide(mySide), reason: "abandon" } };
      scheduleDraft(room);
      broadcastState(room);
    }
    if (room.draftTimer) { clearTimeout(room.draftTimer); room.draftTimer = undefined; }
    const other = opponentOf(room, p.id);
    if (other) {
      sendTo(other, EV.opponentLeft);
      other.roomId = undefined;
      if (other.graceTimer) { clearTimeout(other.graceTimer); other.graceTimer = undefined; }
      if (!other.connected) players.delete(other.id);
    }
    rooms.delete(room.id);
  }

  function dropPlayer(p: Player): void {
    if (p.graceTimer) { clearTimeout(p.graceTimer); p.graceTimer = undefined; }
    leaveRoom(p);
    players.delete(p.id);
  }

  io.on("connection", (socket) => {
    // ---- 会话:同一标签页刷新后沿用 id,可接回对局 ----
    const askedCid = str(socket.handshake.auth?.cid);
    let player: Player;
    const existing = askedCid && CID_RE.test(askedCid) ? players.get(askedCid) : undefined;
    if (existing && !existing.connected) {
      player = existing;
      player.socket = socket;
      player.connected = true;
      if (player.graceTimer) { clearTimeout(player.graceTimer); player.graceTimer = undefined; }
    } else {
      const id = askedCid && CID_RE.test(askedCid) && !existing ? askedCid : newCid();
      player = { id, socket, connected: true, authed: false };
      players.set(id, player);
    }
    socket.emit(EV.sessionId, player.id);

    if (player.authed && player.profile) {
      // 重连:恢复身份、大厅与进行中的对局
      const res: AuthResult = { ok: true, profile: player.profile, guest: !player.username };
      socket.emit(EV.authResult, res);
      socket.emit(EV.lobby, lobbySnapshot());
      const room = player.roomId ? rooms.get(player.roomId) : undefined;
      const side = room ? sideOf(room, player.id) : null;
      if (room && side && room.guestId) {
        if (room.mode === "draft") {
          const msg = draftStart(room, side, true);
          if (msg) socket.emit(EV.draftStart, msg);
        } else {
          const msg = startMsg(room, side, true);
          if (msg) socket.emit(EV.gameStart, msg);
        }
        const status: OpponentStatusMsg = { connected: true };
        sendTo(opponentOf(room, player.id), EV.opponentStatus, status);
      }
      broadcastLobby();
    }

    /** 统一注册事件:任何异常只影响这一条消息,不会拖垮整个服务进程 */
    const on = (ev: string, handler: (d: Record<string, unknown>) => void): void => {
      socket.on(ev, (raw: unknown) => {
        const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        try { handler(d); } catch (err) {
          console.error(`[chess-shogi] handler "${ev}" failed:`, err);
          socket.emit(EV.errorMsg, "服务器处理请求时出错");
        }
      });
    };

    function applyAuth(res: AuthResult, username?: string): void {
      socket.emit(EV.authResult, res);
      if (!res.ok || !res.profile) return;
      player.authed = true;
      player.profile = res.profile;
      player.username = username;
      socket.emit(EV.lobby, lobbySnapshot());
      broadcastLobby();
    }

    on(EV.authRegister, (d) => {
      const res = store.register(str(d.username) ?? "", str(d.password) ?? "", str(d.nickname) ?? "", str(d.avatar) ?? "");
      applyAuth(res, res.ok ? (str(d.username) ?? "").trim() : undefined);
    });
    on(EV.authLogin, (d) => {
      const res = store.login(str(d.username) ?? "", str(d.password) ?? "");
      applyAuth(res, res.ok ? (str(d.username) ?? "").trim() : undefined);
    });
    on(EV.authToken, (d) => {
      const token = str(d.token) ?? "";
      if (player.authed && player.username && store.usernameFromToken(token) === player.username) return; // 重连已恢复
      const res = store.resume(token);
      applyAuth(res, res.ok ? store.usernameFromToken(token) ?? undefined : undefined);
    });
    on(EV.authGuest, (d) => {
      applyAuth({ ok: true, guest: true, profile: AuthStore.guestProfile(str(d.nickname) ?? "", str(d.avatar) ?? "") });
    });
    on(EV.join, (d) => {
      applyAuth({ ok: true, guest: true, profile: AuthStore.guestProfile(str(d.name) ?? "", str(d.avatar) ?? "") });
    });
    on(EV.updateProfile, (d) => {
      if (!player.authed) return;
      if (player.username) {
        const p = store.updateProfile(player.username, str(d.nickname) ?? "", str(d.avatar) ?? "");
        if (p) player.profile = p;
      } else {
        player.profile = AuthStore.guestProfile(str(d.nickname) ?? "", str(d.avatar) ?? "");
      }
      socket.emit(EV.authResult, { ok: true, profile: player.profile, guest: !player.username });
      broadcastLobby();
    });

    on(EV.createRoom, (d) => {
      if (!player.authed || player.roomId) return;
      const s = d.side === "chess" || d.side === "shogi" ? d.side : pick<Side>("chess", "shogi");
      makeRoom(player, s, undefined, isGameMode(d.mode) ? d.mode : "fusion");
      socket.emit(EV.lobby, lobbySnapshot());
      broadcastLobby();
    });
    on(EV.joinRoom, (d) => {
      if (!player.authed || player.roomId) return;
      const room = rooms.get(str(d.roomId) ?? "");
      if (!room || room.guestId) { socket.emit(EV.errorMsg, "房间不可用"); return; }
      const gs = room.openSide;
      room.sides[gs] = player.id; room.profiles[gs] = player.profile!;
      room.guestId = player.id; player.roomId = room.id;
      startGame(room);
    });
    on(EV.invite, (d) => {
      const t = players.get(str(d.targetId) ?? "");
      if (!player.authed || !t || !t.connected || t.roomId || t.id === player.id) return;
      t.socket.emit(EV.incomingInvite, { fromId: player.id, fromName: player.profile!.nickname, fromAvatar: player.profile!.avatar, mode: isGameMode(d.mode) ? d.mode : "fusion" });
    });
    on(EV.acceptInvite, (d) => {
      const host = players.get(str(d.fromId) ?? "");
      if (!player.authed || !host || !host.connected || player.roomId || host.roomId) { socket.emit(EV.errorMsg, "对手已不可用"); return; }
      const room = makeRoom(host, pick<Side>("chess", "shogi"), player, isGameMode(d.mode) ? d.mode : "fusion");
      startGame(room);
    });
    on(EV.declineInvite, (d) => {
      const host = players.get(str(d.fromId) ?? "");
      if (host && player.profile) sendTo(host, EV.inviteDeclined, { fromName: player.profile.nickname });
    });

    on(EV.move, (d) => {
      if (!player.roomId) return;
      const room = rooms.get(player.roomId);
      if (!room || !isActive(room) || room.mode !== "fusion") return;
      const mySide = sideOf(room, player.id);
      if (!mySide || mySide !== room.state.turn) { socket.emit(EV.errorMsg, "还没轮到你"); return; }
      const action = d.action as Action;
      if (!isLegalAction(room.state, action)) { socket.emit(EV.errorMsg, "非法着法"); return; }
      room.state = applyAction(room.state, action);
      room.history.push(action);
      broadcastState(room);
    });
    on(EV.draftAction, (d) => {
      const room = player.roomId ? rooms.get(player.roomId) : undefined;
      if (!room || !isActive(room) || room.mode !== "draft" || !room.draft) return;
      const seat = sideOf(room, player.id);
      if (!seat) return;
      if (!tk.isDraftActionShape(d.action)) { socket.emit(EV.errorMsg, "无效操作"); return; }
      const side = tSideOfSeat(seat);
      const err = tk.draftError(room.draft, side, d.action);
      if (err) { socket.emit(EV.errorMsg, err); return; }
      try { room.draft = tk.applyDraft(room.draft, side, d.action); }
      catch (e) { socket.emit(EV.errorMsg, e instanceof Error ? e.message : "非法操作"); return; }
      scheduleDraft(room);
      broadcastState(room);
    });
    on(EV.resign, () => {
      const room = player.roomId ? rooms.get(player.roomId) : undefined;
      if (!room || !isActive(room)) return;
      const mySide = sideOf(room, player.id);
      if (!mySide) return;
      if (room.mode === "draft" && room.draft) { room.draft = tk.resignDraft(room.draft, tSideOfSeat(mySide)); scheduleDraft(room); }
      else room.state = { ...room.state, result: { kind: "win", winner: otherSide(mySide), reason: "resign" } };
      broadcastState(room);
    });
    on(EV.rematch, () => {
      const room = player.roomId ? rooms.get(player.roomId) : undefined;
      if (!room || !room.guestId || !finished(room)) return;
      room.rematchVotes.add(player.id);
      const other = opponentOf(room, player.id);
      if (other && room.rematchVotes.has(other.id)) { startGame(room); return; }
      sendTo(other, EV.rematchRequested, { fromName: player.profile?.nickname ?? "对手" });
    });
    on(EV.leaveRoom, () => { leaveRoom(player); broadcastLobby(); });

    socket.on("disconnect", () => {
      if (player.socket !== socket) return; // 已被新连接接管
      player.connected = false;
      const room = player.roomId ? rooms.get(player.roomId) : undefined;
      if (room && isActive(room)) {
        // 对局中掉线:保留座位,等待重连
        const status: OpponentStatusMsg = { connected: false, graceMs };
        sendTo(opponentOf(room, player.id), EV.opponentStatus, status);
        player.graceTimer = setTimeout(() => {
          player.graceTimer = undefined;
          if (!player.connected) dropPlayer(player);
          broadcastLobby();
        }, graceMs);
      } else {
        dropPlayer(player);
      }
      broadcastLobby();
    });
  });
}
