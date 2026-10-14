import { tk } from "@cs/shared";

/** 走法图中一格的类型(优先级从低到高) */
export type Mark = "slide" | "step" | "leap" | "jump" | "hook" | "lion" | "range";
const PRIO: Record<Mark, number> = { slide: 1, step: 2, leap: 3, jump: 4, hook: 5, lion: 6, range: 7 };

/**
 * 在空棋盘上计算走法图:返回 "dx,dy" → 类型(+y = 向前)。
 * R = 半径(5×5 棋盘上最远相对距离为 4)。
 */
export function diagram(rules: tk.Rule[], R: number): Map<string, Mark> {
  const m = new Map<string, Mark>();
  const put = (x: number, y: number, t: Mark) => {
    if (Math.abs(x) > R || Math.abs(y) > R || (x === 0 && y === 0)) return;
    const k = `${x},${y}`;
    const cur = m.get(k);
    if (!cur || PRIO[t] > PRIO[cur]) m.set(k, t);
  };
  const inR = (x: number, y: number) => Math.abs(x) <= R && Math.abs(y) <= R;
  for (const r of rules) {
    switch (r.t) {
      case "slide": {
        const max = r.max ?? R;
        for (let n = 1; n <= max && inR(r.d[0] * n, r.d[1] * n); n++) put(r.d[0] * n, r.d[1] * n, (r.max ?? 99) <= 1 ? "step" : r.max === null ? "slide" : "step");
        break;
      }
      case "leap": put(r.d[0], r.d[1], Math.max(Math.abs(r.d[0]), Math.abs(r.d[1])) === 1 ? "step" : "leap"); break;
      case "jumpslide": {
        const k = r.jump;
        if (k > 1) put(r.d[0] * k, r.d[1] * k, "jump");
        const max = r.max ?? R;
        for (let n = 1; n <= max && inR(r.d[0] * (k + n), r.d[1] * (k + n)); n++) put(r.d[0] * (k + n), r.d[1] * (k + n), "slide");
        break;
      }
      case "hook": {
        for (let n = 1; inR(r.d[0] * n, r.d[1] * n); n++) {
          const x = r.d[0] * n, y = r.d[1] * n;
          put(x, y, "slide");
          for (const t of r.turn) for (let j = 1; inR(x + t[0] * j, y + t[1] * j); j++) put(x + t[0] * j, y + t[1] * j, "hook");
        }
        break;
      }
      case "lion":
        for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) put(x, y, "lion");
        break;
      case "igui": break;
      case "rangecap":
        for (let n = 1; inR(r.d[0] * n, r.d[1] * n); n++) put(r.d[0] * n, r.d[1] * n, "range");
        break;
    }
  }
  return m;
}

export const MARK_LABEL: Record<Mark, string> = {
  step: "走到(有限格)",
  slide: "直线滑行(不可越子)",
  leap: "跳到(可越子)",
  jump: "跳越后可继续滑行",
  hook: "钩行:转 90° 后可达",
  lion: "狮子:一回合两步",
  range: "跳越吃子线",
};

/** 由规则归纳出需要额外文字说明的能力 */
export function abilities(k: tk.KindDef): string[] {
  const out: string[] = [];
  const ts = new Set(k.rules.map((r) => r.t));
  if (ts.has("lion")) out.push("狮子之力:一回合可走两步王步——可连吃两子,也可「居喰」(吃掉相邻一子后留在原地)。");
  if (ts.has("igui")) out.push("居喰:可吃掉相邻的一枚敌子而不移动。");
  if (ts.has("rangecap")) out.push(`跳越吃子(等级 ${k.rank}):沿线飞越任意多枚等级更低的棋子,并把飞过的棋子全部吃掉——包括己方棋子!不能飞越同级或更高等级的棋子(王将等级最高)。`);
  if (ts.has("hook")) out.push("钩行:滑行途中可在任意空格转 90° 再滑行一次。");
  const lim = k.rules.filter((r): r is Extract<tk.Rule, { t: "jumpslide" }> => r.t === "jumpslide");
  if (lim.length) {
    const maxJ = Math.max(...lim.map((r) => r.jump));
    out.push(`跳越:可无视前 ${maxJ} 格内的棋子直接落下,落地后还可沿同方向继续滑行。`);
  }
  if (k.rules.some((r) => r.t === "slide" && r.hops)) out.push("越子:直线滑行时可越过一枚棋子继续前进。");
  if (k.rules.some((r) => "mode" in r && r.mode === "m")) out.push("部分方向只能移动、不能吃子。");
  if (k.rules.some((r) => "mode" in r && r.mode === "c")) out.push("部分方向只能吃子。");
  return out;
}

export const kindOf = (id: string): tk.KindDef => tk.KIND[id];
