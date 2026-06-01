import { useState } from "react";
import { LocalGame } from "./game/LocalGame";
import { OnlineApp } from "./online/OnlineApp";
import "./App.css";

type Screen = { k: "home" } | { k: "local" } | { k: "online"; name: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ k: "home" });
  const [name, setName] = useState("");
  const enterOnline = () => { if (name.trim()) setScreen({ k: "online", name: name.trim() }); };

  return (
    <main className="app">
      <header className="app__header">
        {screen.k !== "home" && (
          <button className="app__back" onClick={() => setScreen({ k: "home" })}>← 返回</button>
        )}
        <h1 className="app__title">国象 <span className="app__x">×</span> 将棋</h1>
        <p className="app__subtitle">9×9 融合对战 · 楚河汉界</p>
      </header>

      {screen.k === "home" && (
        <div className="home">
          <button className="home__card" onClick={() => setScreen({ k: "local" })}>
            <span className="home__accent home__accent--wood" />
            <span className="home__t">本地对战</span>
            <span className="home__d">同一台设备,两人轮流走子</span>
          </button>

          <div className="home__card home__card--online">
            <span className="home__accent home__accent--board" />
            <span className="home__t">联机大厅</span>
            <span className="home__d">看在线玩家 · 开房 · 互相邀请</span>
            <div className="home__form">
              <input
                className="home__input"
                placeholder="输入昵称"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") enterOnline(); }}
              />
              <button className="home__go" disabled={!name.trim()} onClick={enterOnline}>进入大厅</button>
            </div>
          </div>
        </div>
      )}

      {screen.k === "local" && <LocalGame />}
      {screen.k === "online" && <OnlineApp name={screen.name} />}
    </main>
  );
}
