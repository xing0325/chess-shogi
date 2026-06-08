import { useEffect, useRef, useState, useCallback } from "react";
import {
  EV, type LobbySnapshot, type GameStartMsg, type GameState,
  type Side, type Action, type InviteMsg, type Profile, type AuthResult,
} from "@cs/shared";
import { createSocket } from "./socket";
import type { Socket } from "socket.io-client";

export type NetPhase = "connecting" | "auth" | "lobby" | "waiting" | "game";

interface OnlineGame { mySide: Side; opponent: Profile; state: GameState }
const TOKEN_KEY = "cs_token";

export function useNet() {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase] = useState<NetPhase>("connecting");
  const [myId, setMyId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState("");
  const [lobby, setLobby] = useState<LobbySnapshot>({ players: [], rooms: [] });
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [gameNonce, setGameNonce] = useState(0);
  const [incoming, setIncoming] = useState<InviteMsg | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const s = createSocket();
    socketRef.current = s;
    s.on("connect", () => {
      setMyId(s.id ?? "");
      const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      if (token) s.emit(EV.authToken, { token });
      else setPhase("auth");
    });
    s.on(EV.authResult, (res: AuthResult) => {
      if (!res.ok || !res.profile) {
        if (res.error) setAuthError(res.error);
        try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
        setPhase((p) => (p === "connecting" ? "auth" : p));
        return;
      }
      if (res.token) { try { localStorage.setItem(TOKEN_KEY, res.token); } catch { /* ignore */ } }
      setProfile(res.profile);
      setAuthError("");
      setPhase((p) => (p === "connecting" || p === "auth" ? "lobby" : p));
    });
    s.on(EV.lobby, (snap: LobbySnapshot) => setLobby(snap));
    s.on(EV.gameStart, (msg: GameStartMsg) => {
      setGame({ mySide: msg.mySide, opponent: msg.opponent, state: msg.state });
      setGameNonce((n) => n + 1);
      setIncoming(null); setNote(""); setPhase("game");
    });
    s.on(EV.gameState, (d: { state: GameState }) => setGame((g) => (g ? { ...g, state: d.state } : g)));
    s.on(EV.incomingInvite, (m: InviteMsg) => setIncoming(m));
    s.on(EV.inviteDeclined, (m: { fromName: string }) => setNote(`${m.fromName} 拒绝了邀请`));
    s.on(EV.opponentLeft, () => setNote("对手已离开本局"));
    s.on(EV.errorMsg, (m: unknown) => setNote(typeof m === "string" ? m : "出错了"));
    return () => { s.close(); };
  }, []);

  const emit = (ev: string, payload?: unknown) => socketRef.current?.emit(ev, payload);

  // 鉴权
  const guest = useCallback((nickname: string, avatar: string) => emit(EV.authGuest, { nickname, avatar }), []);
  const login = useCallback((username: string, password: string) => emit(EV.authLogin, { username, password }), []);
  const register = useCallback((username: string, password: string, nickname: string, avatar: string) =>
    emit(EV.authRegister, { username, password, nickname, avatar }), []);
  const updateProfile = useCallback((nickname: string, avatar: string) => emit(EV.updateProfile, { nickname, avatar }), []);
  const logout = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    emit(EV.leaveRoom);
    setProfile(null); setGame(null); setNote(""); setPhase("auth");
  }, []);

  // 大厅 / 对局
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
    phase, myId, profile, authError, lobby, game, incoming, note, enabled, gameNonce,
    guest, login, register, updateProfile, logout,
    createRoom, joinRoom, invitePlayer, acceptInvite, declineInvite,
    submit, leaveRoom, rematch, cancelWaiting, clearNote: () => setNote(""),
  };
}
