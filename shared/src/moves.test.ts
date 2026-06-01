import { describe, it, expect } from "vitest";
import { pieceTargets } from "./moves";
import { idx, type Position, type Piece } from "./types";

function empty(): Position { return new Array(81).fill(null); }
function put(pos: Position, f: number, r: number, p: Piece): void { pos[idx(f, r)] = p; }
function n(pos: Position, f: number, r: number): number { return pieceTargets(pos, { file: f, rank: r }).length; }
function has(pos: Position, f: number, r: number, tf: number, tr: number): boolean {
  return pieceTargets(pos, { file: f, rank: r }).some((t) => t.file === tf && t.rank === tr);
}

describe("国象走法", () => {
  it("车在空盘中心 16 个落点,遇子停", () => {
    const pos = empty(); put(pos, 4, 4, { side: "chess", kind: "R" });
    expect(n(pos, 4, 4)).toBe(16);
    put(pos, 4, 6, { side: "chess", kind: "P" }); // 己方子挡路
    expect(has(pos, 4, 4, 4, 6)).toBe(false);
    expect(has(pos, 4, 4, 4, 5)).toBe(true);
    expect(has(pos, 4, 4, 4, 7)).toBe(false);
  });
  it("象 16,马 8", () => {
    const pos = empty(); put(pos, 4, 4, { side: "chess", kind: "B" });
    expect(n(pos, 4, 4)).toBe(16);
    const pos2 = empty(); put(pos2, 4, 4, { side: "chess", kind: "N" });
    expect(n(pos2, 4, 4)).toBe(8);
  });
  it("兵:正前 + 起步两格,斜前吃子", () => {
    const pos = empty(); put(pos, 4, 7, { side: "chess", kind: "P" }); // 国象前进 = -rank
    expect(has(pos, 4, 7, 4, 6)).toBe(true);
    expect(has(pos, 4, 7, 4, 5)).toBe(true); // 起步两格
    put(pos, 3, 6, { side: "shogi", kind: "FU" });
    expect(has(pos, 4, 7, 3, 6)).toBe(true); // 斜前吃
    expect(has(pos, 4, 7, 5, 6)).toBe(false); // 无子不能斜走
  });
});

describe("将棋走法", () => {
  it("歩正前 1、銀 5、金 6、桂 2", () => {
    const fu = empty(); put(fu, 4, 4, { side: "shogi", kind: "FU" });
    expect(n(fu, 4, 4)).toBe(1); expect(has(fu, 4, 4, 4, 5)).toBe(true);
    const gin = empty(); put(gin, 4, 4, { side: "shogi", kind: "GIN" });
    expect(n(gin, 4, 4)).toBe(5);
    const kin = empty(); put(kin, 4, 4, { side: "shogi", kind: "KIN" });
    expect(n(kin, 4, 4)).toBe(6);
    const kei = empty(); put(kei, 4, 4, { side: "shogi", kind: "KEI" });
    expect(n(kei, 4, 4)).toBe(2);
    expect(has(kei, 4, 4, 3, 6)).toBe(true);
    expect(has(kei, 4, 4, 5, 6)).toBe(true);
  });
  it("香正前滑行、飛 16、角 16、玉 8", () => {
    const kyo = empty(); put(kyo, 4, 2, { side: "shogi", kind: "KYO" });
    expect(n(kyo, 4, 2)).toBe(6); // (4,3)..(4,8)
    const hi = empty(); put(hi, 4, 4, { side: "shogi", kind: "HI" });
    expect(n(hi, 4, 4)).toBe(16);
    const ka = empty(); put(ka, 4, 4, { side: "shogi", kind: "KAKU" });
    expect(n(ka, 4, 4)).toBe(16);
    const ou = empty(); put(ou, 4, 4, { side: "shogi", kind: "OU" });
    expect(n(ou, 4, 4)).toBe(8);
  });
  it("升变小子走金;龍 = 飛+四斜;馬 = 角+四正", () => {
    const tokin = empty(); put(tokin, 4, 4, { side: "shogi", kind: "FU", promoted: true });
    expect(n(tokin, 4, 4)).toBe(6);
    const ryu = empty(); put(ryu, 4, 4, { side: "shogi", kind: "HI", promoted: true });
    expect(n(ryu, 4, 4)).toBe(20); // 16 + 4
    const uma = empty(); put(uma, 4, 4, { side: "shogi", kind: "KAKU", promoted: true });
    expect(n(uma, 4, 4)).toBe(20);
  });
});
