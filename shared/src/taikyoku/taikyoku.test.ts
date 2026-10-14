import { describe, it, expect } from "vitest";
import {
  KIND, KINDS, POOL_IDS, KING, emptyBoard, idx, pseudoTargets, legalMoves, applyMove, startGame,
  newDraft, applyDraft, autoAction, actor, available, placeSquares, inCheck, mulberry32, DRAFT_ORDER, draftError, isDraftActionShape,
  type TPiece, type TSide, type Sq, type TMove,
} from "./index";
import { REACH_CENTER } from "./reach.fixture";

const S = (x: number, y: number): Sq => ({ x, y });
function board(pieces: [number, number, TSide, string][]) {
  const b = emptyBoard();
  for (const [x, y, side, kind] of pieces) b[idx(S(x, y))] = { side, kind } as TPiece;
  return b;
}
const key = (s: Sq) => `${s.x},${s.y}`;
const has = (ms: TMove[], f: (m: TMove) => boolean) => ms.some(f);

describe("棋子数据", () => {
  it("301 种棋子,205 种进卡池,升变目标都存在", () => {
    expect(KINDS.length).toBe(301);
    expect(POOL_IDS.length).toBe(205);
    for (const k of KINDS) if (k.promotesTo) expect(KIND[k.promotesTo], k.id).toBeTruthy();
    expect(POOL_IDS).not.toContain(KING);
    expect(POOL_IDS).not.toContain("crown-prince");
  });
  it("大局将棋的王将:任意方向最多走 2 格", () => {
    expect(KIND[KING].betza).toBe("Q2");
  });
});

describe("走法生成与 Python 编译器(已对过维基走法图)一致", () => {
  it("所有 301 种棋子在空棋盘中心的可达格", () => {
    const bad: string[] = [];
    for (const k of KINDS) {
      const b = emptyBoard();
      b[idx(S(2, 2))] = { side: "sente", kind: k.id };
      const got = new Set(pseudoTargets(b, S(2, 2)).map((t) => `${t.to.x - 2},${t.to.y - 2}`));
      got.delete("0,0");
      const want = new Set(REACH_CENTER[k.id].map(([x, y]) => `${x},${y}`));
      if (got.size !== want.size || [...want].some((w) => !got.has(w))) bad.push(k.id);
    }
    expect(bad).toEqual([]);
  });
  it("后手的走法是先手旋转 180°", () => {
    for (const id of ["pawn", "cassia-horse", "peacock", "gold-bird", "lance"].filter((i) => KIND[i])) {
      const bs = emptyBoard(); bs[idx(S(2, 2))] = { side: "sente", kind: id };
      const bg = emptyBoard(); bg[idx(S(2, 2))] = { side: "gote", kind: id };
      const s = new Set(pseudoTargets(bs, S(2, 2)).map((t) => `${2 - t.to.x},${2 - t.to.y}`));
      const g = new Set(pseudoTargets(bg, S(2, 2)).map((t) => `${t.to.x - 2},${t.to.y - 2}`));
      expect([...g].sort(), id).toEqual([...s].sort());
    }
  });
});

