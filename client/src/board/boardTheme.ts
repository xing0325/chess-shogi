import { RIVER_RANK } from "@cs/shared";

export type SquareStyleKind = "wood" | "light" | "dark" | "river";

// 决定单格底色类型:河界整行 river;将棋侧木纹;国象侧黑白相间。
export function squareStyleKind(file: number, rank: number): SquareStyleKind {
  if (rank === RIVER_RANK) return "river";
  if (rank < RIVER_RANK) return "wood";
  return (file + rank) % 2 === 0 ? "dark" : "light";
}

// 配色现由 skins/SkinContext 提供(可换皮肤)。
