// 版型與所有共用 HTML 元件、CSS。整站 HTML 由這裡輸出（與 ek21news 相同做法）。
import { BASE, REAL_CATEGORIES, categoryName } from './config.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 活動卡片
export function eventCard(e) {
  const href = `${BASE}/event/one/${e.id}`;
  const img = e.image
    ? `<img src="${esc(e.image)}" alt="${esc(e.title)}" loading="lazy" decoding="async" onerror="this.remove()">`
    : `<span class="ph">eros</span>`;
  return `<article class="ecard">
    <a class="ecard-img" href="${href}">${img}${e.is_vip ? '<b class="vip">VIP</b>' : ''}<span class="cat">${esc(categoryName(e.category))}</span></a>
    <div class="ecard-body">
      <h3><a href="${href}">${esc(e.title)}</a></h3>
      ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
      <div class="ecard-meta">
        ${e.city ? `<span>📍 ${esc(e.city)}</span>` : ''}
        ${e.event_date ? `<span>🗓 ${esc(e.event_date)}</span>` : ''}
        <span class="price">${e.price ? `TWD ${Number(e.price).toLocaleString()}` : '免費'}</span>
      </div>
    </div>
  </article>`;
}

// 專題文章卡片
export function articleCard(a) {
  const href = `/article/${a.id}`;
  const img = a.cover
    ? `<img src="${esc(a.cover)}" alt="${esc(a.title)}" loading="lazy" decoding="async" onerror="this.remove()">`
    : `<span class="ph">eros</span>`;
  const d = a.published_at ? new Date(a.published_at).toLocaleDateString('zh-TW') : '';
  return `<article class="acard">
    <a class="acard-img" href="${href}">${img}${a.catName ? `<span class="cat">${esc(a.catName)}</span>` : ''}</a>
    <div class="acard-body">
      <h3><a href="${href}">${esc(a.title)}</a></h3>
      ${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ''}
      <time>${d}</time>
    </div>
  </article>`;
}

