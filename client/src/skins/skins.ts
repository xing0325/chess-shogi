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

export type ShogiGlyph = "single" | "double";
export interface ShogiStyle { id: string; name: string; bg: string; text: string; glyph: ShogiGlyph }
export const SHOGI_STYLES: ShogiStyle[] = [
  { id: "kanji1", name: "一文字 · 榧木", bg: "linear-gradient(160deg, #f6e0ad 0%, #ecc77f 55%, #dcab5c 100%)", text: "#2a1606", glyph: "single" },
  { id: "kanji2", name: "二文字 · 古印", bg: "linear-gradient(157deg, #f0d49a 0%, #e2b96f 52%, #cf9f50 100%)", text: "#241204", glyph: "double" },
];

export interface Skins { board: string; chessSet: string; shogiStyle: string }
export const DEFAULT_SKINS: Skins = { board: "classic", chessSet: "chess", shogiStyle: "kanji1" };

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
