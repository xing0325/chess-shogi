import type { Action, GameState, Side } from "@cs/shared";
import { Board } from "../board/Board";
import { Hands } from "./Hands";
import { PromotionDialog } from "./PromotionDialog";
import { useBoardInteraction } from "./useBoardInteraction";
import "./GameBoard.css";

export interface GameBoardProps {
  state: GameState;
  submit: (a: Action) => void;
  enabled: boolean;
  mySide?: Side;          // 联机:本方执边
  opponentName?: string;  // 联机:对手名
  onReset?: () => void;   // 本地:重新开局
  onRematch?: () => void; // 联机:再来一局
  onLeave?: () => void;   // 联机:离开房间
  note?: string;          // 提示(如对方掉线)
}

const sideName = (s: Side) => (s === "chess" ? "国象方" : "将棋方");

export function GameBoard(props: GameBoardProps) {
  const { state, submit, enabled, mySide, opponentName, onReset, onRematch, onLeave, note } = props;
  const ui = useBoardInteraction(state, submit, enabled);
  const result = state.result;
  const online = !!mySide;

  let banner: string;
  if (result) {
    banner = result.kind === "draw"
      ? "和棋"
      : `${sideName(result.winner)}胜 · ${result.reason === "checkmate" ? "将死" : "擒王"}`;
  } else if (online) {
    banner = enabled ? `你的回合(执${sideName(mySide!)})` : `等待对手(${opponentName ?? "对方"})落子…`;
  } else {
    banner = `轮到 ${sideName(state.turn)}`;
  }

  return (
    <div className="game">
      <div className="game__bar">
        <span className={`game__status${result ? " game__status--result" : ` game__turn--${state.turn}`}`}>
          {result ? "🏁 " : "● "}{banner}
        </span>
        <div className="game__controls">
          {note && <span className="game__note">{note}</span>}
          {!online && onReset && <button className="game__btn" onClick={onReset}>重新开局</button>}
          {online && result && onRematch && <button className="game__btn game__btn--accent" onClick={onRematch}>再来一局</button>}
          {online && onLeave && <button className="game__btn" onClick={onLeave}>离开</button>}
        </div>
      </div>

      <Board
        position={state.position}
        selected={ui.selectedSquare}
        destinations={ui.destinations}
        lastMove={state.lastMove}
        onCellClick={ui.clickCell}
      />

      <Hands
        hand={state.hands.shogi}
        active={enabled && state.turn === "shogi" && !result}
        selected={ui.handSelected}
        onSelect={ui.selectHand}
      />

      {ui.pendingPromo && (
        <PromotionDialog promo={ui.pendingPromo} onChoose={ui.choosePromo} onCancel={ui.cancelPromo} />
      )}
    </div>
  );
}