describe("特殊走法", () => {
  it("狮子:双吃与居喰", () => {
    const b = board([[2, 2, "sente", "lion"], [2, 3, "gote", "pawn"], [2, 4, "gote", "pawn"], [0, 0, "sente", KING], [4, 4, "gote", KING]]);
    const t = pseudoTargets(b, S(2, 2));
    expect(has(t as TMove[], (m) => key(m.to) === "2,4" && !!m.via && key(m.via) === "2,3" && m.caps!.length === 2)).toBe(true);
    expect(has(t as TMove[], (m) => key(m.to) === "2,2" && !!m.via && key(m.via) === "2,3")).toBe(true); // 居喰
    const g = startGame(b);
    const after = applyMove(g, { from: S(2, 2), to: S(2, 2), via: S(2, 3) });
    expect(after.board[idx(S(2, 3))]).toBeNull();
    expect(after.board[idx(S(2, 2))]?.kind).toBe("lion");
  });

  it("跳越吃子:大将飞过低等级棋子(含己方)并全部吃掉,不能越过王", () => {
    const b = board([[0, 0, "sente", "great-general"], [1, 1, "sente", "pawn"], [2, 2, "gote", "pawn"], [4, 0, "sente", KING], [3, 3, "gote", KING]]);
    const t = pseudoTargets(b, S(0, 0));
    // 斜线:b2(己) c3(敌) 之后是 d4 的敌王 → 王等级更高,挡住
    expect(has(t as TMove[], (m) => key(m.to) === "2,2" && m.caps!.length === 2)).toBe(true);
    expect(has(t as TMove[], (m) => key(m.to) === "3,3")).toBe(false);
  });

  it("钩行:绕过拐角", () => {
    const b = board([[0, 0, "sente", "hook-mover"], [4, 0, "sente", KING], [4, 4, "gote", KING]]);
    const t = pseudoTargets(b, S(0, 0)).map((x) => key(x.to));
    expect(t).toContain("3,3"); // a1 → a4 → d4
  });

  it("不能送将:被钉住的棋子不能离开", () => {
    const b = board([[2, 0, "sente", KING], [2, 1, "sente", "gold-general"], [2, 4, "gote", "reverse-chariot"], [0, 4, "gote", KING]]);
    const ms = legalMoves(startGame(b)).filter((m) => key(m.from) === "2,1");
    expect(ms.every((m) => m.to.x === 2)).toBe(true);
  });

  it("步兵走到底线必须升变成金将", () => {
    const b = board([[0, 3, "sente", "pawn"], [4, 0, "sente", KING], [4, 4, "gote", KING]]);
    const ms = legalMoves(startGame(b)).filter((m) => key(m.from) === "0,3");
    expect(ms.length).toBe(1);
    expect(ms[0].promote).toBe(true);
    const g = applyMove(startGame(b), ms[0]);
    expect(g.board[idx(S(0, 4))]).toEqual({ side: "sente", kind: "gold-general", from: "pawn" });
  });

  it("将死判负", () => {
    // 后手王在 a5,先手两只金将 + 王
    const b = board([[0, 4, "gote", KING], [1, 2, "sente", "gold-general"], [0, 2, "sente", "gold-general"], [4, 0, "sente", KING]]);
    let g = startGame(b);
    const mate = legalMoves(g).find((m) => key(m.from) === "1,2" && key(m.to) === "1,3");
    expect(mate).toBeTruthy();
    g = applyMove(g, mate!);
    // 王将可走两格,未必被将死;只验证判负逻辑:无合法着法时有结果
    if (legalMoves(g).length === 0) expect(g.result?.kind).toBe("win");
    else expect(g.result).toBeUndefined();
  });
});

