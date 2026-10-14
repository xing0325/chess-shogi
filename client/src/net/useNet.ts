import { useEffect, useRef, useState, useCallback } from "react";
import {
  EV, createInitialState, applyAction, tk,
  type GameMode, type DraftStartMsg, type DraftStateMsg,
  type LobbySnapshot, type GameStartMsg, type GameState, type OpponentStatusMsg,
  type Side, type Action, type InviteMsg, type Profile, type AuthResult,
} from "@cs/shared";
import { createSocket, setCid } from "./socket";
import type { Socket } from "socket.io-client";

export type NetPhase = "connecting" | "auth" | "lobby" | "waiting" | "game";

interface OnlineGame {
  mySide: Side;
  opponent: Profile;
  state: GameState;
  seed?: GameState[];   // 重连时由棋谱重放出的历史快照
}

interface OnlineDraft {
  mySide: tk.TSide;
  opponent: Profile;
  draft: tk.DraftState;
  deadline?: number;    // 已换算为本地时钟
}

const TOKEN_KEY = "cs_token";

/** 由着法列表重放出每一手的局面快照(含初始局面) */
function replay(history: Action[] | undefined): GameState[] | undefined {
  if (!history || !history.length) return undefined;
  const snaps: GameState[] = [createInitialState()];
  for (const a of history) snaps.push(applyAction(snaps[snaps.length - 1], a));
  return snaps;
}

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
  const [rematchAsked, setRematchAsked] = useState(false); // 对手已请求再来一局
  const [draft, setDraft] = useState<OnlineDraft | null>(null);

  useEffect(() => {
    const s = createSocket();
    socketRef.current = s;
    s.on(EV.sessionId, (id: string) => { setCid(id); setMyId(id); });
    s.on("connect", () => {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      if (token) s.emit(EV.authToken, { token });
      else setPhase((p) => (p === "connecting" ? "auth" : p));
    });
    s.on("disconnect", () => setNote("与服务器的连接断开,正在重连…"));
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
      setNote((n) => (n.startsWith("与服务器的连接断开") ? "" : n));
      setPhase((p) => (p === "connecting" || p === "auth" ? "lobby" : p));
    });
    s.on(EV.lobby, (snap: LobbySnapshot) => setLobby(snap));
    s.on(EV.gameStart, (msg: GameStartMsg) => {
      setGame({ mySide: msg.mySide, opponent: msg.opponent, state: msg.state, seed: replay(msg.history) });
      setDraft(null);
      setGameNonce((n) => n + 1);
      setIncoming(null);
      setRematchAsked(false);
      setNote(msg.reconnected ? "已恢复对局" : "");
      setPhase("game");
    });
    s.on(EV.gameState, (d: { state: GameState }) => setGame((g) => (g ? { ...g, state: d.state } : g)));
    const local = (deadline: number | undefined, serverNow: number) => (deadline ? deadline - serverNow + Date.now() : undefined);
    s.on(EV.draftStart, (msg: DraftStartMsg) => {
      setDraft({ mySide: msg.mySide, opponent: msg.opponent, draft: msg.draft, deadline: local(msg.deadline, msg.serverNow) });
      setGame(null);
      setGameNonce((n) => n + 1);
      setIncoming(null);
      setRematchAsked(false);
      setNote(msg.reconnected ? "已恢复对局" : "");
      setPhase("game");
    });
    s.on(EV.draftState, (msg: DraftStateMsg) =>
      setDraft((d) => (d ? { ...d, draft: msg.draft, deadline: local(msg.deadline, msg.serverNow) } : d)));
    s.on(EV.incomingInvite, (m: InviteMsg) => setIncoming(m));
    s.on(EV.inviteDeclined, (m: { fromName: string }) => setNote(`${m.fromName} 拒绝了邀请`));
    s.on(EV.opponentLeft, () => { setRematchAsked(false); setNote("对手已离开本局"); });
    s.on(EV.opponentStatus, (m: OpponentStatusMsg) => {
      if (m.connected) setNote("对手已重新连接");
      else setNote(`对手掉线,保留座位 ${Math.round((m.graceMs ?? 60000) / 1000)} 秒等待重连…`);
    });
    s.on(EV.rematchRequested, (m: { fromName: string }) => {
      setRematchAsked(true);
      setNote(`${m.fromName} 想再来一局,点「同意再来一局」开始`);
    });
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
    setProfile(null); setGame(null); setDraft(null); setNote(""); setPhase("auth");
  }, []);

  // 大厅 / 对局
  const createRoom = useCallback((side: Side | "random", mode: GameMode = "fusion") => { emit(EV.createRoom, { side, mode }); setPhase("waiting"); }, []);
  const joinRoom = useCallback((roomId: string) => emit(EV.joinRoom, { roomId }), []);
  const invitePlayer = useCallback((targetId: string, mode: GameMode = "fusion") => { emit(EV.invite, { targetId, mode }); setNote("已发出邀请,等待对方接受…"); }, []);
  const acceptInvite = useCallback(() => { setIncoming((inv) => { if (inv) emit(EV.acceptInvite, { fromId: inv.fromId, mode: inv.mode }); return null; }); }, []);
  const draftAction = useCallback((action: tk.DraftAction) => emit(EV.draftAction, { action }), []);
  const declineInvite = useCallback(() => { setIncoming((inv) => { if (inv) emit(EV.declineInvite, { fromId: inv.fromId }); return null; }); }, []);
  const submit = useCallback((a: Action) => emit(EV.move, { action: a }), []);
  const resign = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("确定认输吗?")) return;
    emit(EV.resign);
  }, []);
  const leaveRoom = useCallback(() => { emit(EV.leaveRoom); setGame(null); setDraft(null); setNote(""); setPhase("lobby"); }, []);
  const rematch = useCallback(() => {
    emit(EV.rematch);
    setNote((n) => (n.includes("想再来一局") ? n : "已发出再来一局请求,等待对方同意…"));
  }, []);
  const cancelWaiting = useCallback(() => { emit(EV.leaveRoom); setPhase("lobby"); }, []);

  const enabled = !!game && !game.state.result && game.mySide === game.state.turn;

  return {
    phase, myId, profile, authError, lobby, game, draft, incoming, note, enabled, gameNonce, rematchAsked, draftAction,
    guest, login, register, updateProfile, logout,
    createRoom, joinRoom, invitePlayer, acceptInvite, declineInvite,
    submit, resign, leaveRoom, rematch, cancelWaiting, clearNote: () => setNote(""),
  };
}
