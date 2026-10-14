import { useState } from "react";
import type { LobbySnapshot, Side, GameMode } from "@cs/shared";
import { Avatar } from "../profile/Avatar";
import "./Lobby.css";

const sideLabel = (s: Side | "random", mode: GameMode = "fusion") =>
  mode === "draft"
    ? (s === "chess" ? "蓝方(先手)" : s === "shogi" ? "红方(后手)" : "随机")
    : (s === "chess" ? "国象" : s === "shogi" ? "将棋" : "随机");
const MODE_LABEL: Record<GameMode, string> = { fusion: "国象×将棋", draft: "大局选将" };

export interface LobbyProps {
  myId: string;
  lobby: LobbySnapshot;
  onCreate: (side: Side | "random", mode: GameMode) => void;
  onJoin: (roomId: string) => void;
  onInvite: (playerId: string, mode: GameMode) => void;
}

export function Lobby({ myId, lobby, onCreate, onJoin, onInvite }: LobbyProps) {
  const [side, setSide] = useState<Side | "random">("random");
  const [mode, setMode] = useState<GameMode>("fusion");
  const others = lobby.players.filter((p) => p.id !== myId);

  return (
    <div className="lobby">
      <section className="lobby__panel">
        <h2 className="lobby__h">开一局</h2>
        <div className="lobby__create">
          <span>模式:</span>
          {(["fusion", "draft"] as const).map((m) => (
            <button key={m} className={`chip${mode === m ? " chip--on" : ""}`} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        <div className="lobby__create">
          <span>我执:</span>
          {(["random", "chess", "shogi"] as const).map((s) => (
            <button
              key={s}
              className={`chip${side === s ? " chip--on" : ""}`}
              onClick={() => setSide(s)}
            >{sideLabel(s, mode)}</button>
          ))}
          <button className="lobby__create-btn" onClick={() => onCreate(side, mode)}>创建房间</button>
        </div>
      </section>

      <section className="lobby__panel">
        <h2 className="lobby__h">开放房间 <span className="lobby__count">{lobby.rooms.length}</span></h2>
        {lobby.rooms.length === 0 && <p className="lobby__empty">还没有等待中的房间,创建一个吧。</p>}
        <ul className="lobby__list">
          {lobby.rooms.map((r) => (
            <li key={r.id} className="lobby__row">
              <Avatar id={r.hostAvatar} size={34} />
              <span className="lobby__name">{r.hostName}</span>
              <span className={`lobby__mode lobby__mode--${r.mode}`}>{MODE_LABEL[r.mode ?? "fusion"]}</span>
              <span className="lobby__meta">加入后你执 {sideLabel(r.openSide, r.mode)}</span>
              <button className="lobby__act" onClick={() => onJoin(r.id)}>加入</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="lobby__panel">
        <h2 className="lobby__h">在线玩家 <span className="lobby__count">{others.length}</span></h2>
        {others.length === 0 && <p className="lobby__empty">暂时只有你在线。</p>}
        <ul className="lobby__list">
          {others.map((p) => (
            <li key={p.id} className="lobby__row">
              <Avatar id={p.avatar} size={34} />
              <span className="lobby__name">{p.name}</span>
              <span className={`lobby__status lobby__status--${p.status}`}>
                {p.status === "playing" ? "对局中" : "空闲"}
              </span>
              <button className="lobby__act" disabled={p.status === "playing"} onClick={() => onInvite(p.id, mode)} title={`邀请对方下「${MODE_LABEL[mode]}」`}>邀请</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
