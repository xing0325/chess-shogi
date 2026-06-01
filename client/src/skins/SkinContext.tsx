import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  type Skins, type BoardTheme, type ShogiStyle,
  DEFAULT_SKINS, SKINS_KEY, loadSkins, boardTheme, shogiStyle,
} from "./skins";

interface SkinCtx {
  skins: Skins;
  setSkin: (patch: Partial<Skins>) => void;
  theme: BoardTheme;
  shogi: ShogiStyle;
  chessSrc: (kind: string) => string;
}

const Ctx = createContext<SkinCtx | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skins, setSkins] = useState<Skins>(() => (typeof localStorage !== "undefined" ? loadSkins() : DEFAULT_SKINS));

  const setSkin = useCallback((patch: Partial<Skins>) => {
    setSkins((s) => {
      const next = { ...s, ...patch };
      try { localStorage.setItem(SKINS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value: SkinCtx = {
    skins,
    setSkin,
    theme: boardTheme(skins.board),
    shogi: shogiStyle(skins.shogiStyle),
    chessSrc: (kind: string) => `/pieces/${skins.chessSet}/w${kind}.svg`,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSkins(): SkinCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSkins must be used within SkinProvider");
  return c;
}
