import { useMemo } from "react";
import { createInitialPosition, BOARD_SIZE, idx } from "@cs/shared";
import { Square } from "./Square";
import { Piece } from "./Piece";
import "./Board.css";

export function Board() {
  const position = useMemo(() => createInitialPosition(), []);
  const cells = [];
  // rank 8(行9)在最上面显示 → 从高 rank 往低 rank 渲染
  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    for (let file = 0; file < BOARD_SIZE; file++) {
      const piece = position[idx(file, rank)];
      cells.push(
        <Square key={`${file}-${rank}`} file={file} rank={rank}>
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
