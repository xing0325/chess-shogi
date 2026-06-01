import { useState } from "react";
import { Avatar, AVATAR_LIST } from "../profile/Avatar";
import "./AuthScreen.css";

type Tab = "guest" | "login" | "register";

export interface AuthScreenProps {
  error?: string;
  onGuest: (nickname: string, avatar: string) => void;
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string, nickname: string, avatar: string) => void;
}

function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="auth__avatars">
      {AVATAR_LIST.map((id) => (
        <button
          key={id}
          type="button"
          className={`auth__avatar-btn${value === id ? " auth__avatar-btn--on" : ""}`}
          onClick={() => onChange(id)}
        >
          <Avatar id={id} size={40} />
        </button>
      ))}
    </div>
  );
}

export function AuthScreen({ error, onGuest, onLogin, onRegister }: AuthScreenProps) {
  const [tab, setTab] = useState<Tab>("guest");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [nickname, setN] = useState("");
  const [avatar, setA] = useState("wK");

  const submit = () => {
    if (tab === "guest") { if (nickname.trim()) onGuest(nickname.trim(), avatar); }
    else if (tab === "login") { if (username.trim() && password) onLogin(username.trim(), password); }
    else { if (username.trim() && password && nickname.trim()) onRegister(username.trim(), password, nickname.trim(), avatar); }
  };

  return (
    <div className="auth">
      <div className="auth__tabs">
        {(["guest", "login", "register"] as Tab[]).map((t) => (
          <button key={t} className={`auth__tab${tab === t ? " auth__tab--on" : ""}`} onClick={() => setTab(t)}>
            {t === "guest" ? "游客" : t === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      <div className="auth__body" onKeyDown={(e) => { if (e.key === "Enter") submit(); }}>
        {(tab === "login" || tab === "register") && (
          <>
            <input className="auth__input" placeholder="用户名" value={username} maxLength={20} onChange={(e) => setU(e.target.value)} />
            <input className="auth__input" type="password" placeholder="密码" value={password} maxLength={40} onChange={(e) => setP(e.target.value)} />
          </>
        )}
        {(tab === "guest" || tab === "register") && (
          <>
            <input className="auth__input" placeholder="昵称(对局中显示)" value={nickname} maxLength={20} onChange={(e) => setN(e.target.value)} />
            <div className="auth__pick-label">选个头像 <Avatar id={avatar} size={28} /></div>
            <AvatarPicker value={avatar} onChange={setA} />
          </>
        )}
        {error && <p className="auth__error">{error}</p>}
        <button className="auth__submit" onClick={submit}>
          {tab === "guest" ? "以游客进入" : tab === "login" ? "登录" : "注册并进入"}
        </button>
        {tab === "register" && <p className="auth__hint">注册后可在别处用账号密码登录,沿用昵称和头像。</p>}
        {tab === "guest" && <p className="auth__hint">游客身份不保存,换设备需重新设置。</p>}
      </div>
    </div>
  );
}
