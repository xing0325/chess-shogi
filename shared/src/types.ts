// 执棋方:国象 / 将棋
export type Side = "chess" | "shogi";

// 棋子类别。国象用英文,将棋用罗马字。
export type ChessKind = "K" | "Q" | "R" | "B" | "N" | "P"; // 王后车象马兵
export type ShogiKind =
  | "OU" | "HI" | "KAKU" | "KIN" | "GIN" | "KEI" | "KYO" | "FU"; // 玉飛角金銀桂香歩
export type PieceKind = ChessKind | ShogiKind;

export interface Piece {
  side: Side;          // 属于哪一方
  kind: PieceKind;     // 棋子类别
  promoted?: boolean;  // 将棋升变 / 国象升变后(兵升变记为新 kind)
  fromChess?: boolean; // true = 被将棋方吃来、以五边形造型存在的国象子(Plan 2+ 用)
}

// 棋盘坐标:file 0..8 (a..i), rank 0..8 (行1..行9)。rank 0 = 行1(将棋底线)。
export interface Square { file: number; rank: number; }

export const BOARD_SIZE = 9;
export const RIVER_RANK = 4; // 第 5 行 = index 4 = 楚河汉界

// 局面:81 格,每格 Piece 或 null。索引 = rank * 9 + file。
export type Position = (Piece | null)[];

export function otherSide(s: Side): Side {
  return s === "chess" ? "shogi" : "chess";
}

export function idx(file: number, rank: number): number {
  return rank * BOARD_SIZE + file;
}
