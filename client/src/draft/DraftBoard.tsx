import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { tk } from "@cs/shared";
import { Token } from "./PieceUI";

type Sq = tk.Sq;
type TMove = tk.TMove;
const k2 = (s?: Sq) => (s ? `${s.x},${s.y}` : "");
const FILES = "abcde";
const DRAG_THRESHOLD = 6; // px:超过这个距离才算拖动,否则按点击处理

/** 驹台:一方尚未布下的棋子(像打入一样,自己挑棋子、挑位置) */
export interface HandSpec {
  side: tk.TSide;
  kinds: string[];
  active: boolean;                          // 现在轮到这一方布阵,且本机可以操作
  blocked: (kind: string) => string | null; // 不能布的原因(先布王将 / 放哪都会将军)
}

export interface DraftBoardProps {
  game: tk.TGame;
  perspective: tk.TSide;            // 下方一侧
  phase: "place" | "play" | "view";
  // 布阵
  hands?: { top: HandSpec; bottom: HandSpec };
  placeKind?: string | null;        // 驹台上选中的棋子
  onPickHand?: (kind: string | null) => void;
  placeableFor?: (kind: string) => Sq[];
  onPlace?: (kind: string, at: Sq) => void;
  // 对局
  legal?: TMove[];                  // 当前用户可走的着法(不轮到时为空)
  onMove?: (m: TMove) => void;
  onInspect?: (p: { kind: string; from?: string }) => void;
}

type Src = { src: "hand" | "board"; kind: string; side: tk.TSide; from?: Sq };
type Pending = Src & { x0: number; y0: number; size: number; id: number };
type Drag = Src & { x: number; y: number; size: number; over: string | null };

function sqAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)?.closest("[data-sq]") as HTMLElement | null;
  return el?.dataset.sq ?? null;
}
const parseSq = (k: string): Sq => { const [x, y] = k.split(",").map(Number); return { x, y }; };

