# -*- coding: utf-8 -*-
"""
把 blog-eros.ek21.com（WordPress）的所有專題文章與圖片，搬到新站：
  1. 用 wp-json 取全部文章（標題、內文、摘要、分類、封面、日期）
  2. 下載每篇的封面與內文圖片到 public/media/blog/（隨部署上傳，網址 /media/blog/…）
  3. 改寫內文的 <img> 指向本站（下載失敗的圖片移除），移除 <script>/srcset
  4. POST 到新站 /admin/import（table=articles）

用法：
    pip install requests
    python scripts/blog_migrate.py --site https://eros.ek21.workers.dev --token <ADMIN_TOKEN>

之後執行  npm run deploy  把圖片與資料一起上線。
"""
import argparse, os, re, json, time, hashlib, html
import requests

WP = "https://blog-eros.ek21.com/wp-json/wp/v2"
HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.normpath(os.path.join(HERE, "..", "public", "media", "blog"))
UA = {"User-Agent": "Mozilla/5.0 (compatible; eros-migrate/1.0)"}

# WordPress 分類 id → 新站 slug
WPCAT = {35: "loveblog", 2: "news", 73: "selected", 79: "couple", 65: "random",
         60: "fashion", 58: "makeupdiet", 59: "travel", 61: "foodrecipe",
         62: "diy", 74: "health", 56: "blooper", 72: "hot", 1: "loveblog"}

session = requests.Session()
session.headers.update(UA)
img_cache = {}   # 原圖 URL → 本站路徑（或 None 表下載失敗）


def to_ms(iso):
    try:
        return int(time.mktime(time.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S")) * 1000)
    except Exception:
        return int(time.time() * 1000)


def download_image(url):
    """下載一張圖片存到 public/media/blog/，回傳本站路徑；失敗回 None。"""
    if not url or url.startswith("data:"):
        return None
    if url in img_cache:
        return img_cache[url]
    try:
        r = session.get(url, timeout=25)
        ct = r.headers.get("content-type", "")
        if r.status_code != 200 or not ct.startswith("image"):
            img_cache[url] = None
            return None
        ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif",
               "image/webp": ".webp"}.get(ct.split(";")[0].strip(), "")
        if not ext:
            m = re.search(r"\.(jpe?g|png|gif|webp)(?:\?|$)", url, re.I)
            ext = ("." + m.group(1).lower().replace("jpeg", "jpg")) if m else ".jpg"
        name = hashlib.md5(url.encode("utf-8")).hexdigest()[:16] + ext
        with open(os.path.join(MEDIA_DIR, name), "wb") as f:
            f.write(r.content)
        path = "/media/blog/" + name
        img_cache[url] = path
        return path
    except Exception:
        img_cache[url] = None
        return None


def rewrite_content(html_text):
    """下載內文圖片、改寫 <img src>，移除 srcset 與 <script>；失敗的圖片整個 <img> 拿掉。"""
    html_text = re.sub(r"<script[\s\S]*?</script>", "", html_text, flags=re.I)
    html_text = re.sub(r'\ssrcset="[^"]*"', "", html_text)
    html_text = re.sub(r'\ssizes="[^"]*"', "", html_text)

    def repl(m):
        tag = m.group(0)
        src = re.search(r'src="([^"]+)"', tag)
        if not src:
            return ""
        local = download_image(html.unescape(src.group(1)))
        if not local:
            return ""  # 下載不到就移除，避免外連
        return re.sub(r'src="[^"]+"', 'src="%s"' % local, tag)

    html_text = re.sub(r"<img\b[^>]*>", repl, html_text, flags=re.I)
    # 移除變成空殼的連結（<a ...></a>）
    html_text = re.sub(r"<a\b[^>]*>\s*</a>", "", html_text, flags=re.I)
    return html_text.strip()


def clean_text(t):
    return html.unescape(re.sub(r"<[^>]+>", "", t or "")).strip()


def fetch_all():
    posts = []
    page = 1
    while True:
        r = session.get(WP + "/posts", params={"per_page": 100, "page": page, "_embed": "1"}, timeout=40)
        if r.status_code != 200:
            break
        batch = r.json()
        if not batch:
            break
        posts.extend(batch)
        total_pages = int(r.headers.get("x-wp-totalpages", "1"))
        print("  取得第 %d/%d 頁，共 %d 篇" % (page, total_pages, len(posts)))
        if page >= total_pages:
            break
        page += 1
    return posts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--token", required=True)
    ap.add_argument("--limit", type=int, default=0, help="只處理前 N 篇（測試用）")
    args = ap.parse_args()

    os.makedirs(MEDIA_DIR, exist_ok=True)
    print("抓取文章清單…")
    posts = fetch_all()
    if args.limit:
        posts = posts[: args.limit]
    print("共 %d 篇，開始下載圖片並改寫內文…" % len(posts))

    rows = []
    for i, p in enumerate(posts, 1):
        cats = p.get("categories") or []
        slug = next((WPCAT[c] for c in cats if c in WPCAT), "loveblog")
        # 封面
        cover = None
        fm = p.get("_embedded", {}).get("wp:featuredmedia", [])
        if fm and isinstance(fm, list) and fm[0].get("source_url"):
            cover = download_image(fm[0]["source_url"])
        content = rewrite_content(p["content"]["rendered"])
        if not cover:
            # 沒有封面時，用內文第一張本站圖當封面
            m = re.search(r'<img[^>]+src="(/media/blog/[^"]+)"', content)
            if m:
                cover = m.group(1)
        excerpt = clean_text(p.get("excerpt", {}).get("rendered", ""))[:120] or clean_text(content)[:120]
        rows.append({
            "legacy_id": p["id"],
            "title": clean_text(p["title"]["rendered"]) or "（無標題）",
            "category": slug,
            "excerpt": excerpt,
            "content": content,
            "cover": cover or "",
            "published_at": to_ms(p.get("date", "")),
            "status": 1,
        })
        if i % 20 == 0:
            print("  已處理 %d/%d 篇，圖片 %d 張" % (i, len(posts), len([v for v in img_cache.values() if v])))

    print("上傳文章資料到新站…（%d 篇，圖片 %d 張）" % (len(rows), len([v for v in img_cache.values() if v])))
    # 分批 POST，第一批 truncate
    for i in range(0, len(rows), 50):
        chunk = rows[i:i + 50]
        r = requests.post(args.site.rstrip("/") + "/admin/import",
                          params={"token": args.token},
                          json={"table": "articles", "rows": chunk, "truncate": (i == 0)},
                          timeout=120)
        try:
            print("  批次 %d: %s" % (i // 50, r.json()))
        except Exception:
            print("  批次 %d: HTTP %s %s" % (i // 50, r.status_code, r.text[:200]))
    print("完成。圖片已存到 public/media/blog/，記得執行 npm run deploy 上線。")


if __name__ == "__main__":
    main()
