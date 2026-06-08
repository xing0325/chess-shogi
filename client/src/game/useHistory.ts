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
 */
export function useHistory(live: GameState, resetKey: string): HistoryNav {
  const [snaps, setSnaps] = useState<GameState[]>([live]);
  const [view, setView] = useState(0);
  const keyRef = useRef(resetKey);
  const followRef = useRef(true); // 是否跟随最新一手

  useEffect(() => {
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey;
      followRef.current = true;
      setSnaps([live]);
      setView(0);
      return;
    }
    setSnaps((prev) => (prev[prev.length - 1] === live ? prev : [...prev, live]));
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
