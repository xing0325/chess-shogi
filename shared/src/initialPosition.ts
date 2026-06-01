import { BOARD_SIZE, idx, type Piece, type Position, type ChessKind, type ShogiKind } from "./types";

export function createInitialPosition(): Position {
  const pos: Position = new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  const C = (kind: ChessKind): Piece => ({ side: "chess", kind });
  const S = (kind: ShogiKind): Piece => ({ side: "shogi", kind });

  // 国象后排(行9 = rank8):车马象 王 后 王 象马车 —— Queen 居中(file4),两 King 在 file3/5
  const chessBack: ChessKind[] = ["R", "N", "B", "K", "Q", "K", "B", "N", "R"];
  chessBack.forEach((k, f) => { pos[idx(f, 8)] = C(k); });
  // 国象兵(行8 = rank7):9 个
  for (let f = 0; f < 9; f++) pos[idx(f, 7)] = C("P");

  // 将棋后排(行1 = rank0):香桂銀 金 玉 金 銀桂香
  const shogiBack: ShogiKind[] = ["KYO", "KEI", "GIN", "KIN", "OU", "KIN", "GIN", "KEI", "KYO"];
  shogiBack.forEach((k, f) => { pos[idx(f, 0)] = S(k); });
  // 飛 / 角(行2 = rank1)
  pos[idx(1, 1)] = S("HI");
  pos[idx(7, 1)] = S("KAKU");
  // 将棋歩(行3 = rank2):9 个
  for (let f = 0; f < 9; f++) pos[idx(f, 2)] = S("FU");

  return pos;
}
