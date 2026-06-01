import { useEffect, useRef, useState, useCallback } from "react";
import {
  EV, type LobbySnapshot, type GameStartMsg, type GameState,
  type Side, type Action, type InviteMsg,
} from "@cs/shared";
import { createSocket } from "./socket";
import type { Socket } from "socket.io-client";

export type NetPhase = "connecting" | "lobby" | "waiting" | "game";

interface OnlineGame { mySide: Side; opponentName: string; state: GameState }

export function useNet(name: string) {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase] = useState<NetPhase>("connecting");
  const [myId, setMyId] = useState("");
  const [lobby, setLobby] = useState<LobbySnapshot>({ players: [], rooms: [] });
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [incoming, setIncoming] = useState<InviteMsg | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const s = createSocket();
    socketRef.current = s;
    s.on("connect", () => { setMyId(s.id ?? ""); s.emit(EV.join, { name }); setPhase("lobby"); });
    s.on(EV.lobby, (snap: LobbySnapshot) => setLobby(snap));
    s.on(EV.gameStart, (msg: GameStartMsg) => {
      setGame({ mySide: msg.mySide, opponentName: msg.opponentName, state: msg.state });
      setIncoming(null); setNote(""); setPhase("game");
    });
    s.on(EV.gameState, (d: { state: GameState }) => setGame((g) => (g ? { ...g, state: d.state } : g)));
    s.on(EV.incomingInvite, (m: InviteMsg) => setIncoming(m));
    s.on(EV.inviteDeclined, (m: { fromName: string }) => setNote(`${m.fromName} 拒绝了邀请`));
    s.on(EV.opponentLeft, () => setNote("对手已离开本局"));
    s.on(EV.errorMsg, (m: unknown) => setNote(typeof m === "string" ? m : "出错了"));
    return () => { s.close(); };
  }, [name]);

  const emit = (ev: string, payload?: unknown) => socketRef.current?.emit(ev, payload);

  const createRoom = useCallback((side: Side | "random") => { emit(EV.createRoom, { side }); setPhase("waiting"); }, []);
  const joinRoom = useCallback((roomId: string) => emit(EV.joinRoom, { roomId }), []);
  const invitePlayer = useCallback((targetId: string) => { emit(EV.invite, { targetId }); setNote("已发出邀请,等待对方接受…"); }, []);
  const acceptInvite = useCallback(() => { setIncoming((inv) => { if (inv) emit(EV.acceptInvite, { fromId: inv.fromId }); return null; }); }, []);
  const declineInvite = useCallback(() => { setIncoming((inv) => { if (inv) emit(EV.declineInvite, { fromId: inv.fromId }); return null; }); }, []);
  const submit = useCallback((a: Action) => emit(EV.move, { action: a }), []);
  const leaveRoom = useCallback(() => { emit(EV.leaveRoom); setGame(null); setNote(""); setPhase("lobby"); }, []);
  const rematch = useCallback(() => emit(EV.rematch), []);
  const cancelWaiting = useCallback(() => { emit(EV.leaveRoom); setPhase("lobby"); }, []);

  const enabled = !!game && !game.state.result && game.mySide === game.state.turn;

  return {
    phase, myId, lobby, game, incoming, note, enabled,
    createRoom, joinRoom, invitePlayer, acceptInvite, declineInvite,
    submit, leaveRoom, rematch, cancelWaiting, clearNote: () => setNote(""),
  };
}
