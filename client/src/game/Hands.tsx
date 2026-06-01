import { type HandGroup, type PieceKind } from "@cs/shared";
import { Piece } from "../board/Piece";
import "./Hands.css";

export interface HandsProps {
  hand: HandGroup[];
  active: boolean; // 是否轮到将棋方(可点选打入)
  selected?: { kind: PieceKind; fromChess: boolean } | null;
  onSelect: (kind: PieceKind, fromChess: boolean) => void;
}

export function Hands({ hand, active, selected, onSelect }: HandsProps) {
  return (
    <div className={`hands${active ? " hands--active" : ""}`}>
      <span className="hands__label">将棋方手牌</span>
      <div className="hands__tray">
        {hand.length === 0 && <span className="hands__empty">(空 —— 吃子后可打入)</span>}
        {hand.map((g) => {
          const isSel = !!selected && selected.kind === g.kind && selected.fromChess === g.fromChess;
          return (
            <button
              key={`${g.kind}-${g.fromChess}`}
              className={`hands__piece${isSel ? " hands__piece--sel" : ""}`}
              onClick={() => onSelect(g.kind, g.fromChess)}
              disabled={!active}
              title={g.fromChess ? "打入的国象子(保留国象走法)" : "将棋子"}
            >
              <Piece piece={{ side: "shogi", kind: g.kind, ...(g.fromChess ? { fromChess: true } : {}) }} />
              {g.count > 1 && <span className="hands__count">{g.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
