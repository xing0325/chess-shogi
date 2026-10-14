import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { tk, type Profile } from "@cs/shared";
import { PieceCard, PieceDetail, Token, type CardState } from "./PieceUI";
import { DraftBoard, type HandSpec } from "./DraftBoard";
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

  // 布阵像打入一样:玩家自己从驹台挑棋子、挑位置;每布完一枚清空选择,不替玩家预选
  const placeSide = d.phase === "place" ? d.placeTurn : undefined;
  useEffect(() => { setPlaceKind(null); }, [d.phase, d.placeTurn, d.toPlace.sente.length, d.toPlace.gote.length]);
  const blockedFor = (side: tk.TSide) => (k: string): string | null =>
    k !== tk.KING && d.toPlace[side].includes(tk.KING) ? "第一枚必须布王将"
      : tk.placeSquares(d, side, k).length === 0 ? "现在放哪都会将军,先布别的棋子" : null;
  const handFor = (side: tk.TSide): HandSpec => ({
    side,
    kinds: d.toPlace[side],
    active: d.phase === "place" && !d.game.result && d.placeTurn === side && (mySide === null || mySide === side),
    blocked: blockedFor(side),
  });
  const other: tk.TSide = perspective === "sente" ? "gote" : "sente";
  const hands = d.phase === "place" ? { top: handFor(other), bottom: handFor(perspective) } : undefined;
  const placeableFor = useMemo(() => (k: string) => (placeSide ? tk.placeSquares(d, placeSide, k) : []), [d, placeSide]);
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

  const focusKind = focus?.kind;
  const lockLabel = step?.act === "ban" ? "禁用" : "选择";
  const canLock = d.phase === "draft" && myTurn && !!focusKind && avail.has(focusKind);

  return (
    <div className="dv">
      <SideGlow team={result ? null : actor ? tk.teamOf(actor) : null} />
      <div className="dv__top">
        <span className="dv__note">{props.note}</span>
        <PhaseBanner d={d} mySide={mySide} myTurn={myTurn} secs={secs} />
        <div className="dv__tools">
          {props.onReset && <button className="game__btn" onClick={props.onReset}>重新开始</button>}
          {!result && props.onResign && <button className="game__btn" onClick={props.onResign}>认输</button>}
          {result && props.onRematch && <button className="game__btn game__btn--accent" onClick={props.onRematch}>{props.rematchAsked ? "同意再来一局" : "再来一局"}</button>}
          {props.onLeave && <button className="game__btn" onClick={props.onLeave}>离开</button>}
        </div>
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
                phase={result ? "view" : d.phase === "place" ? "place" : "play"}
                hands={hands}
                placeKind={placeKind}
                onPickHand={(k) => { setPlaceKind(k); if (k) setFocus({ kind: k }); }}
                placeableFor={placeableFor}
                onPlace={(kind, at) => onAction({ type: "place", kind, at })}
                legal={legal}
                onMove={(m) => onAction({ type: "move", move: { from: m.from, to: m.to, ...(m.via ? { via: m.via } : {}), ...(m.promote ? { promote: true } : {}) } })}
                onInspect={(p) => setFocus({ kind: p.kind, from: p.from })}
              />
              {d.phase === "place" && myTurn && placeSide && !placeKind && (
                <div className="dv__placehint">
                  {d.toPlace[placeSide].includes(tk.KING) ? "先把王将从驹台拖到棋盘上" : "从驹台挑一枚棋子,拖到己方底部两行(或点一下棋子再点格子)"}
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

/** 当前阶段在 BP 顺序里属于第几段(禁 → 选 → 禁 → 选),用来在换段时重放入场动画 */
function segmentOf(step: number): number {
  let seg = 0;
  for (let i = 1; i <= step && i < tk.DRAFT_ORDER.length; i++) if (tk.DRAFT_ORDER[i].act !== tk.DRAFT_ORDER[i - 1].act) seg++;
  return seg;
}

function PhaseBanner({ d, mySide, myTurn, secs }: { d: tk.DraftState; mySide: tk.TSide | null; myTurn: boolean; secs: number | null }) {
  const result = d.game.result;
  const step = tk.currentStep(d);
  const actor = tk.actor(d);
  const team = actor ? tk.teamOf(actor) : null;
  const you = mySide && !result ? (myTurn ? " · 你的回合" : " · 等待对手") : "";
  let kind: string, title: string, sub: string, key: string;
  if (result) {
    const w = result.kind === "draw" ? null : tk.teamOf(result.winner);
    kind = w ?? "draw"; title = w ? `${TEAM_NAME[w]}胜利` : "和棋"; sub = REASON[result.reason]; key = "result";
  } else if (d.phase === "draft" && step) {
    kind = step.act; title = step.act === "ban" ? "禁用阶段" : "选择阶段";
    sub = `${TEAM_NAME[step.team]}${step.act === "ban" ? "禁用" : "选择"} · 第 ${d.step + 1} / ${tk.DRAFT_ORDER.length} 步${you}`;
    key = `draft-${segmentOf(d.step)}`;
  } else if (d.phase === "place") {
    kind = "place"; title = "布阵阶段"; sub = `${TEAM_NAME[tk.teamOf(d.placeTurn)]}布阵 · 己方底部两行 · 开局不能形成将军${you}`; key = "place";
  } else {
    kind = "play"; title = "对局阶段"; sub = `轮到${TEAM_NAME[tk.teamOf(d.game.turn)]}${tk.inCheck(d.game) ? " · 被将军!" : ""}${you}`; key = "play";
  }
  return (
    <div key={key} className={`pb pb--${kind}`} role="status" aria-live="polite">
      <div className="pb__row">
        <span className="pb__line pb__line--l" />
        <span className="pb__glow"><span className="pb__title">{title}</span></span>
        <span className="pb__line pb__line--r" />
      </div>
      <div className={`pb__sub${team && !result ? ` pb__sub--${team}` : ""}`}>
        <span>{sub}</span>
        {secs !== null && !result && <span className={`pb__timer${secs <= 5 ? " pb__timer--low" : ""}`}>{secs}s</span>}
      </div>
    </div>
  );
}

/** 轮到哪一方,哪半边屏幕亮起对应颜色的光(渲染到 body,避免被容器查询的包含块截住) */
function SideGlow({ team }: { team: Team | null }) {
  return createPortal(
    <>
      <div className={`sglow sglow--blue${team === "blue" ? " sglow--on" : ""}`} aria-hidden />
      <div className={`sglow sglow--red${team === "red" ? " sglow--on" : ""}`} aria-hidden />
    </>,
    document.body,
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
