import type { Side } from "./types";
import type { GameState } from "./game";

// 大厅里的在线玩家
export interface PlayerInfo {
  id: string;
  name: string;
  status: "idle" | "playing";
}

// 等待对手的开放房间
export interface RoomInfo {
  id: string;
  hostName: string;
  openSide: Side | "random"; // 客人将执的边(random=进房随机)
}

export interface LobbySnapshot {
  players: PlayerInfo[];
  rooms: RoomInfo[];
}

export interface InviteMsg {
  fromId: string;
  fromName: string;
}

export interface GameStartMsg {
  roomId: string;
  mySide: Side;
  opponentName: string;
  state: GameState;
}

// Socket 事件名(客户端/服务器共用,避免拼写不一致)
export const EV = {
  // client -> server
  join: "lobby:join",
  createRoom: "room:create",
  joinRoom: "room:join",
  leaveRoom: "room:leave",
  invite: "invite:send",
  acceptInvite: "invite:accept",
  declineInvite: "invite:decline",
  move: "game:move",
  rematch: "game:rematch",
  // server -> client
  lobby: "lobby:update",
  incomingInvite: "invite:incoming",
  inviteDeclined: "invite:declined",
  gameStart: "game:start",
  gameState: "game:state",
  opponentLeft: "opponent:left",
  errorMsg: "server:error",
} as const;
