# Plan 1 — 地基:脚手架 + 棋盘渲染 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭好 monorepo 脚手架,并渲染一个静态但美观的 9×9 融合棋盘(木纹半盘 + 黑白格半盘 + 楚河汉界渡口),双方棋子摆在起始位置,在 Vite dev server 上可见。

**Architecture:** npm workspaces monorepo(`client` / `shared`,`server` 留到 Plan 3)。`shared/` 放纯 TS 的类型与初始局面生成器(可独立单测,前后端共用)。`client/` 用 Vite + React + TS,棋盘用 CSS Grid 渲染,经 `@cs/shared` 路径别名引用 shared。本计划不含走子交互(Plan 2)。

**Tech Stack:** Node 20+, npm workspaces, Vite, React 18, TypeScript, Vitest(单测)。

---

## File Structure

```
chess-shogi/
  package.json                      # 根:workspaces=[client, shared]
  shared/
    package.json                    # name: @cs/shared
    tsconfig.json
    src/
      types.ts                      # Side / PieceKind / Piece / Square / Position 类型
      types.test.ts
      initialPosition.ts            # 生成 9×9 起始局面(纯函数)
      initialPosition.test.ts
  client/
    package.json
    vite.config.ts                  # 含 @cs/shared 别名 + vitest 配置
    tsconfig.json
    index.html
    public/pieces/chess/*.svg        # 免费国象棋子素材(cburnett, GPL)
    src/
      main.tsx
      App.tsx
      board/
        boardTheme.ts               # 半盘/河界配色与几何常量
        Board.tsx                   # 9×9 grid + 半盘风格 + 河界渡口
        Board.css
        Square.tsx                  # 单格(底色由 theme 决定)
        Piece.tsx                   # 单个棋子渲染(国象 SVG / 将棋汉字五边形)
        Piece.css
```

---

## Task 1: Monorepo 脚手架 + dev server 跑起来

**Files:**
- Create: `chess-shogi/package.json`
- Create: `chess-shogi/.gitignore`
- Create (via scaffold): `chess-shogi/client/*`(Vite react-ts 模板)

- [ ] **Step 1: 写根 package.json(声明 workspaces)**

`chess-shogi/package.json`:
```json
{
  "name": "chess-shogi",
  "private": true,
  "version": "0.0.0",
  "workspaces": ["shared", "client"],
  "scripts": {
    "dev": "npm run dev --workspace client",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: 写 .gitignore**

`chess-shogi/.gitignore`:
```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 3: 用 Vite 脚手架生成 client**

Run(在 `chess-shogi/` 下):
```
npm create vite@latest client -- --template react-ts
```
Expected: 生成 `client/` 目录,含 `package.json` / `index.html` / `src/main.tsx` / `src/App.tsx`。

- [ ] **Step 4: 安装依赖 + 加 Vitest**

Run(在 `chess-shogi/` 下):
```
npm install
npm install -D --workspace client vitest jsdom @testing-library/react @testing-library/jest-dom
```
Expected: 根 `node_modules` 安装成功,无报错。

- [ ] **Step 5: 启动 dev server 验证**

Run: `npm run dev`
Expected: Vite 打印 `Local: http://localhost:5173/`,浏览器打开是 Vite 默认页。
（验证用 preview_start / 截图确认能访问;确认后停掉。）

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "chore: scaffold monorepo + vite client"
```

---

## Task 2: shared 类型定义(TDD)

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Test: `shared/src/types.test.ts`

- [ ] **Step 1: 写 shared/package.json 与 tsconfig**

`shared/package.json`:
```json
{
  "name": "@cs/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "vitest run" },
  "devDependencies": { "vitest": "^1.0.0" }
}
```
`shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true, "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: 写失败测试**

`shared/src/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { otherSide, type Side } from "./types";

describe("Side", () => {
  it("chess 的对手是 shogi", () => {
    const s: Side = "chess";
    expect(otherSide(s)).toBe("shogi");
  });
  it("shogi 的对手是 chess", () => {
    expect(otherSide("shogi")).toBe("chess");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test --workspace shared`
Expected: FAIL —— `otherSide` is not defined / 模块不存在。

- [ ] **Step 4: 写类型与最小实现**

