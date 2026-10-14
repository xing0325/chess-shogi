import { KIND, KING, POOL_IDS, applyMove, emptyBoard, hasAnyMove, homeRows, idx, kingAttacked, kingSquare, legalMoves, moveLabel, startGame } from "./engine";
import { SIZE, otherT, type Sq, type TGame, type TMove, type TSide } from "./types";

/**
 * 大局选将:
 *  1) 从 205 种大局将棋棋子里随机抽 24 种组成本局卡池;
 *  2) 按英雄联盟职业赛 BP 顺序轮流禁用 / 选择(每种棋子全局唯一);
 *  3) 双方交替把 王将 + 5 枚选中的棋子布在己方底部两行;
 *  4) 先手(蓝方)先走,吃王即胜(实现为:不能送将,无合法着法者负)。
 * 蓝方 = 先手:一选、先布阵、先走;红方 = 后手:拿到最后一选(反制)和最后布阵。
 */
export type Team = "blue" | "red";
export const teamOf = (s: TSide): Team => (s === "sente" ? "blue" : "red");
export const sideOf = (t: Team): TSide => (t === "blue" ? "sente" : "gote");

export interface DraftStep { team: Team; act: "ban" | "pick" }
const B = (team: Team): DraftStep => ({ team, act: "ban" });
const P = (team: Team): DraftStep => ({ team, act: "pick" });
/** 英雄联盟职业赛(Tournament Draft)顺序:3 禁 → 3 选 → 2 禁 → 2 选 */
export const DRAFT_ORDER: DraftStep[] = [
  B("blue"), B("red"), B("blue"), B("red"), B("blue"), B("red"),
  P("blue"), P("red"), P("red"), P("blue"), P("blue"), P("red"),
  B("red"), B("blue"), B("red"), B("blue"),
  P("red"), P("blue"), P("blue"), P("red"),
];
export const POOL_SIZE = 24;
export const PICKS_PER_SIDE = DRAFT_ORDER.filter((s) => s.act === "pick").length / 2;

export type DraftPhase = "draft" | "place" | "play";

export interface DraftState {
  pool: string[];
  step: number;                              // 下一步在 DRAFT_ORDER 中的序号
  bans: Record<Team, (string | null)[]>;     // null = 超时未禁
  picks: Record<Team, string[]>;
  phase: DraftPhase;
  placeTurn: TSide;
  toPlace: Record<TSide, string[]>;          // 尚未布下的棋子(含王)
  game: TGame;                               // 布阵阶段逐步填充,对局阶段即为对局
  history: string[];                         // 人类可读的流程记录
}

export type DraftAction =
  | { type: "ban"; kind: string | null }
  | { type: "pick"; kind: string }
  | { type: "place"; kind: string; at: Sq }
  | { type: "move"; move: TMove };

/** 可复现的随机数(给定种子 → 同一卡池,便于测试/复盘) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newDraft(rng: () => number = Math.random, poolSize = POOL_SIZE): DraftState {
  const ids = POOL_IDS.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const pool = ids.slice(0, poolSize).sort((a, b) => KIND[a].kanji.localeCompare(KIND[b].kanji, "ja"));
  return {
    pool, step: 0,
    bans: { blue: [], red: [] }, picks: { blue: [], red: [] },
    phase: "draft", placeTurn: "sente",
    toPlace: { sente: [], gote: [] },
    game: { board: emptyBoard(), turn: "sente", ply: 0, keys: [] },
    history: [],
  };
}

export const currentStep = (d: DraftState): DraftStep | null => (d.phase === "draft" ? DRAFT_ORDER[d.step] ?? null : null);

/** 现在轮到谁操作(对局结束返回 null) */
export function actor(d: DraftState): TSide | null {
  if (d.game.result) return null;
  if (d.phase === "draft") { const s = currentStep(d); return s ? sideOf(s.team) : null; }
  if (d.phase === "place") return d.placeTurn;
  return d.game.turn;
}

export function available(d: DraftState): string[] {
  const used = new Set([...d.bans.blue, ...d.bans.red, ...d.picks.blue, ...d.picks.red].filter(Boolean) as string[]);
  return d.pool.filter((k) => !used.has(k));
}

