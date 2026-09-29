// 會員密碼雜湊與登入工作階段。新密碼用 Workers 內建 Web Crypto（PBKDF2）；
// 舊會員密碼是 MD5，用 md5.js 相容驗證，登入成功後於 pages.js 升級為 PBKDF2。
import { SESSION_DAYS } from './config.js';
import { md5 } from './md5.js';

const enc = new TextEncoder();
const PBKDF2_ITER = 100_000;

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));

// 產生亂數 token（登入 session 與各種一次性 id 共用）
export function randomToken(bytes = 32) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

// 以 PBKDF2-SHA256 雜湊密碼，格式：pbkdf2$迭代次數$salt$hash
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITER}$${toHex(salt.buffer)}$${toHex(bits)}`;
}

// 是否為需要升級的舊 MD5 密碼格式
export function isLegacyHash(stored) {
  if (!stored) return false;
  return stored.startsWith('md5$') || /^[a-f0-9]{32}$/i.test(stored);
}

// 比對密碼（時間安全比較）。支援舊 MD5（md5$hex 或純 32 hex）與新 PBKDF2。
export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (isLegacyHash(stored)) {
    const target = (stored.startsWith('md5$') ? stored.slice(4) : stored).toLowerCase();
    const got = md5(password).toLowerCase();
    if (got.length !== target.length) return false;
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ target.charCodeAt(i);
    return diff === 0;
  }
  if (!stored.startsWith('pbkdf2$')) return false;
  const [, iterStr, saltHex, hashHex] = stored.split('$');
  const salt = fromHex(saltHex);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: parseInt(iterStr, 10), hash: 'SHA-256' },
    key,
    256,
  );
  const a = toHex(bits);
  if (a.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// ─── Cookie 工具 ────────────────────────────────────────
export function parseCookies(req) {
  const out = {};
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, secure = true } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  if (secure) c += '; Secure';
  if (maxAge != null) c += `; Max-Age=${maxAge}`;
  return c;
}

const SESSION_COOKIE = 'eros_sid';

// 建立 session 並回傳要 Set-Cookie 的字串
export async function createSession(env, memberId, ua = '') {
  const id = randomToken();
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86400_000;
  await env.DB.prepare(
    'INSERT INTO sessions (id, member_id, created_at, expires_at, ua) VALUES (?1,?2,?3,?4,?5)',
  ).bind(id, memberId, now, expires, ua.slice(0, 200)).run();
  await env.DB.prepare('UPDATE members SET last_login_at=?1 WHERE id=?2').bind(now, memberId).run();
  return cookie(SESSION_COOKIE, id, { maxAge: SESSION_DAYS * 86400 });
}

// 讀取目前登入會員（找不到回 null）
export async function currentMember(req, env) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id
     WHERE s.id = ?1 AND s.expires_at > ?2 AND m.status = 1`,
  ).bind(sid, Date.now()).first();
  return row || null;
}

export async function destroySession(req, env) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (sid) await env.DB.prepare('DELETE FROM sessions WHERE id=?1').bind(sid).run();
  return cookie(SESSION_COOKIE, '', { maxAge: 0 });
}

// 後台驗證：ADMIN_TOKEN 相符（query token 或 cookie）
export function isAdmin(req, env, url) {
  const token = env.ADMIN_TOKEN;
  if (!token) return false;
  const given = url.searchParams.get('token') || parseCookies(req)['eros_admin'];
  return given === token;
}
