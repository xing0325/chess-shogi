import type { ChessKind } from "@cs/shared";
import type { PendingPromo } from "./useBoardInteraction";
import "./PromotionDialog.css";

const CHESS_CHOICES: { kind: ChessKind; label: string; svg: string }[] = [
  { kind: "Q", label: "后", svg: "/pieces/chess/wQ.svg" },
  { kind: "R", label: "车", svg: "/pieces/chess/wR.svg" },
  { kind: "B", label: "象", svg: "/pieces/chess/wB.svg" },
  { kind: "N", label: "马", svg: "/pieces/chess/wN.svg" },
];

export interface PromotionDialogProps {
  promo: PendingPromo;
  onChoose: (arg: boolean | ChessKind) => void;
  onCancel: () => void;
}

export function PromotionDialog({ promo, onChoose, onCancel }: PromotionDialogProps) {
  return (
    <div className="promo-overlay" onClick={onCancel}>
      <div className="promo-dialog" onClick={(e) => e.stopPropagation()}>
        {promo.mode === "chess" ? (
          <>
            <div className="promo-title">兵升变为</div>
            <div className="promo-choices">
              {CHESS_CHOICES.map((c) => (
                <button key={c.kind} className="promo-btn" onClick={() => onChoose(c.kind)}>
                  <img src={c.svg} alt={c.label} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="promo-title">是否升变?</div>
            <div className="promo-choices">
              <button className="promo-btn promo-btn--text" onClick={() => onChoose(true)}>
                <span className="promo-yes">升变</span>
              </button>
              <button className="promo-btn promo-btn--text" onClick={() => onChoose(false)}>
                <span>不升</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
