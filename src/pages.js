// 前台各頁面與會員登入/註冊處理。
import { BASE, CATEGORIES, REAL_CATEGORIES, categoryName, STATS, FEATURES, HIGHLIGHTS, PLANS, BLOG_CATEGORIES, blogCategoryName } from './config.js';
import { layout, redirect, esc, eventCard, articleCard, sectionHead, empty } from './render.js';
import { hashPassword, verifyPassword, isLegacyHash, createSession, destroySession, randomToken, cookie, parseCookies } from './auth.js';

const PER_PAGE = 12;
const EVENT_COLS = 'id, title, category, is_vip, date_text, city, price_m, price_f, image, summary, status';

const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();

const pageNum = (url) => {
  const p = parseInt(url.searchParams.get('page') || '1', 10);
  return Number.isFinite(p) && p > 0 && p < 500 ? p : 1;
};
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

// ─── 首頁 ───────────────────────────────────────────────
export async function home(env, member) {
  let events = [];
  try {
    events = await all(env, `SELECT ${EVENT_COLS} FROM events WHERE status=1 ORDER BY event_date DESC, id DESC LIMIT 6`);
  } catch { /* 資料表尚未建立時首頁仍可顯示 */ }
  let articles = [];
  try {
    articles = (await all(env, `SELECT ${ART_COLS} FROM articles WHERE status=1 ORDER BY published_at DESC, id DESC LIMIT 3`))
      .map((a) => ({ ...a, catName: blogCategoryName(a.category) }));
  } catch { /* */ }

  const stats = STATS.map((s) => `<div class="stat"><b>${s.value.toLocaleString()}</b><span>${s.label}</span></div>`).join('');
  const feats = FEATURES.map((f, i) => `<div class="feat"><div class="ic">${['🎉', '💄', '🤝'][i] || '✨'}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join('');
  const hls = HIGHLIGHTS.map((h) => `<div class="hl"><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`).join('');
  const media = ['創業小聚', '數位時代', 'Yahoo News', '網路溫度計', '科技豆', 'NOWnews']
    .map((m) => `<span>${esc(m)}</span>`).join('');
  const plans = PLANS.map((p) => `<div class="plan${p.key === 'vip' ? ' vip' : ''}">${p.key === 'vip' ? '<span class="badge">最超值</span>' : ''}<h3>${esc(p.name)}</h3><p>${esc(p.text)}</p>${member ? '' : `<button class="btn" onclick="eros.open('register')">加入會員</button>`}</div>`).join('');

  const eventsHtml = events.length
    ? `<div class="egrid">${events.map(eventCard).join('')}</div><div style="text-align:center;margin-top:34px"><a class="btn ghost" href="/event">更多主題活動</a></div>`
    : empty('活動即將登場，敬請期待！先加入會員搶先收到通知 🎊');

  const body = `
  <section class="hero">
    <h1>真實互動玩趴踢　主題活動玩不膩</h1>
    <p>百種主題活動任意挑選，盡情享受派對！甩開冰冷螢幕，一起找回面對面的感動吧！</p>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
      ${member ? '' : `<button class="btn" onclick="eros.open('register')">免費加入會員</button>`}
      <a class="btn ghost" href="/event">看看有哪些活動</a>
    </div>
  </section>
  <div class="stats"><div class="wrap">${stats}</div></div>

  <section class="blk"><div class="wrap">
    ${sectionHead('最新活動', '每月不同主題，總有一款適合你')}
    ${eventsHtml}
  </div></section>

  <section class="blk soft"><div class="wrap">
    ${sectionHead('為什麼選擇 eros', '甩開冰冷螢幕，一起找回面對面的感動吧！')}
    <div class="feats">${feats}</div>
  </div></section>

  <section class="blk"><div class="wrap">
    ${sectionHead('精彩花絮', '看看參加過的朋友怎麼說')}
    <div class="hls">${hls}</div>
  </div></section>

  <section class="blk soft"><div class="wrap">
    ${sectionHead('媒體報導')}
    <div class="media">${media}</div>
  </div></section>

  ${articles.length ? `<section class="blk"><div class="wrap">
    ${sectionHead('最新專題文章', '戀愛講座、兩性情感與精選好文')}
    <div class="agrid">${articles.map(articleCard).join('')}</div>
    <div style="text-align:center;margin-top:30px"><a class="btn ghost" href="/article">看更多文章</a></div>
  </div></section>` : ''}

  <section class="blk soft"><div class="wrap">
    ${sectionHead('選擇最適合你的方式')}
    <div class="plans">${plans}</div>
  </div></section>

  <section class="cta">
    <h2>加入我們，和單身 Say Goodbye :)</h2>
    ${member ? `<a class="btn" href="/event">立即報名活動</a>` : `<button class="btn" onclick="eros.open('register')">立即免費加入</button>`}
  </section>`;

  return layout(env, { body, active: 'home', member, canonical: (env.SITE_URL || '') + '/' });
}

// ─── 活動列表 ───────────────────────────────────────────
export async function eventList(env, url, member) {
  const cat = url.searchParams.get('cat') || 'all';
  const page = pageNum(url);
  const valid = CATEGORIES.some((c) => c.slug === cat) ? cat : 'all';
  const where = valid === 'all' ? 'status=1' : 'status=1 AND category=?1';
  const args = valid === 'all' ? [] : [valid];

  let rows = [];
  try {
    rows = await all(
      env,
      `SELECT ${EVENT_COLS} FROM events WHERE ${where} ORDER BY event_date DESC, id DESC LIMIT ?${args.length + 1} OFFSET ?${args.length + 2}`,
      ...args, PER_PAGE + 1, (page - 1) * PER_PAGE,
    );
  } catch { /* 尚未建表 */ }
  const hasMore = rows.length > PER_PAGE;
  rows = rows.slice(0, PER_PAGE);

  const filter = CATEGORIES.map((c) => `<a href="/event?cat=${c.slug}"${c.slug === valid ? ' class="on"' : ''}>${c.name}</a>`).join('');
  const grid = rows.length ? `<div class="egrid">${rows.map(eventCard).join('')}</div>` : empty();
  const mk = (p) => `/event?cat=${valid}&page=${p}`;
  const pager = (page > 1 || hasMore)
    ? `<nav class="pager">${page > 1 ? `<a href="${mk(page - 1)}">‹ 上一頁</a>` : ''}${hasMore ? `<a href="${mk(page + 1)}">下一頁 ›</a>` : ''}</nav>`
    : '';

  const body = `
  <section class="phead"><h1>主題活動</h1><p>百種主題活動任意挑選，找到志同道合的好夥伴</p></section>
  <section class="blk"><div class="wrap">
    <div class="filter">${filter}</div>
    ${grid}
    ${pager}
    <div style="text-align:center;margin-top:36px"><a class="btn ghost" href="/wish">想要更多元的活動？到許願池許願 →</a></div>
  </div></section>`;
  return layout(env, { title: '主題活動', body, active: 'event', member });
}

// ─── 活動詳情 ───────────────────────────────────────────
export async function eventOne(env, id, member, url) {
  let e = null;
  try { e = await first(env, `SELECT * FROM events WHERE id=?1 AND status=1`, id); } catch { /* */ }
  if (!e) {
    return layout(env, {
      title: '找不到活動', status: 404, member,
      body: `<section class="blk"><div class="wrap">${empty('找不到這個活動，可能已結束或下架。')}<div style="text-align:center;margin-top:24px"><a class="btn" href="/event">回活動列表</a></div></div></section>`,
    });
  }
  try { await env.DB.prepare('UPDATE events SET views=views+1 WHERE id=?1').bind(id).run(); } catch { /* */ }

  const cover = e.image
    ? `<img src="${esc(e.image)}" alt="${esc(e.title)}" onerror="this.parentElement.innerHTML='<div style=&quot;display:grid;place-items:center;height:100%;color:#fff;font-size:40px;font-weight:900&quot;>eros</div>'">`
    : `<div style="display:grid;place-items:center;height:100%;color:#fff;font-size:40px;font-weight:900">eros</div>`;
  const price = e.price_m || e.price_f
    ? `TWD ${Number(e.price_m || e.price_f).toLocaleString()}${e.price_m && e.price_f && e.price_m !== e.price_f ? `（女 ${Number(e.price_f).toLocaleString()}）` : ''}`
    : '免費';
  const tags = [categoryName(e.category), e.is_vip ? 'VIP 限定' : null].filter(Boolean)
    .map((t) => `<span>${esc(t)}</span>`).join('');
  // 會員是否已報名
  let joined = null;
  if (member) {
    try { joined = await first(env, 'SELECT id FROM registrations WHERE event_id=?1 AND member_id=?2 AND status=1', id, member.id); } catch { /* */ }
  }
  const flag = url?.searchParams.get('joined');
  const flash = flag === '1' ? '<div class="msg ok">🎉 報名成功！eros 戀愛秘書將盡快與您聯繫。</div>'
    : flag === 'dup' ? '<div class="msg ok">你已經報名過這個活動囉！</div>'
    : flag === 'cancel' ? '<div class="msg err">已取消報名。</div>' : '';
  const bookForm = joined
    ? `<div class="msg ok" style="text-align:center;margin:0 0 12px">✅ 你已報名此活動</div>
          <form method="post" action="/event/cancel" onsubmit="return confirm('確定要取消報名嗎？')">
            <input type="hidden" name="event_id" value="${e.id}">
            <button class="btn ghost" style="width:100%">取消報名</button>
          </form>`
    : `<form method="post" action="/event/join">
            <input type="hidden" name="event_id" value="${e.id}">
            ${member ? `<p style="margin:0 0 10px;font-size:14px;color:var(--sub)">以 <b style="color:var(--ink)">${esc(member.name || member.email)}</b> 的身分報名</p>` : `
            <input type="text" name="name" placeholder="姓名" required>
            <input type="tel" name="phone" placeholder="手機號碼" required style="margin-top:8px">
            <input type="email" name="email" placeholder="信箱" required style="margin-top:8px">`}
            <button class="btn">${member ? '立即報名' : '填資料報名'}</button>
          </form>
          ${member ? '' : `<p style="font-size:13px;margin:10px 0 0;text-align:center"><a href="#login" onclick="eros.open('login');return false" style="color:var(--pink)">已是會員？登入後一鍵報名</a></p>`}`;
  const content = [e.intro, e.schedule, e.notice, e.notice2].filter(Boolean).join('<hr style="margin:22px 0;border:0;border-top:1px solid var(--line)">');

  const body = `
  <section class="phead"><h1>${esc(e.title)}</h1>${e.date_text || e.city ? `<p>${[e.city, e.date_text].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</section>
  <section class="blk"><div class="wrap">
    <div class="detail">
      <div>
        <div class="cover">${cover}</div>
        <div class="body" style="margin-top:24px">
          <div class="tags">${tags}</div>
          <div class="content">${content || '<p>活動詳情請洽戀愛秘書。</p>'}</div>
        </div>
      </div>
      <aside>
        <div class="side-book">
          ${flash}
          <p class="price">${price}</p>
          <dl>
            ${e.city ? `<dt>地點</dt><dd>${esc(e.city)}</dd>` : ''}
            ${e.date_text ? `<dt>時間</dt><dd>${esc(e.date_text)}${e.time_text ? ' ' + esc(e.time_text) : ''}</dd>` : ''}
            <dt>分類</dt><dd>${esc(categoryName(e.category))}</dd>
          </dl>
          ${bookForm}
          <p style="font-size:13px;color:var(--sub);margin:12px 0 0">報名成功後，eros 戀愛秘書將與您聯繫安排活動。</p>
        </div>
      </aside>
    </div>
  </div></section>`;
  return layout(env, { title: e.title, description: e.summary || e.title, body, active: 'event', member });
}

// 活動報名
export async function eventJoin(env, req, member) {
  const form = await req.formData();
  const eventId = parseInt(form.get('event_id'), 10);
  if (!eventId) return redirect('/event');
  const name = member ? member.name : (form.get('name') || '').trim();
  const email = member ? member.email : (form.get('email') || '').trim();
  const phone = member ? member.phone : (form.get('phone') || '').trim();
  if (!member && (!name || !email)) return redirect(`/event/one/${eventId}`);
  // 同一人同一活動不重複報名（會員看 member_id，訪客看 email）
  try {
    const dup = member
      ? await first(env, 'SELECT id FROM registrations WHERE event_id=?1 AND member_id=?2 AND status=1', eventId, member.id)
      : await first(env, 'SELECT id FROM registrations WHERE event_id=?1 AND email=?2 AND status=1', eventId, email);
    if (dup) return redirect(`/event/one/${eventId}?joined=dup`);
  } catch { /* */ }
  try {
    await env.DB.prepare(
      `INSERT INTO registrations (event_id, member_id, name, email, phone, gender, status, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,1,?7)`,
    ).bind(eventId, member?.id || null, name, email, phone, member?.gender || null, Date.now()).run();
  } catch { /* */ }
  return redirect(`/event/one/${eventId}?joined=1`);
}

// 取消報名（僅會員）
export async function eventCancel(env, req, member) {
  const form = await req.formData();
  const eventId = parseInt(form.get('event_id'), 10);
  if (!eventId) return redirect('/user/events');
  if (!member) return redirect(`/event/one/${eventId}#login`);
  try {
    await env.DB.prepare('UPDATE registrations SET status=0 WHERE event_id=?1 AND member_id=?2 AND status=1')
      .bind(eventId, member.id).run();
  } catch { /* */ }
  return redirect(`/event/one/${eventId}?joined=cancel`);
}

// 我的活動：會員已報名的活動
export async function myEvents(env, member) {
  if (!member) return redirect('/#login');
  let rows = [];
  try {
    rows = await all(env, `SELECT ${EVENT_COLS.split(', ').map((c) => 'e.' + c).join(', ')}, r.created_at AS joined_at
      FROM registrations r JOIN events e ON e.id = r.event_id
      WHERE r.member_id=?1 AND r.status=1 ORDER BY r.created_at DESC`, member.id);
  } catch { /* */ }
  const grid = rows.length
    ? `<div class="egrid">${rows.map(eventCard).join('')}</div>`
    : `${empty('你還沒有報名任何活動，快去看看有哪些有趣的主題吧！')}<div style="text-align:center;margin-top:24px"><a class="btn" href="/event">逛逛主題活動</a></div>`;
  const body = `
  <section class="phead"><h1>我的活動</h1><p>${esc(member.name || member.email)}，你已報名 ${rows.length} 個活動</p></section>
  <section class="blk"><div class="wrap">${grid}</div></section>`;
  return layout(env, { title: '我的活動', body, member });
}

// ─── 許願池 ─────────────────────────────────────────────
export async function wishPage(env, url, member) {
  let wishes = [];
  try { wishes = await all(env, `SELECT id, name, content, votes FROM wishes WHERE status=1 ORDER BY votes DESC, id DESC LIMIT 30`); } catch { /* */ }
  const ok = url.searchParams.get('ok');
  const list = wishes.length
    ? `<div class="wishlist">${wishes.map((w) => `<div class="wish"><div class="v">${w.votes}<small>讚</small></div><div><b>${esc(w.name || '匿名')}</b><p style="margin:2px 0 0;color:var(--sub)">${esc(w.content)}</p></div></div>`).join('')}</div>`
    : '';
  const body = `
  <section class="phead"><h1>活動許願池</h1><p>想要什麼樣的主題活動？告訴我們，讓 eros 為你實現！</p></section>
  <section class="blk"><div class="wrap">
    ${ok ? '<div class="msg ok" style="max-width:520px;margin:0 auto 20px">許願成功！我們會參考大家的願望規劃活動 💖</div>' : ''}
    <form class="form" method="post" action="/wish">
      ${member ? '' : `<div class="row"><div><label>姓名</label><input name="name" placeholder="怎麼稱呼你" required></div><div><label>信箱</label><input type="email" name="email" placeholder="選填"></div></div>`}
      <label>我想要的活動</label>
      <textarea name="content" rows="4" placeholder="例如：桌遊之夜、夜衝陽明山、調酒體驗課…" required></textarea>
      <button class="btn">送出願望</button>
    </form>
    ${list}
  </div></section>`;
  return layout(env, { title: '活動許願池', body, active: 'wish', member });
}

export async function wishSubmit(env, req, member) {
  const form = await req.formData();
  const content = (form.get('content') || '').trim();
  if (!content) return redirect('/wish');
  const name = member ? member.name : (form.get('name') || '').trim();
  const email = member ? member.email : (form.get('email') || '').trim();
  try {
    await env.DB.prepare(
      `INSERT INTO wishes (member_id, name, email, content, votes, status, created_at) VALUES (?1,?2,?3,?4,0,1,?5)`,
    ).bind(member?.id || null, name || null, email || null, content.slice(0, 500), Date.now()).run();
  } catch { /* */ }
  return redirect('/wish?ok=1');
}

// ─── 專題文章 ───────────────────────────────────────────
const ART_COLS = 'id, title, category, excerpt, cover, published_at';
const ARTS_PER = 12;

export async function articleList(env, url, member) {
  const cat = url.searchParams.get('cat') || 'all';
  const page = pageNum(url);
  const valid = BLOG_CATEGORIES.some((c) => c.slug === cat) ? cat : 'all';
  const where = valid === 'all' ? 'status=1' : 'status=1 AND category=?1';
  const args = valid === 'all' ? [] : [valid];

  let rows = [];
  try {
    rows = await all(
      env,
      `SELECT ${ART_COLS} FROM articles WHERE ${where} ORDER BY published_at DESC, id DESC LIMIT ?${args.length + 1} OFFSET ?${args.length + 2}`,
      ...args, ARTS_PER + 1, (page - 1) * ARTS_PER,
    );
  } catch { /* 尚未建表 */ }
  const hasMore = rows.length > ARTS_PER;
  rows = rows.slice(0, ARTS_PER).map((a) => ({ ...a, catName: blogCategoryName(a.category) }));

  const filter = [['all', '全部文章'], ...BLOG_CATEGORIES.map((c) => [c.slug, c.name])]
    .map(([slug, name]) => `<a href="/article?cat=${slug}"${slug === valid ? ' class="on"' : ''}>${name}</a>`).join('');
  const grid = rows.length ? `<div class="agrid">${rows.map(articleCard).join('')}</div>` : empty('這個分類還沒有文章。');
  const mk = (p) => `/article?cat=${valid}&page=${p}`;
  const pager = (page > 1 || hasMore)
    ? `<nav class="pager">${page > 1 ? `<a href="${mk(page - 1)}">‹ 上一頁</a>` : ''}${hasMore ? `<a href="${mk(page + 1)}">下一頁 ›</a>` : ''}</nav>`
    : '';

  const body = `
  <section class="phead"><h1>專題文章</h1><p>戀愛講座、兩性情感、活動花絮與精選好文，都在這裡</p></section>
  <section class="blk"><div class="wrap">
    <div class="filter">${filter}</div>
    ${grid}
    ${pager}
  </div></section>`;
  return layout(env, { title: '專題文章', body, active: 'article', member });
}

export async function articleOne(env, id, member) {
  let a = null;
  try { a = await first(env, `SELECT * FROM articles WHERE id=?1 AND status=1`, id); } catch { /* */ }
  if (!a) {
    return layout(env, {
      title: '找不到文章', status: 404, member,
      body: `<section class="blk"><div class="wrap">${empty('找不到這篇文章。')}<div style="text-align:center;margin-top:24px"><a class="btn" href="/article">回文章列表</a></div></div></section>`,
    });
  }
  try { await env.DB.prepare('UPDATE articles SET views=views+1 WHERE id=?1').bind(id).run(); } catch { /* */ }

  const d = a.published_at ? new Date(a.published_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const cover = a.cover ? `<div class="a-cover"><img src="${esc(a.cover)}" alt="${esc(a.title)}" onerror="this.parentElement.remove()"></div>` : '';
  // 相關文章（同分類）
  let related = [];
  try {
    related = (await all(env, `SELECT ${ART_COLS} FROM articles WHERE status=1 AND category=?1 AND id<>?2 ORDER BY published_at DESC LIMIT 3`, a.category, id))
      .map((x) => ({ ...x, catName: blogCategoryName(x.category) }));
  } catch { /* */ }
  const relHtml = related.length
    ? `<section class="blk soft"><div class="wrap">${sectionHead('相關文章')}<div class="agrid">${related.map(articleCard).join('')}</div></div></section>`
    : '';

  const body = `
  <section class="blk"><div class="wrap">
    <article class="article-page">
      <div class="a-cat">${esc(blogCategoryName(a.category))}</div>
      <h1>${esc(a.title)}</h1>
      <div class="a-meta">${d}</div>
      ${cover}
      <div class="a-content">${a.content || `<p>${esc(a.excerpt || '')}</p>`}</div>
    </article>
    <div class="article-back"><a class="btn ghost" href="/article">← 回專題文章</a></div>
  </div></section>
  ${relHtml}`;
  return layout(env, { title: a.title, description: a.excerpt || a.title, body, active: 'article', member });
}

// ─── 聯絡我們 / 條款 ────────────────────────────────────
export function contactPage(env, member) {
  const mail = env.CONTACT_EMAIL || 'eros@ek21.com';
  const body = `
  <section class="phead"><h1>聯絡我們</h1><p>有任何問題或合作提案，歡迎與我們聯繫</p></section>
  <section class="blk"><div class="wrap" style="max-width:640px">
    <div class="form">
      <p style="margin:0 0 18px">選擇最方便的方式聯絡 eros 主題派對：</p>
      <p><b>📧 Email</b><br><a href="mailto:${esc(mail)}" style="color:var(--pink)">${esc(mail)}</a></p>
      <p><b>💬 LINE</b><br><a href="${esc(env.CONTACT_LINE || '#')}" style="color:var(--pink)">加入官方 LINE</a></p>
      <p><b>👍 Facebook</b><br><a href="${esc(env.CONTACT_FB || '#')}" style="color:var(--pink)">eros 主題派對粉絲團</a></p>
    </div>
  </div></section>`;
  return layout(env, { title: '聯絡我們', body, active: 'contact', member });
}

export function conditionPage(env, member) {
  const body = `
  <section class="phead"><h1>使用服務條款與隱私權</h1></section>
  <section class="blk"><div class="wrap" style="max-width:760px;line-height:1.9">
    <h3>一、服務說明</h3>
    <p>eros 主題派對（尋夢園旗下品牌）提供各式主題交友活動之報名與會員服務。使用本服務即表示您已年滿 18 歲，並同意遵守本條款。</p>
    <h3>二、會員資料</h3>
    <p>為提供活動安排與聯繫服務，我們會蒐集您提供的姓名、性別、信箱、手機號碼等資料。您的個人資料僅用於活動通知、報名聯繫與客服用途，不會轉售予第三方。</p>
    <h3>三、活動報名</h3>
    <p>報名成功不代表具參加資格，實際名額與資格以戀愛秘書通知為準。網站公告之費用為活動保證金，成為 VIP 會員後將全額退還。</p>
    <h3>四、隱私權保護</h3>
    <p>您可隨時來信要求查詢、更正或刪除您的個人資料。本網站採用加密方式保存會員密碼。</p>
    <h3>五、條款修訂</h3>
    <p>eros 保留隨時修訂本條款與活動細節之權利，修訂後將公告於本網站。</p>
  </div></section>`;
  return layout(env, { title: '使用服務條款', body, active: '', member });
}

// ─── 會員：登入 / 註冊 / 登出 ───────────────────────────
export async function login(env, req) {
  const form = await req.formData();
  const email = (form.get('email') || '').trim().toLowerCase();
  const password = form.get('password') || '';
  const m = await first(env, `SELECT * FROM members WHERE email=?1`, email);
  if (!m || !(await verifyPassword(password, m.password_hash))) {
    return errorPage(env, '登入失敗', '信箱或密碼錯誤，請再試一次。', '/', 'login');
  }
  if (m.status !== 1) return disabledPage(env);
  // 舊 MD5 密碼登入成功→升級為 PBKDF2
  if (isLegacyHash(m.password_hash)) {
    try {
      const upgraded = await hashPassword(password);
      await env.DB.prepare('UPDATE members SET password_hash=?1, updated_at=?2 WHERE id=?3')
        .bind(upgraded, Date.now(), m.id).run();
    } catch { /* 升級失敗不影響登入 */ }
  }
  const cookie = await createSession(env, m.id, req.headers.get('user-agent') || '');
  return redirect('/', [cookie]);
}

export async function register(env, req) {
  const form = await req.formData();
  const name = (form.get('name') || '').trim();
  const email = (form.get('email') || '').trim().toLowerCase();
  const phone = (form.get('phone') || '').trim();
  const gender = form.get('gender') || '';
  const password = form.get('password') || '';
  const agree = form.get('agree');

  if (!name || !email || password.length < 6) {
    return errorPage(env, '註冊失敗', '請完整填寫姓名、信箱，密碼至少 6 碼。', '/', 'register');
  }
  if (!agree) return errorPage(env, '註冊失敗', '請先閱讀並同意使用服務條款。', '/', 'register');

  const exist = await first(env, `SELECT id FROM members WHERE email=?1`, email);
  if (exist) return errorPage(env, '註冊失敗', '這個信箱已經註冊過了，請直接登入。', '/', 'login');

  const now = Date.now();
  const hash = await hashPassword(password);
  let res;
  try {
    res = await env.DB.prepare(
      `INSERT INTO members (email, name, phone, password_hash, gender, source, is_vip, status, created_at, updated_at)
       VALUES (?1,?2,?3,?4,?5,'web',0,1,?6,?6)`,
    ).bind(email, name, phone || null, hash, gender || null, now).run();
  } catch (e) {
    return errorPage(env, '註冊失敗', '系統忙碌，請稍後再試。', '/', 'register');
  }
  const memberId = res.meta?.last_row_id;
  const cookie = await createSession(env, memberId, req.headers.get('user-agent') || '');
  return redirect('/?welcome=1', [cookie]);
}

export async function logout(env, req) {
  const cookie = await destroySession(req, env);
  return redirect('/', [cookie]);
}

// ─── Facebook 登入（OAuth）────────────────────────────
const FB_VER = 'v21.0';

// 第一步：把使用者導去 Facebook 授權頁
export function fbLogin(env, req, url) {
  if (!env.FB_APP_ID) {
    return errorPage(env, 'Facebook 登入', 'Facebook 登入尚未設定（缺少 FB_APP_ID），請先使用信箱登入或註冊。', '/', 'login');
  }
  const state = randomToken(16);
  const redirectUri = `${url.origin}/user/fb_callback`;
  const auth = `https://www.facebook.com/${FB_VER}/dialog/oauth?` + new URLSearchParams({
    client_id: env.FB_APP_ID,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    // email 需在 FB 後台「權限與功能」開通存取權，未開通帶 email 會被判 Invalid Scopes。
    // 開通後把 FB_SCOPE 設為 "public_profile,email" 即可。
    scope: env.FB_SCOPE || 'public_profile',
  }).toString();
  return redirect(auth, [cookie('eros_fbstate', state, { maxAge: 600 })]);
}

// 第二步：Facebook 導回，換 token、取用戶、找/建會員、建立登入
export async function fbCallback(env, req, url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = parseCookies(req)['eros_fbstate'];
  if (url.searchParams.get('error')) {
    return errorPage(env, 'Facebook 登入', '你取消了 Facebook 授權，或授權未完成。', '/', 'login');
  }
  if (!code || !state || state !== saved) {
    return errorPage(env, 'Facebook 登入', '授權驗證失敗（state 不符），請再試一次。', '/', 'login');
  }
  const redirectUri = `${url.origin}/user/fb_callback`;
  try {
    // 換 access_token
    const tokRes = await fetch(`https://graph.facebook.com/${FB_VER}/oauth/access_token?` + new URLSearchParams({
      client_id: env.FB_APP_ID,
      client_secret: env.FB_APP_SECRET,
      redirect_uri: redirectUri,
      code,
    }).toString());
    const tok = await tokRes.json();
    if (!tok.access_token) {
      const d = tok.error ? (tok.error.message || JSON.stringify(tok.error)) : JSON.stringify(tok);
      return errorPage(env, 'Facebook 登入', 'token 失敗：' + d, '/', 'login');
    }

    // 取用戶資料（只取有開通的欄位；email 未開通時不要求，避免報錯）
    const fields = (env.FB_SCOPE || '').includes('email') ? 'id,name,email' : 'id,name';
    const meRes = await fetch(`https://graph.facebook.com/${FB_VER}/me?` + new URLSearchParams({
      fields,
      access_token: tok.access_token,
    }).toString());
    const me = await meRes.json();
    if (!me.id) {
      const d = me.error ? (me.error.message || JSON.stringify(me.error)) : JSON.stringify(me);
      return errorPage(env, 'Facebook 登入', '取得帳號資料失敗：' + d, '/', 'login');
    }

    const fbId = String(me.id);
    const email = (me.email || `fb_${fbId}@eros.ek21.com`).toLowerCase();
    const now = Date.now();

    // 先用 fb id 找，再用 email 找
    let m = await first(env, `SELECT * FROM members WHERE fb_account=?1 LIMIT 1`, fbId);
    if (!m) m = await first(env, `SELECT * FROM members WHERE email=?1 LIMIT 1`, email);

    if (!m) {
      const res = await env.DB.prepare(
        `INSERT INTO members (email, name, fb_account, source, is_vip, status, created_at, updated_at)
         VALUES (?1,?2,?3,'fb',0,1,?4,?4)`,
      ).bind(email, me.name || 'Facebook 用戶', fbId, now).run();
      m = { id: res.meta?.last_row_id };
    } else if (!m.fb_account) {
      // 既有 email 會員第一次用 FB 登入 → 綁定 fb id
      try { await env.DB.prepare('UPDATE members SET fb_account=?1, updated_at=?2 WHERE id=?3').bind(fbId, now, m.id).run(); } catch { /* */ }
    }

    // 停用帳號不建立登入（否則 session 建了但 currentMember 讀不到，畫面看起來像沒登入）
    if (m.status !== undefined && m.status !== 1) return disabledPage(env);

    const c = await createSession(env, m.id, req.headers.get('user-agent') || '');
    return redirect('/', [c, cookie('eros_fbstate', '', { maxAge: 0 })]);
  } catch (e) {
    return errorPage(env, 'Facebook 登入', '錯誤：' + (e && e.message ? e.message : String(e)), '/', 'login');
  }
}

const disabledPage = (env) => errorPage(env, '帳號已停用',
  `此帳號目前為停用狀態，無法登入。如需恢復，請來信 ${env.CONTACT_EMAIL || 'eros@ek21.com'} 與我們聯繫。`, '/');

// 簡單的訊息頁（含返回按鈕 + 自動開啟登入/註冊 modal）
function errorPage(env, title, msg, back = '/', openTab = '') {
  const body = `<section class="blk"><div class="wrap" style="max-width:520px;text-align:center;padding:60px 20px">
    <h1 style="font-size:26px">${esc(title)}</h1>
    <p style="color:var(--sub);margin:14px 0 26px">${esc(msg)}</p>
    <a class="btn" href="${esc(back)}${openTab ? '#' + openTab : ''}">返回</a>
  </div></section>`;
  return layout(env, { title, body, status: 200 });
}
