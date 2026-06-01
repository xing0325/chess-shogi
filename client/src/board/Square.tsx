import type { ReactNode } from "react";
import { squareStyleKind } from "./boardTheme";
import { useSkins } from "../skins/SkinContext";

export interface SquareProps {
  file: number;
  rank: number;
  children?: ReactNode;
  selected?: boolean;
  isDest?: boolean;
  isCapture?: boolean;
  isLast?: boolean;
  onClick?: (file: number, rank: number) => void;
}

export function Square({ file, rank, children, selected, isDest, isCapture, isLast, onClick }: SquareProps) {
  const { theme } = useSkins();
  const kind = squareStyleKind(file, rank);
  const bg = {
    wood: (file + rank) % 2 === 0 ? theme.woodDark : theme.woodLight,
    light: theme.chessLight,
    dark: theme.chessDark,
    river: theme.river,
  }[kind];
  const cls = [
    "sq", `sq--${kind}`,
    selected && "sq--selected",
    isLast && "sq--last",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ background: bg }} onClick={() => onClick?.(file, rank)}>
      {kind === "river" && <div className="sq__water" aria-hidden />}
      {children}
      {isDest && !isCapture && <div className="sq__dot" aria-hidden />}
      {isDest && isCapture && <div className="sq__capture" aria-hidden />}
    </div>
  );
}
