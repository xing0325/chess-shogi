import { KINDS } from "./pieces.data";
import {
  SIZE, otherT,
  type KindDef, type Sq, type TGame, type TMove, type TPiece, type TSide,
} from "./types";

export const KIND: Record<string, KindDef> = Object.fromEntries(KINDS.map((k) => [k.id, k]));
export const POOL_IDS: string[] = KINDS.filter((k) => k.inPool).map((k) => k.id);
export const KING = "king";
export const MAX_PLIES = 300;

export const idx = (s: Sq) => s.y * SIZE + s.x;
export const sqOf = (i: number): Sq => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
export const inb = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
export const sameSq = (a?: Sq, b?: Sq) => (!a && !b) || (!!a && !!b && a.x === b.x && a.y === b.y);
/** 先手的向量原样使用,后手旋转 180° */
const orient = (side: TSide, d: readonly [number, number]): [number, number] =>
  side === "sente" ? [d[0], d[1]] : [-d[0], -d[1]];
export const inZone = (side: TSide, y: number) => (side === "sente" ? y === SIZE - 1 : y === 0);
export const homeRows = (side: TSide) => (side === "sente" ? [0, 1] : [SIZE - 2, SIZE - 1]);
const ADJ: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export function emptyBoard(): (TPiece | null)[] {
  return Array.from({ length: SIZE * SIZE }, () => null);
}

/** 一枚棋子在给定局面下可到达的格子(不考虑王是否被将) */
export interface Target { to: Sq; via?: Sq; caps: Sq[] }

