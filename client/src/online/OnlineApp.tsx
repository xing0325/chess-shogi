import { useNet } from "../net/useNet";
import { AuthScreen } from "./AuthScreen";
import { Lobby } from "./Lobby";
import { GameView } from "../game/GameView";
import { Avatar } from "../profile/Avatar";
import "./OnlineApp.css";

export function OnlineApp() {
  const net = useNet();
  const showMe = net.profile && (net.phase === "lobby" || net.phase === "waiting");

  return (
    <div className="online">
      {net.phase === "connecting" && <p className="online__hint">连接服务器中…</p>}

      {net.phase === "auth" && (
        <AuthScreen error={net.authError} onGuest={net.guest} onLogin={net.login} onRegister={net.register} />
      )}

      {showMe && net.profile && (
        <div className="online__me">
          <Avatar id={net.profile.avatar} size={32} />
          <span className="online__me-name">{net.profile.nickname}</span>
          <button className="online__logout" onClick={net.logout}>退出登录</button>
        </div>
      )}

      {net.note && net.phase !== "game" && (
        <div className="online__note" onClick={net.clearNote}>{net.note}<span className="online__note-x">×</span></div>
      )}

      {net.incoming && (
        <div className="invite">
          <Avatar id={net.incoming.fromAvatar} size={32} />
          <span><b>{net.incoming.fromName}</b> 邀请你对战</span>
          <button className="invite__yes" onClick={net.acceptInvite}>接受</button>
          <button className="invite__no" onClick={net.declineInvite}>拒绝</button>
        </div>
      )}

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
        <GameView
          live={net.game.state}
          submit={net.submit}
          canPlay={net.enabled}
          resetKey={`online-${net.gameNonce}`}
          basePerspective={net.game.mySide}
          mySide={net.game.mySide}
          opponent={net.game.opponent}
          myProfile={net.profile ?? undefined}
          onRematch={net.rematch}
          onLeave={net.leaveRoom}
          note={net.note || undefined}
        />
      )}
    </div>
  );
}
