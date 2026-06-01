import { useState, useCallback } from "react";
import { createInitialState, applyAction, type Action } from "@cs/shared";
import { GameBoard } from "./GameBoard";

export function LocalGame() {
  const [state, setState] = useState(createInitialState);
  const submit = useCallback((a: Action) => setState((s) => applyAction(s, a)), []);
  const reset = useCallback(() => setState(createInitialState()), []);
  return <GameBoard state={state} submit={submit} enabled={!state.result} onReset={reset} />;
}
