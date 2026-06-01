import { describe, it, expect } from "vitest";
import { otherSide, idx, type Side } from "./types";

describe("Side", () => {
  it("chess 的对手是 shogi", () => {
    const s: Side = "chess";
    expect(otherSide(s)).toBe("shogi");
  });
  it("shogi 的对手是 chess", () => {
    expect(otherSide("shogi")).toBe("chess");
  });
});

describe("idx", () => {
  it("行列映射到 0..80", () => {
    expect(idx(0, 0)).toBe(0);
    expect(idx(8, 0)).toBe(8);
    expect(idx(0, 1)).toBe(9);
    expect(idx(8, 8)).toBe(80);
  });
});
