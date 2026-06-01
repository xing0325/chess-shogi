import { GameView } from "./game/GameView";
import "./App.css";

export default function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">国象 <span className="app__x">×</span> 将棋</h1>
        <p className="app__subtitle">9×9 融合对战 · 楚河汉界</p>
      </header>
      <GameView />
    </main>
  );
}
