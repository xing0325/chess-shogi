import { tk } from "@cs/shared";
import { diagram, abilities, MARK_LABEL, type Mark } from "./geometry";

/** 走法图:中心为棋子,向上为前方 */
export function MoveDiagram({ kind, R = 4, cell = 14, legend = false }: { kind: string; R?: number; cell?: number; legend?: boolean }) {
  const k = tk.KIND[kind];
  if (!k) return null;
  const m = diagram(k.rules, R);
  const rows = [];
  for (let y = R; y >= -R; y--) {
    const cells = [];
    for (let x = -R; x <= R; x++) {
      const t = x === 0 && y === 0 ? "self" : m.get(`${x},${y}`) ?? "";
      cells.push(<span key={x} className={`md__c${t ? ` md__c--${t}` : ""}`} style={{ width: cell, height: cell }} />);
    }
    rows.push(<div key={y} className="md__row">{cells}</div>);
  }
  const used = [...new Set(m.values())] as Mark[];
  return (
    <div className="md">
      <div className="md__grid">{rows}</div>
      {legend && (
        <ul className="md__legend">
          {used.map((t) => <li key={t}><span className={`md__c md__c--${t}`} style={{ width: 12, height: 12 }} />{MARK_LABEL[t]}</li>)}
        </ul>
      )}
    </div>
  );
}

/** 将棋式五角形棋子 */
export function Token({ piece, flip = false, size = 56, team }: { piece: { kind: string; from?: string }; flip?: boolean; size?: number; team?: "blue" | "red" }) {
  const k = tk.KIND[piece.kind];
  const name = k?.kanji ?? "?";
  const chars = [...name.replace(/[·\s]/g, "")];
  const fs = chars.length <= 2 ? size * 0.34 : size * 0.26;
  return (
    <span
      className={`tok${flip ? " tok--flip" : ""}${piece.from ? " tok--promoted" : ""}${team ? ` tok--${team}` : ""}${piece.kind === tk.KING ? " tok--king" : ""}`}
      style={{ width: size * 0.86, height: size }}
      title={`${name} · ${k?.en ?? ""}`}
    >
      <span className="tok__txt" style={{ fontSize: fs }}>{chars.map((c, i) => <span key={i}>{c}</span>)}</span>
    </span>
  );
}

export type CardState = "free" | "banned" | "blue" | "red";

export function PieceCard({ kind, state, selected, onClick }: { kind: string; state: CardState; selected?: boolean; onClick?: () => void }) {
  const k = tk.KIND[kind];
  const promo = k.promotesTo ? tk.KIND[k.promotesTo] : null;
  return (
    <button className={`pc pc--${state}${selected ? " pc--sel" : ""}`} onClick={onClick}>
      <span className="pc__top">
        <span className="pc__kanji">{k.kanji}</span>
        <MoveDiagram kind={kind} R={2} cell={8} />
      </span>
      <span className="pc__en">{k.en}</span>
      <span className="pc__promo">{promo ? <>成 → {promo.kanji}</> : "不升变"}</span>
      {state === "banned" && <span className="pc__badge pc__badge--ban">禁</span>}
      {state === "blue" && <span className="pc__badge pc__badge--blue">蓝</span>}
      {state === "red" && <span className="pc__badge pc__badge--red">红</span>}
    </button>
  );
}

export function PieceDetail({ kind, from, children }: { kind: string; from?: string; children?: React.ReactNode }) {
  const k = tk.KIND[kind];
  if (!k) return null;
  const promo = k.promotesTo ? tk.KIND[k.promotesTo] : null;
  const orig = from ? tk.KIND[from] : null;
  const abil = abilities(k);
  return (
    <div className="pd">
      <div className="pd__head">
        <Token piece={{ kind, from }} size={54} />
        <div>
          <div className="pd__name">{k.kanji}</div>
          <div className="pd__en">{k.en}{orig && <> · 由 {orig.kanji} 升变而来</>}</div>
        </div>
      </div>
      <MoveDiagram kind={kind} R={4} cell={15} legend />
      {abil.length > 0 && <ul className="pd__abil">{abil.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      <div className="pd__meta">
        <span>Betza:<code>{k.betza}</code></span>
      </div>
      {promo && !from && (
        <div className="pd__promo">
          <div className="pd__promo-h">升变 → <b>{promo.kanji}</b> <span className="pd__en">{promo.en}</span></div>
          <MoveDiagram kind={promo.id} R={4} cell={9} />
        </div>
      )}
      {!promo && !from && <div className="pd__promo pd__promo--none">此棋子不能升变</div>}
      {children}
    </div>
  );
}