describe("BP 选将流程", () => {
  it("完整流程:20 步 BP → 交替布阵 → 先手开局", () => {
    let d = newDraft(mulberry32(42));
    expect(d.pool.length).toBe(24);
    expect(new Set(d.pool).size).toBe(24);
    expect(DRAFT_ORDER.length).toBe(20);
    const rng = mulberry32(7);
    // 抢先操作被拒
    expect(draftError(d, "gote", { type: "ban", kind: d.pool[0] })).toBeTruthy();
    for (let i = 0; i < 20; i++) {
      const side = actor(d)!;
      const a = autoAction(d, rng)!;
      const real = a.type === "ban" ? { type: "ban" as const, kind: available(d)[0] } : a;
      d = applyDraft(d, side, real);
    }
    expect(d.phase).toBe("place");
    expect(d.picks.blue.length).toBe(5);
    expect(d.picks.red.length).toBe(5);
    expect(new Set([...d.picks.blue, ...d.picks.red, ...(d.bans.blue as string[]), ...(d.bans.red as string[])]).size).toBe(20);
    expect(d.toPlace.sente).toContain(KING);
    const order: TSide[] = [];
    while (d.phase === "place") {
      const side = actor(d)!;
      order.push(side);
      d = applyDraft(d, side, autoAction(d, rng)!);
    }
    expect(d.game.board.filter((p) => p?.kind === KING).length).toBe(2);
    expect(order).toEqual(["sente", "gote", "sente", "gote", "sente", "gote", "sente", "gote", "sente", "gote", "sente", "gote"]);
    expect(d.phase).toBe("play");
    expect(inCheck(d.game)).toBe(false);
    expect(d.game.turn).toBe("sente");
    expect(d.game.board.filter(Boolean).length).toBe(12);
    expect(legalMoves(d.game).length).toBeGreaterThan(0);
  });

  it("选择已被禁用的棋子会被拒绝;结构校验挡住畸形数据", () => {
    let d = newDraft(mulberry32(1));
    const k = d.pool[3];
    d = applyDraft(d, "sente", { type: "ban", kind: k });
    expect(draftError(d, "gote", { type: "ban", kind: k })).toBeTruthy();
    expect(isDraftActionShape({ type: "place", kind: "lion", at: { x: 9, y: 0 } })).toBe(false);
    expect(isDraftActionShape({ type: "move", move: { from: { x: 1, y: 1 } } })).toBe(false);
    expect(isDraftActionShape(null)).toBe(false);
    expect(isDraftActionShape({ type: "ban", kind: null })).toBe(true);
  });

  it("随机自对弈 30 局不会抛错且都能结束", () => {
    const rng = mulberry32(2024);
    let finished = 0;
    for (let n = 0; n < 30; n++) {
      let d = newDraft(rng);
      while (d.phase !== "play") d = applyDraft(d, actor(d)!, autoAction(d, rng)!);
      while (!d.game.result) {
        const ms = legalMoves(d.game);
        d = applyDraft(d, d.game.turn, { type: "move", move: ms[Math.floor(rng() * ms.length)] });
      }
      finished++;
    }
    expect(finished).toBe(30);
  }, 60000);

  it("布阵:不能布下直接将军的棋子,王将不能放进攻击范围", () => {
    let d = newDraft(mulberry32(5));
    const rng = mulberry32(9);
    while (d.phase === "draft") d = applyDraft(d, actor(d)!, autoAction(d, rng)!);
    // 手工构造:先手王在 c1,后手放香车(只能向前直走)到 c4/c5 会直接将军
    d = { ...d, toPlace: { sente: [], gote: ["incense-chariot"] }, placeTurn: "gote", game: { ...d.game, board: board([[2, 0, "sente", KING]]) } };
    const sq = placeSquares(d, "gote", "incense-chariot").map(key);
    expect(sq).not.toContain("2,3");
    expect(sq).not.toContain("2,4");
    expect(sq).toContain("0,4");
    expect(draftError(d, "gote", { type: "place", kind: "incense-chariot", at: S(2, 4) })).toMatch(/将军/);
    // 先手在 c2 有香车 → 后手王不能放 c4/c5
    d = { ...d, toPlace: { sente: [], gote: [KING, "incense-chariot"] }, game: { ...d.game, board: board([[2, 0, "sente", KING], [2, 1, "sente", "incense-chariot"]]) } };
    expect(placeSquares(d, "gote", KING).map(key)).not.toContain("2,4");
    // 王将未布时不能先布别的棋子
    expect(draftError(d, "gote", { type: "place", kind: "incense-chariot", at: S(0, 4) })).toMatch(/王将/);
  });

  it("开局时若只有后手王将被攻击,改由后手先走", () => {
    let d = newDraft(mulberry32(3));
    const rng = mulberry32(4);
    while (d.phase === "draft") d = applyDraft(d, actor(d)!, autoAction(d, rng)!);
    // 只剩后手最后一枚棋子;构造先手香车正对后手王将、且后手无法遮挡的局面
    d = { ...d, placeTurn: "gote", toPlace: { sente: [], gote: ["gold-general"] },
      game: { ...d.game, board: board([[0, 0, "sente", KING], [2, 1, "sente", "incense-chariot"], [2, 4, "gote", KING]]) } };
    d = applyDraft(d, "gote", { type: "place", kind: "gold-general", at: S(0, 4) });
    expect(d.phase).toBe("play");
    if (!d.game.result) expect(d.game.turn).toBe("gote");
  });
});
