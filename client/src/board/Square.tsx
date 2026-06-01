import type { ReactNode } from "react";
import { squareStyleKind, THEME } from "./boardTheme";

export function Square({ file, rank, children }: { file: number; rank: number; children?: ReactNode }) {
  const kind = squareStyleKind(file, rank);
  const bg = {
    wood: (file + rank) % 2 === 0 ? THEME.woodDark : THEME.woodLight,
    light: THEME.chessLight,
    dark: THEME.chessDark,
    river: THEME.river,
  }[kind];
  return (
    <div className={`sq sq--${kind}`} style={{ background: bg }}>
      {kind === "river" && <div className="sq__water" aria-hidden />}
      {children}
    </div>
  );
}
