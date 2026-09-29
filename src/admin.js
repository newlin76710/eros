// 後台：儀表板、活動管理、會員清單、報名/許願清單、舊資料匯入 API。
// 驗證：需 ADMIN_TOKEN（?token=xxx 首次帶入後寫進 cookie eros_admin）。
import { REAL_CATEGORIES, categoryName } from './config.js';
import { esc } from './render.js';
import { isAdmin, cookie } from './auth.js';

const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

// 後台共用版型（與前台分離，走簡潔管理風）
function adminLayout(title, body, token) {
  const nav = [
    ['/admin', '儀表板'], ['/admin/events', '活動管理'], ['/admin/members', '會員'],
    ['/admin/regs', '報名'], ['/admin/wishes', '許願池'],
  ].map(([h, n]) => `<a href="${h}?token=${encodeURIComponent(token)}">${n}</a>`).join('');
  return new Response(`<!doctype html><html lang="zh-Hant-TW"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} - eros 後台</title>
<style>
*{box-sizing:border-box}body{margin:0;font:15px/1.6 "Noto Sans TC",system-ui,sans-serif;background:#f4f5f7;color:#222}
header{background:#1d1420;color:#fff;padding:0 20px;display:flex;align-items:center;gap:18px;height:56px;position:sticky;top:0;z-index:5}
header b{color:#ff2e88;font-size:20px;font-weight:900}
header nav{display:flex;gap:16px;flex-wrap:wrap}header nav a{color:#ddd;text-decoration:none;font-weight:600}header nav a:hover{color:#ff2e88}
.wrap{max-width:1100px;margin:24px auto;padding:0 20px}
h1{font-size:24px;margin:0 0 18px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:26px}
.c{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.c b{display:block;font-size:32px;color:#ff2e88}.c span{color:#666}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #eee;font-size:14px}th{background:#faf0f5;color:#c2185b}
tr:hover td{background:#fafafa}
a.btn,button.btn{display:inline-block;background:#ff2e88;color:#fff;border:0;padding:8px 18px;border-radius:8px;font:inherit;font-weight:700;cursor:pointer;text-decoration:none}
a.btn.sm{padding:4px 12px;font-size:13px}
a.gray{color:#666;text-decoration:none}
form.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08);max-width:760px}
label{display:block;font-weight:600;margin:12px 0 4px}
input,select,textarea{width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:8px;font:inherit}
.row{display:flex;gap:14px}.row>div{flex:1}
.pg{display:flex;gap:10px;margin:18px 0}.pg a{padding:7px 16px;background:#fff;border-radius:8px;text-decoration:none;color:#c2185b;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.tip{background:#fff8fb;border:1px solid #ffd9e8;border-radius:10px;padding:14px 16px;color:#a3416a;font-size:14px;margin-bottom:18px}
code{background:#2d2030;color:#ffb3d1;padding:2px 6px;border-radius:4px}
</style></head><body>
<header><b>eros</b><nav>${nav}</nav></header>
<div class="wrap"><h1>${esc(title)}</h1>${body}</div>
</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

const need = () => new Response('需要有效的 admin token：/admin?token=你的ADMIN_TOKEN', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

// ─── 匯入 API 的欄位白名單 ─────────────────────────────
const MEMBER_COLS = ['legacy_id', 'email', 'name', 'phone', 'password_hash', 'fb_account', 'gender', 'birth', 'city', 'zone', 'address', 'education', 'job_category', 'job_title', 'height', 'weight', 'intro', 'avatar', 'source', 'location', 'contact_status', 'is_vip', 'status', 'created_at', 'updated_at'];
const EVENT_COLS = ['legacy_id', 'title', 'category', 'is_vip', 'date_text', 'event_date', 'time_text', 'city', 'address', 'price_m', 'price_f', 'limit_m', 'limit_f', 'summary', 'intro', 'schedule', 'notice', 'notice2', 'image', 'images', 'video', 'status', 'created_at', 'updated_at'];

async function importRows(env, table, rows) {
  const now = Date.now();
  const cols = table === 'members' ? MEMBER_COLS : EVENT_COLS;
  const orIgnore = table === 'members'; // members 以 email unique 擋重複；events 事前 truncate
  const stmts = [];
  for (const r of rows) {
    const use = cols.filter((c) => r[c] !== undefined);
    if (!use.includes('created_at')) { r.created_at = now; use.push('created_at'); }
    if (!use.includes('updated_at')) { r.updated_at = now; use.push('updated_at'); }
    const ph = use.map((_, i) => `?${i + 1}`).join(',');
    const sql = `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO ${table} (${use.join(',')}) VALUES (${ph})`;
    stmts.push(env.DB.prepare(sql).bind(...use.map((c) => r[c])));
  }
  let done = 0;
  for (let i = 0; i < stmts.length; i += 50) {
    await env.DB.batch(stmts.slice(i, i + 50));
    done += Math.min(50, stmts.length - i);
  }
  return done;
}

export async function handleAdmin(env, req, url) {
  const path = url.pathname;

  // 匯入 API：POST /admin/import  {table, rows:[...], truncate?}
  if (path === '/admin/import') {
    if (!isAdmin(req, env, url)) return json({ error: 'unauthorized' }, 401);
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    let payload;
    try { payload = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const { table, rows, truncate } = payload || {};
    if (!['members', 'events'].includes(table) || !Array.isArray(rows)) return json({ error: 'need {table:members|events, rows:[]}' }, 400);
    try {
      if (truncate) await env.DB.prepare(`DELETE FROM ${table}`).run();
      const n = await importRows(env, table, rows);
      return json({ ok: true, table, inserted: n });
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }

  if (!isAdmin(req, env, url)) return need();
  const token = env.ADMIN_TOKEN;
  const setCookie = { 'set-cookie': cookie('eros_admin', token, { maxAge: 86400 }) };

  // 活動：儲存
  if (path === '/admin/event/save' && req.method === 'POST') {
    const f = await req.formData();
    const id = f.get('id');
    const now = Date.now();
    const fields = {
      title: f.get('title') || '', category: f.get('category') || 'other',
      is_vip: f.get('is_vip') ? 1 : 0, date_text: f.get('date_text') || '',
      event_date: f.get('event_date') || null, city: f.get('city') || '',
      price_m: parseInt(f.get('price_m') || '0', 10) || 0, price_f: parseInt(f.get('price_f') || '0', 10) || 0,
      summary: f.get('summary') || '', intro: f.get('intro') || '', notice: f.get('notice') || '',
      image: f.get('image') || '', status: f.get('status') ? 1 : 0,
    };
    if (id) {
      await env.DB.prepare(`UPDATE events SET title=?1,category=?2,is_vip=?3,date_text=?4,event_date=?5,city=?6,price_m=?7,price_f=?8,summary=?9,intro=?10,notice=?11,image=?12,status=?13,updated_at=?14 WHERE id=?15`)
        .bind(fields.title, fields.category, fields.is_vip, fields.date_text, fields.event_date, fields.city, fields.price_m, fields.price_f, fields.summary, fields.intro, fields.notice, fields.image, fields.status, now, id).run();
    } else {
      await env.DB.prepare(`INSERT INTO events (title,category,is_vip,date_text,event_date,city,price_m,price_f,summary,intro,notice,image,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)`)
        .bind(fields.title, fields.category, fields.is_vip, fields.date_text, fields.event_date, fields.city, fields.price_m, fields.price_f, fields.summary, fields.intro, fields.notice, fields.image, fields.status, now).run();
    }
    return new Response(null, { status: 302, headers: { location: `/admin/events?token=${encodeURIComponent(token)}`, ...setCookie } });
  }

  // 活動：刪除
  if (path === '/admin/event/delete') {
    const id = url.searchParams.get('id');
    if (id) await env.DB.prepare('DELETE FROM events WHERE id=?1').bind(id).run();
    return new Response(null, { status: 302, headers: { location: `/admin/events?token=${encodeURIComponent(token)}`, ...setCookie } });
  }

  // 活動：新增/編輯表單
  if (path === '/admin/event/edit') {
    const id = url.searchParams.get('id');
    const e = id ? await first(env, 'SELECT * FROM events WHERE id=?1', id) : {};
    const catOpts = REAL_CATEGORIES.map((c) => `<option value="${c.slug}"${e.category === c.slug ? ' selected' : ''}>${c.name}</option>`).join('');
    const body = `<form class="card" method="post" action="/admin/event/save?token=${encodeURIComponent(token)}">
      ${id ? `<input type="hidden" name="id" value="${id}">` : ''}
      <label>活動名稱</label><input name="title" value="${esc(e.title || '')}" required>
      <div class="row">
        <div><label>分類</label><select name="category">${catOpts}</select></div>
        <div><label>地點</label><input name="city" value="${esc(e.city || '')}"></div>
      </div>
      <div class="row">
        <div><label>日期文字（顯示）</label><input name="date_text" value="${esc(e.date_text || '')}" placeholder="2026/01/01 (六)"></div>
        <div><label>日期（排序 YYYY-MM-DD）</label><input name="event_date" value="${esc(e.event_date || '')}" placeholder="2026-01-01"></div>
      </div>
      <div class="row">
        <div><label>男生費用</label><input type="number" name="price_m" value="${e.price_m || 0}"></div>
        <div><label>女生費用</label><input type="number" name="price_f" value="${e.price_f || 0}"></div>
      </div>
      <label>主圖 URL</label><input name="image" value="${esc(e.image || '')}" placeholder="https://...">
      <label>摘要</label><textarea name="summary" rows="2">${esc(e.summary || '')}</textarea>
      <label>活動內容（可用 HTML）</label><textarea name="intro" rows="6">${esc(e.intro || '')}</textarea>
      <label>注意事項（可用 HTML）</label><textarea name="notice" rows="4">${esc(e.notice || '')}</textarea>
      <div class="row">
        <div><label><input type="checkbox" name="is_vip" value="1" style="width:auto"${e.is_vip ? ' checked' : ''}> VIP 限定</label></div>
        <div><label><input type="checkbox" name="status" value="1" style="width:auto"${e.status !== 0 ? ' checked' : ''}> 上架</label></div>
      </div>
      <div style="margin-top:18px"><button class="btn">儲存</button> <a class="gray" href="/admin/events?token=${encodeURIComponent(token)}">取消</a></div>
    </form>`;
    const res = adminLayout(id ? '編輯活動' : '新增活動', body, token);
    res.headers.append('set-cookie', setCookie['set-cookie']);
    return res;
  }

  // 活動清單
  if (path === '/admin/events') {
    const rows = await all(env, 'SELECT id,title,category,is_vip,city,date_text,status FROM events ORDER BY id DESC LIMIT 300');
    const trs = rows.map((e) => `<tr>
      <td>${e.id}</td><td>${esc(e.title)}</td><td>${esc(categoryName(e.category))}${e.is_vip ? ' 👑' : ''}</td>
      <td>${esc(e.city || '')}</td><td>${esc(e.date_text || '')}</td><td>${e.status ? '上架' : '下架'}</td>
      <td><a class="gray" href="/admin/event/edit?id=${e.id}&token=${encodeURIComponent(token)}">編輯</a> ·
      <a class="gray" href="/admin/event/delete?id=${e.id}&token=${encodeURIComponent(token)}" onclick="return confirm('確定刪除？')">刪除</a></td>
    </tr>`).join('');
    const body = `<p><a class="btn" href="/admin/event/edit?token=${encodeURIComponent(token)}">+ 新增活動</a></p>
      <table><tr><th>ID</th><th>名稱</th><th>分類</th><th>地點</th><th>日期</th><th>狀態</th><th></th></tr>${trs || '<tr><td colspan=7>尚無活動</td></tr>'}</table>`;
    const res = adminLayout('活動管理', body, token);
    res.headers.append('set-cookie', setCookie['set-cookie']);
    return res;
  }

  // 會員清單
  if (path === '/admin/members') {
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const per = 50;
    const where = q ? `WHERE email LIKE ?1 OR name LIKE ?1 OR phone LIKE ?1` : '';
    const args = q ? [`%${q}%`] : [];
    const rows = await all(env, `SELECT id,legacy_id,email,name,phone,gender,is_vip,status,created_at FROM members ${where} ORDER BY id DESC LIMIT ${per + 1} OFFSET ${(page - 1) * per}`, ...args);
    const total = await first(env, `SELECT COUNT(*) n FROM members`);
    const hasMore = rows.length > per;
    const trs = rows.slice(0, per).map((m) => `<tr>
      <td>${m.id}</td><td>${esc(m.name || '')}</td><td>${esc(m.email)}</td><td>${esc(m.phone || '')}</td>
      <td>${m.gender === 'M' ? '男' : m.gender === 'F' ? '女' : ''}</td><td>${m.is_vip ? 'VIP' : '一般'}</td>
      <td>${m.status ? '啟用' : '停用'}</td><td>${m.created_at ? new Date(m.created_at).toLocaleDateString('zh-TW') : ''}</td>
    </tr>`).join('');
    const qs = (p) => `/admin/members?token=${encodeURIComponent(token)}${q ? '&q=' + encodeURIComponent(q) : ''}&page=${p}`;
    const body = `<div class="tip">共 <b>${(total?.n || 0).toLocaleString()}</b> 位會員。</div>
      <form method="get" style="margin-bottom:14px"><input type="hidden" name="token" value="${esc(token)}">
        <input name="q" value="${esc(q)}" placeholder="搜尋 信箱／姓名／手機" style="max-width:320px;display:inline-block"> <button class="btn">搜尋</button></form>
      <table><tr><th>ID</th><th>姓名</th><th>信箱</th><th>手機</th><th>性別</th><th>會員</th><th>狀態</th><th>註冊</th></tr>${trs || '<tr><td colspan=8>查無會員</td></tr>'}</table>
      <div class="pg">${page > 1 ? `<a href="${qs(page - 1)}">‹ 上一頁</a>` : ''}${hasMore ? `<a href="${qs(page + 1)}">下一頁 ›</a>` : ''}</div>`;
    const res = adminLayout('會員管理', body, token);
    res.headers.append('set-cookie', setCookie['set-cookie']);
    return res;
  }

  // 報名清單
  if (path === '/admin/regs') {
    const rows = await all(env, `SELECT r.id, r.name, r.email, r.phone, r.created_at, e.title FROM registrations r LEFT JOIN events e ON e.id=r.event_id ORDER BY r.id DESC LIMIT 300`);
    const trs = rows.map((r) => `<tr><td>${r.id}</td><td>${esc(r.title || '')}</td><td>${esc(r.name || '')}</td><td>${esc(r.phone || '')}</td><td>${esc(r.email || '')}</td><td>${r.created_at ? new Date(r.created_at).toLocaleString('zh-TW') : ''}</td></tr>`).join('');
    const body = `<table><tr><th>ID</th><th>活動</th><th>姓名</th><th>手機</th><th>信箱</th><th>時間</th></tr>${trs || '<tr><td colspan=6>尚無報名</td></tr>'}</table>`;
    const res = adminLayout('報名清單', body, token);
    res.headers.append('set-cookie', setCookie['set-cookie']);
    return res;
  }

  // 許願清單
  if (path === '/admin/wishes') {
    const rows = await all(env, `SELECT id,name,email,content,votes,created_at FROM wishes ORDER BY id DESC LIMIT 300`);
    const trs = rows.map((w) => `<tr><td>${w.id}</td><td>${esc(w.name || '匿名')}</td><td>${esc(w.content)}</td><td>${w.votes}</td><td>${w.created_at ? new Date(w.created_at).toLocaleDateString('zh-TW') : ''}</td></tr>`).join('');
    const body = `<table><tr><th>ID</th><th>暱稱</th><th>願望</th><th>讚</th><th>時間</th></tr>${trs || '<tr><td colspan=5>尚無許願</td></tr>'}</table>`;
    const res = adminLayout('活動許願池', body, token);
    res.headers.append('set-cookie', setCookie['set-cookie']);
    return res;
  }

  // 儀表板
  const safe = async (sql) => { try { return (await first(env, sql))?.n || 0; } catch { return 0; } };
  const [nm, ne, nr, nw] = await Promise.all([
    safe('SELECT COUNT(*) n FROM members'),
    safe('SELECT COUNT(*) n FROM events'),
    safe('SELECT COUNT(*) n FROM registrations'),
    safe('SELECT COUNT(*) n FROM wishes'),
  ]);
  const body = `<div class="cards">
      <div class="c"><b>${nm.toLocaleString()}</b><span>會員</span></div>
      <div class="c"><b>${ne.toLocaleString()}</b><span>活動</span></div>
      <div class="c"><b>${nr.toLocaleString()}</b><span>報名</span></div>
      <div class="c"><b>${nw.toLocaleString()}</b><span>許願</span></div>
    </div>
    <div class="tip">舊資料匯入：用 <code>scripts/migrate.py</code> 從舊 MySQL 讀出並 POST 到 <code>/admin/import</code>（需帶 token）。詳見 README。</div>
    <p><a class="btn" href="/admin/events?token=${encodeURIComponent(token)}">管理活動</a> <a class="btn" href="/admin/members?token=${encodeURIComponent(token)}">查看會員</a></p>`;
  const res = adminLayout('儀表板', body, token);
  res.headers.append('set-cookie', setCookie['set-cookie']);
  return res;
}
