import { describe, it, expect } from "vitest";
import {
  createInitialState, kingCount, inCheck, legalActions, applyAction,
  legalDropDestinations, promotionOptions, status, findMove,
  type GameState, type HandGroup,
} from "./game";
import { idx, type Position, type Piece } from "./types";

function empty(): Position { return new Array(81).fill(null); }
function put(pos: Position, f: number, r: number, p: Piece): void { pos[idx(f, r)] = p; }
function st(pos: Position, turn: GameState["turn"], shogiHand: HandGroup[] = []): GameState {
  return { position: pos, turn, hands: { chess: [], shogi: shogiHand } };
}
function hasMoveTo(state: GameState, ff: number, fr: number, tf: number, tr: number): boolean {
  return legalActions(state).some((a) => a.type === "move" && a.from.file === ff && a.from.rank === fr && a.to.file === tf && a.to.rank === tr);
}

describe("初始局面", () => {
  it("国象先手,国象 2 王、将棋 1 王", () => {
    const s = createInitialState();
    expect(s.turn).toBe("chess");
    expect(kingCount(s.position, "chess")).toBe(2);
    expect(kingCount(s.position, "shogi")).toBe(1);
  });
});

describe("将军判定", () => {
  it("将棋方只 1 王,被国象车正对 → 将军", () => {
    const pos = empty();
    put(pos, 4, 4, { side: "shogi", kind: "OU" });
    put(pos, 4, 8, { side: "chess", kind: "R" });
    expect(inCheck(pos, "shogi")).toBe(true);
  });
});

describe("双王规则", () => {
  it("国象有 2 王时,将棋可直接吃掉一个王(该动作合法)", () => {
    const pos = empty();
    put(pos, 3, 8, { side: "chess", kind: "K" });
    put(pos, 5, 8, { side: "chess", kind: "K" });
    put(pos, 0, 0, { side: "shogi", kind: "OU" });
    put(pos, 3, 0, { side: "shogi", kind: "HI" }); // 正对 file3 上的王
    const s = st(pos, "shogi");
    expect(hasMoveTo(s, 3, 0, 3, 8)).toBe(true);
    const after = applyAction(s, { type: "move", from: { file: 3, rank: 0 }, to: { file: 3, rank: 8 } });
    expect(kingCount(after.position, "chess")).toBe(1); // 还剩一个王,未分胜负
    expect(after.result).toBeUndefined();
  });
  it("只剩 1 王且被将:所有合法动作走后都不再被将", () => {
    const pos = empty();
    put(pos, 4, 8, { side: "chess", kind: "K" });
    put(pos, 4, 0, { side: "shogi", kind: "HI" }); // 沿 file4 将军
    put(pos, 8, 0, { side: "shogi", kind: "OU" });
    const s = st(pos, "chess");
    const acts = legalActions(s);
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) {
      const nx = applyAction(s, a);
      expect(inCheck(nx.position, "chess")).toBe(false);
    }
    // 不能停在 file4(仍被将)
    expect(hasMoveTo(s, 4, 8, 4, 7)).toBe(false);
  });
});

describe("打入", () => {
  it("将棋吃掉国象车 → 入手(保留 fromChess)", () => {
    const pos = empty();
    put(pos, 3, 0, { side: "shogi", kind: "HI" });
    put(pos, 3, 4, { side: "chess", kind: "R" });
    put(pos, 0, 0, { side: "shogi", kind: "OU" });
    put(pos, 8, 8, { side: "chess", kind: "K" });
    put(pos, 7, 8, { side: "chess", kind: "K" });
    const s = st(pos, "shogi");
    const after = applyAction(s, { type: "move", from: { file: 3, rank: 0 }, to: { file: 3, rank: 4 } });
    const g = after.hands.shogi.find((h) => h.kind === "R");
    expect(g).toBeDefined();
    expect(g!.fromChess).toBe(true);
  });
  it("打入国象车到空格;二步禁手;国象兵不能落最后一行", () => {
    const pos = empty();
    put(pos, 0, 0, { side: "shogi", kind: "OU" });
    put(pos, 8, 8, { side: "chess", kind: "K" });
    put(pos, 7, 8, { side: "chess", kind: "K" });
    // 已有未升变将棋歩在 file4
    put(pos, 4, 3, { side: "shogi", kind: "FU" });
    const s = st(pos, "shogi", [
      { kind: "R", fromChess: true, count: 1 },
      { kind: "FU", fromChess: false, count: 1 },
      { kind: "P", fromChess: true, count: 1 },
    ]);
    expect(legalDropDestinations(s, "R", true).some((d) => d.file === 5 && d.rank === 5)).toBe(true);
    // 二步:歩不能落在已有己方歩的 file4
    expect(legalDropDestinations(s, "FU", false).some((d) => d.file === 4)).toBe(false);
    // 国象兵不能落将棋方最后一行(rank8)
    expect(legalDropDestinations(s, "P", true).some((d) => d.rank === 8)).toBe(false);
  });
});

describe("升变", () => {
  it("将棋歩到底线强制升变", () => {
    const pos = empty();
    put(pos, 4, 7, { side: "shogi", kind: "FU" });
    put(pos, 0, 0, { side: "shogi", kind: "OU" });
    put(pos, 8, 8, { side: "chess", kind: "K" });
    put(pos, 7, 8, { side: "chess", kind: "K" });
    const s = st(pos, "shogi");
    const opt = promotionOptions(s, { file: 4, rank: 7 }, { file: 4, rank: 8 });
    expect(opt.canPromote).toBe(true);
    expect(opt.canStay).toBe(false);
  });
  it("国象兵到底线升变为后", () => {
    const pos = empty();
    put(pos, 4, 1, { side: "chess", kind: "P" });
    put(pos, 3, 8, { side: "chess", kind: "K" });
    put(pos, 5, 8, { side: "chess", kind: "K" });
    put(pos, 0, 0, { side: "shogi", kind: "OU" });
    const s = st(pos, "chess");
    const opt = promotionOptions(s, { file: 4, rank: 1 }, { file: 4, rank: 0 });
    expect(opt.isChessPawn).toBe(true);
    const mv = findMove(s, { file: 4, rank: 1 }, { file: 4, rank: 0 }, undefined, "Q")!;
    const after = applyAction(s, mv);
    expect(after.position[idx(4, 0)]).toEqual({ side: "chess", kind: "Q" });
  });
});

describe("胜负", () => {
  it("最后一个王被将死 → 对方胜", () => {
    const pos = empty();
    put(pos, 8, 8, { side: "chess", kind: "K" }); // 1 王,角落
    put(pos, 8, 0, { side: "shogi", kind: "HI" }); // file8 将军
    put(pos, 7, 0, { side: "shogi", kind: "HI" }); // file7 封锁逃路
    put(pos, 0, 0, { side: "shogi", kind: "OU" });
    const s = st(pos, "chess");
    expect(inCheck(pos, "chess")).toBe(true);
    expect(legalActions(s).length).toBe(0);
    expect(status(s)).toEqual({ kind: "win", winner: "shogi", reason: "checkmate" });
  });
});
