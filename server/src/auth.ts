import fs from "node:fs";
import path from "node:path";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { isValidAvatar, DEFAULT_AVATAR, type Profile, type AuthResult } from "@cs/shared";

interface UserRecord {
  username: string;
  salt: string;
  hash: string;
  nickname: string;
  avatar: string;
}

const SECRET = process.env.AUTH_SECRET || "dev-secret-chess-shogi";

function hashPassword(pw: string, salt = randomBytes(16).toString("hex")): { salt: string; hash: string } {
  return { salt, hash: scryptSync(pw, salt, 64).toString("hex") };
}
function verifyPassword(pw: string, salt: string, hash: string): boolean {
  const h = scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return h.length === expected.length && timingSafeEqual(h, expected);
}
function signToken(username: string): string {
  const sig = createHmac("sha256", SECRET).update(username).digest("hex");
  return `${Buffer.from(username).toString("base64url")}.${sig}`;
}
function verifyToken(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  let username: string;
  try { username = Buffer.from(b64, "base64url").toString("utf8"); } catch { return null; }
  const expected = createHmac("sha256", SECRET).update(username).digest("hex");
  if (sig.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? username : null;
}

function cleanNick(s: unknown, fallback: string): string {
  const t = typeof s === "string" ? s.trim() : "";
  return (t || fallback).slice(0, 20);
}
function cleanAvatar(a: unknown): string {
  return typeof a === "string" && isValidAvatar(a) ? a : DEFAULT_AVATAR;
}

export class AuthStore {
  private users = new Map<string, UserRecord>();
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "accounts.json");
    this.load();
  }
  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const arr = JSON.parse(fs.readFileSync(this.file, "utf8")) as UserRecord[];
        for (const u of arr) this.users.set(u.username, u);
      }
    } catch { /* 起步空库即可 */ }
  }
  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify([...this.users.values()], null, 2));
    } catch { /* 持久化失败不致命 */ }
  }

  register(username: string, password: string, nickname: string, avatar: string): AuthResult {
    const u = typeof username === "string" ? username.trim() : "";
    if (u.length < 3 || u.length > 20) return { ok: false, error: "用户名需 3–20 个字符" };
    if (typeof password !== "string" || password.length < 4) return { ok: false, error: "密码至少 4 位" };
    if (this.users.has(u)) return { ok: false, error: "用户名已被占用" };
    const { salt, hash } = hashPassword(password);
    const rec: UserRecord = { username: u, salt, hash, nickname: cleanNick(nickname, u), avatar: cleanAvatar(avatar) };
    this.users.set(u, rec);
    this.save();
    return { ok: true, token: signToken(u), profile: { nickname: rec.nickname, avatar: rec.avatar } };
  }

  login(username: string, password: string): AuthResult {
    const rec = this.users.get(typeof username === "string" ? username.trim() : "");
    if (!rec || !verifyPassword(typeof password === "string" ? password : "", rec.salt, rec.hash)) {
      return { ok: false, error: "用户名或密码错误" };
    }
    return { ok: true, token: signToken(rec.username), profile: { nickname: rec.nickname, avatar: rec.avatar } };
  }

  resume(token: string): AuthResult {
    const username = verifyToken(typeof token === "string" ? token : "");
    const rec = username ? this.users.get(username) : null;
    if (!rec) return { ok: false, error: "登录已失效" };
    return { ok: true, token, profile: { nickname: rec.nickname, avatar: rec.avatar } };
  }

  updateProfile(username: string, nickname: string, avatar: string): Profile | null {
    const rec = this.users.get(username);
    if (!rec) return null;
    rec.nickname = cleanNick(nickname, rec.username);
    rec.avatar = cleanAvatar(avatar);
    this.save();
    return { nickname: rec.nickname, avatar: rec.avatar };
  }

  // 游客:不落库,仅整理出合法 profile
  static guestProfile(nickname: string, avatar: string): Profile {
    return { nickname: cleanNick(nickname, "游客"), avatar: cleanAvatar(avatar) };
  }
  // 暴露用户名解析(联机层校验 token)
  usernameFromToken(token: string): string | null { return verifyToken(token); }
}
