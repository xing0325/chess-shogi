import { describe, it, expect } from "vitest";
import { squareStyleKind } from "./boardTheme";

describe("squareStyleKind", () => {
  it("行5(rank4)是河界", () => {
    expect(squareStyleKind(3, 4)).toBe("river");
    expect(squareStyleKind(0, 4)).toBe("river");
  });
  it("将棋半盘(rank<4)是木纹", () => {
    expect(squareStyleKind(0, 0)).toBe("wood");
    expect(squareStyleKind(8, 3)).toBe("wood");
  });
  it("国象半盘(rank>4)是黑白格", () => {
    const k = squareStyleKind(0, 8);
    expect(k === "light" || k === "dark").toBe(true);
  });
});
