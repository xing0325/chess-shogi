import { useState } from "react";
import { LocalGame } from "./game/LocalGame";
import { OnlineApp } from "./online/OnlineApp";
import "./App.css";

type Screen = "home" | "local" | "online";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <main className="app">
      <header className="app__header">
        {screen !== "home" && (
          <button className="app__back" onClick={() => setScreen("home")}>← 返回</button>
        )}
        <h1 className="app__title">国象 <span className="app__x">×</span> 将棋</h1>
        <p className="app__subtitle">9×9 融合对战 · 楚河汉界</p>
      </header>

      {screen === "home" && (
        <div className="home">
          <button className="home__card" onClick={() => setScreen("local")}>
            <span className="home__accent home__accent--wood" />
            <span className="home__t">本地对战</span>
            <span className="home__d">同一台设备,两人轮流走子</span>
          </button>
          <button className="home__card" onClick={() => setScreen("online")}>
            <span className="home__accent home__accent--board" />
            <span className="home__t">联机大厅</span>
            <span className="home__d">注册/游客登录 · 开房 · 邀请在线玩家</span>
          </button>
        </div>
      )}

      {screen === "local" && <LocalGame />}
      {screen === "online" && <OnlineApp />}
    </main>
  );
}
