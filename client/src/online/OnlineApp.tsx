import { useNet } from "../net/useNet";
import { Lobby } from "./Lobby";
import { GameBoard } from "../game/GameBoard";
import "./OnlineApp.css";

export function OnlineApp({ name }: { name: string }) {
  const net = useNet(name);

  return (
    <div className="online">
      {net.note && net.phase !== "game" && (
        <div className="online__note" onClick={net.clearNote}>{net.note}<span className="online__note-x">×</span></div>
      )}
      {net.incoming && (
        <div className="invite">
          <span><b>{net.incoming.fromName}</b> 邀请你对战</span>
          <button className="invite__yes" onClick={net.acceptInvite}>接受</button>
          <button className="invite__no" onClick={net.declineInvite}>拒绝</button>
        </div>
      )}

      {net.phase === "connecting" && <p className="online__hint">连接服务器中…</p>}

      {net.phase === "lobby" && (
        <Lobby myId={net.myId} lobby={net.lobby} onCreate={net.createRoom} onJoin={net.joinRoom} onInvite={net.invitePlayer} />
      )}

      {net.phase === "waiting" && (
        <div className="online__wait">
          <div className="online__spinner" />
          <p>等待对手加入你的房间…</p>
          <button className="game__btn" onClick={net.cancelWaiting}>取消</button>
        </div>
      )}

      {net.phase === "game" && net.game && (
        <GameBoard
          state={net.game.state}
          submit={net.submit}
          enabled={net.enabled}
          mySide={net.game.mySide}
          opponentName={net.game.opponentName}
          onRematch={net.rematch}
          onLeave={net.leaveRoom}
          note={net.note || undefined}
        />
      )}
    </div>
  );
}
