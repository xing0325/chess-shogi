import { useEffect, useMemo, useState } from "react";
import { tk, type Profile } from "@cs/shared";
import { PieceCard, PieceDetail, Token, type CardState } from "./PieceUI";
import { DraftBoard } from "./DraftBoard";
import { Avatar } from "../profile/Avatar";
import "./draft.css";

type Team = tk.Team;
const TEAM_NAME: Record<Team, string> = { blue: "蓝方", red: "红方" };
const REASON: Record<string, string> = {
  checkmate: "将死", "no-moves": "无子可动", resign: "认输", abandon: "对方离开", timeout: "超时",
  repetition: "千日手(同一局面出现四次)", "move-limit": "达到 300 手上限",
};

export interface DraftViewProps {
  draft: tk.DraftState;
  mySide: tk.TSide | null;            // null = 本地同屏(双方都由本机操作)
  onAction: (a: tk.DraftAction) => void;
  deadline?: number;                  // 已换算成本地时间
  me?: Profile;
  opponent?: Profile;
  note?: string;
  onResign?: () => void;
  onRematch?: () => void;
  rematchAsked?: boolean;
  onLeave?: () => void;
  onReset?: () => void;
}

function useCountdown(deadline?: number): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
}

export function DraftView(props: DraftViewProps) {
  const { draft: d, mySide, onAction } = props;
  const actor = tk.actor(d);
  const myTurn = !!actor && (mySide === null || mySide === actor);
  const step = tk.currentStep(d);
  const secs = useCountdown(props.deadline);
  const avail = useMemo(() => new Set(tk.available(d)), [d]);
  const [focus, setFocus] = useState<{ kind: string; from?: string } | null>(null);
  const [placeKind, setPlaceKind] = useState<string | null>(null);
  const perspective: tk.TSide = mySide ?? "sente";

  // 默认聚焦:BP 时第一枚可选棋子;布阵时第一枚待布棋子
  const placeSide = d.phase === "place" ? d.placeTurn : undefined;
  const roster = placeSide ? d.toPlace[placeSide] : [];
  useEffect(() => {
    if (d.phase === "place" && placeSide && (mySide === null || mySide === placeSide)) {
      const ready = roster.filter((r) => tk.placeSquares(d, placeSide, r).length > 0);
      const k = roster.includes(tk.KING) ? tk.KING : placeKind && ready.includes(placeKind) ? placeKind : ready[0] ?? roster[0] ?? null;
      setPlaceKind(k);
      if (k) setFocus({ kind: k });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.phase, placeSide, roster.length, d.game.board]);
  useEffect(() => {
    if (d.phase === "draft" && (!focus || !d.pool.includes(focus.kind))) {
      const first = d.pool.find((k) => avail.has(k));
      if (first) setFocus({ kind: first });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.phase]);

  const cardState = (k: string): CardState =>
    d.bans.blue.includes(k) || d.bans.red.includes(k) ? "banned"
      : d.picks.blue.includes(k) ? "blue" : d.picks.red.includes(k) ? "red" : "free";

  const legal = useMemo(() => (d.phase === "play" && myTurn && !d.game.result ? tk.legalMoves(d.game) : []), [d, myTurn]);
  const result = d.game.result;

  // ---------- 顶部状态 ----------
  let banner = "";
  if (result) {
    banner = result.kind === "draw" ? `和棋 · ${REASON[result.reason]}` : `${TEAM_NAME[tk.teamOf(result.winner)]}胜 · ${REASON[result.reason]}`;
  } else if (d.phase === "draft" && step) {
    const who = TEAM_NAME[step.team];
    banner = `第 ${d.step + 1}/${tk.DRAFT_ORDER.length} 步 · ${who}${step.act === "ban" ? "禁用" : "选择"}`;
  } else if (d.phase === "place") {
    banner = `布阵 · ${TEAM_NAME[tk.teamOf(d.placeTurn)]}放置棋子(己方底部两行 · 先布王将 · 开局不能形成将军)`;
  } else {
    banner = `对局 · 轮到${TEAM_NAME[tk.teamOf(d.game.turn)]}${tk.inCheck(d.game) ? " · 被将军!" : ""}`;
  }
  const youTag = mySide && !result ? (myTurn ? "(你的回合)" : "(等待对手)") : "";

  const focusKind = focus?.kind;
  const lockLabel = step?.act === "ban" ? "禁用" : "选择";
  const canLock = d.phase === "draft" && myTurn && !!focusKind && avail.has(focusKind);

  return (
    <div className="dv">
      <Timeline d={d} />
      <div className="dv__bar">
        <span className={`dv__status${result ? " dv__status--result" : actor ? ` dv__status--${tk.teamOf(actor)}` : ""}`}>{banner} {youTag}</span>
        {secs !== null && !result && <span className={`dv__timer${secs <= 5 ? " dv__timer--low" : ""}`}>{secs}s</span>}
        <span className="dv__spacer" />
        {props.note && <span className="dv__note">{props.note}</span>}
        {props.onReset && <button className="game__btn" onClick={props.onReset}>重新开始</button>}
        {!result && props.onResign && <button className="game__btn" onClick={props.onResign}>认输</button>}
        {result && props.onRematch && <button className="game__btn game__btn--accent" onClick={props.onRematch}>{props.rematchAsked ? "同意再来一局" : "再来一局"}</button>}
        {props.onLeave && <button className="game__btn" onClick={props.onLeave}>离开</button>}
      </div>
      <div className="dv__body">
        <TeamColumn d={d} team="blue" active={!!actor && tk.teamOf(actor) === "blue"} profile={mySide === "sente" ? props.me : mySide === "gote" ? props.opponent : undefined} you={mySide === "sente"} onInspect={setFocus} />
        <div className="dv__center">
          {d.phase === "draft" && (
            <div className="dv__pool">
              {d.pool.map((k) => (
                <PieceCard key={k} kind={k} state={cardState(k)} selected={focusKind === k} onClick={() => setFocus({ kind: k })} />
              ))}
            </div>
          )}
          {d.phase !== "draft" && (
            <div className="dv__boardwrap">
              <DraftBoard
                game={d.game}
                perspective={perspective}
                phase={result ? "view" : d.phase === "place" ? (myTurn ? "place" : "view") : "play"}
                placeSide={myTurn ? placeSide : undefined}
                placeKind={placeKind ?? undefined}
                placeable={myTurn && placeSide && placeKind ? tk.placeSquares(d, placeSide, placeKind) : []}
                onPlace={(at) => placeKind && onAction({ type: "place", kind: placeKind, at })}
                legal={legal}
                onMove={(m) => onAction({ type: "move", move: { from: m.from, to: m.to, ...(m.via ? { via: m.via } : {}), ...(m.promote ? { promote: true } : {}) } })}
                onInspect={(p) => setFocus({ kind: p.kind, from: p.from })}
              />
              {d.phase === "place" && myTurn && placeSide && (
                <div className="dv__roster">
                  <span className="dv__roster-h">{mySide === null ? `${TEAM_NAME[tk.teamOf(placeSide)]}待布:` : "待布棋子:"}</span>
                  {roster.map((k) => (
                    <button key={k} className={`dv__rbtn${placeKind === k ? " dv__rbtn--on" : ""}`} disabled={(k !== tk.KING && roster.includes(tk.KING)) || tk.placeSquares(d, placeSide, k).length === 0} title={k !== tk.KING && roster.includes(tk.KING) ? "请先布王将" : tk.placeSquares(d, placeSide, k).length === 0 ? "现在放哪都会将军,先布别的棋子" : undefined} onClick={() => { setPlaceKind(k); setFocus({ kind: k }); }}>
                      <Token piece={{ kind: k }} size={44} team={tk.teamOf(placeSide)} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="dv__side">
          {focusKind && (
            <PieceDetail kind={focusKind} from={focus?.from}>
              {d.phase === "draft" && (
                <button className="dv__lock" disabled={!canLock} onClick={() => focusKind && onAction(step!.act === "ban" ? { type: "ban", kind: focusKind } : { type: "pick", kind: focusKind })}>
                  {canLock ? `${lockLabel} ${tk.KIND[focusKind].kanji}` : !myTurn ? "等待对手…" : "该棋子不可选"}
                </button>
              )}
            </PieceDetail>
          )}
          <History lines={d.history} />
        </div>
        <TeamColumn d={d} team="red" active={!!actor && tk.teamOf(actor) === "red"} profile={mySide === "gote" ? props.me : mySide === "sente" ? props.opponent : undefined} you={mySide === "gote"} onInspect={setFocus} />
      </div>
    </div>
  );
}

function Timeline({ d }: { d: tk.DraftState }) {
  return (
    <div className="tl">
      {tk.DRAFT_ORDER.map((s, i) => (
        <span key={i} className={`tl__s tl__s--${s.team} tl__s--${s.act}${i < d.step || d.phase !== "draft" ? " tl__s--done" : ""}${i === d.step && d.phase === "draft" ? " tl__s--now" : ""}`} title={`${TEAM_NAME[s.team]}${s.act === "ban" ? "禁" : "选"}`}>
          {s.act === "ban" ? "禁" : "选"}
        </span>
      ))}
      <span className={`tl__phase${d.phase === "place" ? " tl__phase--now" : d.phase === "play" ? " tl__phase--done" : ""}`}>布阵</span>
      <span className={`tl__phase${d.phase === "play" ? " tl__phase--now" : ""}`}>对局</span>
    </div>
  );
}

function TeamColumn({ d, team, active, profile, you, onInspect }: { d: tk.DraftState; team: Team; active: boolean; profile?: Profile; you: boolean; onInspect: (f: { kind: string; from?: string }) => void }) {
  const bans = d.bans[team];
  const picks = d.picks[team];
  const nBan = tk.DRAFT_ORDER.filter((s) => s.team === team && s.act === "ban").length;
  return (
    <div className={`tc tc--${team}${active ? " tc--active" : ""}`}>
      <div className="tc__head">
        {profile && <Avatar id={profile.avatar} size={26} />}
        <span className="tc__name">{TEAM_NAME[team]}{team === "blue" ? " · 先手" : " · 后手"}</span>
        {you && <span className="tc__you">你</span>}
      </div>
      {profile && <div className="tc__player">{profile.nickname}</div>}
      <div className="tc__label">禁用</div>
      <div className="tc__bans">
        {Array.from({ length: nBan }, (_, i) => {
          const k = bans[i];
          return <span key={i} className={`tc__ban${i < bans.length ? " tc__ban--done" : ""}`} onClick={() => k && onInspect({ kind: k })}>{i < bans.length ? (k ? tk.KIND[k].kanji : "空") : ""}</span>;
        })}
      </div>
      <div className="tc__label">阵容</div>
      <ul className="tc__picks">
        <li className="tc__pick tc__pick--king" onClick={() => onInspect({ kind: tk.KING })}>
          <Token piece={{ kind: tk.KING }} size={30} team={team} />
          <span><b>王将</b><small>固定 · 被将死即负</small></span>
        </li>
        {Array.from({ length: tk.PICKS_PER_SIDE }, (_, i) => {
          const k = picks[i];
          return k ? (
            <li key={i} className="tc__pick" onClick={() => onInspect({ kind: k })}>
              <Token piece={{ kind: k }} size={30} team={team} />
              <span><b>{tk.KIND[k].kanji}</b><small>{tk.KIND[k].en}</small></span>
            </li>
          ) : <li key={i} className="tc__pick tc__pick--empty">—</li>;
        })}
      </ul>
    </div>
  );
}

function History({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(true);
  if (!lines.length) return null;
  const shown = lines.slice(-14);
  return (
    <div className="hist">
      <button className="hist__h" onClick={() => setOpen((o) => !o)}>记录 {open ? "▾" : "▸"}</button>
      {open && <ul className="hist__list">{shown.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}
