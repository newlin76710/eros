// Cloudflare Worker 進入點：路由分派。
import { currentMember } from './auth.js';
import {
  home, eventList, eventOne, eventJoin, eventCancel, myEvents, wishPage, wishSubmit,
  contactPage, conditionPage, login, register, logout, fbLogin, fbCallback,
  articleList, articleOne,
} from './pages.js';
import { handleAdmin } from './admin.js';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    try {
      // 後台（含匯入 API）
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return await handleAdmin(env, req, url);
      }

      // robots / sitemap
      if (pathname === '/robots.txt') {
        return new Response(`User-agent: *\nAllow: /\nSitemap: ${(env.SITE_URL || '')}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
      }
      if (pathname === '/sitemap.xml') return await sitemap(env);

      // 會員動作
      if (pathname === '/user/login' && method === 'POST') return await login(env, req);
      if (pathname === '/user/register' && method === 'POST') return await register(env, req);
      if (pathname === '/user/logout') return await logout(env, req);
      if (pathname === '/user/fb_login') return fbLogin(env, req, url);
      if (pathname === '/user/fb_callback') return await fbCallback(env, req, url);
      if (pathname === '/user/condition') return conditionPage(env, await currentMember(req, env));

      // 目前登入會員（前台頁面需要）
      const member = await currentMember(req, env);

      // 前台頁面
      if (pathname === '/' || pathname === '') return await home(env, member);
      if (pathname === '/event') return await eventList(env, url, member);

      const one = pathname.match(/^\/event\/one\/(\d+)$/);
      if (one) return await eventOne(env, parseInt(one[1], 10), member, url);

      if (pathname === '/event/join' && method === 'POST') return await eventJoin(env, req, member);
      if (pathname === '/event/cancel' && method === 'POST') return await eventCancel(env, req, member);
      if (pathname === '/user/events') return await myEvents(env, member);

      if (pathname === '/article') return await articleList(env, url, member);
      const art = pathname.match(/^\/article\/(\d+)$/);
      if (art) return await articleOne(env, parseInt(art[1], 10), member);

      if (pathname === '/wish' && method === 'POST') return await wishSubmit(env, req, member);
      if (pathname === '/wish') return await wishPage(env, url, member);

      if (pathname === '/contact') return contactPage(env, member);

      return notFound(env, member);
    } catch (err) {
      return new Response(`伺服器錯誤：${err && err.message ? err.message : err}`, {
        status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  },
};

async function sitemap(env) {
  const base = env.SITE_URL || '';
  let ids = [];
  try {
    ids = (await env.DB.prepare('SELECT id FROM events WHERE status=1 ORDER BY id DESC LIMIT 1000').all()).results;
  } catch { /* */ }
  let artIds = [];
  try {
    artIds = (await env.DB.prepare('SELECT id FROM articles WHERE status=1 ORDER BY id DESC LIMIT 2000').all()).results;
  } catch { /* */ }
  const urls = ['/', '/event', '/article', '/wish', '/contact', '/user/condition']
    .map((p) => `<url><loc>${base}${p}</loc></url>`)
    .concat(ids.map((e) => `<url><loc>${base}/event/one/${e.id}</loc></url>`))
    .concat(artIds.map((a) => `<url><loc>${base}/article/${a.id}</loc></url>`))
    .join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}

function notFound(env, member) {
  // 找不到的路徑一律導回首頁
  return new Response(null, { status: 302, headers: { location: '/' } });
}
