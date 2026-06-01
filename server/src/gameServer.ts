import type { Server, Socket } from "socket.io";
import {
  createInitialState, applyAction, isLegalAction, otherSide,
  EV, type Action, type GameState, type Side,
  type PlayerInfo, type RoomInfo, type LobbySnapshot, type GameStartMsg,
} from "@cs/shared";

interface Player { id: string; name: string; socket: Socket; roomId?: string; }
interface Room {
  id: string;
  hostId: string;
  hostName: string;
  openSide: Side;                       // 客人进房将执的边
  guestId?: string;
  sides: Partial<Record<Side, string>>; // 边 -> 玩家 id
  names: Record<Side, string>;
  state: GameState;
}

function pick<T>(a: T, b: T): T { return Math.random() < 0.5 ? a : b; }

export function attachGameServer(io: Server): void {
  const players = new Map<string, Player>();
  const rooms = new Map<string, Room>();
  let roomSeq = 0;
  const newRoomId = (): string => `r${++roomSeq}`;

  function lobbySnapshot(): LobbySnapshot {
    const ps: PlayerInfo[] = [...players.values()]
      .filter((p) => p.name)
      .map((p) => ({ id: p.id, name: p.name, status: p.roomId ? "playing" : "idle" }));
    const rs: RoomInfo[] = [...rooms.values()]
      .filter((r) => !r.guestId)
      .map((r) => ({ id: r.id, hostName: r.hostName, openSide: r.openSide }));
    return { players: ps, rooms: rs };
  }
  const broadcastLobby = (): void => { io.emit(EV.lobby, lobbySnapshot()); };

  function startGame(room: Room): void {
    room.state = createInitialState();
    (["chess", "shogi"] as Side[]).forEach((side) => {
      const pid = room.sides[side];
      const p = pid ? players.get(pid) : undefined;
      if (!p) return;
      const msg: GameStartMsg = {
        roomId: room.id,
        mySide: side,
        opponentName: room.names[otherSide(side)],
        state: room.state,
      };
      p.socket.emit(EV.gameStart, msg);
    });
    broadcastLobby();
  }

  function makeRoom(host: Player, hostSide: Side, guest?: Player): Room {
    const id = newRoomId();
    const room: Room = {
      id, hostId: host.id, hostName: host.name,
      openSide: otherSide(hostSide),
      sides: {}, names: { chess: "", shogi: "" }, state: createInitialState(),
    };
    room.sides[hostSide] = host.id; room.names[hostSide] = host.name;
    host.roomId = id;
    if (guest) {
      room.sides[otherSide(hostSide)] = guest.id;
      room.names[otherSide(hostSide)] = guest.name;
      room.guestId = guest.id;
      guest.roomId = id;
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
    players.set(socket.id, { id: socket.id, name: "", socket });

    socket.on(EV.join, (data: { name?: string }) => {
      const p = players.get(socket.id); if (!p) return;
      p.name = (data?.name || "无名").slice(0, 20);
      socket.emit(EV.lobby, lobbySnapshot());
      broadcastLobby();
    });

    socket.on(EV.createRoom, (data: { side?: Side | "random" }) => {
      const p = players.get(socket.id); if (!p || !p.name || p.roomId) return;
      const hostSide: Side = data?.side && data.side !== "random" ? data.side : pick<Side>("chess", "shogi");
      makeRoom(p, hostSide);
      socket.emit(EV.lobby, lobbySnapshot());
      broadcastLobby();
    });

    socket.on(EV.joinRoom, (data: { roomId: string }) => {
      const p = players.get(socket.id); if (!p || !p.name || p.roomId) return;
      const room = rooms.get(data?.roomId);
      if (!room || room.guestId) { socket.emit(EV.errorMsg, "房间不可用"); return; }
      const guestSide = room.openSide;
      room.sides[guestSide] = p.id; room.names[guestSide] = p.name;
      room.guestId = p.id; p.roomId = room.id;
      startGame(room);
    });

    socket.on(EV.invite, (data: { targetId: string }) => {
      const p = players.get(socket.id); const t = players.get(data?.targetId);
      if (!p || !p.name || !t || t.roomId || t.id === p.id) return;
      t.socket.emit(EV.incomingInvite, { fromId: p.id, fromName: p.name });
    });

    socket.on(EV.acceptInvite, (data: { fromId: string }) => {
      const p = players.get(socket.id); const host = players.get(data?.fromId);
      if (!p || !host || p.roomId || host.roomId) { socket.emit(EV.errorMsg, "对手已不可用"); return; }
      const room = makeRoom(host, pick<Side>("chess", "shogi"), p);
      startGame(room);
    });

    socket.on(EV.declineInvite, (data: { fromId: string }) => {
      const host = players.get(data?.fromId); const p = players.get(socket.id);
      if (host && p) host.socket.emit(EV.inviteDeclined, { fromName: p.name });
    });

    socket.on(EV.move, (data: { action: Action }) => {
      const p = players.get(socket.id); if (!p || !p.roomId) return;
      const room = rooms.get(p.roomId); if (!room || !room.guestId) return;
      if (room.state.result) return;
      const mySide: Side | null =
        room.sides.chess === p.id ? "chess" : room.sides.shogi === p.id ? "shogi" : null;
      if (!mySide || mySide !== room.state.turn) { socket.emit(EV.errorMsg, "还没轮到你"); return; }
      if (!isLegalAction(room.state, data.action)) { socket.emit(EV.errorMsg, "非法着法"); return; }
      room.state = applyAction(room.state, data.action);
      (["chess", "shogi"] as Side[]).forEach((side) => {
        const pid = room.sides[side]; const pl = pid ? players.get(pid) : undefined;
        if (pl) pl.socket.emit(EV.gameState, { state: room.state });
      });
    });

    socket.on(EV.rematch, () => {
      const p = players.get(socket.id); if (!p || !p.roomId) return;
      const room = rooms.get(p.roomId); if (!room || !room.guestId) return;
      startGame(room);
    });

    socket.on(EV.leaveRoom, () => {
      const p = players.get(socket.id); if (p) { leaveRoom(p); broadcastLobby(); }
    });

    socket.on("disconnect", () => {
      const p = players.get(socket.id);
      if (p) { leaveRoom(p); players.delete(socket.id); }
      broadcastLobby();
    });
  });
}
