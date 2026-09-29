# -*- coding: utf-8 -*-
"""
把舊站 MySQL（eros3.ek21.com 的 eros 資料庫）的會員與活動，
分批讀出、轉成新 D1 欄位，POST 到新站的 /admin/import。

用法：
    pip install requests
    python scripts/migrate.py --site https://eros.ek21.com --token <ADMIN_TOKEN> --what members
    python scripts/migrate.py --site https://eros.ek21.com --token <ADMIN_TOKEN> --what events

只讀舊庫、只寫新站，不修改舊庫。可重複執行（members 以 email 去重；events 會先清空再匯入）。
舊密碼是 MD5，會加上 md5$ 前綴存入；會員首次登入成功後由網站自動升級為 PBKDF2。
"""
import argparse, re, html, json, time, sys
import requests

PMA = "http://eros3.ek21.com/myadm4/"
DBUSER, DBPW, DBNAME = "dbuser", "QQAAWWSS", "eros"

# 舊分類 id → 新前台分類 slug
CAT_MAP = {18: "game", 19: "craft", 16: "talk", 17: "craft", 21: "other", 5: "other", 1: "other"}
VIP_CAT = 14  # rel_event_cate 內含此 id 代表 VIP 限定


def pma_login():
    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0", "Referer": PMA})
    r = s.get(PMA + "index.php")

    def attr(n, t):
        m = re.search(r'name="' + re.escape(n) + r'"[^>]*value="([^"]*)"', t)
        return html.unescape(m.group(1)) if m else None

    d = {"token": attr("token", r.text), "pma_username": DBUSER,
         "pma_password": DBPW, "server": "1", "target": "index.php"}
    ss = attr("set_session", r.text)
    if ss:
        d["set_session"] = ss
    s.post(PMA + "index.php", data=d)
    if "pmaAuth-1" not in s.cookies.get_dict():
        sys.exit("舊庫登入失敗，請確認帳密。")
    home = s.get(PMA + "index.php").text
    # 掃出目前 token
    key = 'token:"'
    i = home.find(key)
    j = i + len(key)
    out = []
    while j < len(home) and home[j] != '"':
        if home[j] == "\\":
            out.append(home[j:j + 2]); j += 2; continue
        out.append(home[j]); j += 1
    try:
        tok = json.loads('"' + "".join(out) + '"')
    except Exception:
        tok = "".join(out)
    return s, tok


def sql_json(s, tok, query, max_rows=2000):
    """執行 SQL，回傳資料列（解析 phpMyAdmin 的 HTML 表格）。
    用 sql.php 並把 session_max_rows 設大，避免只回預設的前 25 列。"""
    r = s.post(PMA + "sql.php",
               data={"token": tok, "db": DBNAME, "ajax_request": "true",
                     "sql_query": query, "pos": "0", "session_max_rows": str(max_rows)},
               headers={"X-Requested-With": "XMLHttpRequest"})
    try:
        txt = r.json().get("message", "")
    except Exception:
        txt = r.text
    # 解析結果表：找出表頭與資料列
    # phpMyAdmin 會把資料放在 class="data" 的 table
    rows = []
    # 抓每個 <tr>，取 data 欄位（有 data-type 或 class 含 grid_edit 的 td）
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", txt, re.S):
        tds = re.findall(r'<td[^>]*class="[^"]*\bdata\b[^"]*"[^>]*>(.*?)</td>', tr, re.S)
        if not tds:
            continue
        vals = []
        for c in tds:
            c = re.sub(r"<[^>]+>", "", c)
            vals.append(html.unescape(c).strip())
        rows.append(vals)
    return rows


def to_ms(dt):
    if not dt or dt.startswith("0000"):
        return int(time.time() * 1000)
    try:
        return int(time.mktime(time.strptime(dt, "%Y-%m-%d %H:%M:%S")) * 1000)
    except Exception:
        try:
            return int(time.mktime(time.strptime(dt[:10], "%Y-%m-%d")) * 1000)
        except Exception:
            return int(time.time() * 1000)


def post_import(site, token, table, rows, truncate=False):
    r = requests.post(site.rstrip("/") + "/admin/import",
                      params={"token": token},
                      json={"table": table, "rows": rows, "truncate": truncate},
                      timeout=120)
    try:
        return r.json()
    except Exception:
        return {"status": r.status_code, "text": r.text[:300]}


