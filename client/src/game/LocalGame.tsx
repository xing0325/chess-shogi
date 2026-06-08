import { useState, useCallback } from "react";
import { createInitialState, applyAction, type Action } from "@cs/shared";
import { GameView } from "./GameView";

export function LocalGame() {
  const [state, setState] = useState(createInitialState);
  const [epoch, setEpoch] = useState(0);
  const submit = useCallback((a: Action) => setState((s) => applyAction(s, a)), []);
  const reset = useCallback(() => { setState(createInitialState()); setEpoch((e) => e + 1); }, []);
  return <GameView live={state} submit={submit} canPlay resetKey={`local-${epoch}`} onReset={reset} />;
}
