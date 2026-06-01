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

// 前进方向(朝敌方):国象在上往下走(-1),将棋在下往上走(+1)。
// 子的前进方向由其"所有者"决定 —— 被将棋打入的国象子也按将棋方向前进。
export function forward(side: Side): number {
  return side === "chess" ? -1 : 1;
}

export function inBounds(file: number, rank: number): boolean {
  return file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
}

export function pieceAt(pos: Position, file: number, rank: number): Piece | null {
  return inBounds(file, rank) ? pos[idx(file, rank)] : null;
}

const CHESS_KINDS: ChessKind[] = ["K", "Q", "R", "B", "N", "P"];
export function isChessKind(k: PieceKind): k is ChessKind {
  return (CHESS_KINDS as string[]).includes(k);
}

// 将棋方升变区 = 敌阵最里 3 行(rank 6/7/8);国象兵升变线 = 对方底线。
export function inShogiPromoZone(rank: number): boolean {
  return rank >= 6;
}

// 国象兵(及被将棋打入的国象兵)到达对方底线时升变。
export function chessPromoRank(side: Side): number {
  return side === "chess" ? 0 : BOARD_SIZE - 1;
}
