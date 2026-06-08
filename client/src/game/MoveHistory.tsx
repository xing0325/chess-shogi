import { useEffect, useRef } from "react";
import { idx, type GameState } from "@cs/shared";
import "./MoveHistory.css";

const KANJI: Record<string, string> = {
  OU: "玉", HI: "飛", KAKU: "角", KIN: "金", GIN: "銀", KEI: "桂", KYO: "香", FU: "歩",
  K: "K", Q: "Q", R: "R", B: "B", N: "N", P: "P",
};
const FILES = "abcdefghi";

function moveLabel(snap: GameState): { side: "chess" | "shogi"; text: string } | null {
  const lm = snap.lastMove;
  if (!lm) return null;
  const p = snap.position[idx(lm.file, lm.rank)];
  const coord = `${FILES[lm.file]}${lm.rank + 1}`;
  if (!p) return { side: snap.turn === "chess" ? "shogi" : "chess", text: coord };
  const k = (p.promoted ? "+" : "") + (KANJI[p.kind] ?? p.kind);
  return { side: p.side, text: `${k}${coord}` };
}

export interface MoveHistoryProps {
  snaps: GameState[];
  view: number;
  onSelect: (i: number) => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip: () => void;
}

export function MoveHistory({ snaps, view, onSelect, onFirst, onPrev, onNext, onLast, onFlip }: MoveHistoryProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [view]);

  return (
    <div className="mh">
      <div className="mh__head">
        <span>棋谱</span>
        <button className="mh__flip" onClick={onFlip} title="翻转棋盘视角">⟲ 翻转</button>
      </div>

      <div className="mh__list" ref={listRef}>
        {snaps.map((s, i) => {
          if (i === 0) return null;
          const m = moveLabel(s);
          const active = i === view;
          return (
            <button
              key={i}
              ref={active ? activeRef : null}
              className={`mh__row${active ? " mh__row--active" : ""}`}
              onClick={() => onSelect(i)}
            >
              <span className="mh__no">{i}</span>
              <span className={`mh__dot mh__dot--${m?.side ?? "chess"}`} />
              <span className="mh__mv">{m?.text ?? "—"}</span>
            </button>
          );
        })}
        {snaps.length <= 1 && <div className="mh__empty">还没有走子</div>}
      </div>

      <div className="mh__nav">
        <button onClick={onFirst} disabled={view === 0} title="开局">⏮</button>
        <button onClick={onPrev} disabled={view === 0} title="上一步">◀</button>
        <button onClick={onNext} disabled={view >= snaps.length - 1} title="下一步">▶</button>
        <button onClick={onLast} disabled={view >= snaps.length - 1} title="最新">⏭</button>
      </div>
    </div>
  );
}