`shared/src/types.ts`:
```ts
// 执棋方:国象 / 将棋
export type Side = "chess" | "shogi";

// 棋子类别。国象用英文,将棋用罗马字。
export type ChessKind = "K" | "Q" | "R" | "B" | "N" | "P"; // 王后车象马兵
export type ShogiKind =
  | "OU" | "HI" | "KAKU" | "KIN" | "GIN" | "KEI" | "KYO" | "FU"; // 玉飛角金銀桂香歩
export type PieceKind = ChessKind | ShogiKind;

export interface Piece {
  side: Side;          // 属于哪一方
  kind: PieceKind;     // 棋子类别
  promoted?: boolean;  // 将棋升变 / 国象升变后(兵升变记为新 kind)
  fromChess?: boolean; // true=被将棋方吃来、以五边形造型存在的国象子(Plan 2+ 用)
}

// 棋盘坐标:file 0..8 (a..i), rank 0..8 (行1..行9)。rank 0 = 行1(将棋底线)。
export interface Square { file: number; rank: number; }

export const BOARD_SIZE = 9;
export const RIVER_RANK = 4; // 第5行 = index 4 = 楚河汉界

// 局面:81 格,每格 Piece 或 null。索引 = rank * 9 + file。
export type Position = (Piece | null)[];

export function otherSide(s: Side): Side {
  return s === "chess" ? "shogi" : "chess";
}

export function idx(file: number, rank: number): number {
  return rank * BOARD_SIZE + file;
}
```
并建 `shared/src/index.ts`:
```ts
export * from "./types";
export * from "./initialPosition";
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test --workspace shared`
Expected: PASS(2 passed)。注意:`index.ts` 此时引用了尚不存在的 `initialPosition` —— 若报错,先把 index.ts 里那行注释掉,Task 3 再放开。

- [ ] **Step 6: Commit**

```
git add shared
git commit -m "feat(shared): core types + Side helpers"
```

---

## Task 3: 起始局面生成器(TDD)

**Files:**
- Create: `shared/src/initialPosition.ts`
- Test: `shared/src/initialPosition.test.ts`

布局(rank index 0=行1 将棋底线 … 8=行9 国象底线):
- rank 8(行9)国象后排:`R N B K Q K B N R`(file 0..8)→ Queen 在 file 4,两 King 在 file 3 / 5。
- rank 7(行8)国象兵:9 个 `P`。
- rank 2(行3)将棋兵:9 个 `FU`。
- rank 1(行2)将棋:file 1 = `HI`(飛),file 7 = `KAKU`(角)。
- rank 0(行1)将棋后排:`KYO KEI GIN KIN OU KIN GIN KEI KYO`。
- 其余(含 rank 4 河界)全空。

- [ ] **Step 1: 写失败测试**

`shared/src/initialPosition.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createInitialPosition } from "./initialPosition";
import { idx, BOARD_SIZE } from "./types";

describe("createInitialPosition", () => {
  const pos = createInitialPosition();

  it("共 81 格", () => {
    expect(pos.length).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it("国象后排:后居中(file4),两王在 file3/5", () => {
    expect(pos[idx(4, 8)]).toEqual({ side: "chess", kind: "Q" });
    expect(pos[idx(3, 8)]).toEqual({ side: "chess", kind: "K" });
    expect(pos[idx(5, 8)]).toEqual({ side: "chess", kind: "K" });
  });

  it("国象 9 个兵在行8(rank7)", () => {
    for (let f = 0; f < 9; f++)
      expect(pos[idx(f, 7)]).toEqual({ side: "chess", kind: "P" });
  });

  it("将棋玉在行1正中(file4),9 个歩在行3", () => {
    expect(pos[idx(4, 0)]).toEqual({ side: "shogi", kind: "OU" });
    for (let f = 0; f < 9; f++)
      expect(pos[idx(f, 2)]).toEqual({ side: "shogi", kind: "FU" });
  });

  it("飛在行2 file1,角在行2 file7", () => {
    expect(pos[idx(1, 1)]).toEqual({ side: "shogi", kind: "HI" });
    expect(pos[idx(7, 1)]).toEqual({ side: "shogi", kind: "KAKU" });
  });

  it("河界整行(rank4)为空", () => {
    for (let f = 0; f < 9; f++) expect(pos[idx(f, 4)]).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test --workspace shared`
Expected: FAIL —— `createInitialPosition` 未定义。

- [ ] **Step 3: 写实现**

