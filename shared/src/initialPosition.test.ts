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

  it("国象后排两翼:车马象", () => {
    expect(pos[idx(0, 8)]).toEqual({ side: "chess", kind: "R" });
    expect(pos[idx(1, 8)]).toEqual({ side: "chess", kind: "N" });
    expect(pos[idx(2, 8)]).toEqual({ side: "chess", kind: "B" });
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
