// 幫「沒有主圖」的活動自動配圖（從 public/media/blog/ 找情境最接近的文章圖片）。
// 用法：
//   node scripts/event_images.mjs            # 只預覽配對結果，寫出 scripts/event_images.sql
//   node scripts/event_images.mjs --apply    # 預覽後直接寫入遠端 D1
//   node scripts/event_images.mjs --all      # 連已有主圖的活動也重配
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { buildIndex, pickImage } from '../src/match.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL = args.includes('--all');

// 直接用 node 跑專案內的 wrangler（不經 shell，SQL 參數才不會被拆開）
const WRANGLER = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const wrangler = (a, opts) => execFileSync(process.execPath, [WRANGLER, 'd1', 'execute', 'eros', '--remote', ...a], opts);

function d1(sql) {
  const out = wrangler(['--json', '--command', sql], {
    encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
}

console.log('讀取文章與活動…');
const articles = d1('SELECT id,title,excerpt,content,cover,category FROM articles WHERE status=1');
const events = d1(`SELECT id,title,summary,intro,image FROM events ${ALL ? '' : "WHERE image IS NULL OR image=''"} ORDER BY id`);
console.log(`文章 ${articles.length} 篇、待配圖活動 ${events.length} 筆`);

const index = buildIndex(articles);
const used = new Map();
const lines = [];
let missing = 0;
for (const e of events) {
  const img = pickImage(e, index, used);
  if (!img) continue;
  // 確認圖片檔真的在 public 裡
  if (!existsSync(new URL(`../public${img}`, import.meta.url))) { missing++; continue; }
  lines.push(`UPDATE events SET image='${img.replace(/'/g, "''")}' WHERE id=${e.id};`);
  if (lines.length <= 25) console.log(`  #${e.id} ${e.title}  →  ${img}`);
}
const distinct = new Set(lines.map((l) => l.match(/'(.*?)'/)[1])).size;
console.log(`共配 ${lines.length} 筆（不同圖片 ${distinct} 張${missing ? `，${missing} 筆圖檔不存在已略過` : ''}）`);

const file = new URL('./event_images.sql', import.meta.url);
writeFileSync(file, lines.join('\n') + '\n');
console.log('已寫出 scripts/event_images.sql');

if (APPLY && lines.length) {
  wrangler(['--yes', '--file', 'scripts/event_images.sql'], { stdio: 'inherit' });
  console.log('已寫入 D1。');
}
