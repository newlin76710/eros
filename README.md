# eros 主題派對（全新版）

參考 [eros.ek21.com](https://eros.ek21.com) 重新打造的 eros 主題派對網站——尋夢園旗下的交友活動品牌。
整站是 **serverless**，跑在 **Cloudflare Workers + D1**，結構與姊妹站 `ek21news`、`dating` 一致。
資料庫（D1）保存**會員資料**、活動、報名與許願，並可從舊站 MySQL 完整匯入。

## 功能

- **首頁**：主視覺、營運數字、最新活動、三大特色、精彩花絮、媒體報導、會員方案、行動呼籲
- **主題活動** `/event`：分類篩選（娛樂遊戲／手作教學／專業講座／其他活動）、分頁
- **活動詳情** `/event/one/:id`：內容、注意事項、線上報名
- **活動許願池** `/wish`：會員許願、清單
- **會員系統**：信箱＋密碼註冊／登入、session cookie；相容舊站 **MD5** 密碼（登入後自動升級為 PBKDF2）
- **後台** `/admin`：儀表板、活動 CRUD、會員查詢、報名／許願清單、舊資料匯入 API
- `sitemap.xml`、`robots.txt`

## 技術結構

| 檔案 | 說明 |
|---|---|
| `src/index.js` | Worker 進入點與路由 |
| `src/config.js` | 站台設定、活動分類、文案、統計數字 |
| `src/render.js` | 全站 HTML 版型與 CSS、活動卡片、登入/註冊 Modal |
| `src/pages.js` | 前台各頁與會員登入/註冊/報名/許願 |
| `src/admin.js` | 後台與 `/admin/import` 匯入 API |
| `src/auth.js` | 密碼雜湊（PBKDF2）、MD5 相容驗證、session、cookie |
| `src/md5.js` | 純 JS MD5（僅供相容舊密碼） |
| `schema.sql` | D1 資料表（members / sessions / events / registrations / wishes） |
| `seed.sql` | 示範活動 |
| `scripts/migrate.py` | 從舊 MySQL 遷移會員與活動到新站 |

## 本機開發

```bash
npm install
npm run db:init:local     # 建立本機 D1 資料表
npm run db:seed:local     # 灌入示範活動
npm run dev               # http://localhost:8787
```

`.dev.vars`（複製自 `.dev.vars.example`）放本機用的 `ADMIN_TOKEN`。
後台：`http://localhost:8787/admin?token=你的ADMIN_TOKEN`

## 部署到 Cloudflare

```bash
npm install
npx wrangler login
npx wrangler d1 create eros          # 把輸出的 database_id 貼進 wrangler.toml
npm run db:init                      # 遠端建表
npm run db:seed                      # （可選）示範活動
npx wrangler secret put ADMIN_TOKEN  # 後台密碼
npx wrangler secret put SESSION_SECRET
npm run deploy
```

部署後在 Cloudflare 後台把網域 `eros.ek21.com` 綁到本 Worker（Custom Domain 或 Route）。

## 從舊站匯入會員與活動

舊資料在 `eros3.ek21.com` 的 MySQL（會員 39,532 筆、活動 397 筆）。
部署完成、`ADMIN_TOKEN` 設好後執行：

```bash
pip install requests
python scripts/migrate.py --site https://eros.ek21.com --token <ADMIN_TOKEN> --what events
python scripts/migrate.py --site https://eros.ek21.com --token <ADMIN_TOKEN> --what members --truncate
```

- 會員以 **email** 去重；沒有有效 email 的舊資料會略過。
- 舊密碼是 MD5，匯入後存為 `md5$...`，會員**首次登入成功即自動升級**為 PBKDF2，舊會員可用原密碼登入。
- 活動舊圖的公開路徑已失效，`image` 匯入時留空，請在後台補上新圖 URL。

匯入也可直接呼叫 API：

```
POST /admin/import?token=<ADMIN_TOKEN>
Content-Type: application/json
{ "table": "members" | "events", "rows": [ {...} ], "truncate": false }
```

## 網域與品牌

- 正式網址 `https://eros.ek21.com`（掛在子網域根目錄，`BASE=''`）
- 專題文章沿用 `https://blog-eros.ek21.com`
- 尋夢園旗下品牌，與 `dating`、`shesay`、`ek21news` 同一套 serverless 做法
