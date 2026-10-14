// 用 TS 引擎(权威实现)生成 lishogi 移植的差分测试夹具。
// 每行: sfen \t 全部合法着法(USI,排序,空格分隔) \t 选中的着法 \t 走后 sfen
// 用法: npx tsx tools/taikyoku/gen_lishogi_fixtures.ts <输出文件> [局数=400] [种子=1]
import { writeFileSync } from "node:fs";
import { KIND, POOL_IDS, KING, legalMoves, applyMove, kingAttacked, startGame, idx } from "../../shared/src/taikyoku/engine";
import { SIZE, type Sq, type TGame, type TMove, type TPiece, type TSide } from "../../shared/src/taikyoku/types";

const out = process.argv[2] ?? "taikyoku-fixtures.tsv";
const games = Number(process.argv[3] ?? 400);
let seed = Number(process.argv[4] ?? 1);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

// USI 坐标:筋 = 5 - x,段 = 'a' + (4 - y)
const key = (s: Sq) => `${SIZE - s.x}${String.fromCharCode(97 + SIZE - 1 - s.y)}`;
const usi = (m: TMove) => key(m.from) + (m.via ? key(m.via) : "") + key(m.to) + (m.promote ? "+" : "");

function token(p: TPiece) {
  const t = `[${p.from ? "+" : ""}${p.kind}]`;
  return p.side === "sente" ? t.toUpperCase() : t;
}
function sfen(g: TGame) {
  const rows: string[] = [];
  for (let y = SIZE - 1; y >= 0; y--) {
    let row = "", empty = 0;
    for (let x = 0; x < SIZE; x++) {
      const p = g.board[y * SIZE + x];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += token(p);
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${g.turn === "sente" ? "b" : "w"} - ${g.ply + 1}`;
}

// 已升变棋子:kind 为升变后的 id,from 为任一能升变成它的棋子
const promoFrom: Record<string, string> = {};
for (const id of [...POOL_IDS, KING]) { const t = KIND[id].promotesTo; if (t && !promoFrom[t]) promoFrom[t] = id; }
const promotedKinds = Object.keys(promoFrom);

// 带特殊规则(狮子、居喰、跳越吃子、钩行)的棋子,保证这些规则被充分覆盖
const isSpecial = (id: string) => KIND[id].rules.some((r) => r.t === "lion" || r.t === "igui" || r.t === "rangecap" || r.t === "hook");
const specialPool = POOL_IDS.filter(isSpecial);
const specialPromoted = promotedKinds.filter(isSpecial);
let forceSpecial = false;

function randomPiece(side: TSide): TPiece {
  if (forceSpecial && rnd() < 0.5) {
    if (rnd() < 0.3 && specialPromoted.length) { const k = pick(specialPromoted); return { side, kind: k, from: promoFrom[k] }; }
    return { side, kind: pick(specialPool) };
  }
  if (rnd() < 0.25) { const k = pick(promotedKinds); return { side, kind: k, from: promoFrom[k] }; }
  return { side, kind: pick(POOL_IDS) };
}

function randomGame(dense: boolean): TGame | null {
  const board: (TPiece | null)[] = Array.from({ length: SIZE * SIZE }, () => null);
  const free = (cands: number[]) => cands.filter((i) => !board[i]);
  for (const side of ["sente", "gote"] as TSide[]) {
    const home = side === "sente" ? [0, 1] : [3, 4];
    const area = dense ? [...Array(SIZE * SIZE).keys()] : [...Array(SIZE * SIZE).keys()].filter((i) => home.includes(Math.floor(i / SIZE)));
    const k = pick(free(area)); board[k] = { side, kind: KING };
    const n = dense ? 3 + Math.floor(rnd() * 6) : 5;
    for (let j = 0; j < n; j++) { const c = free(area); if (!c.length) break; board[pick(c)] = randomPiece(side); }
  }
  const g = startGame(board);
  if (kingAttacked(board, "gote")) return null; // 先手走棋时后手王不能已被攻击
  return g;
}

const lines: string[] = [];
let positions = 0, withVia = 0, rangeMulti = 0, promos = 0;
for (let n = 0; n < games; n++) {
  forceSpecial = n % 3 === 2;
  let g = randomGame(n % 2 === 1);
  if (!g) { n--; continue; }
  for (let ply = 0; ply < 60 && !g.result; ply++) {
    const ms = legalMoves(g);
    if (!ms.length) break;
    // 偏好吃子与狮子走法,以覆盖更多规则
    const interesting = ms.filter((m) => (m.caps?.length ?? 0) > 0 || m.via || m.promote);
    const m = interesting.length && rnd() < 0.6 ? pick(interesting) : pick(ms);
    const next = applyMove(g, m);
    lines.push([sfen(g), ms.map(usi).sort().join(" "), usi(m), sfen(next)].join("\t"));
    positions++;
    if (ms.some((x) => x.via)) withVia++;
    if ((m.caps?.length ?? 0) >= 2 && !m.via) rangeMulti++;
    if (m.promote) promos++;
    g = next;
  }
}
writeFileSync(out, lines.join("\n") + "\n");
console.log(`special kinds: ${specialPool.length} in pool, ${specialPromoted.length} promoted`);
console.log(`${positions} positions (${withVia} with lion moves, ${rangeMulti} range multi-captures played, ${promos} promotions) -> ${out}`);
void idx;