def migrate_members(s, tok, site, token):
    cols = ["id", "email", "name", "phone", "password", "fb_account", "sex", "birth",
            "city", "zone", "address", "education", "job_category", "job_title",
            "height", "weight", "text", "img", "source", "location", "contact_status",
            "time", "status"]
    total = int(sql_json(s, tok, "SELECT COUNT(*) FROM member")[0][0])
    print(f"會員總數 {total}")
    batch, offset, first = 500, 0, True
    while offset < total:
        q = ("SELECT " + ",".join("`%s`" % c for c in cols) +
             f" FROM member ORDER BY id LIMIT {batch} OFFSET {offset}")
        raw = sql_json(s, tok, q)
        out = []
        for r in raw:
            d = dict(zip(cols, r))
            email = (d["email"] or "").strip().lower()
            if not email or "@" not in email:
                continue  # 沒有有效 email 無法當登入帳號，略過
            pw = (d["password"] or "").strip()
            out.append({
                "legacy_id": int(d["id"]),
                "email": email,
                "name": d["name"] or None,
                "phone": (d["phone"] or None),
                "password_hash": ("md5$" + pw) if re.fullmatch(r"[a-fA-F0-9]{32}", pw or "") else None,
                "fb_account": d["fb_account"] or None,
                "gender": (d["sex"] or "").upper()[:1] or None,
                "birth": None if (not d["birth"] or d["birth"].startswith("0000")) else d["birth"],
                "city": d["city"] or None, "zone": d["zone"] or None, "address": d["address"] or None,
                "education": d["education"] or None, "job_category": d["job_category"] or None,
                "job_title": d["job_title"] or None, "height": d["height"] or None, "weight": d["weight"] or None,
                "intro": d["text"] or None, "avatar": d["img"] or None, "source": d["source"] or None,
                "location": d["location"] or None, "contact_status": d["contact_status"] or None,
                "is_vip": 0,
                "status": 1 if str(d["status"]) == "1" else 0,
                "created_at": to_ms(d["time"]), "updated_at": to_ms(d["time"]),
            })
        res = post_import(site, token, "members", out, truncate=(first and "--truncate" in sys.argv))
        print(f"  offset {offset}: 讀 {len(raw)} 寫 {res}")
        first = False
        offset += batch
        if not raw:
            break


def migrate_events(s, tok, site, token):
    # 先抓分類關聯
    rels = sql_json(s, tok, "SELECT event_id, category_id FROM rel_event_cate WHERE status=1")
    cat_of, vip_of = {}, set()
    for ev, cid in rels:
        ev, cid = int(ev), int(cid)
        if cid == VIP_CAT:
            vip_of.add(ev)
        elif ev not in cat_of and cid in CAT_MAP:
            cat_of[ev] = CAT_MAP[cid]
    cols = ["id", "name", "event_date", "event_date_text", "event_time_text", "location",
            "address", "text", "schedule", "notice", "notice2", "price_m", "price_f",
            "limit_m", "limit_f", "img", "video"]
    raw = sql_json(s, tok, "SELECT " + ",".join("`%s`" % c for c in cols) + " FROM event ORDER BY id")
    out = []
    for r in raw:
        d = dict(zip(cols, r))
        eid = int(d["id"])
        text = d["text"] or ""
        out.append({
            "legacy_id": eid,
            "title": d["name"] or "（未命名活動）",
            "category": cat_of.get(eid, "other"),
            "is_vip": 1 if eid in vip_of else 0,
            "date_text": d["event_date_text"] or None,
            "event_date": None if (not d["event_date"] or d["event_date"].startswith("0000")) else d["event_date"],
            "time_text": d["event_time_text"] or None,
            "city": d["location"] or None,
            "address": d["address"] or None,
            "price_m": int(d["price_m"] or 0), "price_f": int(d["price_f"] or 0),
            "limit_m": int(d["limit_m"] or 0), "limit_f": int(d["limit_f"] or 0),
            "summary": re.sub(r"<[^>]+>", "", text)[:80] or None,
            "intro": text or None, "schedule": d["schedule"] or None,
            "notice": d["notice"] or None, "notice2": d["notice2"] or None,
            "image": "",  # 舊圖公開路徑已失效，留空由後台補
            "video": d["video"] or None,
            "status": 1,
        })
    res = post_import(site, token, "events", out, truncate=True)
    print(f"活動：讀 {len(raw)} 寫 {res}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="新站網址，例：https://eros.ek21.com")
    ap.add_argument("--token", required=True, help="新站 ADMIN_TOKEN")
    ap.add_argument("--what", choices=["members", "events", "all"], default="all")
    ap.add_argument("--truncate", action="store_true", help="會員匯入前先清空")
    ap.parse_args()
    args = ap.parse_args()
    s, tok = pma_login()
    print("舊庫登入成功。")
    if args.what in ("events", "all"):
        migrate_events(s, tok, args.site, args.token)
    if args.what in ("members", "all"):
        migrate_members(s, tok, args.site, args.token)
    print("完成。")


if __name__ == "__main__":
    main()
