import { type Piece as PieceT, isChessKind } from "@cs/shared";
import { useSkins } from "../skins/SkinContext";
import "./Piece.css";

const SHOGI_KANJI: Record<string, string> = {
  OU: "玉", HI: "飛", KAKU: "角", KIN: "金", GIN: "銀", KEI: "桂", KYO: "香", FU: "歩",
};
const SHOGI_PROMOTED: Record<string, string> = {
  HI: "龍", KAKU: "馬", GIN: "全", KEI: "圭", KYO: "杏", FU: "と",
};
const SHOGI_KANJI2: Record<string, [string, string]> = {
  OU: ["王", "將"], HI: ["飛", "車"], KAKU: ["角", "行"], KIN: ["金", "將"],
  GIN: ["銀", "將"], KEI: ["桂", "馬"], KYO: ["香", "車"], FU: ["歩", "兵"],
};
const SHOGI_PROMOTED2: Record<string, [string, string]> = {
  HI: ["龍", "王"], KAKU: ["龍", "馬"], GIN: ["成", "銀"], KEI: ["成", "桂"],
  KYO: ["成", "香"], FU: ["と", "金"],
};

export function Piece({ piece, flip }: { piece: PieceT; flip?: boolean }) {
  const { chessSrc, shogi } = useSkins();
  const rot = flip ? { transform: "rotate(180deg)" } : null;

  // 被将棋打入、保留国象走法的子:五边形木牌里嵌国象图案
  if (isChessKind(piece.kind) && piece.side === "shogi") {
    return (
      <div className="piece piece--shogi piece--captured" style={{ background: shogi.bg, ...rot }} title="打入的国象子">
        <img className="piece__inset" src={chessSrc(piece.kind)} alt={piece.kind} draggable={false} />
      </div>
    );
  }
  // 国象方棋子:SVG(按皮肤切换;不旋转)
  if (piece.side === "chess") {
    return <img className="piece piece--chess" src={chessSrc(piece.kind)} alt={piece.kind} draggable={false} />;
  }

  // 将棋方:五边形木牌 + 汉字(一文字 / 二文字),升变红字,远方旋转 180°
  const big = piece.kind === "OU" || piece.kind === "HI" || piece.kind === "KAKU";
  const color = piece.promoted ? "#c01f16" : shogi.text;
  const cls = `piece piece--shogi${big ? " piece--shogi-big" : ""}`;

  if (shogi.glyph === "double") {
    const pair = piece.promoted
      ? SHOGI_PROMOTED2[piece.kind] ?? SHOGI_KANJI2[piece.kind]
      : SHOGI_KANJI2[piece.kind];
    return (
      <div className={cls} style={{ background: shogi.bg, ...rot }}>
        <span className="koma koma--double" style={{ color }}>
          <span>{pair?.[0]}</span><span>{pair?.[1]}</span>
        </span>
      </div>
    );
  }

  const glyph = piece.promoted ? SHOGI_PROMOTED[piece.kind] ?? SHOGI_KANJI[piece.kind] : SHOGI_KANJI[piece.kind];
  return (
    <div className={cls} style={{ background: shogi.bg, ...rot }}>
      <span className="koma" style={{ color }}>{glyph}</span>
    </div>
  );
}
