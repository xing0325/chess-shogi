import { BOARD_SIZE, idx, type Position, type Square as Sq, type Side } from "@cs/shared";
import { Square } from "./Square";
import { Piece } from "./Piece";
import { useSkins } from "../skins/SkinContext";
import "./Board.css";

export interface BoardProps {
  position: Position;
  selected?: Sq | null;
  destinations?: Sq[];
  lastMove?: Sq | null;
  perspective?: Side; // 谁在下方(默认将棋方)
  onCellClick?: (file: number, rank: number) => void;
}

export function Board({ position, selected, destinations = [], lastMove, perspective = "shogi", onCellClick }: BoardProps) {
  const { theme } = useSkins();
  const destSet = new Set(destinations.map((d) => idx(d.file, d.rank)));

  // 将棋视角:上=rank8(国象底线),下=rank0;国象视角:整盘旋转 180°
  const asc = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  const ranks = perspective === "chess" ? asc : [...asc].reverse(); // 从上到下渲染的 rank 顺序
  const files = perspective === "chess" ? [...asc].reverse() : asc;  // 从左到右渲染的 file 顺序

  const cells = [];
  for (const rank of ranks) {
    for (const file of files) {
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
          {piece && <Piece piece={piece} flip={piece.side !== perspective} />}
        </Square>
      );
    }
  }
  return (
    <div className="board-wrap">
      <div className="board" style={{ borderColor: theme.border, background: theme.border }}>{cells}</div>
      <div className="river-label" aria-hidden>
        <span>楚 河</span>
        <span>汉 界</span>
      </div>
    </div>
  );
}
