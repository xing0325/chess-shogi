import type { Side } from "./types";
import type { GameState } from "./game";

// 玩家档案:昵称 + 头像 id
export interface Profile {
  nickname: string;
  avatar: string;
}

// 可选头像 id(实际图形在前端渲染;此处用于前后端校验一致)
export const AVATAR_IDS = [
  "wK", "wQ", "wR", "wB", "wN", "wP", "OU", "HI", "KAKU", "KIN", "GIN", "FU",
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export function isValidAvatar(a: string): boolean {
  return (AVATAR_IDS as readonly string[]).includes(a);
}
export const DEFAULT_AVATAR: AvatarId = "wP";

// 大厅里的在线玩家
export interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  status: "idle" | "playing";
}

// 等待对手的开放房间
export interface RoomInfo {
  id: string;
  hostName: string;
  hostAvatar: string;
  openSide: Side | "random";
}

export interface LobbySnapshot {
  players: PlayerInfo[];
  rooms: RoomInfo[];
}

export interface InviteMsg {
  fromId: string;
  fromName: string;
  fromAvatar: string;
}

export interface GameStartMsg {
  roomId: string;
  mySide: Side;
  opponent: Profile;
  state: GameState;
}

// 登录/注册成功返回
export interface AuthResult {
  ok: boolean;
  error?: string;
  token?: string;     // 注册账号时下发(游客无)
  profile?: Profile;
  guest?: boolean;
}

// Socket 事件名(客户端/服务器共用)
export const EV = {
  // 鉴权 client -> server
  authRegister: "auth:register",
  authLogin: "auth:login",
  authGuest: "auth:guest",
  authToken: "auth:token",
  updateProfile: "profile:update",
  // 鉴权 server -> client
  authResult: "auth:result",
  // 大厅/对局 client -> server
  join: "lobby:join", // 兼容:等价游客登录(name[, avatar])
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
