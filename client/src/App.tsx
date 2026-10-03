import { useState } from "react";
import { LocalGame } from "./game/LocalGame";
import { OnlineApp } from "./online/OnlineApp";
import { SkinSettings } from "./skins/SkinSettings";
import "./App.css";

const staticDemo = import.meta.env.VITE_STATIC_DEMO === "true";

type Screen = "home" | "local" | "online";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [skinsOpen, setSkinsOpen] = useState(false);

  return (
    <main className="app">
      <header className="app__header">
        {screen !== "home" && (
          <button className="app__back" onClick={() => setScreen("home")}>← 返回</button>
        )}
        <button className="app__skins" onClick={() => setSkinsOpen(true)}>外观</button>
        <h1 className="app__title">国象 <span className="app__x">×</span> 将棋</h1>
        <p className="app__subtitle">9×9 融合对战 · 楚河汉界</p>
      </header>
      {skinsOpen && <SkinSettings onClose={() => setSkinsOpen(false)} />}

      {screen === "home" && (
        <div className="home">
          <button className="home__card" onClick={() => setScreen("local")}>
            <span className="home__accent home__accent--wood" />
            <span className="home__t">本地对战</span>
            <span className="home__d">同一台设备,两人轮流走子</span>
          </button>
          {!staticDemo && <button className="home__card" onClick={() => setScreen("online")}>
            <span className="home__accent home__accent--board" />
            <span className="home__t">联机大厅</span>
            <span className="home__d">注册/游客登录 · 开房 · 邀请在线玩家</span>
          </button>}
          {staticDemo && <p>公开试玩支持同屏双人对战。联机大厅需另行部署服务端。</p>}
        </div>
      )}

      {screen === "local" && <LocalGame />}
      {screen === "online" && <OnlineApp />}
    </main>
  );
}
