import { Board } from "./board/Board";
import "./App.css";

export default function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">国象 <span className="app__x">×</span> 将棋</h1>
        <p className="app__subtitle">9×9 融合对战 · 楚河汉界</p>
      </header>
      <Board />
      <footer className="app__footer">
        <span className="tag tag--chess">国象方</span>
        <span className="tag tag--shogi">将棋方</span>
      </footer>
    </main>
  );
}