export function DraftBoard(props: DraftBoardProps) {
  const { game, perspective, phase, legal = [], onMove, onInspect, hands } = props;
  const [sel, setSel] = useState<Sq | null>(null);
  const [via, setVia] = useState<Sq | null>(null);
  const [promo, setPromo] = useState<TMove[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const pending = useRef<Pending | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // 拖放结束后浏览器还会在被拖的元素上补发一次 click,只吞掉这一下,不影响点别的元素
  const suppressClick = useRef<{ el: EventTarget | null; t: number }>({ el: null, t: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setSel(null); setVia(null); setPromo(null); }, [game.ply, phase, game.board]);

  // 新落下的棋子播放一次落子动画(布阵和走子都适用)
  const prevBoard = useRef(game.board);
  const boardVer = useRef(0);
  const landed = useMemo(() => {
    const s = new Set<number>();
    if (prevBoard.current !== game.board) {
      boardVer.current++;
      game.board.forEach((p, i) => { if (p && prevBoard.current[i] !== p) s.add(i); });
    }
    return s;
  }, [game.board]);
  useEffect(() => { prevBoard.current = game.board; }, [game.board]);

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
  // 布阵:拖动中的棋子优先,否则是驹台上选中的棋子
  const activeHand = hands ? [hands.bottom, hands.top].find((h) => h.active) : undefined;
  const placingKind = drag?.src === "hand" ? drag.kind : props.placeKind ?? null;
  const placeSet = useMemo(
    () => new Set(phase === "place" && placingKind && props.placeableFor ? props.placeableFor(placingKind).map(k2) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, placingKind, props.placeableFor, game.board],
  );
  const placeable = (s: Sq) => placeSet.has(k2(s));

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
      if (placingKind && placeable(s)) props.onPlace?.(placingKind, s);
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

  // 拖动走子:松手的格子 = 落点;落在狮子第一步的格子上则进入第二步(再点一次)
  function dropMove(from: Sq, s: Sq) {
    if (tk.sameSq(from, s)) { setSel(from); return; }
    const ms = legal.filter((m) => tk.sameSq(m.from, from));
    const direct = ms.filter((m) => !m.via && tk.sameSq(m.to, s));
    if (direct.length) { setSel(from); finish(direct); return; }
    if (ms.some((m) => m.via && tk.sameSq(m.via, s))) { setSel(from); setVia(s); return; }
    setSel(null); setVia(null);
  }

  // ---------- 拖放(Pointer Events:鼠标与触屏通用) ----------
  function cellSize(): number {
    const el = gridRef.current?.querySelector(".db__sq") as HTMLElement | null;
    return el ? el.getBoundingClientRect().width : 72;
  }
  function down(e: RPointerEvent<HTMLElement>, src: Src) {
    if (e.button !== 0) return;
    pending.current = { ...src, x0: e.clientX, y0: e.clientY, size: cellSize(), id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 旧浏览器 */ }
  }
  function move(e: RPointerEvent<HTMLElement>) {
    const pd = pending.current;
    if (!pd || pd.id !== e.pointerId) return;
    let d = dragRef.current;
    if (!d) {
      if (Math.hypot(e.clientX - pd.x0, e.clientY - pd.y0) < DRAG_THRESHOLD) return;
      if (pd.src === "board") { setSel(pd.from!); setVia(null); setPromo(null); }
      else props.onPickHand?.(pd.kind);
      d = { src: pd.src, kind: pd.kind, side: pd.side, from: pd.from, size: pd.size, x: 0, y: 0, over: null };
    }
    d = { ...d, x: e.clientX, y: e.clientY, over: sqAt(e.clientX, e.clientY) };
    dragRef.current = d;
    setDrag(d);
  }
  function up(e: RPointerEvent<HTMLElement>) {
    const pd = pending.current;
    if (!pd || pd.id !== e.pointerId) return;
    pending.current = null;
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return; // 没拖动:交给 onClick 按点击处理
    suppressClick.current = { el: e.currentTarget, t: Date.now() };
    const over = sqAt(e.clientX, e.clientY);
    if (!over) return;
    const s = parseSq(over);
    if (d.src === "hand") {
      if (props.placeableFor?.(d.kind).some((q) => tk.sameSq(q, s))) props.onPlace?.(d.kind, s);
    } else dropMove(d.from!, s);
  }
  function cancel() { pending.current = null; dragRef.current = null; setDrag(null); }
  const dragHandlers = { onPointerMove: move, onPointerUp: up, onPointerCancel: cancel, onLostPointerCapture: cancel };
  const clicked = (e: { currentTarget: EventTarget }) => {
    const sc = suppressClick.current;
    if (sc.el !== e.currentTarget || Date.now() - sc.t > 400) return false;
    suppressClick.current = { el: null, t: 0 };
    return true;
  };

  const ys = perspective === "sente" ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
  const xs = perspective === "sente" ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  const lm = game.lastMove;
  const teamOf = (side: tk.TSide) => (side === "sente" ? "blue" : "red") as "blue" | "red";

  const renderHand = (h: HandSpec, pos: "top" | "bottom") => {
    if (phase !== "place" || (!h.kinds.length && !h.active)) return null;
    const team = teamOf(h.side);
    return (
      <div className={`hand hand--${pos} hand--${team}${h.active ? " hand--active" : ""}`}>
        <span className="hand__label">{team === "blue" ? "蓝方" : "红方"}驹台{h.kinds.length ? ` · ${h.kinds.length}` : " · 已布完"}</span>
        <div className="hand__tray">
          {h.kinds.map((k) => {
            const why = h.active ? h.blocked(k) : null;
            const can = h.active && !why;
            const on = h.active && props.placeKind === k;
            const dragging = drag?.src === "hand" && drag.kind === k;
            return (
              <button
                key={k}
                className={`hand__tok${can ? " hand__tok--can" : ""}${why ? " hand__tok--blocked" : ""}${on ? " hand__tok--on" : ""}${dragging ? " hand__tok--dragging" : ""}${k === tk.KING && can ? " hand__tok--must" : ""}`}
                title={why ?? (can ? "拖到棋盘上,或点一下再点格子" : tk.KIND[k].kanji)}
                onPointerDown={can ? (e) => down(e, { src: "hand", kind: k, side: h.side }) : undefined}
                {...(can ? dragHandlers : {})}
                onClick={(e) => {
                  if (clicked(e)) return;
                  onInspect?.({ kind: k });
                  if (can) props.onPickHand?.(on ? null : k);
                }}
              >
                <Token piece={{ kind: k }} size={56} team={team} flip={h.side !== perspective} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`db${drag ? " db--dragging" : ""}`}>
      {hands && renderHand(hands.top, "top")}
      <div className="db__grid" ref={gridRef}>
        {ys.map((y) => xs.map((x) => {
          const s = { x, y };
          const key = k2(s);
          const i = tk.idx(s);
          const p = game.board[i];
          const tg = targets.get(key);
          const movable = phase === "play" && !!p && legal.some((m) => tk.sameSq(m.from, s));
          const cls = ["db__sq"];
          if ((x + y) % 2) cls.push("db__sq--alt");
          if (activeHand && phase === "place" && tk.homeRows(activeHand.side).includes(y)) cls.push("db__sq--home");
          if (placeable(s)) cls.push("db__sq--placeable");
          if (lm && (tk.sameSq(lm.from, s) || tk.sameSq(lm.to, s))) cls.push("db__sq--last");
          if (lm?.via && tk.sameSq(lm.via, s)) cls.push("db__sq--lastvia");
          if (sel && tk.sameSq(sel, s)) cls.push("db__sq--sel");
          if (via && tk.sameSq(via, s)) cls.push("db__sq--via");
          if (checkSq && tk.sameSq(checkSq, s)) cls.push("db__sq--check");
          if (movable) cls.push("db__sq--movable");
          if (drag && drag.over === key) cls.push(placeable(s) || targets.has(key) ? "db__sq--over" : "db__sq--over-bad");
          if (drag?.src === "board" && drag.from && tk.sameSq(drag.from, s)) cls.push("db__sq--dragfrom");
          return (
            <button
              key={key}
              data-sq={key}
              className={cls.join(" ")}
              onClick={(e) => { if (!clicked(e)) click(s); }}
              onPointerDown={movable ? (e) => down(e, { src: "board", kind: p!.kind, side: p!.side, from: s }) : undefined}
              {...(movable ? dragHandlers : {})}
              aria-label={`${FILES[x]}${y + 1}`}
            >
              {p && (
                <span key={landed.has(i) ? `l${boardVer.current}` : "p"} className={`db__pc${landed.has(i) ? " db__pc--landed" : ""}`}>
                  <Token piece={p} flip={p.side !== perspective} team={teamOf(p.side)} size={72} />
                </span>
              )}
              {tg && !p && <span className={`db__dot${tg.lion ? " db__dot--lion" : ""}`} />}
              {tg && p && <span className={`db__ring${tg.lion ? " db__ring--lion" : ""}`} />}
              {tg && tg.caps > 1 && <span className={`db__caps${tg.friendly ? " db__caps--friendly" : ""}`}>×{tg.caps}{tg.friendly ? " 含己方" : ""}</span>}
              {y === ys[ys.length - 1] && <span className="db__file">{FILES[x]}</span>}
              {x === xs[xs.length - 1] && <span className="db__rank">{y + 1}</span>}
            </button>
          );
        }))}
      </div>
      {hands && renderHand(hands.bottom, "bottom")}
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
      {drag && createPortal(
        <div className="db-ghost" style={{ left: drag.x, top: drag.y, width: drag.size, height: drag.size }}>
          <Token piece={(drag.src === "board" && drag.from && game.board[tk.idx(drag.from)]) || { kind: drag.kind }} size={72} team={teamOf(drag.side)} flip={drag.side !== perspective} />
        </div>,
        document.body,
      )}
    </div>
  );
}
