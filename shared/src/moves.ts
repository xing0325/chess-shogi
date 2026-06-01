import {
  type Position, type Square, type Piece, type PieceKind,
  idx, forward, inBounds, pieceAt,
} from "./types";

// 方向常量
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KING_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];

// 金将走法(6 格):前 / 两前斜 / 左右 / 正后。fd = 前进方向。
function goldSteps(fd: number): number[][] {
  return [[0, fd], [-1, fd], [1, fd], [-1, 0], [1, 0], [0, -fd]];
}

/**
 * 某格棋子的所有目标格(伪合法 —— 不考虑走后是否被将)。
 * forAttack=true:用于"被攻击/将军"判定,此时所有能打到的格子都算(不管目标是否有子),
 * 且兵/歩按"攻击格"而非"移动格"计算。
 */
export function pieceTargets(pos: Position, sq: Square, forAttack = false): Square[] {
  const p = pos[idx(sq.file, sq.rank)];
  if (!p) return [];
  const fd = forward(p.side);
  const out: Square[] = [];

  const own = (f: number, r: number): boolean => {
    const q = pieceAt(pos, f, r);
    return !!q && q.side === p.side;
  };
  const enemy = (f: number, r: number): boolean => {
    const q = pieceAt(pos, f, r);
    return !!q && q.side !== p.side;
  };
  // 非滑行的单步:能落在空格或敌子上(forAttack 时所有格都算)
  const step = (f: number, r: number): void => {
    if (!inBounds(f, r)) return;
    if (forAttack || !own(f, r)) out.push({ file: f, rank: r });
  };
  // 滑行:沿方向走到底,遇子停;敌子(或 forAttack 时任意子)所在格算目标
  const slide = (df: number, dr: number): void => {
    let f = sq.file + df, r = sq.rank + dr;
    while (inBounds(f, r)) {
      const q = pieceAt(pos, f, r);
      if (!q) { out.push({ file: f, rank: r }); }
      else { if (forAttack || q.side !== p.side) out.push({ file: f, rank: r }); break; }
      f += df; r += dr;
    }
  };

  const kind: PieceKind = p.kind;
  const promoted = !!p.promoted;

  // ---- 国象子(含被将棋打入、保留国象走法的子)----
  switch (kind) {
    case "K": KING_DIRS.forEach(([df, dr]) => step(sq.file + df, sq.rank + dr)); return out;
    case "Q": KING_DIRS.forEach(([df, dr]) => slide(df, dr)); return out;
    case "R": ROOK_DIRS.forEach(([df, dr]) => slide(df, dr)); return out;
    case "B": BISHOP_DIRS.forEach(([df, dr]) => slide(df, dr)); return out;
    case "N":
      [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
        .forEach(([df, dr]) => step(sq.file + df, sq.rank + dr));
      return out;
    case "P": {
      // 攻击:斜前两格;移动:正前 1(空)、起步 2(空)、斜前吃子
      const lf = sq.file - 1, rf = sq.file + 1, r1 = sq.rank + fd;
      if (forAttack) { step(lf, r1); step(rf, r1); return out; }
      if (inBounds(sq.file, r1) && !pieceAt(pos, sq.file, r1)) {
        out.push({ file: sq.file, rank: r1 });
        const homeRank = p.side === "chess" ? 7 : 1;
        const r2 = sq.rank + 2 * fd;
        if (sq.rank === homeRank && inBounds(sq.file, r2) && !pieceAt(pos, sq.file, r2))
          out.push({ file: sq.file, rank: r2 });
      }
      if (enemy(lf, r1)) out.push({ file: lf, rank: r1 });
      if (enemy(rf, r1)) out.push({ file: rf, rank: r1 });
      return out;
    }
  }

  // ---- 将棋子 ----
  // 升变后的小子(歩/香/桂/銀)一律走金
  if (promoted && (kind === "FU" || kind === "KYO" || kind === "KEI" || kind === "GIN")) {
    goldSteps(fd).forEach(([df, dr]) => step(sq.file + df, sq.rank + dr));
    return out;
  }

  switch (kind) {
    case "OU": KING_DIRS.forEach(([df, dr]) => step(sq.file + df, sq.rank + dr)); return out;
    case "KIN": goldSteps(fd).forEach(([df, dr]) => step(sq.file + df, sq.rank + dr)); return out;
    case "GIN": // 銀:正前 + 4 斜
      [[0, fd], [-1, fd], [1, fd], [-1, -fd], [1, -fd]]
        .forEach(([df, dr]) => step(sq.file + df, sq.rank + dr));
      return out;
    case "KEI": // 桂:两前一侧(只往前跳)
      [[-1, 2 * fd], [1, 2 * fd]].forEach(([df, dr]) => step(sq.file + df, sq.rank + dr));
      return out;
    case "KYO": // 香:正前滑行(升变已在上面处理)
      slide(0, fd); return out;
    case "FU": // 歩:正前 1(攻击格也是正前 1)
      step(sq.file, sq.rank + fd); return out;
    case "HI": // 飛:十字滑行;升变(龍)再加四斜单步
      ROOK_DIRS.forEach(([df, dr]) => slide(df, dr));
      if (promoted) BISHOP_DIRS.forEach(([df, dr]) => step(sq.file + df, sq.rank + dr));
      return out;
    case "KAKU": // 角:斜向滑行;升变(馬)再加四正单步
      BISHOP_DIRS.forEach(([df, dr]) => slide(df, dr));
      if (promoted) ROOK_DIRS.forEach(([df, dr]) => step(sq.file + df, sq.rank + dr));
      return out;
  }
  return out;
}

// 某方是否攻击到指定格(用于将军/能否走入判定)。
export function isAttackedBy(pos: Position, target: Square, bySide: Piece["side"]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let f = 0; f < 9; f++) {
      const q = pos[idx(f, r)];
      if (!q || q.side !== bySide) continue;
      const ts = pieceTargets(pos, { file: f, rank: r }, true);
      if (ts.some((t) => t.file === target.file && t.rank === target.rank)) return true;
    }
  }
  return false;
}