export function pseudoTargets(b: (TPiece | null)[], from: Sq): Target[] {
  const p = b[idx(from)];
  if (!p) return [];
  const k = KIND[p.kind];
  if (!k) return [];
  const out: Target[] = [];
  const seen = new Set<string>();
  const push = (to: Sq, caps: Sq[], via?: Sq) => {
    const key = `${to.x},${to.y}|${via ? `${via.x},${via.y}` : ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(via ? { to, via, caps } : { to, caps });
  };
  const occ = (x: number, y: number) => b[y * SIZE + x];
  const mine = (q: TPiece | null) => !!q && q.side === p.side;

  for (const r of k.rules) {
    switch (r.t) {
      case "slide": {
        const [dx, dy] = orient(p.side, r.d);
        let hops = r.hops ?? 0;
        const max = r.max ?? SIZE;
        for (let n = 1; n <= max; n++) {
          const x = from.x + dx * n, y = from.y + dy * n;
          if (!inb(x, y)) break;
          const q = occ(x, y);
          if (!q) { if (r.mode !== "c") push({ x, y }, []); continue; }
          if (!mine(q) && r.mode !== "m") push({ x, y }, [{ x, y }]);
          if (hops > 0) { hops--; continue; }
          break;
        }
        break;
      }
      case "leap": {
        const [dx, dy] = orient(p.side, r.d);
        const x = from.x + dx, y = from.y + dy;
        if (!inb(x, y)) break;
        const q = occ(x, y);
        if (!q) { if (r.mode !== "c") push({ x, y }, []); }
        else if (!mine(q) && r.mode !== "m") push({ x, y }, [{ x, y }]);
        break;
      }
      case "jumpslide": {
        // 落到第 jump 格(无视中间棋子),再可沿同方向继续滑行
        const [dx, dy] = orient(p.side, r.d);
        const x0 = from.x + dx * r.jump, y0 = from.y + dy * r.jump;
        if (!inb(x0, y0)) break;
        const q0 = occ(x0, y0);
        if (q0) { if (!mine(q0) && r.jmode !== "m") push({ x: x0, y: y0 }, [{ x: x0, y: y0 }]); break; }
        if (r.jmode !== "c") push({ x: x0, y: y0 }, []);
        const max = r.max ?? SIZE;
        for (let n = 1; n <= max; n++) {
          const x = x0 + dx * n, y = y0 + dy * n;
          if (!inb(x, y)) break;
          const q = occ(x, y);
          if (!q) { push({ x, y }, []); continue; }
          if (!mine(q)) push({ x, y }, [{ x, y }]);
          break;
        }
        break;
      }
      case "hook": {
        // 沿第一方向滑行,途中任一空格可转 90° 再滑行一次
        const [dx, dy] = orient(p.side, r.d);
        for (let n = 1; ; n++) {
          const x = from.x + dx * n, y = from.y + dy * n;
          if (!inb(x, y)) break;
          const q = occ(x, y);
          if (q) { if (!mine(q)) push({ x, y }, [{ x, y }]); break; }
          push({ x, y }, []);
          for (const t of r.turn) {
            const [tx, ty] = orient(p.side, t);
            for (let m = 1; ; m++) {
              const x2 = x + tx * m, y2 = y + ty * m;
              if (!inb(x2, y2)) break;
              const q2 = occ(x2, y2);
              if (q2) { if (!mine(q2)) push({ x: x2, y: y2 }, [{ x: x2, y: y2 }]); break; }
              push({ x: x2, y: y2 }, []);
            }
          }
        }
        break;
      }
      case "lion": {
        // 两次王步:第一步可吃子后继续(双吃、居喰)
        for (const [ax, ay] of ADJ) {
          const a = { x: from.x + ax, y: from.y + ay };
          if (!inb(a.x, a.y)) continue;
          const qa = occ(a.x, a.y);
          if (mine(qa)) continue;
          push(a, qa ? [a] : []);
          for (const [bx, by] of ADJ) {
            const c = { x: a.x + bx, y: a.y + by };
            if (!inb(c.x, c.y)) continue;
            if (sameSq(c, from)) { if (qa) push(from, [a], a); continue; } // 居喰;不吃子的"原地返回"(停着)不允许
            const qc = occ(c.x, c.y);
            if (mine(qc)) continue;
            const caps = [...(qa ? [a] : []), ...(qc ? [c] : [])];
            if (qa) push(c, caps, a); else push(c, caps);
          }
        }
        break;
      }
      case "igui": {
        for (const [ax, ay] of ADJ) {
          const a = { x: from.x + ax, y: from.y + ay };
          if (!inb(a.x, a.y)) continue;
          const qa = occ(a.x, a.y);
          if (qa && !mine(qa)) push(from, [a], a);
        }
        break;
      }
      case "rangecap": {
        // 跳越吃子:飞过任意数量的低等级棋子(不分敌我)并全部吃掉
        const [dx, dy] = orient(p.side, r.d);
        const caps: Sq[] = [];
        for (let n = 1; ; n++) {
          const x = from.x + dx * n, y = from.y + dy * n;
          if (!inb(x, y)) break;
          const q = occ(x, y);
          if (!q) { push({ x, y }, [...caps]); continue; }
          if ((KIND[q.kind]?.rank ?? 5) <= k.rank) break;
          if (!mine(q)) push({ x, y }, [...caps, { x, y }]);
          caps.push({ x, y });
        }
        break;
      }
    }
  }
  return out;
}

const mobilityCache = new Map<string, boolean>();
/** 该棋子放在 at 上、棋盘为空时是否还有任何走法(用于强制升变 / 布阵校验) */
export function hasAnyMove(kind: string, side: TSide, at: Sq): boolean {
  const key = `${kind}|${side}|${at.x},${at.y}`;
  let v = mobilityCache.get(key);
  if (v === undefined) {
    const b = emptyBoard();
    b[idx(at)] = { side, kind };
    v = pseudoTargets(b, at).length > 0;
    mobilityCache.set(key, v);
  }
  return v;
}

export function kingSquare(b: (TPiece | null)[], side: TSide): Sq | null {
  const i = b.findIndex((p) => !!p && p.side === side && p.kind === KING);
  return i < 0 ? null : sqOf(i);
}

/** side 方的王是否正受攻击(王不在了也视为受攻击) */
export function kingAttacked(b: (TPiece | null)[], side: TSide): boolean {
  const k = kingSquare(b, side);
  if (!k) return true;
  for (let i = 0; i < b.length; i++) {
    const p = b[i];
    if (!p || p.side === side) continue;
    for (const t of pseudoTargets(b, sqOf(i))) {
      if (t.caps.some((c) => c.x === k.x && c.y === k.y)) return true;
    }
  }
  return false;
}

export function applyRaw(b: (TPiece | null)[], m: TMove): (TPiece | null)[] {
  const nb = b.slice();
  const p = nb[idx(m.from)];
  if (!p) return nb;
  for (const c of m.caps ?? []) nb[idx(c)] = null;
  nb[idx(m.from)] = null;
  const kd = KIND[p.kind];
  nb[idx(m.to)] = m.promote && kd?.promotesTo ? { side: p.side, kind: kd.promotesTo, from: p.kind } : p;
  return nb;
}

/** 当前行棋方的全部合法着法(不能让己方王处于被攻击状态) */
export function legalMoves(g: TGame): TMove[] {
  const side = g.turn;
  const out: TMove[] = [];
  for (let i = 0; i < g.board.length; i++) {
    const p = g.board[i];
    if (!p || p.side !== side) continue;
    const from = sqOf(i);
    const kd = KIND[p.kind];
    for (const t of pseudoTargets(g.board, from)) {
      const canPromo = !p.from && !!kd?.promotesTo && (inZone(side, from.y) || inZone(side, t.to.y));
      const must = canPromo && !hasAnyMove(p.kind, side, t.to);
      const opts = must ? [true] : canPromo ? [false, true] : [false];
      for (const promote of opts) {
        const m: TMove = { from, to: t.to, caps: t.caps, ...(t.via ? { via: t.via } : {}), ...(promote ? { promote } : {}) };
        if (!kingAttacked(applyRaw(g.board, m), side)) out.push(m);
      }
    }
  }
  return out;
}

export const inCheck = (g: TGame) => kingAttacked(g.board, g.turn);

export function positionKey(b: (TPiece | null)[], turn: TSide): string {
  return b.map((p) => (p ? `${p.side === "sente" ? "S" : "G"}${p.kind}${p.from ? "+" : ""}` : ".")).join(",") + "|" + turn;
}

export function startGame(board: (TPiece | null)[]): TGame {
  return { board, turn: "sente", ply: 0, keys: [positionKey(board, "sente")] };
}

/** 在合法着法中找到与提交着法匹配的那一个(客户端无需提供 caps) */
export function findLegal(g: TGame, m: TMove): TMove | undefined {
  return legalMoves(g).find((x) => sameSq(x.from, m.from) && sameSq(x.to, m.to) && sameSq(x.via, m.via) && !!x.promote === !!m.promote);
}

export function applyMove(g: TGame, submitted: TMove): TGame {
  if (g.result) throw new Error("对局已结束");
  const m = findLegal(g, submitted);
  if (!m) throw new Error("非法着法");
  const board = applyRaw(g.board, m);
  const turn = otherT(g.turn);
  const key = positionKey(board, turn);
  const next: TGame = { board, turn, ply: g.ply + 1, lastMove: m, keys: [...g.keys, key] };
  if (legalMoves(next).length === 0) {
    next.result = { kind: "win", winner: g.turn, reason: kingAttacked(board, turn) ? "checkmate" : "no-moves" };
  } else if (next.keys.filter((k) => k === key).length >= 4) {
    next.result = { kind: "draw", reason: "repetition" };
  } else if (next.ply >= MAX_PLIES) {
    next.result = { kind: "draw", reason: "move-limit" };
  }
  return next;
}

const FILES = "abcde";
export const sqName = (s: Sq) => `${FILES[s.x]}${s.y + 1}`;

/** 简易记谱:獅子 c2xc3-c4 / 歩兵 b4-b5+ */
export function moveLabel(before: TGame, m: TMove): string {
  const p = before.board[idx(m.from)];
  const name = p ? KIND[p.kind]?.kanji ?? p.kind : "?";
  const capAt = (s: Sq) => !!before.board[idx(s)];
  let s = `${name} ${sqName(m.from)}`;
  if (m.via) s += `x${sqName(m.via)}`;
  if (!sameSq(m.to, m.from) || !m.via) s += `${capAt(m.to) ? "x" : "-"}${sqName(m.to)}`;
  else s += "(居喰)";
  if ((m.caps?.length ?? 0) > 2 || (m.caps?.length === 2 && !m.via)) s += ` 吃${m.caps!.length}`;
  if (m.promote) s += "+";
  return s;
}
