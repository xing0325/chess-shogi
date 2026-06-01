export interface BoardTheme {
  id: string;
  name: string;
  woodLight: string;
  woodDark: string;
  chessLight: string;
  chessDark: string;
  river: string;
  border: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "classic", name: "经典暖木", woodLight: "#e6c489", woodDark: "#d2a85f", chessLight: "#f0d9b5", chessDark: "#b58863", river: "#bfe3ee", border: "#5a3d22" },
  { id: "jade", name: "青玉", woodLight: "#ddca9c", woodDark: "#c2ab6c", chessLight: "#e9efe1", chessDark: "#7fa080", river: "#c2e6d9", border: "#3f5a44" },
  { id: "ink", name: "墨", woodLight: "#b9a489", woodDark: "#8f7a5e", chessLight: "#cfcabe", chessDark: "#6c6760", river: "#a3bcc2", border: "#2c2622" },
];

export interface ChessSet { id: string; name: string }
// id 即 public/pieces/<id>/ 目录名
export const CHESS_SETS: ChessSet[] = [
  { id: "chess", name: "经典 Cburnett" },
  { id: "merida", name: "Merida" },
  { id: "alpha", name: "Alpha" },
];

export interface ShogiStyle { id: string; name: string; bg: string; text: string }
export const SHOGI_STYLES: ShogiStyle[] = [
  { id: "wood", name: "榧木", bg: "linear-gradient(160deg, #f6e0ad 0%, #ecc77f 55%, #dcab5c 100%)", text: "#3a2410" },
  { id: "ebony", name: "黑檀", bg: "linear-gradient(160deg, #6e5638 0%, #4a3a22 55%, #352a18 100%)", text: "#f2e3c4" },
];

export interface Skins { board: string; chessSet: string; shogiStyle: string }
export const DEFAULT_SKINS: Skins = { board: "classic", chessSet: "chess", shogiStyle: "wood" };

export const SKINS_KEY = "cs_skins";

export function loadSkins(): Skins {
  try {
    const raw = localStorage.getItem(SKINS_KEY);
    if (raw) return { ...DEFAULT_SKINS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SKINS;
}
export function boardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
export function shogiStyle(id: string): ShogiStyle {
  return SHOGI_STYLES.find((s) => s.id === id) ?? SHOGI_STYLES[0];
}
