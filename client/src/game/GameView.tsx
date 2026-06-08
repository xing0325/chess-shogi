import { useEffect, useState } from "react";
import { otherSide, type Action, type GameState, type Side, type Profile } from "@cs/shared";
import { GameBoard } from "./GameBoard";
import { MoveHistory } from "./MoveHistory";
import { useHistory } from "./useHistory";
import "./GameView.css";

export interface GameViewProps {
  live: GameState;
  submit: (a: Action) => void;
  canPlay: boolean;        // 当前用户此刻有权落子(本地=true;联机=轮到我)
  resetKey: string;        // 一局标识,变化即新对局
  basePerspective?: Side;  // 默认下方一侧(联机=mySide;本地=将棋方)
  mySide?: Side;
  opponent?: Profile;
  myProfile?: Profile;
  onReset?: () => void;
  onRematch?: () => void;
  onLeave?: () => void;
  note?: string;
}

export function GameView(props: GameViewProps) {
  const { live, submit, canPlay, resetKey, basePerspective } = props;
  const hist = useHistory(live, resetKey);
  const display = hist.snaps[hist.view];
  const replay = !hist.atLatest;
  const enabled = canPlay && hist.atLatest && !live.result;

  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setFlipped(false); }, [resetKey]);
  const base = basePerspective ?? "shogi";
  const perspective = flipped ? otherSide(base) : base;

  return (
    <div className="gameview">
      <div className="gameview__main">
        <GameBoard
          state={display}
          submit={submit}
          enabled={enabled}
          perspective={perspective}
          replay={replay}
          mySide={props.mySide}
          opponent={props.opponent}
          myProfile={props.myProfile}
          onReset={props.onReset}
          onRematch={props.onRematch}
          onLeave={props.onLeave}
          note={props.note}
        />
      </div>
      <MoveHistory
        snaps={hist.snaps}
        view={hist.view}
        onSelect={hist.setView}
        onFirst={hist.first}
        onPrev={hist.prev}
        onNext={hist.next}
        onLast={hist.last}
        onFlip={() => setFlipped((f) => !f)}
      />
    </div>
  );
}