`shared/src/initialPosition.ts`:
```ts
import { BOARD_SIZE, idx, type Piece, type Position, type ChessKind, type ShogiKind } from "./types";

export function createInitialPosition(): Position {
  const pos: Position = new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  const C = (kind: ChessKind): Piece => ({ side: "chess", kind });
  const S = (kind: ShogiKind): Piece => ({ side: "shogi", kind });

  // 国象后排(行9 = rank8):车马象 王 后 王 象马车
  const chessBack: ChessKind[] = ["R", "N", "B", "K", "Q", "K", "B", "N", "R"];
  chessBack.forEach((k, f) => { pos[idx(f, 8)] = C(k); });
  // 国象兵(行8 = rank7)
  for (let f = 0; f < 9; f++) pos[idx(f, 7)] = C("P");

  // 将棋后排(行1 = rank0):香桂銀 金 玉 金 銀桂香
  const shogiBack: ShogiKind[] = ["KYO", "KEI", "GIN", "KIN", "OU", "KIN", "GIN", "KEI", "KYO"];
  shogiBack.forEach((k, f) => { pos[idx(f, 0)] = S(k); });
  // 飛/角(行2 = rank1)
  pos[idx(1, 1)] = S("HI");
  pos[idx(7, 1)] = S("KAKU");
  // 将棋歩(行3 = rank2)
  for (let f = 0; f < 9; f++) pos[idx(f, 2)] = S("FU");

  return pos;
}
```
确保 `shared/src/index.ts` 已放开 `export * from "./initialPosition";`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test --workspace shared`
Expected: PASS(全部 it 通过)。

- [ ] **Step 5: Commit**

```
git add shared
git commit -m "feat(shared): 9x9 initial position generator + tests"
```

---

## Task 4: client 接入 @cs/shared 别名 + 主题常量

**Files:**
- Modify: `client/vite.config.ts`
- Modify: `client/tsconfig.json`(加 paths)
- Create: `client/src/board/boardTheme.ts`
- Test: `client/src/board/boardTheme.test.ts`

- [ ] **Step 1: 配置别名(vite + ts)**

`client/vite.config.ts`(替换为):
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@cs/shared": path.resolve(__dirname, "../shared/src/index.ts") } },
  test: { environment: "jsdom", globals: true },
});
```
在 `client/tsconfig.json` 的 `compilerOptions` 加:
```json
"baseUrl": ".",
"paths": { "@cs/shared": ["../shared/src/index.ts"] }
```

- [ ] **Step 2: 写主题失败测试**

`client/src/board/boardTheme.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { squareStyleKind } from "./boardTheme";

describe("squareStyleKind", () => {
  it("行5(rank4)是河界", () => {
    expect(squareStyleKind(3, 4)).toBe("river");
  });
  it("将棋半盘(rank<4)是木纹", () => {
    expect(squareStyleKind(0, 0)).toBe("wood");
  });
  it("国象半盘(rank>4)是黑白格", () => {
    const k = squareStyleKind(0, 8);
    expect(k === "light" || k === "dark").toBe(true);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npm run test --workspace client`
Expected: FAIL —— `squareStyleKind` 未定义。

- [ ] **Step 4: 写实现**

`client/src/board/boardTheme.ts`:
```ts
import { RIVER_RANK } from "@cs/shared";

export type SquareStyleKind = "wood" | "light" | "dark" | "river";

// 决定单格底色类型:河界整行 river;将棋侧木纹;国象侧黑白相间。
export function squareStyleKind(file: number, rank: number): SquareStyleKind {
  if (rank === RIVER_RANK) return "river";
  if (rank < RIVER_RANK) return "wood";
  return (file + rank) % 2 === 0 ? "dark" : "light";
}

// 配色(后续 Plan 4 做成可换皮肤)
export const THEME = {
  woodLight: "#e8c79a",
  woodDark: "#caa06a",
  woodLine: "#7a5a32",
  chessLight: "#f0d9b5",
  chessDark: "#b58863",
  river: "#cfe8f0",
  riverWater: "#9fd0e0",
};
```

- [ ] **Step 5: 运行确认通过**

Run: `npm run test --workspace client`
Expected: PASS。

- [ ] **Step 6: Commit**

```
git add client
git commit -m "feat(client): @cs/shared alias + board theme"
```

---

## Task 5: 棋盘 + 格子渲染(9×9 / 半盘 / 河界渡口)

**Files:**
- Create: `client/src/board/Square.tsx`
- Create: `client/src/board/Board.tsx`
- Create: `client/src/board/Board.css`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: 写 Square 组件**

