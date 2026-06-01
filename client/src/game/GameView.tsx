import { useGame } from "./useGame";
import { Board } from "../board/Board";
import { Hands } from "./Hands";
import { PromotionDialog } from "./PromotionDialog";
import "./GameView.css";

export function GameView() {
  const g = useGame();
  const { state } = g;
  const result = state.result;
  const turnLabel = state.turn === "chess" ? "国象方" : "将棋方";
  const handSelected = g.selection?.type === "hand"
    ? { kind: g.selection.kind, fromChess: g.selection.fromChess }
    : null;

  return (
    <div className="game">
      <div className="game__bar">
        {result ? (
          <span className="game__result">
            {result.kind === "draw"
              ? "和棋"
              : `${result.winner === "chess" ? "国象方" : "将棋方"}胜 · ${result.reason === "checkmate" ? "将死" : "擒王"}`}
          </span>
        ) : (
          <span className={`game__turn game__turn--${state.turn}`}>● 轮到 {turnLabel}</span>
        )}
        <button className="game__reset" onClick={g.reset}>重新开局</button>
      </div>

      <Board
        position={state.position}
        selected={g.selectedSquare}
        destinations={g.destinations}
        lastMove={state.lastMove}
        onCellClick={g.clickCell}
      />

      <Hands
        hand={state.hands.shogi}
        active={state.turn === "shogi" && !result}
        selected={handSelected}
        onSelect={g.selectHand}
      />

      {g.pendingPromo && (
        <PromotionDialog promo={g.pendingPromo} onChoose={g.choosePromo} onCancel={g.cancelPromo} />
      )}
    </div>
  );
}
