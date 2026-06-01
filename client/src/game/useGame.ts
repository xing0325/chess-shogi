import { useMemo, useState, useCallback } from "react";
import {
  createInitialState, legalDestinations, legalDropDestinations, promotionOptions,
  findMove, applyAction, idx,
  type GameState, type Square, type PieceKind, type ChessKind,
} from "@cs/shared";

type Selection =
  | { type: "board"; sq: Square }
  | { type: "hand"; kind: PieceKind; fromChess: boolean }
  | null;

export interface PendingPromo {
  mode: "chess" | "shogi";
  from: Square;
  to: Square;
}

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState);
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingPromo, setPendingPromo] = useState<PendingPromo | null>(null);

  const destinations = useMemo<Square[]>(() => {
    if (!selection) return [];
    if (selection.type === "board") return legalDestinations(state, selection.sq);
    return legalDropDestinations(state, selection.kind, selection.fromChess);
  }, [selection, state]);

  const apply = useCallback((action: Parameters<typeof applyAction>[1]) => {
    setState((s) => applyAction(s, action));
    setSelection(null);
    setPendingPromo(null);
  }, []);

  const clickCell = useCallback((file: number, rank: number) => {
    if (state.result || pendingPromo) return;
    const to: Square = { file, rank };
    const isDest = destinations.some((d) => d.file === file && d.rank === rank);

    if (selection && isDest) {
      if (selection.type === "board") {
        const opt = promotionOptions(state, selection.sq, to);
        if (opt.isChessPawn) { setPendingPromo({ mode: "chess", from: selection.sq, to }); return; }
        if (opt.canPromote && opt.canStay) { setPendingPromo({ mode: "shogi", from: selection.sq, to }); return; }
        const forced = opt.canPromote && !opt.canStay;
        const mv = findMove(state, selection.sq, to, forced);
        if (mv) apply(mv);
        return;
      }
      apply({ type: "drop", kind: selection.kind, fromChess: selection.fromChess, to });
      return;
    }

    // 否则:尝试选中当前方的棋子
    const p = state.position[idx(file, rank)];
    if (p && p.side === state.turn) setSelection({ type: "board", sq: to });
    else setSelection(null);
  }, [state, selection, destinations, pendingPromo, apply]);

  const selectHand = useCallback((kind: PieceKind, fromChess: boolean) => {
    if (state.result) return;
    if (state.turn !== "shogi") return; // 只有将棋方能打入
    setSelection((cur) =>
      cur && cur.type === "hand" && cur.kind === kind && cur.fromChess === fromChess
        ? null
        : { type: "hand", kind, fromChess });
  }, [state]);

  const choosePromo = useCallback((arg: boolean | ChessKind) => {
    if (!pendingPromo) return;
    const { from, to, mode } = pendingPromo;
    const mv = mode === "chess"
      ? findMove(state, from, to, undefined, arg as ChessKind)
      : findMove(state, from, to, arg as boolean);
    if (mv) apply(mv);
    else setPendingPromo(null);
  }, [pendingPromo, state, apply]);

  const cancelPromo = useCallback(() => { setPendingPromo(null); setSelection(null); }, []);
  const reset = useCallback(() => { setState(createInitialState()); setSelection(null); setPendingPromo(null); }, []);

  return {
    state, selection, destinations, pendingPromo,
    clickCell, selectHand, choosePromo, cancelPromo, reset,
    selectedSquare: selection?.type === "board" ? selection.sq : null,
  };
}
