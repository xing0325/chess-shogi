import type { Side } from "./types";
import type { Action, GameState } from "./game";
import type { DraftState } from "./taikyoku/draft";
import type { TSide } from "./taikyoku/types";

/** 对局模式:fusion = 国象 vs 将棋(原模式);draft = 大局选将(BP + 5×5) */
export type GameMode = "fusion" | "draft";
export const isGameMode = (m: unknown): m is GameMode => m === "fusion" || m === "draft";

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
  openSide: Side | "random";  // draft 模式下:chess = 蓝方(先手),shogi = 红方(后手)
  mode: GameMode;
}

export interface LobbySnapshot {
  players: PlayerInfo[];
  rooms: RoomInfo[];
}

export interface InviteMsg {
  fromId: string;
  fromName: string;
  fromAvatar: string;
  mode: GameMode;
}

// 大局选将:开局 / 重连
export interface DraftStartMsg {
  roomId: string;
  mySide: TSide;
  opponent: Profile;
  draft: DraftState;
  deadline?: number;       // 当前步骤的截止时间(服务器时间戳 ms)
  serverNow: number;       // 用于客户端校正时钟
  reconnected?: boolean;
}
export interface DraftStateMsg {
  draft: DraftState;
  deadline?: number;
  serverNow: number;
}

export interface GameStartMsg {
  roomId: string;
  mySide: Side;
  opponent: Profile;
  state: GameState;
  history?: Action[];      // 本局已走的着法(断线重连时用于恢复棋谱)
  reconnected?: boolean;   // true = 这是重连恢复,而非新开局
}

// 对手连接状态
export interface OpponentStatusMsg {
  connected: boolean;
  graceMs?: number;        // 掉线时:保留座位的毫秒数
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
  resign: "game:resign",
  // server -> client
  sessionId: "session:id",
  lobby: "lobby:update",
  incomingInvite: "invite:incoming",
  inviteDeclined: "invite:declined",
  gameStart: "game:start",
  gameState: "game:state",
  opponentLeft: "opponent:left",
  opponentStatus: "opponent:status",
  rematchRequested: "game:rematch-requested",
  // 大局选将
  draftAction: "draft:action",   // client -> server { action }
  draftStart: "draft:start",     // server -> client DraftStartMsg
  draftState: "draft:state",     // server -> client DraftStateMsg
  errorMsg: "server:error",
} as const;