`client/src/board/Square.tsx`:
```tsx
import { squareStyleKind, THEME } from "./boardTheme";
import type { ReactNode } from "react";

export function Square({ file, rank, children }: { file: number; rank: number; children?: ReactNode }) {
  const kind = squareStyleKind(file, rank);
  const bg = {
    wood: (file + rank) % 2 === 0 ? THEME.woodDark : THEME.woodLight,
    light: THEME.chessLight,
    dark: THEME.chessDark,
    river: THEME.river,
  }[kind];
  return (
    <div className={`sq sq--${kind}`} style={{ background: bg }}>
      {kind === "river" && <div className="sq__water" aria-hidden />}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 写 Board 组件**

`client/src/board/Board.tsx`:
```tsx
import { useMemo } from "react";
import { createInitialPosition, BOARD_SIZE, idx } from "@cs/shared";
import { Square } from "./Square";
import { Piece } from "./Piece";
import "./Board.css";

export function Board() {
  const position = useMemo(() => createInitialPosition(), []);
  const rows = [];
  // rank 8(行9)在最上面显示 → 从高 rank 往低 rank 渲染
  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    for (let file = 0; file < BOARD_SIZE; file++) {
      const piece = position[idx(file, rank)];
      rows.push(
        <Square key={`${file}-${rank}`} file={file} rank={rank}>
          {piece && <Piece piece={piece} />}
        </Square>
      );
    }
  }
  return (
    <div className="board-wrap">
      <div className="board">{rows}</div>
      <div className="river-label">楚 河　　　　　汉 界</div>
    </div>
  );
}
```

- [ ] **Step 3: 写 Board.css(grid + 河界渡口 + 水流动画)**

`client/src/board/Board.css`:
```css
.board-wrap { position: relative; width: min(90vmin, 720px); margin: 24px auto; }
.board {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-template-rows: repeat(9, 1fr);
  aspect-ratio: 1 / 1;
  border: 10px solid #5a3d22;
  border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
  overflow: hidden;
}
.sq { position: relative; display: flex; align-items: center; justify-content: center; }
.sq--river { overflow: hidden; }
/* 渡口流水:横向移动的水纹,暗示"可踏过" */
.sq__water {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(90deg,
    rgba(255,255,255,.0) 0 12px, rgba(255,255,255,.35) 12px 16px);
  animation: flow 3s linear infinite;
  opacity: .6;
}
@keyframes flow { from { transform: translateX(0); } to { transform: translateX(16px); } }
/* 渡口踏脚石:每个河界格中央一块半透明石板,明确"能落子" */
.sq--river::after {
  content: ""; position: absolute; width: 62%; height: 62%;
  border-radius: 8px; background: rgba(120,90,60,.55);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.25);
}
.river-label {
  position: absolute; left: 0; right: 0;
  top: calc(10px + (100% - 20px) * 4 / 9); height: calc((100% - 20px) / 9);
  display: flex; align-items: center; justify-content: center;
  font-size: clamp(14px, 3.2vmin, 28px); letter-spacing: .5em;
  color: #2b4a55; font-weight: 700; pointer-events: none; text-shadow: 0 1px 0 rgba(255,255,255,.4);
}
```

- [ ] **Step 4: 接进 App**

`client/src/App.tsx`(替换内容):
```tsx
import { Board } from "./board/Board";

export default function App() {
  return (
    <main style={{ minHeight: "100vh", background: "#2a2320", display: "grid", placeItems: "center" }}>
      <Board />
    </main>
  );
}
```

- [ ] **Step 5: dev server 验证棋盘**

Run: `npm run dev`(若未运行)→ 用 preview reload。
Expected: 看到 9×9 棋盘,下半木纹、上半黑白格、第5行有流水+踏脚石+"楚河汉界"字样。棋子此时可能还没图(Task 6)——格子和河界先对。
（preview_screenshot 确认布局。）

- [ ] **Step 6: Commit**

```
git add client
git commit -m "feat(client): 9x9 board with split themes + river crossing"
```

---

## Task 6: 棋子渲染(国象 SVG 素材 + 将棋汉字五边形)

**Files:**
- Create: `client/public/pieces/chess/{wK,wQ,wR,wB,wN,wP}.svg`(免费素材)
- Create: `client/src/board/Piece.tsx`
- Create: `client/src/board/Piece.css`

说明:国象用免费 **cburnett**(GPL)SVG 棋子集(单色即可,因为只有国象一方)。将棋子按真实形态渲染——**汉字刻在五边形木牌上**(这是将棋的真实样子,非占位符);玉/飛/角/金/銀/桂/香/歩 对应汉字 玉飛角金銀桂香歩。

- [ ] **Step 1: 取国象 SVG 素材**

下载 cburnett 集的 6 个白方棋子到 `client/public/pieces/chess/`:
Run:
```
mkdir -p client/public/pieces/chess
for p in wK wQ wR wB wN wP; do \
  curl -L -o client/public/pieces/chess/$p.svg \
  https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/$p.svg; done
