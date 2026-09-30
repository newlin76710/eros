// 離線端到端測試：用 node:sqlite 當 D1，直接呼叫 Worker 的 fetch handler。
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './src/index.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('./schema.sql', 'utf8'));
db.exec(readFileSync('./seed.sql', 'utf8'));

// 把 D1 的 ?N 佔位轉成 node:sqlite 的具名參數（支援同一參數重複使用，如 ?6,?6）
function toNamed(sql) {
  return sql.replace(/\?(\d+)/g, (_, n) => `:p${n}`);
}
const D1 = {
  prepare(sql) {
    const named = toNamed(sql);
    let params = {};
    const bindObj = (args) => { const o = {}; args.forEach((v, i) => { o[`p${i + 1}`] = v === undefined ? null : v; }); return o; };
    const api = {
      bind(...args) { params = bindObj(args); return api; },
      async all() { const st = db.prepare(named); return { results: st.all(params) }; },
      async first() { const st = db.prepare(named); const r = st.get(params); return r ?? null; },
      async run() { const st = db.prepare(named); const info = st.run(params); return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } }; },
    };
    return api;
  },
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
};

const env = {
  DB: D1, ADMIN_TOKEN: 'test-token', SESSION_SECRET: 's',
  SITE_NAME: 'eros 主題派對', SITE_TAGLINE: '意想不到的主題活動',
  SITE_URL: 'http://localhost', BLOG_URL: 'https://blog-eros.ek21.com',
  CONTACT_EMAIL: 'eros@ek21.com', CONTACT_LINE: 'https://line.me/x', CONTACT_FB: 'https://fb.com/x',
};

const cookies = {};
function saveCookies(res) {
  for (const [k, v] of res.headers) {
    if (k.toLowerCase() === 'set-cookie') {
      const m = v.match(/^([^=]+)=([^;]*)/); if (m) cookies[m[1]] = m[2];
    }
  }
}
const cookieHeader = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

async function req(method, path, { form, json, useCookie = true } = {}) {
  const headers = { 'user-agent': 'harness' };
  let body;
  if (form) { body = new URLSearchParams(form).toString(); headers['content-type'] = 'application/x-www-form-urlencoded'; }
  if (json) { body = JSON.stringify(json); headers['content-type'] = 'application/json'; }
  if (useCookie && Object.keys(cookies).length) headers['cookie'] = cookieHeader();
  const r = await worker.fetch(new Request('http://localhost' + path, { method, headers, body, redirect: 'manual' }), env, {});
  saveCookies(r);
  const text = await r.text();
  return { status: r.status, text, loc: r.headers.get('location') };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };

console.log('GET 頁面：');
let r = await req('GET', '/');
ok('首頁 200', r.status === 200, r.status);
ok('首頁含活動卡', r.text.includes('ecard') && r.text.includes('攝影聯誼'), '');
ok('首頁含統計 103,387', r.text.includes('103,387'));
r = await req('GET', '/event');
ok('活動列表 200 且含 6 筆', r.status === 200 && (r.text.match(/ecard/g) || []).length >= 6);
r = await req('GET', '/event?cat=craft');
ok('分類篩選 craft（手作）', r.status === 200 && r.text.includes('手作乾燥花') && !r.text.includes('電玩派對'));
r = await req('GET', '/event/one/3');
ok('活動詳情 200', r.status === 200 && r.text.includes('電玩派對聯誼'));
r = await req('GET', '/event/one/99999');
ok('不存在活動 404', r.status === 404);
r = await req('GET', '/wish');
ok('許願頁 200', r.status === 200 && r.text.includes('活動許願池'));
r = await req('GET', '/contact');
ok('聯絡頁 200', r.status === 200 && r.text.includes('eros@ek21.com'));
r = await req('GET', '/user/condition');
ok('條款頁 200', r.status === 200 && r.text.includes('隱私權'));
r = await req('GET', '/sitemap.xml');
ok('sitemap', r.status === 200 && r.text.includes('/event/one/'));

