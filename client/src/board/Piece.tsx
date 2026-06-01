import { type Piece as PieceT, isChessKind } from "@cs/shared";
import { useSkins } from "../skins/SkinContext";
import "./Piece.css";

const SHOGI_KANJI: Record<string, string> = {
  OU: "玉", HI: "飛", KAKU: "角", KIN: "金", GIN: "銀", KEI: "桂", KYO: "香", FU: "歩",
};
const SHOGI_PROMOTED: Record<string, string> = {
  HI: "龍", KAKU: "馬", GIN: "全", KEI: "圭", KYO: "杏", FU: "と",
};

export function Piece({ piece }: { piece: PieceT }) {
  const { chessSrc, shogi } = useSkins();

  // 被将棋打入、保留国象走法的子:五边形木牌里嵌国象图案
  if (isChessKind(piece.kind) && piece.side === "shogi") {
    return (
      <div className="piece piece--shogi piece--captured" style={{ background: shogi.bg }} title="打入的国象子">
        <img className="piece__inset" src={chessSrc(piece.kind)} alt={piece.kind} draggable={false} />
      </div>
    );
  }
  // 国象方棋子:SVG(按皮肤切换)
  if (piece.side === "chess") {
    return <img className="piece piece--chess" src={chessSrc(piece.kind)} alt={piece.kind} draggable={false} />;
  }
  // 将棋方:五边形木牌 + 汉字(升变红字)
  const big = piece.kind === "OU" || piece.kind === "HI" || piece.kind === "KAKU";
  const glyph = piece.promoted ? SHOGI_PROMOTED[piece.kind] ?? SHOGI_KANJI[piece.kind] : SHOGI_KANJI[piece.kind];
  const color = piece.promoted ? "#d6342a" : shogi.text;
  return (
    <div className={`piece piece--shogi${big ? " piece--shogi-big" : ""}`} style={{ background: shogi.bg }}>
      <span className="koma" style={{ color }}>{glyph}</span>
    </div>
  );
}
