// 大局选将(大局将棋 BP 模式)的类型定义
// 坐标:x = 0..4(从先手视角的左到右),y = 0..4(先手底线 y=0,后手底线 y=4)

export const SIZE = 5;

export type TSide = "sente" | "gote"; // 先手 / 后手
export const otherT = (s: TSide): TSide => (s === "sente" ? "gote" : "sente");

export interface Sq { x: number; y: number }

/** 走法规则(向量以棋子自身朝向为准,+y = 向前) */
export type Rule =
  | { t: "slide"; d: [number, number]; max: number | null; mode?: "m" | "c"; hops?: number }
  | { t: "leap"; d: [number, number]; mode?: "m" | "c" }
  | { t: "jumpslide"; d: [number, number]; jump: number; max: number | null; jmode?: "m" | "c" }
  | { t: "hook"; d: [number, number]; turn: [number, number][] }
  | { t: "lion" }
  | { t: "igui" }
  | { t: "rangecap"; d: [number, number] };

export interface KindDef {
  id: string;
  kanji: string;
  en: string;
  rank: number;              // 跳越吃子的等级:1 最高(王/太子),5 普通棋子
  base: boolean;             // 是否作为初始棋子存在(否则只是升变结果)
  inPool: boolean;           // 是否进入 BP 卡池
  promotesTo: string | null; // 升变后的棋子 id
  betza: string;             // 维基百科原始记法(仅供展示/核对)
  rules: Rule[];
}

export interface TPiece {
  side: TSide;
  kind: string;      // 当前棋子 id(升变后即为升变后的 id)
  from?: string;     // 升变前的 id(存在即表示已升变)
}

export interface TMove {
  from: Sq;
  to: Sq;
  via?: Sq;          // 狮子类连续走的第一步(吃子格);to 与 from 相同即"居喰"
  promote?: boolean;
  caps?: Sq[];       // 本步吃掉的所有格(由引擎生成,客户端提交时可省略)
}

export type TResult =
  | { kind: "win"; winner: TSide; reason: "checkmate" | "no-moves" | "resign" | "abandon" | "timeout" }
  | { kind: "draw"; reason: "repetition" | "move-limit" };

export interface TGame {
  board: (TPiece | null)[]; // 25 格,idx = y*5+x
  turn: TSide;
  ply: number;
  lastMove?: TMove;
  result?: TResult;
  keys: string[];          // 每手后的局面键(千日手判定)
}