console.log('\n會員流程：');
r = await req('POST', '/user/register', { form: { name: '測試員', email: 'Test@Example.com', phone: '0912345678', gender: 'M', password: 'secret123', agree: '1' } });
ok('註冊成功導向', r.status === 302, r.status + ' ' + r.text.slice(0, 120));
ok('註冊後拿到登入 cookie', !!cookies['eros_sid']);
r = await req('GET', '/');
ok('登入後首頁顯示暱稱', r.text.includes('測試員'));
r = await req('POST', '/user/register', { form: { name: 'x', email: 'test@example.com', password: 'secret123', agree: '1' }, useCookie: false });
ok('重複 email 擋下', r.text.includes('註冊') && !r.text.includes('eros_sid'));
// 登出
delete cookies.eros_sid;
r = await req('POST', '/user/login', { form: { email: 'test@example.com', password: 'secret123' } });
ok('登入成功導向', r.status === 302);
ok('登入拿到 cookie', !!cookies['eros_sid']);
r = await req('POST', '/user/login', { form: { email: 'test@example.com', password: 'WRONG' }, useCookie: false });
ok('錯誤密碼被拒', r.text.includes('登入失敗'));

console.log('\n舊 MD5 會員相容登入 + 升級：');
// 直接塞一個 MD5 舊會員（密碼 abc → md5）
db.prepare(`INSERT INTO members (email,name,password_hash,source,status,created_at,updated_at) VALUES (:e,:n,:p,'legacy',1,0,0)`)
  .run({ e: 'old@ex.com', n: '老會員', p: 'md5$900150983cd24fb0d6963f7d28e17f72' });
const before = db.prepare('SELECT password_hash FROM members WHERE email=?').get('old@ex.com').password_hash;
delete cookies.eros_sid;
r = await req('POST', '/user/login', { form: { email: 'old@ex.com', password: 'abc' } });
ok('舊 MD5 密碼可登入', r.status === 302 && !!cookies['eros_sid']);
const after = db.prepare('SELECT password_hash FROM members WHERE email=?').get('old@ex.com').password_hash;
ok('登入後升級為 PBKDF2', after.startsWith('pbkdf2$') && before.startsWith('md5$'));

console.log('\n報名 / 許願：');
r = await req('POST', '/event/join', { form: { event_id: '3', name: '報名人', email: 'j@ex.com', phone: '0900' } });
ok('報名導向', r.status === 302 && r.loc.includes('joined=1'));
ok('報名寫入 DB', db.prepare('SELECT COUNT(*) n FROM registrations').get().n >= 1);
r = await req('POST', '/wish', { form: { content: '想要調酒體驗課', name: '許願人' } });
ok('許願導向 ok', r.status === 302 && r.loc.includes('ok=1'));
ok('許願寫入 DB', db.prepare('SELECT COUNT(*) n FROM wishes').get().n >= 1);

console.log('\n登入後狀態 / 會員報名：');
// 此時 cookie 為已登入的「老會員」
r = await req('GET', '/');
ok('登入後導覽列顯示登出、不顯示註冊', r.text.includes('/user/logout') && !r.text.includes('免費註冊'));
{
  const res = await worker.fetch(new Request('http://localhost/', { headers: { cookie: cookieHeader() } }), env, {});
  ok('頁面不可被快取（private, no-store）', res.headers.get('cache-control') === 'private, no-store', res.headers.get('cache-control'));
}
r = await req('GET', '/event/one/3?joined=1');
ok('報名成功訊息', r.text.includes('報名成功'));
ok('已報名顯示取消按鈕', r.text.includes('你已報名此活動') && r.text.includes('/event/cancel'));
r = await req('POST', '/event/join', { form: { event_id: '3' } });
ok('重複報名擋下', r.loc.includes('joined=dup'));
ok('同會員同活動只有一筆', db.prepare(`SELECT COUNT(*) n FROM registrations r JOIN members m ON m.id=r.member_id WHERE m.email='old@ex.com' AND r.event_id=3 AND r.status=1`).get().n === 1);
r = await req('GET', '/user/events');
ok('我的活動列出已報名活動', r.status === 200 && r.text.includes('/event/one/3'));
r = await req('POST', '/event/cancel', { form: { event_id: '3' } });
ok('取消報名導向', r.loc.includes('joined=cancel'));
r = await req('GET', '/user/events');
ok('取消後我的活動變空', !r.text.includes('/event/one/3'));
r = await req('GET', '/user/events', { useCookie: false });
ok('未登入看我的活動導回登入', r.status === 302);

