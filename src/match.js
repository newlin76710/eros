// 活動配圖：活動沒有主圖時，從本站專題文章的圖片（public/media/blog/）中，
// 找情境與活動標題／摘要最接近的一張。
// 做法：中文字元 bigram + IDF 權重比對「活動文字」與「文章標題/摘要/內文」，
// 花絮、手作、美食、旅遊類文章多為活動現場照，加權優先；心理測驗類圖多為示意圖，降權。
// 純函式、無外部相依，Worker 與 Node 腳本（scripts/event_images.mjs）共用。

const CAT_BOOST = { blooper: 1.6, diy: 1.3, foodrecipe: 1.3, travel: 1.2, news: 1.1, random: 0.4 };
// 這些字詞幾乎每篇都有，對判斷情境沒幫助
const STOP = /(活動|聯誼|單身|主題|派對|eros|一起|我們|你的|自己|什麼|可以|就是|這個|一個|男女|朋友|報名)/gi;

const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');

export function bigrams(text) {
  const t = stripHtml(text).toLowerCase().replace(STOP, ' ');
  const out = new Map();
  // 以非中英數字切段，段內取連續兩字
  for (const seg of t.split(/[^\p{Script=Han}a-z0-9]+/u)) {
    const chars = [...seg];
    for (let i = 0; i + 1 < chars.length; i++) {
      const g = chars[i] + chars[i + 1];
      out.set(g, (out.get(g) || 0) + 1);
    }
  }
  return out;
}

export const imagesInHtml = (html) =>
  [...String(html || '').matchAll(/src="(\/media\/blog\/[^"]+)"/g)].map((m) => m[1]);

// 建索引。articles: [{ id, title, excerpt, content?, cover?, category }]
export function buildIndex(articles) {
  const docs = articles.map((a) => {
    const vec = bigrams(a.title);
    for (const [g, n] of vec) vec.set(g, n * 3); // 標題權重較高
    for (const [g, n] of bigrams(`${a.excerpt || ''} ${stripHtml(a.content).slice(0, 800)}`)) vec.set(g, (vec.get(g) || 0) + n);
    const imgs = [...new Set([a.cover, ...imagesInHtml(a.content)].filter((x) => x && x.startsWith('/media/blog/')))];
    return { id: a.id, category: a.category, vec, imgs };
  }).filter((d) => d.imgs.length);
  const df = new Map();
  for (const d of docs) for (const g of d.vec.keys()) df.set(g, (df.get(g) || 0) + 1);
  const N = docs.length || 1;
  const idf = (g) => Math.log((N + 1) / ((df.get(g) || 0) + 1));
  return { docs, idf };
}

function score(eventVec, doc, idf) {
  let s = 0;
  for (const [g, n] of eventVec) {
    const m = doc.vec.get(g);
    if (m) s += Math.min(n, 3) * Math.log(1 + m) * idf(g) ** 2;
  }
  return s * (CAT_BOOST[doc.category] ?? 1);
}

const eventText = (e) => `${e.title || ''} ${e.title || ''} ${e.summary || ''} ${stripHtml(e.intro).slice(0, 300)}`;

// 替單一活動挑圖。used：已用過的圖片（Map 圖→次數），用來讓各活動盡量不同圖。
export function pickImage(event, index, used = new Map()) {
  const ev = bigrams(eventText(event));
  let best = null;
  let bestScore = -1;
  for (const d of index.docs) {
    const uses = d.imgs.reduce((n, i) => n + (used.get(i) || 0), 0);
    const s = score(ev, d, index.idf) / (1 + uses * 0.8);
    if (s > bestScore) { bestScore = s; best = d; }
  }
  if (!best || bestScore <= 0) {
    // 完全比不到時，從花絮照輪流挑
    const pool = index.docs.filter((d) => d.category === 'blooper').flatMap((d) => d.imgs);
    if (!pool.length) return null;
    const img = pool.reduce((a, b) => ((used.get(b) || 0) < (used.get(a) || 0) ? b : a));
    used.set(img, (used.get(img) || 0) + 1);
    return img;
  }
  const img = best.imgs.reduce((a, b) => ((used.get(b) || 0) < (used.get(a) || 0) ? b : a));
  used.set(img, (used.get(img) || 0) + 1);
  return img;
}