```
Expected: 6 个 svg 文件,每个非空(>1KB)。若网络受限,记录为待办并先用占位灰圆,后续补素材。

- [ ] **Step 2: 写汉字映射 + Piece 组件**

`client/src/board/Piece.tsx`:
```tsx
import type { Piece as PieceT } from "@cs/shared";
import "./Piece.css";

const CHESS_SVG: Record<string, string> = {
  K: "/pieces/chess/wK.svg", Q: "/pieces/chess/wQ.svg", R: "/pieces/chess/wR.svg",
  B: "/pieces/chess/wB.svg", N: "/pieces/chess/wN.svg", P: "/pieces/chess/wP.svg",
};
const SHOGI_KANJI: Record<string, string> = {
  OU: "玉", HI: "飛", KAKU: "角", KIN: "金", GIN: "銀", KEI: "桂", KYO: "香", FU: "歩",
};

export function Piece({ piece }: { piece: PieceT }) {
  if (piece.side === "chess") {
    const src = CHESS_SVG[piece.kind as string];
    return <img className="piece piece--chess" src={src} alt={piece.kind} draggable={false} />;
  }
  // 将棋:五边形木牌 + 汉字。将棋方在下方,棋子尖朝上(朝对手)。
  return (
    <div className="piece piece--shogi">
      <span className="koma">{SHOGI_KANJI[piece.kind as string]}</span>
    </div>
  );
}
```

- [ ] **Step 3: 写 Piece.css(五边形木牌)**

`client/src/board/Piece.css`:
```css
.piece { width: 84%; height: 84%; user-select: none; }
.piece--chess { object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.4)); }
/* 将棋五边形木牌 */
.piece--shogi {
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(#f4dca8, #e3bd79);
  clip-path: polygon(50% 0%, 88% 22%, 88% 100%, 12% 100%, 12% 22%);
  box-shadow: 0 2px 3px rgba(0,0,0,.35); border: 1px solid #b98c4a;
}
.koma {
  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-weight: 700; font-size: clamp(12px, 4.2vmin, 34px); color: #3a2410;
  margin-top: 6%;
}
```

- [ ] **Step 4: dev server 验证整盘**

Run: dev server reload。
Expected: 国象方(上半)是车马象/王后王/象马车 + 9 兵的 SVG 图;将棋方(下半)是汉字五边形木牌;河界在中间。
（preview_screenshot 出整盘图给用户。）

- [ ] **Step 5: Commit**

```
git add client
git commit -m "feat(client): render chess (svg) + shogi (kanji pentagon) pieces at start"
```

---

## Self-Review

**1. Spec coverage(本计划只覆盖 spec §2 架构地基 + §3 布局 + §9 美术的静态部分):**
- §2 架构(monorepo / shared / client / 别名)→ Task 1,2,4 ✅
- §3 9×9 布局与初始摆子 → Task 3(生成器+测试)、Task 5/6(渲染)✅
- §6 楚河汉界渲染(渡口/流水/可读"能走")→ Task 5 ✅
- §9 美术(木纹/黑白格/棋子素材)→ Task 5,6 ✅(皮肤切换在 Plan 4)
- 走子/规则/双King/打入/升变 → 不在本计划(Plan 2)✅
- 大厅/联网 → 不在本计划(Plan 3)✅

**2. Placeholder scan:** 无 TBD。唯一外部依赖是 Task 6 Step 1 的素材下载,已给出降级方案(取不到则灰圆占位 + 记待办)。

**3. Type consistency:** `idx/BOARD_SIZE/RIVER_RANK/Side/Piece/Position/createInitialPosition` 在 Task 2/3 定义,Task 4/5/6 引用一致;`squareStyleKind` 签名 `(file, rank)` 全程一致。

完。
