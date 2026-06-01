import {
  type Position, type Square, type Piece, type Side, type PieceKind, type ChessKind,
  idx, otherSide, forward, inBounds, pieceAt, isChessKind, inShogiPromoZone, chessPromoRank,
} from "./types";
import { createInitialPosition } from "./initialPosition";
import { pieceTargets, isAttackedBy } from "./moves";

// ---- 行棋动作 ----
export interface BoardMove {
  type: "move";
  from: Square;
  to: Square;
  promote?: boolean;      // 将棋升变
  promoteTo?: ChessKind;  // 国象兵升变目标(Q/R/B/N)
}
export interface DropMove {
  type: "drop";
  kind: PieceKind;
  fromChess: boolean;
  to: Square;
}
export type Action = BoardMove | DropMove;

// ---- 手牌 / 对局状态 ----
export interface HandGroup { kind: PieceKind; fromChess: boolean; count: number }
export type GameResult =
  | { kind: "win"; winner: Side; reason: "checkmate" | "king-captured" }
  | { kind: "draw" };

export interface GameState {
  position: Position;
  turn: Side;
  hands: { chess: HandGroup[]; shogi: HandGroup[] };
  lastMove?: Square;
  result?: GameResult;
}

export function createInitialState(): GameState {
  return {
    position: createInitialPosition(),
    turn: "chess",
    hands: { chess: [], shogi: [] },
  };
}

// ---- 王 / 将军 ----
function isRoyal(p: Piece): boolean {
  return p.kind === (p.side === "chess" ? "K" : "OU");
}
export function kingCount(pos: Position, side: Side): number {
  let n = 0;
  for (const p of pos) if (p && p.side === side && isRoyal(p)) n++;
  return n;
}
function findKing(pos: Position, side: Side): Square | null {
  for (let r = 0; r < 9; r++) for (let f = 0; f < 9; f++) {
    const p = pos[idx(f, r)];
    if (p && p.side === side && isRoyal(p)) return { file: f, rank: r };
  }
  return null;
}
// 只有当某方"只剩最后一个王"时才需应将
export function mustRespondToCheck(pos: Position, side: Side): boolean {
  return kingCount(pos, side) === 1;
}
export function inCheck(pos: Position, side: Side): boolean {
  if (kingCount(pos, side) !== 1) return false;
  const k = findKing(pos, side);
  return !!k && isAttackedBy(pos, k, otherSide(side));
}

// ---- 升变判定 ----
function isShogiPromotable(p: Piece): boolean {
  if (p.promoted) return false;
  return p.kind === "HI" || p.kind === "KAKU" || p.kind === "GIN"
    || p.kind === "KEI" || p.kind === "KYO" || p.kind === "FU";
}
// 将棋小子落在无法再走的格 → 强制升变
function shogiMustPromote(kind: PieceKind, toRank: number): boolean {
  if (kind === "FU" || kind === "KYO") return toRank === 8;
  if (kind === "KEI") return toRank >= 7;
  return false;
}
function chessPawnPromotes(p: Piece, toRank: number): boolean {
  return isChessKind(p.kind) && p.kind === "P" && toRank === chessPromoRank(p.side);
}

// ---- 生成某格的走子动作(含升变变体)----
function boardMovesFromSquare(pos: Position, from: Square): BoardMove[] {
  const p = pos[idx(from.file, from.rank)];
  if (!p) return [];
  const acts: BoardMove[] = [];
  for (const to of pieceTargets(pos, from, false)) {
    if (chessPawnPromotes(p, to.rank)) {
      // 国象兵到底线:强制升变,默认后(UI 可改)
      acts.push({ type: "move", from, to, promoteTo: "Q" });
      continue;
    }
    if (p.side === "shogi" && isShogiPromotable(p) &&
        (inShogiPromoZone(from.rank) || inShogiPromoZone(to.rank))) {
      const must = shogiMustPromote(p.kind, to.rank);
      acts.push({ type: "move", from, to, promote: true });
      if (!must) acts.push({ type: "move", from, to });
      continue;
    }
    acts.push({ type: "move", from, to });
  }
  return acts;
}