console.log('\n後台 + 匯入 API：');
r = await req('GET', '/admin', { useCookie: false });
ok('後台無 token 擋下 401', r.status === 401);
r = await req('GET', '/admin?token=test-token', { useCookie: false });
ok('後台有 token 200', r.status === 200 && r.text.includes('儀表板'));
r = await req('GET', '/admin/members?token=test-token', { useCookie: false });
ok('會員清單 200', r.status === 200 && r.text.includes('測試員'));
r = await req('POST', '/admin/import?token=test-token', { json: { table: 'members', rows: [{ legacy_id: 5, email: 'imp@ex.com', name: '匯入員', password_hash: 'md5$900150983cd24fb0d6963f7d28e17f72', gender: 'F', status: 1 }] }, useCookie: false });
ok('匯入 API 成功', r.status === 200 && JSON.parse(r.text).inserted === 1, r.text);
ok('匯入資料進 DB', db.prepare('SELECT COUNT(*) n FROM members WHERE email=?').get('imp@ex.com').n === 1);
r = await req('POST', '/admin/import?token=test-token', { json: { table: 'events', rows: [{ legacy_id: 100, title: '匯入活動', category: 'game', status: 1 }], truncate: false }, useCookie: false });
ok('活動匯入成功', r.status === 200 && JSON.parse(r.text).inserted === 1, r.text);

// ── 專題文章 ──
console.log('\n專題文章：');
db.prepare(`INSERT INTO articles (legacy_id,title,category,excerpt,content,cover,published_at,status,created_at,updated_at) VALUES (11,'測試好文','loveblog','摘要','<p>內文<img src="/media/blog/x.jpg"></p>','/media/blog/c.jpg',1700000000000,1,0,0)`).run();
let ra = await req('GET','/article');
ok('文章列表 200 且顯示標題', ra.status===200 && ra.text.includes('測試好文') && ra.text.includes('專欄文章'));
ra = await req('GET','/article/'+db.prepare('SELECT id FROM articles LIMIT 1').get().id);
ok('文章內頁 200 顯示內文', ra.status===200 && ra.text.includes('/media/blog/x.jpg'));
ra = await req('GET','/article?cat=news');
ok('文章分類篩選', ra.status===200 && !ra.text.includes('測試好文'));

console.log('\n活動自動配圖：');
db.prepare(`INSERT INTO articles (legacy_id,title,category,excerpt,content,cover,published_at,status,created_at,updated_at) VALUES (12,'手作香氛蠟燭花絮','blooper','大家一起做乾燥花蠟燭','','/media/blog/candle.jpg',1700000000000,1,0,0)`).run();
db.prepare(`INSERT INTO articles (legacy_id,title,category,excerpt,content,cover,published_at,status,created_at,updated_at) VALUES (13,'保齡球競賽','blooper','保齡球PK','','/media/blog/bowling.jpg',1700000000000,1,0,0)`).run();
ra = await req('POST', '/admin/event/save?token=test-token', { form: { title: '夏日手作乾燥花香蠟燭', category: 'craft', status: '1' }, useCookie: false });
ok('沒填主圖自動配到最接近的圖', db.prepare(`SELECT image FROM events WHERE title='夏日手作乾燥花香蠟燭'`).get()?.image === '/media/blog/candle.jpg',
  db.prepare(`SELECT image FROM events WHERE title='夏日手作乾燥花香蠟燭'`).get()?.image);
ra = await req('POST', '/admin/event/save?token=test-token', { form: { title: '保齡球大賽', category: 'game', status: '1', image: 'https://x/y.jpg' }, useCookie: false });
ok('有填主圖則不覆蓋', db.prepare(`SELECT image FROM events WHERE title='保齡球大賽'`).get()?.image === 'https://x/y.jpg');
ra = await req('POST','/admin/import?token=test-token',{json:{table:'articles',rows:[{legacy_id:22,title:'匯入文','category:':'news',category:'news',status:1,content:'<p>hi</p>'}]},useCookie:false});
ok('文章匯入 API', ra.status===200 && JSON.parse(ra.text).inserted===1, ra.text);


// ── Facebook 登入導向 ──
console.log('\nFacebook 登入：');
env.FB_APP_ID='123456';
{
let rf = await req('GET','/user/fb_login',{useCookie:false});
ok('fb_login 導向 facebook', rf.status===302 && rf.loc && rf.loc.startsWith('https://www.facebook.com/') && rf.loc.includes('client_id=123456'));
ok('fb_login 設 state cookie', !!cookies['eros_fbstate']);
let rc = await req('GET','/user/fb_callback?error=access_denied');
ok('callback 取消授權有提示', rc.status===200 && rc.text.includes('取消'));
rc = await req('GET','/user/fb_callback?code=x&state=badstate',{useCookie:false});
ok('callback state 不符擋下', rc.text.includes('state 不符'));
}

console.log(`\n結果：${pass} 通過，${fail} 失敗`);
process.exit(fail ? 1 : 0);
