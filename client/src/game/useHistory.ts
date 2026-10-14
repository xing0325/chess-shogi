import { useEffect, useRef, useState } from "react";
import type { GameState } from "@cs/shared";

export interface HistoryNav {
  snaps: GameState[];
  view: number;
  atLatest: boolean;
  setView: (i: number) => void;
  first: () => void;
  prev: () => void;
  next: () => void;
  last: () => void;
}

/**
 * 累积每一手的局面快照,支持回放浏览。
 * @param live     当前权威局面(本地 apply 后 / 服务器下发)。每手都是新对象引用。
 * @param resetKey 一局的标识;变化即视为新对局,清空历史。
 * @param seed     新对局开始时的已有快照(断线重连时由棋谱重放得到),末项应与 live 同局面。
 */
export function useHistory(live: GameState, resetKey: string, seed?: GameState[]): HistoryNav {
  const initial = (): GameState[] => (seed && seed.length ? [...seed.slice(0, -1), live] : [live]);
  const [snaps, setSnaps] = useState<GameState[]>(initial);
  const [view, setView] = useState(() => initial().length - 1);
  const keyRef = useRef(resetKey);
  const followRef = useRef(true); // 是否跟随最新一手

  useEffect(() => {
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey;
      followRef.current = true;
      const s = initial();
      setSnaps(s);
      setView(s.length - 1);
      return;
    }
    setSnaps((prev) => (prev[prev.length - 1] === live ? prev : [...prev, live]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, resetKey]);

  // 跟随最新:新增快照且处于跟随态时跳到末尾
  useEffect(() => {
    if (followRef.current) setView(snaps.length - 1);
  }, [snaps.length]);

  const go = (i: number) => {
    const c = Math.max(0, Math.min(snaps.length - 1, i));
    followRef.current = c === snaps.length - 1;
    setView(c);
  };

  return {
    snaps,
    view,
    atLatest: view === snaps.length - 1,
    setView: go,
    first: () => go(0),
    prev: () => go(view - 1),
    next: () => go(view + 1),
    last: () => go(snaps.length - 1),
  };
}