// ---- 打入(仅将棋方)----
function fileHasUnpromotedShogiPawn(pos: Position, file: number, side: Side): boolean {
  for (let r = 0; r < 9; r++) {
    const p = pos[idx(file, r)];
    if (p && p.side === side && p.kind === "FU" && !p.promoted && !p.fromChess) return true;
  }
  return false;
}
function canDropOn(pos: Position, g: HandGroup, side: Side, to: Square): boolean {
  if (pieceAt(pos, to.file, to.rank)) return false; // 必须空格
  // 落子后无法再走的格(以所有者前进方向计)
  const dir = forward(side);
  const lastRank = dir === 1 ? 8 : 0;
  const secondLast = dir === 1 ? 7 : 1;
  if (!g.fromChess) {
    if ((g.kind === "FU" || g.kind === "KYO") && to.rank === lastRank) return false;
    if (g.kind === "KEI" && (to.rank === lastRank || to.rank === secondLast)) return false;
    if (g.kind === "FU" && fileHasUnpromotedShogiPawn(pos, to.file, side)) return false; // 二步
  } else {
    if (g.kind === "P" && to.rank === lastRank) return false; // 国象兵无法再走
  }
  return true;
}
function dropMoves(pos: Position, side: Side, hands: HandGroup[]): DropMove[] {
  const acts: DropMove[] = [];
  for (const g of hands) {
    if (g.count <= 0) continue;
    for (let r = 0; r < 9; r++) for (let f = 0; f < 9; f++) {
      const to = { file: f, rank: r };
      if (canDropOn(pos, g, side, to)) acts.push({ type: "drop", kind: g.kind, fromChess: g.fromChess, to });
    }
  }
  return acts;
}

// ---- 应用动作 ----
function cloneHands(h: GameState["hands"]): GameState["hands"] {
  return { chess: h.chess.map((g) => ({ ...g })), shogi: h.shogi.map((g) => ({ ...g })) };
}
function addHand(hand: HandGroup[], kind: PieceKind, fromChess: boolean): void {
  const g = hand.find((x) => x.kind === kind && x.fromChess === fromChess);
  if (g) g.count++; else hand.push({ kind, fromChess, count: 1 });
}
function removeHand(hand: HandGroup[], kind: PieceKind, fromChess: boolean): void {
  const i = hand.findIndex((x) => x.kind === kind && x.fromChess === fromChess);
  if (i < 0) return;
  hand[i].count--;
  if (hand[i].count <= 0) hand.splice(i, 1);
}

// 不计算胜负的纯应用(供合法性过滤复用,避免递归)
function applyRaw(state: GameState, a: Action): GameState {
  const pos = state.position.slice();
  const side = state.turn;
  const hands = cloneHands(state.hands);

  if (a.type === "move") {
    const p = pos[idx(a.from.file, a.from.rank)]!;
    const captured = pos[idx(a.to.file, a.to.rank)];
    if (captured && side === "shogi" && !isRoyal(captured)) {
      // 将棋方吃子入手:国象子保留 kind 标 fromChess;将棋子去升变
      if (isChessKind(captured.kind)) addHand(hands.shogi, captured.kind, true);
      else addHand(hands.shogi, captured.kind, false);
    }
    let np: Piece = { ...p };
    if (a.promoteTo) np = { side: p.side, kind: a.promoteTo };
    else if (a.promote) np.promoted = true;
    pos[idx(a.to.file, a.to.rank)] = np;
    pos[idx(a.from.file, a.from.rank)] = null;
    return { position: pos, turn: otherSide(side), hands, lastMove: a.to };
  }
  // drop
  removeHand(hands[side], a.kind, a.fromChess);
  pos[idx(a.to.file, a.to.rank)] = { side, kind: a.kind, ...(a.fromChess ? { fromChess: true } : {}) };
  return { position: pos, turn: otherSide(side), hands, lastMove: a.to };
}

// ---- 合法动作 ----
export function legalActions(state: GameState): Action[] {
  const side = state.turn;
  const pos = state.position;
  let acts: Action[] = [];
  for (let r = 0; r < 9; r++) for (let f = 0; f < 9; f++) {
    const p = pos[idx(f, r)];
    if (p && p.side === side) acts.push(...boardMovesFromSquare(pos, { file: f, rank: r }));
  }
  if (side === "shogi") acts.push(...dropMoves(pos, side, state.hands.shogi));

  // 只剩一王时:过滤掉走后己方王仍被将的动作
  if (mustRespondToCheck(pos, side)) {
    acts = acts.filter((a) => !inCheck(applyRaw(state, a).position, side));
  }
  return acts;
}

