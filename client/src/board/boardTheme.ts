import { RIVER_RANK } from "@cs/shared";

export type SquareStyleKind = "wood" | "light" | "dark" | "river";

// 决定单格底色类型:河界整行 river;将棋侧木纹;国象侧黑白相间。
export function squareStyleKind(file: number, rank: number): SquareStyleKind {
  if (rank === RIVER_RANK) return "river";
  if (rank < RIVER_RANK) return "wood";
  return (file + rank) % 2 === 0 ? "dark" : "light";
}

// 配色(后续 Plan 4 做成可换皮肤)
export const THEME = {
  woodLight: "#e6c489",
  woodDark: "#d2a85f",
  chessLight: "#f0d9b5",
  chessDark: "#b58863",
  river: "#bfe3ee",
};