const isSq = (s: unknown): s is Sq =>
  !!s && typeof s === "object" && Number.isInteger((s as Sq).x) && Number.isInteger((s as Sq).y) &&
  (s as Sq).x >= 0 && (s as Sq).x < SIZE && (s as Sq).y >= 0 && (s as Sq).y < SIZE;

/** 结构校验(来自网络的数据先过这一关) */
export function isDraftActionShape(a: unknown): a is DraftAction {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  switch (o.type) {
    case "ban": return o.kind === null || typeof o.kind === "string";
    case "pick": return typeof o.kind === "string";
    case "place": return typeof o.kind === "string" && isSq(o.at);
    case "move": {
      const m = o.move as Record<string, unknown> | undefined;
      return !!m && isSq(m.from) && isSq(m.to) && (m.via === undefined || isSq(m.via)) &&
        (m.promote === undefined || typeof m.promote === "boolean");
    }
    default: return false;
  }
}

function freeSquares(d: DraftState, side: TSide, kind: string): Sq[] {
  const out: Sq[] = [];
  for (const y of homeRows(side)) for (let x = 0; x < SIZE; x++) {
    const s = { x, y };
    if (!d.game.board[idx(s)] && hasAnyMove(kind, side, s)) out.push(s);
  }
  return out;
}
/** 不会造成将军的格子:棋子不攻击对方王将;王将不进入对方攻击范围 */
function safeSquares(d: DraftState, side: TSide, kind: string): Sq[] {
  return freeSquares(d, side, kind).filter((s) => {
    const b = d.game.board.slice();
    b[idx(s)] = { side, kind };
    if (kind === KING) return !kingAttacked(b, side);
    return !kingSquare(b, otherT(side)) || !kingAttacked(b, otherT(side));
  });
}

/**
 * 布阵时某枚棋子可以放的格子。规则:
 * 1. 王将必须最先布下(见 draftError)。
 * 2. 开局不能有将军:不能布下直接攻击对方王将的棋子,王将也不能放进对方火力范围。
 * 3. 某枚棋子放哪都会将军(如钩行者在空旷棋盘上)时,若阵容里还有别的棋子能安全布下,
 *    这枚棋子暂时不能布(返回空),等棋盘上有了遮挡再布。
 * 4. 若阵容里没有任何棋子能安全布下,才放宽为任意空格;若这是全场最后一步,
 *    仍排除会让先手开局无子可动的格子。
 */
export function placeSquares(d: DraftState, side: TSide, kind: string): Sq[] {
  const safe = safeSquares(d, side, kind);
  if (safe.length) return safe;
  if (d.toPlace[side].some((k) => k !== kind && safeSquares(d, side, k).length > 0)) return [];
  const all = freeSquares(d, side, kind);
  if (d.toPlace.sente.length + d.toPlace.gote.length !== 1) return all;
  const ok = all.filter((s) => {
    const b = d.game.board.slice();
    b[idx(s)] = { side, kind };
    return legalMoves(startGame(b)).length > 0;
  });
  return ok.length ? ok : all;
}

/** 返回错误信息;合法则返回 null */
export function draftError(d: DraftState, side: TSide, a: DraftAction): string | null {
  if (d.game.result) return "对局已结束";
  if (actor(d) !== side) return "还没轮到你";
  if (d.phase === "draft") {
    const st = currentStep(d)!;
    if (a.type !== st.act) return st.act === "ban" ? "现在是禁用阶段" : "现在是选择阶段";
    if (a.type === "ban" && a.kind === null) return null;
    const k = (a as { kind: string }).kind;
    if (!available(d).includes(k)) return "这枚棋子不可选";
    return null;
  }
  if (d.phase === "place") {
    if (a.type !== "place") return "现在是布阵阶段";
    if (!d.toPlace[side].includes(a.kind)) return "这枚棋子不在你的待布列表里";
    if (!homeRows(side).includes(a.at.y)) return "只能布在己方底部两行";
    if (d.game.board[idx(a.at)]) return "该格已有棋子";
    if (!hasAnyMove(a.kind, side, a.at)) return "放在这里将无路可走";
    if (a.kind !== KING && d.toPlace[side].includes(KING)) return "请先布王将";
    const ok = placeSquares(d, side, a.kind);
    if (!ok.length) return "这枚棋子放哪都会将军,请先布别的棋子";
    if (!ok.some((s) => s.x === a.at.x && s.y === a.at.y)) return "开局不能形成将军:换个格子";
    return null;
  }
  if (a.type !== "move") return "现在是对局阶段";
  return null; // 着法合法性由 applyMove 判定
}

