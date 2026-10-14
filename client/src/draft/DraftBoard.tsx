import { useEffect, useMemo, useState } from "react";
import { tk } from "@cs/shared";
import { Token } from "./PieceUI";

type Sq = tk.Sq;
type TMove = tk.TMove;
const k2 = (s?: Sq) => (s ? `${s.x},${s.y}` : "");
const FILES = "abcde";

export interface DraftBoardProps {
  game: tk.TGame;
  perspective: tk.TSide;            // 下方一侧
  phase: "place" | "play" | "view";
  // 布阵
  placeSide?: tk.TSide;
  placeKind?: string;
  placeable?: Sq[];                 // 当前棋子可布的格子
  onPlace?: (at: Sq) => void;
  // 对局
  legal?: TMove[];                  // 当前用户可走的着法(不轮到时为空)
  onMove?: (m: TMove) => void;
  onInspect?: (p: tk.TPiece) => void;
}

export function DraftBoard(props: DraftBoardProps) {
  const { game, perspective, phase, legal = [], onMove, onInspect } = props;
  const [sel, setSel] = useState<Sq | null>(null);
  const [via, setVia] = useState<Sq | null>(null);
  const [promo, setPromo] = useState<TMove[] | null>(null);
  useEffect(() => { setSel(null); setVia(null); setPromo(null); }, [game.ply, phase, game.board]);

  const fromSel = useMemo(() => (sel ? legal.filter((m) => tk.sameSq(m.from, sel)) : []), [legal, sel]);
  // 第一阶段可点击的格:直接落点 + 狮子第一步吃子格
  const targets = useMemo(() => {
    const t = new Map<string, { caps: number; friendly: boolean; lion: boolean }>();
    const list = via ? fromSel.filter((m) => m.via && tk.sameSq(m.via, via)) : fromSel;
    for (const m of list) {
      const key = via ? k2(m.to) : k2(m.via ?? m.to);
      const isLionFirst = !via && !!m.via;
      const caps = isLionFirst ? 1 : m.caps?.length ?? 0;
      const friendly = !isLionFirst && (m.caps ?? []).some((c) => game.board[tk.idx(c)]?.side === game.turn);
      const prev = t.get(key);
      t.set(key, { caps: Math.max(prev?.caps ?? 0, caps), friendly: (prev?.friendly ?? false) || friendly, lion: (prev?.lion ?? false) || isLionFirst });
    }
    if (via) {
      // 第二阶段:点本格 = 只吃一子停下
      const single = fromSel.filter((m) => !m.via && tk.sameSq(m.to, via));
      if (single.length) t.set(k2(via), { caps: 1, friendly: false, lion: false });
    }
    return t;
  }, [fromSel, via, game]);

  const checkSq = phase === "play" && !game.result && tk.inCheck(game) ? tk.kingSquare(game.board, game.turn) : null;
  const placeSet = useMemo(() => new Set((props.placeable ?? []).map(k2)), [props.placeable]);
  const placeable = (s: Sq) => phase === "place" && placeSet.has(k2(s));

  function finish(cands: TMove[]) {
    if (!cands.length) return;
    const hasP = cands.some((m) => m.promote), hasN = cands.some((m) => !m.promote);
    if (hasP && hasN) { setPromo(cands); return; }
    onMove?.(cands[0]);
    setSel(null); setVia(null);
  }

  function click(s: Sq) {
    const p = game.board[tk.idx(s)];
    if (phase === "place") {
      if (placeable(s)) props.onPlace?.(s);
      else if (p) onInspect?.(p);
      return;
    }
    if (phase !== "play") { if (p) onInspect?.(p); return; }
    if (sel && via) {
      if (tk.sameSq(s, via)) { finish(fromSel.filter((m) => !m.via && tk.sameSq(m.to, via))); return; }
      const c = fromSel.filter((m) => m.via && tk.sameSq(m.via, via) && tk.sameSq(m.to, s));
      if (c.length) { finish(c); return; }
      setVia(null); setSel(null);
      return;
    }
    if (sel) {
      const lionFirst = fromSel.filter((m) => m.via && tk.sameSq(m.via, s));
      if (lionFirst.length) { setVia(s); return; }
      const c = fromSel.filter((m) => !m.via && tk.sameSq(m.to, s));
      if (c.length) { finish(c); return; }
    }
    if (p) onInspect?.(p);
    if (p && legal.some((m) => tk.sameSq(m.from, s))) { setSel(s); setVia(null); }
    else { setSel(null); setVia(null); }
  }

  const ys = perspective === "sente" ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
  const xs = perspective === "sente" ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  const lm = game.lastMove;
  return (
    <div className="db">
      <div className="db__grid">
        {ys.map((y) => xs.map((x) => {
          const s = { x, y };
          const key = k2(s);
          const p = game.board[tk.idx(s)];
          const tg = targets.get(key);
          const cls = ["db__sq"];
          if ((x + y) % 2) cls.push("db__sq--alt");
          if (props.placeSide && phase === "place" && tk.homeRows(props.placeSide).includes(y)) cls.push("db__sq--home");
          if (placeable(s)) cls.push("db__sq--placeable");
          if (lm && (tk.sameSq(lm.from, s) || tk.sameSq(lm.to, s))) cls.push("db__sq--last");
          if (lm?.via && tk.sameSq(lm.via, s)) cls.push("db__sq--lastvia");
          if (sel && tk.sameSq(sel, s)) cls.push("db__sq--sel");
          if (via && tk.sameSq(via, s)) cls.push("db__sq--via");
          if (checkSq && tk.sameSq(checkSq, s)) cls.push("db__sq--check");
          return (
            <button key={key} className={cls.join(" ")} onClick={() => click(s)} aria-label={`${FILES[x]}${y + 1}`}>
              {p && <Token piece={p} flip={p.side !== perspective} team={p.side === "sente" ? "blue" : "red"} size={72} />}
              {tg && !p && <span className={`db__dot${tg.lion ? " db__dot--lion" : ""}`} />}
              {tg && p && <span className={`db__ring${tg.lion ? " db__ring--lion" : ""}`} />}
              {tg && tg.caps > 1 && <span className={`db__caps${tg.friendly ? " db__caps--friendly" : ""}`}>×{tg.caps}{tg.friendly ? " 含己方" : ""}</span>}
              {y === ys[ys.length - 1] && <span className="db__file">{FILES[x]}</span>}
              {x === xs[xs.length - 1] && <span className="db__rank">{y + 1}</span>}
            </button>
          );
        }))}
      </div>
      {via && <div className="db__hint">狮子第二步:点高亮格继续走 · 点原位 = 居喰 · 再点吃子格 = 只吃一子</div>}
      {promo && (
        <div className="db__promo">
          <span>是否升变?</span>
          {promo.map((m) => {
            const pc = game.board[tk.idx(m.from)]!;
            const k = tk.KIND[pc.kind];
            return (
              <button key={String(!!m.promote)} className="game__btn" onClick={() => { setPromo(null); onMove?.(m); setSel(null); setVia(null); }}>
                {m.promote ? `升变为 ${tk.KIND[k.promotesTo!].kanji}` : `保持 ${k.kanji}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
