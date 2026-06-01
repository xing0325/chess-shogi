import { useState } from "react";
import type { LobbySnapshot, Side } from "@cs/shared";
import "./Lobby.css";

const sideLabel = (s: Side | "random") => (s === "chess" ? "国象" : s === "shogi" ? "将棋" : "随机");

export interface LobbyProps {
  myId: string;
  lobby: LobbySnapshot;
  onCreate: (side: Side | "random") => void;
  onJoin: (roomId: string) => void;
  onInvite: (playerId: string) => void;
}

export function Lobby({ myId, lobby, onCreate, onJoin, onInvite }: LobbyProps) {
  const [side, setSide] = useState<Side | "random">("random");
  const others = lobby.players.filter((p) => p.id !== myId);

  return (
    <div className="lobby">
      <section className="lobby__panel">
        <h2 className="lobby__h">开一局</h2>
        <div className="lobby__create">
          <span>我执:</span>
          {(["random", "chess", "shogi"] as const).map((s) => (
            <button
              key={s}
              className={`chip${side === s ? " chip--on" : ""}`}
              onClick={() => setSide(s)}
            >{sideLabel(s)}</button>
          ))}
          <button className="lobby__create-btn" onClick={() => onCreate(side)}>创建房间</button>
        </div>
      </section>

      <section className="lobby__panel">
        <h2 className="lobby__h">开放房间 <span className="lobby__count">{lobby.rooms.length}</span></h2>
        {lobby.rooms.length === 0 && <p className="lobby__empty">还没有等待中的房间,创建一个吧。</p>}
        <ul className="lobby__list">
          {lobby.rooms.map((r) => (
            <li key={r.id} className="lobby__row">
              <span className="lobby__name">{r.hostName}</span>
              <span className="lobby__meta">加入后你执 {sideLabel(r.openSide)}</span>
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
              <span className="lobby__name">{p.name}</span>
              <span className={`lobby__status lobby__status--${p.status}`}>
                {p.status === "playing" ? "对局中" : "空闲"}
              </span>
              <button className="lobby__act" disabled={p.status === "playing"} onClick={() => onInvite(p.id)}>邀请</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
