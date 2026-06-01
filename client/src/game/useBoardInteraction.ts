import { useMemo, useState, useCallback, useEffect } from "react";
import {
  legalDestinations, legalDropDestinations, promotionOptions, findMove, idx,
  type GameState, type Square, type PieceKind, type ChessKind, type Action,
} from "@cs/shared";

type Selection =
  | { type: "board"; sq: Square }
  | { type: "hand"; kind: PieceKind; fromChess: boolean }
  | null;

export interface PendingPromo { mode: "chess" | "shogi"; from: Square; to: Square }

/**
 * 棋盘交互逻辑(选子/高亮/升变),与"状态从哪来、动作发去哪"解耦。
 * @param state  当前局面(本地 state 或服务器下发的 state)
 * @param submit 提交一个动作(本地=直接 apply;联机=emit 给服务器)
 * @param enabled 本地用户当前是否可落子(本地热座=该回合即可;联机=自己执的边轮到)
 */
export function useBoardInteraction(state: GameState, submit: (a: Action) => void, enabled: boolean) {
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingPromo, setPendingPromo] = useState<PendingPromo | null>(null);

  // 局面变化(我方落子完成 / 对方落子到达)→ 清空选择
  useEffect(() => { setSelection(null); setPendingPromo(null); }, [state]);

  const destinations = useMemo<Square[]>(() => {
    if (!selection) return [];
    if (selection.type === "board") return legalDestinations(state, selection.sq);
    return legalDropDestinations(state, selection.kind, selection.fromChess);
  }, [selection, state]);

  const clickCell = useCallback((file: number, rank: number) => {
    if (!enabled || state.result || pendingPromo) return;
    const to: Square = { file, rank };
    const isDest = destinations.some((d) => d.file === file && d.rank === rank);

    if (selection && isDest) {
      if (selection.type === "board") {
        const opt = promotionOptions(state, selection.sq, to);
        if (opt.isChessPawn) { setPendingPromo({ mode: "chess", from: selection.sq, to }); return; }
        if (opt.canPromote && opt.canStay) { setPendingPromo({ mode: "shogi", from: selection.sq, to }); return; }
        const mv = findMove(state, selection.sq, to, opt.canPromote && !opt.canStay);
        if (mv) submit(mv);
        return;
      }
      submit({ type: "drop", kind: selection.kind, fromChess: selection.fromChess, to });
      return;
    }

    const p = state.position[idx(file, rank)];
    if (p && p.side === state.turn) setSelection({ type: "board", sq: to });
    else setSelection(null);
  }, [state, selection, destinations, pendingPromo, enabled, submit]);

  const selectHand = useCallback((kind: PieceKind, fromChess: boolean) => {
    if (!enabled || state.result || state.turn !== "shogi") return;
    setSelection((cur) =>
      cur && cur.type === "hand" && cur.kind === kind && cur.fromChess === fromChess
        ? null : { type: "hand", kind, fromChess });
  }, [enabled, state]);

  const choosePromo = useCallback((arg: boolean | ChessKind) => {
    if (!pendingPromo) return;
    const { from, to, mode } = pendingPromo;
    const mv = mode === "chess"
      ? findMove(state, from, to, undefined, arg as ChessKind)
      : findMove(state, from, to, arg as boolean);
    if (mv) submit(mv);
    setPendingPromo(null);
  }, [pendingPromo, state, submit]);

  const cancelPromo = useCallback(() => { setPendingPromo(null); setSelection(null); }, []);

  return {
    selection, pendingPromo, destinations, clickCell, selectHand, choosePromo, cancelPromo,
    selectedSquare: selection?.type === "board" ? selection.sq : null,
    handSelected: selection?.type === "hand" ? { kind: selection.kind, fromChess: selection.fromChess } : null,
  };
}
