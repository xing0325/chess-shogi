import { useState } from "react";
import { tk } from "@cs/shared";
import { DraftView } from "./DraftView";

/** 本地同屏:双方轮流在同一台设备上 BP、布阵、对局(不计时) */
export function LocalDraft() {
  const [d, setD] = useState<tk.DraftState>(() => tk.newDraft());
  const [note, setNote] = useState("");
  const act = (a: tk.DraftAction) => {
    const who = tk.actor(d);
    if (!who) return;
    try { setD(tk.applyDraft(d, who, a)); setNote(""); }
    catch (e) { setNote(e instanceof Error ? e.message : "操作无效"); }
  };
  return (
    <DraftView
      draft={d}
      mySide={null}
      onAction={act}
      note={note}
      onReset={() => { if (d.phase === "draft" && d.step === 0 || window.confirm("重新开始一局?当前进度会丢失。")) setD(tk.newDraft()); }}
      onResign={d.phase === "play" ? () => { if (window.confirm(`${tk.teamOf(d.game.turn) === "blue" ? "蓝" : "红"}方认输?`)) setD(tk.resignDraft(d, d.game.turn)); } : undefined}
    />
  );
}