function sameSq(a: Square, b: Square): boolean { return a.file === b.file && a.rank === b.rank; }

// UI 用:某格的合法落点(去重)
export function legalDestinations(state: GameState, from: Square): Square[] {
  const seen = new Set<number>();
  const out: Square[] = [];
  for (const a of legalActions(state)) {
    if (a.type === "move" && sameSq(a.from, from)) {
      const k = idx(a.to.file, a.to.rank);
      if (!seen.has(k)) { seen.add(k); out.push(a.to); }
    }
  }
  return out;
}
// UI 用:某手牌的合法落点
export function legalDropDestinations(state: GameState, kind: PieceKind, fromChess: boolean): Square[] {
  const out: Square[] = [];
  for (const a of legalActions(state))
    if (a.type === "drop" && a.kind === kind && a.fromChess === fromChess) out.push(a.to);
  return out;
}
// UI 用:某步是否可升 / 是否必须升
export function promotionOptions(state: GameState, from: Square, to: Square): { canPromote: boolean; canStay: boolean; isChessPawn: boolean } {
  let canPromote = false, canStay = false, isChessPawn = false;
  for (const a of legalActions(state)) {
    if (a.type !== "move" || !sameSq(a.from, from) || !sameSq(a.to, to)) continue;
    if (a.promoteTo) { isChessPawn = true; canPromote = true; }
    else if (a.promote) canPromote = true;
    else canStay = true;
  }
  return { canPromote, canStay, isChessPawn };
}

// ---- 应用动作并计算胜负 ----
export function applyAction(state: GameState, a: Action): GameState {
  const next = applyRaw(state, a);
  next.result = computeResult(next);
  return next;
}

// 评估当前局面胜负(side = state.turn 视角)
export function status(state: GameState): GameResult | undefined {
  return computeResult(state);
}

// 服务器权威校验:某动作是否在当前合法动作集中
export function isLegalAction(state: GameState, a: Action): boolean {
  const acts = legalActions(state);
  if (a.type === "drop") {
    return acts.some((b) => b.type === "drop" && b.kind === a.kind
      && b.fromChess === a.fromChess && sameSq(b.to, a.to));
  }
  // 国象兵升变:目标 kind 任选 Q/R/B/N,只要该 from→to 升变步合法
  if (a.promoteTo) {
    if (!(["Q", "R", "B", "N"] as string[]).includes(a.promoteTo)) return false;
    return acts.some((b) => b.type === "move" && sameSq(b.from, a.from) && sameSq(b.to, a.to) && !!b.promoteTo);
  }
  return acts.some((b) => b.type === "move" && sameSq(b.from, a.from)
    && sameSq(b.to, a.to) && !!b.promote === !!a.promote && !b.promoteTo);
}

function computeResult(state: GameState): GameResult | undefined {
  const pos = state.position;
  if (kingCount(pos, "chess") === 0) return { kind: "win", winner: "shogi", reason: "king-captured" };
  if (kingCount(pos, "shogi") === 0) return { kind: "win", winner: "chess", reason: "king-captured" };
  const side = state.turn;
  const moves = legalActions(state);
  if (moves.length === 0) {
    if (inCheck(pos, side)) return { kind: "win", winner: otherSide(side), reason: "checkmate" };
    return { kind: "draw" };
  }
  return undefined;
}

// 便捷:在 legalActions 里找一个匹配 from→to(+升变意向)的动作
export function findMove(state: GameState, from: Square, to: Square, promote?: boolean, promoteTo?: ChessKind): BoardMove | undefined {
  let fallback: BoardMove | undefined;
  for (const a of legalActions(state)) {
    if (a.type !== "move" || !sameSq(a.from, from) || !sameSq(a.to, to)) continue;
    if (promoteTo) { if (a.promoteTo) return { ...a, promoteTo }; continue; }
    if (promote === true && a.promote) return a;
    if (promote === false && !a.promote && !a.promoteTo) return a;
    fallback = a;
  }
  return fallback;
}

export { inBounds };