export const sectionHead = (title, sub = '') =>
  `<div class="shead"><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;

export const empty = (msg = '目前沒有活動，敬請期待！') => `<div class="empty">${esc(msg)}</div>`;

const CSS = `
:root{--pink:#ff2e88;--pink2:#ff6aa6;--deep:#c2185b;--ink:#1d1420;--sub:#6b6472;--bg:#fff;--soft:#fff5f9;--line:#f0e2ea;--card:#fff;--dark:#1a0f16;--shadow:0 2px 8px rgba(255,46,136,.08),0 8px 30px rgba(0,0,0,.06)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#f3eef1;--sub:#a99fb0;--bg:#150d13;--soft:#1f1119;--line:#33222c;--card:#1d131a;--shadow:0 8px 30px rgba(0,0,0,.5)}}
:root[data-theme=dark]{--ink:#f3eef1;--sub:#a99fb0;--bg:#150d13;--soft:#1f1119;--line:#33222c;--card:#1d131a;--shadow:0 8px 30px rgba(0,0,0,.5)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.btn{display:inline-block;border:0;cursor:pointer;font:inherit;font-weight:700;padding:12px 30px;border-radius:999px;background:linear-gradient(135deg,var(--pink),var(--pink2));color:#fff;box-shadow:0 6px 18px rgba(255,46,136,.35);transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(255,46,136,.45);color:#fff}
.btn.ghost{background:transparent;color:var(--pink);border:2px solid var(--pink);box-shadow:none;padding:10px 28px}
.btn.ghost:hover{background:var(--pink);color:#fff}
/* 導覽列 */
.nav{position:sticky;top:0;z-index:40;background:var(--card);border-bottom:1px solid var(--line);backdrop-filter:saturate(1.4) blur(6px)}
.nav .wrap{display:flex;align-items:center;gap:24px;min-height:66px}
.logo{font-weight:900;font-size:26px;letter-spacing:2px;background:linear-gradient(135deg,var(--pink),var(--deep));-webkit-background-clip:text;background-clip:text;color:transparent}
.nav nav{display:flex;gap:22px;margin-left:8px}
.nav nav a{font-weight:600;color:var(--ink);padding:6px 0;border-bottom:2px solid transparent}
.nav nav a:hover,.nav nav a.on{color:var(--pink);border-color:var(--pink)}
.nav .right{margin-left:auto;display:flex;align-items:center;gap:12px}
.nav .who{font-size:14px;color:var(--sub)}
.link-btn{background:none;border:0;font:inherit;font-weight:600;color:var(--pink);cursor:pointer;padding:0}
.burger{display:none;background:none;border:0;font-size:26px;color:var(--pink);cursor:pointer}
/* Hero */
.hero{position:relative;color:#fff;text-align:center;padding:96px 20px 108px;background:linear-gradient(135deg,#ff2e88,#ff6aa6 45%,#ffa26b);overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,.25),transparent 40%),radial-gradient(circle at 80% 70%,rgba(255,255,255,.18),transparent 45%)}
.hero>*{position:relative;z-index:1}
.hero h1{font-size:44px;margin:0 0 14px;font-weight:900;letter-spacing:1px;text-shadow:0 4px 20px rgba(0,0,0,.18)}
.hero p{font-size:19px;margin:0 auto 30px;max-width:640px;opacity:.96}
.hero .btn{background:#fff;color:var(--pink)}.hero .btn:hover{color:var(--deep)}
.hero .btn.ghost{background:transparent;color:#fff;border-color:#fff}.hero .btn.ghost:hover{background:#fff;color:var(--pink)}
/* 統計 */
.stats{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin:-56px auto 0;position:relative;z-index:5;max-width:760px}
.stats .wrap{display:flex;gap:14px;width:100%;justify-content:center}
.stat{flex:1;min-width:150px;background:var(--card);border-radius:16px;padding:22px;text-align:center;box-shadow:var(--shadow)}
.stat b{display:block;font-size:34px;font-weight:900;color:var(--pink);line-height:1.1}
.stat span{color:var(--sub);font-size:15px}
/* 通用 section */
section.blk{padding:64px 0}
.shead{text-align:center;margin-bottom:36px}
.shead h2{font-size:32px;margin:0 0 8px;font-weight:900}
.shead h2::after{content:"";display:block;width:56px;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--pink),var(--pink2));margin:12px auto 0}
.shead p{color:var(--sub);margin:0}
.soft{background:var(--soft)}
/* 活動卡片格 */
.egrid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.ecard{background:var(--card);border-radius:16px;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;transition:transform .18s}
.ecard:hover{transform:translateY(-4px)}
.ecard-img{position:relative;display:block;aspect-ratio:16/11;background:linear-gradient(135deg,var(--pink),var(--pink2));overflow:hidden}
.ecard-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.ecard:hover .ecard-img img{transform:scale(1.05)}
.ecard-img .ph{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:34px;font-weight:900;letter-spacing:3px;opacity:.85}
.ecard-img .cat{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;font-size:13px;padding:3px 12px;border-radius:999px}
.ecard-img .vip{position:absolute;right:12px;top:12px;background:linear-gradient(135deg,#ffb300,#ff7043);color:#fff;font-size:12px;font-weight:800;padding:3px 11px;border-radius:999px;letter-spacing:1px}
.ecard-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:8px;flex:1}
.ecard-body h3{margin:0;font-size:19px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ecard-body p{margin:0;color:var(--sub);font-size:14.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ecard-meta{margin-top:auto;display:flex;flex-wrap:wrap;gap:10px;font-size:14px;color:var(--sub);align-items:center}
.ecard-meta .price{margin-left:auto;color:var(--pink);font-weight:800}
/* 文章卡片格 */
.agrid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.acard{background:var(--card);border-radius:16px;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;transition:transform .18s}
.acard:hover{transform:translateY(-4px)}
.acard-img{position:relative;display:block;aspect-ratio:16/10;background:linear-gradient(135deg,var(--pink),var(--pink2));overflow:hidden}
.acard-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.acard:hover .acard-img img{transform:scale(1.05)}
.acard-img .ph{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:30px;font-weight:900;letter-spacing:3px;opacity:.85}
.acard-img .cat{position:absolute;left:12px;top:12px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:3px 11px;border-radius:999px}
.acard-body{padding:15px 17px 17px;display:flex;flex-direction:column;gap:7px;flex:1}
.acard-body h3{margin:0;font-size:18px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.acard-body p{margin:0;color:var(--sub);font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.acard-body time{margin-top:auto;color:var(--sub);font-size:13px}
/* 文章內頁 */
.article-page{max-width:820px;margin:0 auto;background:var(--card);border-radius:16px;padding:34px;box-shadow:var(--shadow)}
.article-page .a-cat{color:var(--pink);font-weight:700;font-size:14px}
.article-page h1{font-size:30px;line-height:1.4;margin:8px 0 10px}
.article-page .a-meta{color:var(--sub);font-size:14px;margin-bottom:20px;border-bottom:1px solid var(--line);padding-bottom:16px}
.article-page .a-cover{border-radius:12px;overflow:hidden;margin:0 0 22px}
.article-page .a-content{font-size:17px;line-height:2;overflow-wrap:anywhere}
.article-page .a-content img{border-radius:10px;margin:16px auto;height:auto}
.article-page .a-content p{margin:0 0 1.1em}
.article-page .a-content h2,.article-page .a-content h3{line-height:1.5;margin:1.4em 0 .5em}
.article-page .a-content iframe{max-width:100%;border-radius:10px}
.article-back{display:block;text-align:center;margin:30px 0 0}
/* 篩選列 */
.filter{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:32px}
.filter a{padding:8px 20px;border-radius:999px;border:1.5px solid var(--line);color:var(--sub);font-weight:600}
.filter a:hover,.filter a.on{border-color:var(--pink);color:var(--pink);background:var(--soft)}
/* 特色三欄 */
.feats{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.feat{text-align:center;padding:12px}
.feat .ic{width:76px;height:76px;margin:0 auto 16px;border-radius:22px;display:grid;place-items:center;font-size:34px;color:#fff;background:linear-gradient(135deg,var(--pink),var(--pink2));box-shadow:0 10px 24px rgba(255,46,136,.3)}
.feat h3{margin:0 0 8px;font-size:21px}
.feat p{color:var(--sub);margin:0}
/* 精彩花絮 */
.hls{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.hl{background:var(--card);border-radius:16px;padding:26px;box-shadow:var(--shadow);border-top:4px solid var(--pink)}
.hl h3{margin:0 0 10px;font-size:20px;color:var(--pink)}
.hl p{margin:0;color:var(--sub)}
/* 方案 */
.plans{display:grid;grid-template-columns:1fr 1fr;gap:28px;max-width:920px;margin:0 auto}
.plan{background:var(--card);border-radius:20px;padding:38px 32px;box-shadow:var(--shadow);text-align:center;position:relative;border:2px solid transparent}
.plan.vip{border-color:var(--pink);background:linear-gradient(180deg,var(--soft),var(--card))}
.plan .badge{position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#ffb300,#ff7043);color:#fff;font-weight:800;font-size:13px;padding:4px 16px;border-radius:999px}
.plan h3{font-size:26px;margin:0 0 14px}
.plan p{color:var(--sub);margin:0 0 24px;text-align:left}
/* CTA 帶 */
.cta{background:linear-gradient(135deg,var(--pink),var(--deep));color:#fff;text-align:center;padding:70px 20px}
.cta h2{font-size:32px;margin:0 0 22px;font-weight:900}
.cta .btn{background:#fff;color:var(--pink)}
/* 內頁標題 */
.phead{background:linear-gradient(135deg,var(--pink),var(--pink2));color:#fff;padding:56px 20px;text-align:center}
.phead h1{margin:0;font-size:34px;font-weight:900}
.phead p{margin:8px 0 0;opacity:.95}
/* 活動詳情 */
.detail{display:grid;grid-template-columns:1.6fr 1fr;gap:32px;align-items:start}
.detail .cover{border-radius:16px;overflow:hidden;box-shadow:var(--shadow);aspect-ratio:16/10;background:linear-gradient(135deg,var(--pink),var(--pink2))}
.detail .cover img{width:100%;height:100%;object-fit:cover}
.detail .body{background:var(--card);border-radius:16px;padding:26px;box-shadow:var(--shadow)}
.detail h1{margin:0 0 6px;font-size:28px}
.detail .tags{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.detail .tags span{background:var(--soft);color:var(--pink);font-size:13px;padding:4px 12px;border-radius:999px;font-weight:700}
.detail .content{line-height:1.95;overflow-wrap:anywhere}
.detail .content img{border-radius:10px;margin:12px 0}
.side-book{position:sticky;top:82px;background:var(--card);border-radius:16px;padding:24px;box-shadow:var(--shadow)}
.side-book .price{font-size:30px;font-weight:900;color:var(--pink);margin:0 0 4px}
.side-book dl{margin:16px 0;font-size:15px}
.side-book dt{color:var(--sub);float:left;width:76px;clear:left}
.side-book dd{margin:0 0 8px 84px}
.side-book .btn{width:100%;text-align:center;margin-top:8px}
.notice{background:var(--soft);border-radius:12px;padding:18px 20px;margin-top:22px;font-size:14.5px;color:var(--sub)}
.notice h3{margin:0 0 10px;font-size:17px;color:var(--ink)}
/* 表單/許願 */
.form{max-width:520px;margin:0 auto;background:var(--card);border-radius:16px;padding:30px;box-shadow:var(--shadow)}
.form label{display:block;font-weight:600;margin:14px 0 6px;font-size:15px}
.form input,.form select,.form textarea{width:100%;padding:11px 14px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit}
.form input:focus,.form select:focus,.form textarea:focus{outline:0;border-color:var(--pink)}
.form .btn{width:100%;margin-top:22px}
.form .row{display:flex;gap:14px}.form .row>div{flex:1}
.msg{padding:12px 16px;border-radius:10px;margin-bottom:16px;font-size:15px}
.msg.err{background:#ffe4ec;color:#c2185b}.msg.ok{background:#e3f7ec;color:#1b8a4c}
.empty{text-align:center;padding:60px 20px;color:var(--sub);background:var(--card);border-radius:16px}
.wishlist{max-width:760px;margin:32px auto 0;display:flex;flex-direction:column;gap:14px}
.wish{background:var(--card);border-radius:12px;padding:16px 20px;box-shadow:var(--shadow);display:flex;gap:14px;align-items:center}
.wish .v{background:var(--soft);color:var(--pink);font-weight:800;border-radius:10px;padding:8px 14px;text-align:center;min-width:56px}
.wish .v small{display:block;font-size:11px;color:var(--sub);font-weight:500}
.pager{display:flex;justify-content:center;gap:14px;margin:36px 0 0}
.pager a{padding:9px 22px;border-radius:999px;background:var(--soft);color:var(--pink);font-weight:600}
.media{display:flex;flex-wrap:wrap;gap:26px 40px;justify-content:center;align-items:center;opacity:.7}
.media span{font-weight:800;color:var(--sub);font-size:19px}
/* Footer */
footer{background:var(--dark);color:#c9bcc4;padding:52px 0 28px;font-size:14.5px}
footer .cols{display:grid;grid-template-columns:2fr 1fr 1fr;gap:32px;margin-bottom:28px}
footer h4{color:#fff;font-size:16px;margin:0 0 14px}
footer a{color:#c9bcc4}footer a:hover{color:var(--pink2)}
footer ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
footer .brand{font-size:24px;font-weight:900;color:#fff;letter-spacing:2px}
footer .social{display:flex;gap:14px;margin-top:14px}
footer .social a{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.1);display:grid;place-items:center;font-size:18px}
footer .social a:hover{background:var(--pink)}
footer .copy{border-top:1px solid rgba(255,255,255,.12);padding-top:18px;text-align:center;color:#8a7d85}
/* Modal */
dialog{border:0;border-radius:20px;padding:0;max-width:440px;width:calc(100% - 32px);box-shadow:0 30px 80px rgba(0,0,0,.4);background:var(--card);color:var(--ink)}
dialog::backdrop{background:rgba(20,8,16,.55);backdrop-filter:blur(3px)}
.modal{padding:32px}
.modal .x{position:absolute;top:14px;right:18px;background:none;border:0;font-size:26px;color:var(--sub);cursor:pointer}
.modal h2{margin:0 0 6px;font-size:26px;text-align:center}
.modal .tabs{display:flex;gap:8px;margin:18px 0 8px;background:var(--soft);border-radius:999px;padding:5px}
.modal .tabs button{flex:1;border:0;background:none;padding:9px;border-radius:999px;font:inherit;font-weight:700;color:var(--sub);cursor:pointer}
.modal .tabs button.on{background:var(--card);color:var(--pink);box-shadow:var(--shadow)}
.fbbtn{width:100%;background:#1877f2;color:#fff;border:0;border-radius:10px;padding:12px;font:inherit;font-weight:700;cursor:pointer;margin-bottom:10px;display:block;text-align:center}
.or{text-align:center;color:var(--sub);font-size:13px;margin:12px 0;position:relative}
.or::before,.or::after{content:"";position:absolute;top:50%;width:38%;height:1px;background:var(--line)}.or::before{left:0}.or::after{right:0}
.tos{font-size:13px;color:var(--sub);display:flex;gap:8px;align-items:flex-start;margin-top:12px}
@media(max-width:900px){.egrid,.feats,.hls{grid-template-columns:1fr 1fr}.detail{grid-template-columns:1fr}.plans{grid-template-columns:1fr}.side-book{position:static}footer .cols{grid-template-columns:1fr}}
@media(max-width:640px){.nav nav{display:none}.burger{display:block}.egrid,.feats,.hls{grid-template-columns:1fr}.hero h1{font-size:32px}.shead h2{font-size:26px}.stats{flex-direction:column}.stats .wrap{flex-direction:column}}
`;

// 導覽列
function navbar(env, active, member) {
  const items = [
    ['/event', '主題活動', 'event'],
    ['/article', '專題文章', 'article'],
    ['/wish', '活動許願池', 'wish'],
    ['/contact', '聯絡我們', 'contact'],
  ];
  const links = items
    .map(([href, name, key]) => `<a href="${href}"${active === key ? ' class="on"' : ''}>${name}</a>`)
    .join('');
  const right = member
    ? `<span class="who">Hi, ${esc(member.name || member.email)}${member.is_vip ? ' 👑' : ''}</span>
       <a class="link-btn" href="/user/events">我的活動</a>
       <a class="link-btn" href="/user/logout">登出</a>`
    : `<button class="link-btn" onclick="eros.open('login')">登入</button>
       <button class="btn" style="padding:8px 22px" onclick="eros.open('register')">免費註冊</button>`;
  return `<header class="nav"><div class="wrap">
    <a class="logo" href="/">eros</a>
    <nav>${links}</nav>
    <div class="right">${right}</div>
    <button class="burger" onclick="document.getElementById('m-nav').showModal()">☰</button>
  </div></header>`;
}

// 登入/註冊 Modal + 手機選單 + 前端小程式
function modals(env, member) {
  if (member) {
    return `<dialog id="m-nav"><div class="modal"><button class="x" onclick="this.closest('dialog').close()">×</button>
      <h2 style="font-size:20px">選單</h2>
      <nav style="display:flex;flex-direction:column;gap:14px;margin-top:18px;font-weight:600">
        <a href="/event">主題活動</a><a href="/article">專題文章</a>
        <a href="/wish">活動許願池</a><a href="/contact">聯絡我們</a><a href="/user/events">我的活動</a><a href="/user/logout">登出</a>
      </nav></div></dialog>`;
  }
  return `
  <dialog id="m-auth"><div class="modal">
    <button class="x" onclick="this.closest('dialog').close()">×</button>
    <div class="tabs">
      <button id="tab-login" class="on" onclick="eros.tab('login')">登入</button>
      <button id="tab-register" onclick="eros.tab('register')">註冊</button>
    </div>
    <form id="pane-login" method="post" action="/user/login">
      <a class="fbbtn" href="/user/fb_login">使用 Facebook 登入</a>
      <div class="or">或使用信箱登入</div>
      <input type="email" name="email" placeholder="信箱" required>
      <input type="password" name="password" placeholder="密碼" required style="margin-top:10px">
      <button class="btn" style="width:100%;margin-top:16px">登入</button>
    </form>
    <form id="pane-register" method="post" action="/user/register" style="display:none">
      <a class="fbbtn" href="/user/fb_login">使用 Facebook 註冊</a>
      <div class="or">或使用信箱註冊</div>
      <input type="text" name="name" placeholder="姓名" required>
      <div class="row" style="margin-top:10px">
        <div><select name="gender"><option value="">性別</option><option value="M">男</option><option value="F">女</option></select></div>
        <div><input type="tel" name="phone" placeholder="手機號碼"></div>
      </div>
      <input type="email" name="email" placeholder="信箱" required style="margin-top:10px">
      <input type="password" name="password" placeholder="設定密碼（至少 6 碼）" minlength="6" required style="margin-top:10px">
      <label class="tos"><input type="checkbox" name="agree" value="1" required style="width:auto;margin-top:4px">
        <span>我已年滿 18 歲，並已詳細閱讀並同意遵守<a href="/user/condition" style="color:var(--pink)">使用服務條款</a>與隱私權條款</span></label>
      <button class="btn" style="width:100%;margin-top:16px">立即註冊</button>
      <p style="font-size:12px;color:var(--sub);text-align:center;margin:12px 0 0">升級 VIP 會員將有專員電訪後開通 VIP 身份</p>
    </form>
  </div></dialog>
  <dialog id="m-nav"><div class="modal"><button class="x" onclick="this.closest('dialog').close()">×</button>
    <h2 style="font-size:20px">選單</h2>
    <nav style="display:flex;flex-direction:column;gap:14px;margin-top:18px;font-weight:600">
      <a href="/event">主題活動</a><a href="/article">專題文章</a>
      <a href="/wish">活動許願池</a><a href="/contact">聯絡我們</a>
      <a href="#" onclick="document.getElementById('m-nav').close();eros.open('login');return false">登入 / 註冊</a>
    </nav></div></dialog>
  <script>
  window.eros={
    open:function(t){var d=document.getElementById('m-auth');if(!d)return;this.tab(t);if(!d.open)d.showModal()},
    tab:function(t){['login','register'].forEach(function(k){
      document.getElementById('tab-'+k).classList.toggle('on',k===t);
      document.getElementById('pane-'+k).style.display=(k===t)?'block':'none';})}
  };
  (function(){var h=location.hash.replace('#','');if(h==='login'||h==='register')eros.open(h);})();
  </script>`;
}

function footer(env) {
  const blog = env.BLOG_URL || 'https://blog-eros.ek21.com';
  return `<footer><div class="wrap">
    <div class="cols">
      <div>
        <div class="brand">eros</div>
        <p style="margin:12px 0 0">eros 主題派對主打多元有趣的主題活動，從派對、廚藝、郊遊、手作教室到聯誼活動應有盡有，讓大家自然認識彼此，輕鬆交友拓展交友圈！</p>
        <div class="social">
          <a href="mailto:${esc(env.CONTACT_EMAIL || 'eros@ek21.com')}" title="Email">✉</a>
          <a href="${esc(env.CONTACT_LINE || '#')}" title="LINE">L</a>
          <a href="${esc(env.CONTACT_FB || '#')}" title="Facebook">f</a>
        </div>
      </div>
      <div><h4>關於 eros</h4><ul>
        <li><a href="${blog}/about/">關於 Eros</a></li>
        <li><a href="/user/condition">隱私權條款</a></li>
        <li><a href="${blog}/qa/">常見問題</a></li>
        <li><a href="${blog}/category/news/">最新消息</a></li>
      </ul></div>
      <div><h4>聯絡我們</h4><ul>
        <li><a href="mailto:${esc(env.CONTACT_EMAIL || 'eros@ek21.com')}">${esc(env.CONTACT_EMAIL || 'eros@ek21.com')}</a></li>
        <li><a href="${blog}/cooperation/">合作提案</a></li>
        <li><a href="/contact">聯絡表單</a></li>
      </ul></div>
    </div>
    <div class="copy">© 2015 - ${new Date().getFullYear()} eros 主題派對 · 尋夢園旗下品牌 · All Rights Reserved.</div>
  </div></footer>`;
}

export function layout(env, { title, description, body, active = '', member = null, status = 200, canonical = '' } = {}) {
  const site = env.SITE_NAME || 'eros 主題派對';
  const fullTitle = title ? `${title} | ${site}` : `${site} | ${env.SITE_TAGLINE || '意想不到的主題活動'}`;
  const desc = description || 'eros 主題派對主打多元有趣的主題活動，從派對、廚藝、郊遊、手作教室到聯誼活動應有盡有，希望讓大家自然認識彼此，豐富下班生活，輕鬆交友拓展交友圈！';
  const html = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="eros,交友,主題活動,主題派對,交友活動,聯誼活動">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="${esc(site)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_TW">
<meta property="og:image" content="https://ek21.com/images/eros/org_eros.png">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta name="theme-color" content="#ff2e88">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2224%22 fill=%22%23ff2e88%22/><text x=%2250%22 y=%2272%22 font-size=%2258%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22sans-serif%22 font-weight=%22bold%22>e</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>${CSS}</style>
</head>
<body>
${navbar(env, active, member)}
${body}
${footer(env)}
${modals(env, member)}
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // 頁面內容依登入狀態不同（導覽列、報名狀態），不可被瀏覽器/CDN 快取，否則登入後仍看到未登入畫面
      'cache-control': 'private, no-store',
    },
  });
}

// 小工具：帶訊息重導（用 query flash）
export function redirect(location, cookies = []) {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}

export { REAL_CATEGORIES };
