import type { Server, Socket } from "socket.io";
import {
  createInitialState, applyAction, isLegalAction, otherSide,
  EV, type Action, type GameState, type Side, type Profile, type AuthResult,
  type PlayerInfo, type RoomInfo, type LobbySnapshot, type GameStartMsg,
} from "@cs/shared";
import { AuthStore } from "./auth";

interface Player {
  id: string;
  socket: Socket;
  authed: boolean;
  profile?: Profile;
  username?: string; // 注册账号才有(游客为空)
  roomId?: string;
}
interface Room {
  id: string;
  hostId: string;
  openSide: Side;                          // 客人进房将执的边
  guestId?: string;
  sides: Partial<Record<Side, string>>;    // 边 -> 玩家 id
  profiles: Partial<Record<Side, Profile>>;// 边 -> 档案
  state: GameState;
}

function pick<T>(a: T, b: T): T { return Math.random() < 0.5 ? a : b; }

export function attachGameServer(io: Server, store: AuthStore): void {
  const players = new Map<string, Player>();
  const rooms = new Map<string, Room>();
  let roomSeq = 0;
  const newRoomId = (): string => `r${++roomSeq}`;

  function lobbySnapshot(): LobbySnapshot {
    const ps: PlayerInfo[] = [...players.values()]
      .filter((p) => p.authed && p.profile)
      .map((p) => ({ id: p.id, name: p.profile!.nickname, avatar: p.profile!.avatar, status: p.roomId ? "playing" : "idle" }));
    const rs: RoomInfo[] = [...rooms.values()]
      .filter((r) => !r.guestId)
      .map((r) => {
        const host = r.profiles[otherSide(r.openSide)];
        return { id: r.id, hostName: host?.nickname ?? "?", hostAvatar: host?.avatar ?? "wP", openSide: r.openSide };
      });
    return { players: ps, rooms: rs };
  }
  const broadcastLobby = (): void => { io.emit(EV.lobby, lobbySnapshot()); };

  function startGame(room: Room): void {
    room.state = createInitialState();
    (["chess", "shogi"] as Side[]).forEach((side) => {
      const pid = room.sides[side];
      const p = pid ? players.get(pid) : undefined;
      const opp = room.profiles[otherSide(side)];
      if (!p || !opp) return;
      const msg: GameStartMsg = { roomId: room.id, mySide: side, opponent: opp, state: room.state };
      p.socket.emit(EV.gameStart, msg);
    });
    broadcastLobby();
  }

  function makeRoom(host: Player, hostSide: Side, guest?: Player): Room {
    const id = newRoomId();
    const room: Room = {
      id, hostId: host.id, openSide: otherSide(hostSide),
      sides: {}, profiles: {}, state: createInitialState(),
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

  function leaveRoom(p: Player): void {
    if (!p.roomId) return;
    const room = rooms.get(p.roomId);
    if (room) {
      (["chess", "shogi"] as Side[]).forEach((side) => {
        const pid = room.sides[side];
        if (pid && pid !== p.id) {
          const other = players.get(pid);
          if (other) { other.socket.emit(EV.opponentLeft); other.roomId = undefined; }
        }
      });
      rooms.delete(room.id);
    }
    p.roomId = undefined;
  }

  io.on("connection", (socket) => {
    const player: Player = { id: socket.id, socket, authed: false };
    players.set(socket.id, player);

    function applyAuth(res: AuthResult, username?: string): void {
      socket.emit(EV.authResult, res);
      if (!res.ok || !res.profile) return;
      player.authed = true;
      player.profile = res.profile;
      player.username = username;
      socket.emit(EV.lobby, lobbySnapshot());
      broadcastLobby();
    }

    socket.on(EV.authRegister, (d: { username: string; password: string; nickname: string; avatar: string }) => {
      const res = store.register(d?.username, d?.password, d?.nickname, d?.avatar);
      applyAuth(res, res.ok ? d.username.trim() : undefined);
    });
    socket.on(EV.authLogin, (d: { username: string; password: string }) => {
      const res = store.login(d?.username, d?.password);
      applyAuth(res, res.ok ? d.username.trim() : undefined);
    });
    socket.on(EV.authToken, (d: { token: string }) => {
      const res = store.resume(d?.token);
      applyAuth(res, res.ok ? store.usernameFromToken(d.token) ?? undefined : undefined);
    });
    socket.on(EV.authGuest, (d: { nickname: string; avatar: string }) => {
      applyAuth({ ok: true, guest: true, profile: AuthStore.guestProfile(d?.nickname, d?.avatar) });
    });
    socket.on(EV.join, (d: { name?: string; avatar?: string }) => {
      applyAuth({ ok: true, guest: true, profile: AuthStore.guestProfile(d?.name ?? "", d?.avatar ?? "") });
    });

    socket.on(EV.updateProfile, (d: { nickname: string; avatar: string }) => {
      if (!player.authed) return;
      if (player.username) {
        const p = store.updateProfile(player.username, d?.nickname, d?.avatar);
        if (p) player.profile = p;
      } else {
        player.profile = AuthStore.guestProfile(d?.nickname, d?.avatar);
      }
      socket.emit(EV.authResult, { ok: true, profile: player.profile, guest: !player.username });
      broadcastLobby();
    });

    socket.on(EV.createRoom, (d: { side?: Side | "random" }) => {
      if (!player.authed || player.roomId) return;
      const hostSide: Side = d?.side && d.side !== "random" ? d.side : pick<Side>("chess", "shogi");
      makeRoom(player, hostSide);
      socket.emit(EV.lobby, lobbySnapshot());
      broadcastLobby();
    });

    socket.on(EV.joinRoom, (d: { roomId: string }) => {
      if (!player.authed || player.roomId) return;
      const room = rooms.get(d?.roomId);
      if (!room || room.guestId) { socket.emit(EV.errorMsg, "房间不可用"); return; }
      const gs = room.openSide;
      room.sides[gs] = player.id; room.profiles[gs] = player.profile!;
      room.guestId = player.id; player.roomId = room.id;
      startGame(room);
    });

    socket.on(EV.invite, (d: { targetId: string }) => {
      const t = players.get(d?.targetId);
      if (!player.authed || !t || t.roomId || t.id === player.id) return;
      t.socket.emit(EV.incomingInvite, { fromId: player.id, fromName: player.profile!.nickname, fromAvatar: player.profile!.avatar });
    });
    socket.on(EV.acceptInvite, (d: { fromId: string }) => {
      const host = players.get(d?.fromId);
      if (!player.authed || !host || player.roomId || host.roomId) { socket.emit(EV.errorMsg, "对手已不可用"); return; }
      const room = makeRoom(host, pick<Side>("chess", "shogi"), player);
      startGame(room);
    });
    socket.on(EV.declineInvite, (d: { fromId: string }) => {
      const host = players.get(d?.fromId);
      if (host && player.profile) host.socket.emit(EV.inviteDeclined, { fromName: player.profile.nickname });
    });

    socket.on(EV.move, (d: { action: Action }) => {
      if (!player.roomId) return;
      const room = rooms.get(player.roomId);
      if (!room || !room.guestId || room.state.result) return;
      const mySide: Side | null =
        room.sides.chess === player.id ? "chess" : room.sides.shogi === player.id ? "shogi" : null;
      if (!mySide || mySide !== room.state.turn) { socket.emit(EV.errorMsg, "还没轮到你"); return; }
      if (!isLegalAction(room.state, d.action)) { socket.emit(EV.errorMsg, "非法着法"); return; }
      room.state = applyAction(room.state, d.action);
      (["chess", "shogi"] as Side[]).forEach((side) => {
        const pid = room.sides[side]; const pl = pid ? players.get(pid) : undefined;
        if (pl) pl.socket.emit(EV.gameState, { state: room.state });
      });
    });

    socket.on(EV.rematch, () => {
      if (!player.roomId) return;
      const room = rooms.get(player.roomId);
      if (room && room.guestId) startGame(room);
    });

    socket.on(EV.leaveRoom, () => { leaveRoom(player); broadcastLobby(); });
    socket.on("disconnect", () => { leaveRoom(player); players.delete(socket.id); broadcastLobby(); });
  });
}