function label(k: string | null) { return k ? `${KIND[k]?.kanji ?? k}` : "(空过)"; }

export function applyDraft(d: DraftState, side: TSide, a: DraftAction): DraftState {
  const err = draftError(d, side, a);
  if (err) throw new Error(err);
  const team = teamOf(side);
  if (d.phase === "draft") {
    const n: DraftState = {
      ...d,
      bans: { blue: d.bans.blue.slice(), red: d.bans.red.slice() },
      picks: { blue: d.picks.blue.slice(), red: d.picks.red.slice() },
      step: d.step + 1,
      history: [...d.history, `${team === "blue" ? "蓝" : "红"}方${a.type === "ban" ? "禁用" : "选择"} ${label((a as { kind: string | null }).kind)}`],
    };
    if (a.type === "ban") n.bans[team].push(a.kind);
    else n.picks[team].push((a as { kind: string }).kind);
    if (n.step >= DRAFT_ORDER.length) {
      n.phase = "place";
      n.placeTurn = "sente";
      n.toPlace = { sente: [KING, ...n.picks.blue], gote: [KING, ...n.picks.red] };
    }
    return n;
  }
  if (d.phase === "place") {
    const pa = a as Extract<DraftAction, { type: "place" }>;
    const board = d.game.board.slice();
    board[idx(pa.at)] = { side, kind: pa.kind };
    const rest = d.toPlace[side].slice();
    rest.splice(rest.indexOf(pa.kind), 1);
    const toPlace = { ...d.toPlace, [side]: rest } as Record<TSide, string[]>;
    const n: DraftState = { ...d, toPlace, game: { ...d.game, board }, history: [...d.history, `${team === "blue" ? "蓝" : "红"}方布下 ${label(pa.kind)}`] };
    const other = otherT(side);
    if (toPlace[other].length) n.placeTurn = other;
    else if (toPlace[side].length) n.placeTurn = side;
    else {
      n.phase = "play";
      n.game = startGame(board);
      // 兜底(极少见,约千分之一):若只有后手王将处于被攻击状态,先手第一手就能吃王——改由后手先走
      if (kingAttacked(board, "gote") && !kingAttacked(board, "sente")) n.game = { ...n.game, turn: "gote" };
      if (legalMoves(n.game).length === 0) n.game = { ...n.game, result: { kind: "win", winner: otherT(n.game.turn), reason: "no-moves" } };
    }
    return n;
  }
  const ma = a as Extract<DraftAction, { type: "move" }>;
  const game = applyMove(d.game, ma.move);
  const mark = side === "sente" ? "▲" : "△";
  return { ...d, game, history: [...d.history, `${d.game.ply + 1}. ${mark}${moveLabel(d.game, game.lastMove!)}`] };
}

/** 超时代操作:禁用 → 空过;选择 → 随机;布阵 → 随机棋子随机格。对局阶段不计时。 */
export function autoAction(d: DraftState, rng: () => number = Math.random): DraftAction | null {
  const side = actor(d);
  if (!side) return null;
  if (d.phase === "draft") {
    const st = currentStep(d)!;
    if (st.act === "ban") return { type: "ban", kind: null };
    const av = available(d);
    return { type: "pick", kind: av[Math.floor(rng() * av.length)] };
  }
  if (d.phase === "place") {
    const roster = d.toPlace[side];
    const ready = roster.filter((k) => placeSquares(d, side, k).length > 0);
    const kind = roster.includes(KING) ? KING : ready[Math.floor(rng() * ready.length)];
    const free = placeSquares(d, side, kind);
    return { type: "place", kind, at: free[Math.floor(rng() * free.length)] };
  }
  return null;
}

export function resignDraft(d: DraftState, side: TSide, reason: "resign" | "abandon" | "timeout" = "resign"): DraftState {
  if (d.game.result) return d;
  return { ...d, game: { ...d.game, result: { kind: "win", winner: otherT(side), reason } } };
}
