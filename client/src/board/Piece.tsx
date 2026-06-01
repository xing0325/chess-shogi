import type { Piece as PieceT } from "@cs/shared";
import "./Piece.css";

const CHESS_SVG: Record<string, string> = {
  K: "/pieces/chess/wK.svg", Q: "/pieces/chess/wQ.svg", R: "/pieces/chess/wR.svg",
  B: "/pieces/chess/wB.svg", N: "/pieces/chess/wN.svg", P: "/pieces/chess/wP.svg",
};
const SHOGI_KANJI: Record<string, string> = {
  OU: "玉", HI: "飛", KAKU: "角", KIN: "金", GIN: "銀", KEI: "桂", KYO: "香", FU: "歩",
};

export function Piece({ piece }: { piece: PieceT }) {
  if (piece.side === "chess") {
    const src = CHESS_SVG[piece.kind as string];
    return <img className="piece piece--chess" src={src} alt={piece.kind} draggable={false} />;
  }
  // 将棋:五边形木牌 + 汉字。将棋方在下方,棋子尖朝上(朝对手)。
  const big = piece.kind === "OU" || piece.kind === "HI" || piece.kind === "KAKU";
  return (
    <div className={`piece piece--shogi${big ? " piece--shogi-big" : ""}`}>
      <span className="koma">{SHOGI_KANJI[piece.kind as string]}</span>
    </div>
  );
}
