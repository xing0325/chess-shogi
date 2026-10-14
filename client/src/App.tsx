import { useState } from "react";
import { LocalGame } from "./game/LocalGame";
import { OnlineApp } from "./online/OnlineApp";
import { LocalDraft } from "./draft/LocalDraft";
import { SkinSettings } from "./skins/SkinSettings";
import "./App.css";

const staticDemo = import.meta.env.VITE_STATIC_DEMO === "true";

type Screen = "home" | "local" | "online" | "draft";

export default function App() {
  const [screen, setScreenRaw] = useState<Screen>(() => {
    try { const s = sessionStorage.getItem("cs_screen"); return s === "local" || (s === "online" && !staticDemo) || s === "draft" ? s : "home"; } catch { return "home"; }
  });
  const setScreen = (s: Screen) => { setScreenRaw(s); try { sessionStorage.setItem("cs_screen", s); } catch { /* ignore */ } };
  const [skinsOpen, setSkinsOpen] = useState(false);
  const [onlineDraft, setOnlineDraft] = useState(false);
  const draftTitle = screen === "draft" || (screen === "online" && onlineDraft);

  return (
    <main className="app">
      <header className="app__header">
        {screen !== "home" && (
          <button className="app__back" onClick={() => setScreen("home")}>← 返回</button>
        )}
        <button className="app__skins" onClick={() => setSkinsOpen(true)}>外观</button>
        {draftTitle ? (
          <>
            <h1 className="app__title">大局<span className="app__x">·</span>选将</h1>
            <p className="app__subtitle">205 种大局将棋棋子 · BP 选将 · 5×5 决战</p>
          </>
        ) : (
          <>
            <h1 className="app__title">国象 <span className="app__x">×</span> 将棋</h1>
            <p className="app__subtitle">9×9 融合对战 · 楚河汉界</p>
          </>
        )}
      </header>
      {skinsOpen && <SkinSettings onClose={() => setSkinsOpen(false)} />}

      {screen === "home" && (
        <div className="home">
          <button className="home__card" onClick={() => setScreen("local")}>
            <span className="home__accent home__accent--wood" />
            <span className="home__t">本地对战</span>
            <span className="home__d">同一台设备,两人轮流走子</span>
          </button>
          <button className="home__card" onClick={() => setScreen("draft")}>
            <span className="home__accent home__accent--draft" />
            <span className="home__t">大局选将 <small className="home__new">新</small></span>
            <span className="home__d">从大局将棋 205 种棋子中随机抽 24 种,像 MOBA 一样禁用 / 选择,再在 5×5 棋盘上决战(同屏)</span>
          </button>
          {!staticDemo && <button className="home__card" onClick={() => setScreen("online")}>
            <span className="home__accent home__accent--board" />
            <span className="home__t">联机大厅</span>
            <span className="home__d">注册/游客登录 · 开房 · 邀请在线玩家</span>
          </button>}
          {staticDemo && <p>公开试玩版:本地对战和大局选将都是同屏双人。联机大厅需要另行部署服务端。</p>}
        </div>
      )}

      {screen === "local" && <LocalGame />}
      {screen === "online" && <OnlineApp onDraftChange={setOnlineDraft} />}
      {screen === "draft" && <LocalDraft />}
    </main>
  );
}
