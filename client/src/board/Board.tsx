import { BOARD_SIZE, idx, type Position, type Square as Sq } from "@cs/shared";
import { Square } from "./Square";
import { Piece } from "./Piece";
import "./Board.css";

export interface BoardProps {
  position: Position;
  selected?: Sq | null;
  destinations?: Sq[];
  lastMove?: Sq | null;
  onCellClick?: (file: number, rank: number) => void;
}

export function Board({ position, selected, destinations = [], lastMove, onCellClick }: BoardProps) {
  const destSet = new Set(destinations.map((d) => idx(d.file, d.rank)));
  const cells = [];
  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    for (let file = 0; file < BOARD_SIZE; file++) {
      const piece = position[idx(file, rank)];
      const here = idx(file, rank);
      const isDest = destSet.has(here);
      cells.push(
        <Square
          key={`${file}-${rank}`}
          file={file}
          rank={rank}
          selected={!!selected && selected.file === file && selected.rank === rank}
          isDest={isDest}
          isCapture={isDest && !!piece}
          isLast={!!lastMove && lastMove.file === file && lastMove.rank === rank}
          onClick={onCellClick}
        >
          {piece && <Piece piece={piece} />}
        </Square>
      );
    }
  }
  return (
    <div className="board-wrap">
      <div className="board">{cells}</div>
      <div className="river-label" aria-hidden>
        <span>楚 河</span>
        <span>汉 界</span>
      </div>
    </div>
  );
}
