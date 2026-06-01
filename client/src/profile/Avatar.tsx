import "./Avatar.css";

interface AvatarDef { bg: string; kanji?: string; svg?: string }

const DEFS: Record<string, AvatarDef> = {
  wK: { bg: "#c0392b", svg: "/pieces/chess/wK.svg" },
  wQ: { bg: "#8e44ad", svg: "/pieces/chess/wQ.svg" },
  wR: { bg: "#2c7a7b", svg: "/pieces/chess/wR.svg" },
  wB: { bg: "#2f855a", svg: "/pieces/chess/wB.svg" },
  wN: { bg: "#b7791f", svg: "/pieces/chess/wN.svg" },
  wP: { bg: "#2b6cb0", svg: "/pieces/chess/wP.svg" },
  OU: { bg: "#6b46c1", kanji: "玉" },
  HI: { bg: "#c05621", kanji: "飛" },
  KAKU: { bg: "#2c5282", kanji: "角" },
  KIN: { bg: "#975a16", kanji: "金" },
  GIN: { bg: "#4a5568", kanji: "銀" },
  FU: { bg: "#285e61", kanji: "歩" },
};

export const AVATAR_LIST = Object.keys(DEFS);

export function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  const d = DEFS[id] ?? DEFS.wP;
  return (
    <span className="avatar" style={{ width: size, height: size, background: d.bg }}>
      {d.svg
        ? <img className="avatar__img" src={d.svg} alt="" draggable={false} />
        : <span className="avatar__k" style={{ fontSize: size * 0.5 }}>{d.kanji}</span>}
    </span>
  );
}
