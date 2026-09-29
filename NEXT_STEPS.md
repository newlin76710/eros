# eros 收尾待辦（明天執行）

## 目前狀態（2026-09-29）

| 項目 | 狀態 |
|---|---|
| 網站程式 | ✅ 已上線 https://eros.ek21.workers.dev |
| Worker 名稱 | `eros` |
| D1 資料庫 | `eros`（id `25b2e03f-f7ac-4649-885d-b9ab01102999`） |
| 會員 | ✅ 已匯入 **39,400 筆**（舊庫 39,532，略過無 email 132 筆） |
| 活動 | ✅ 已匯入 **397 筆** |
| 專題文章圖片 | ✅ 已下載 **1,327 張**並部署到本站 `/media/blog/…` |
| 專題文章文字 | ⏳ **尚未寫入 D1**（今天 D1 免費寫入額度用完，被擋） |

**後台**：https://eros.ek21.workers.dev/admin?token=`KHLk_r_Dp0XX-FF8SQQ6wXVk8uuii_KC`
（此 token 就是 `ADMIN_TOKEN` secret，也存在 `C:\tmp\admin_token.txt`）

---

## 明天要做的唯一一件事：補灌 475 篇專題文章

D1 免費方案每日寫入上限 **100,000 列**，今天被 3.9 萬筆會員（含索引放大約 19.7 萬列）用光。
額度在 **UTC 午夜＝台灣時間每天早上 08:00** 重置。

**08:00 之後**，在專案資料夾開終端機執行這一行即可（圖片已在本機、腳本會自動跳過重新下載，只重建文字並寫入 D1，約幾秒～1 分鐘）：

```bash
cd C:\Users\88691\Documents\GitHub\eros
python scripts/blog_migrate.py --site https://eros.ek21.workers.dev --token KHLk_r_Dp0XX-FF8SQQ6wXVk8uuii_KC
```

> 需要 Python 與 requests：`pip install requests`

跑完會看到每批 `{'ok': True, 'table': 'articles', 'inserted': ...}`，加總約 475。
完成後開 https://eros.ek21.workers.dev/article 就能看到全部文章（含圖片）。

### 驗證

```bash
# 看文章筆數
npx wrangler d1 execute eros --remote --command "SELECT COUNT(*) FROM articles"
# 或直接開頁面
#   https://eros.ek21.workers.dev/article
#   https://eros.ek21.workers.dev/admin?token=KHLk_r_Dp0XX-FF8SQQ6wXVk8uuii_KC （儀表板會顯示文章數）
```

### 如果又遇到「D1 daily write limit」

代表當天又有大量寫入把額度用掉。等隔天 08:00 再跑，或升級 **Workers Paid（約 US$5/月）** 立即解除額度限制後再跑同一行指令。

---

## 之後還可以做的（非必要）

1. **綁正式網域 `eros.ek21.com`**
   - Cloudflare 後台 → Workers & Pages → `eros` → Settings → Domains & Routes → 加 Custom Domain `eros.ek21.com`
   - 綁好後後台網址改成 `https://eros.ek21.com/admin?token=...`
2. **活動封面圖**：舊站活動圖路徑已失效，目前活動用漸層預設卡。可在後台 `/admin/events` 逐一編輯補上新圖 URL。
3. **Facebook 登入**：目前註冊/登入用信箱＋密碼；FB 登入按鈕保留位置，OAuth 尚未串接。
4. **重跑會員遷移**（若舊庫有新增會員）：
   ```bash
   python scripts/migrate.py --site https://eros.ek21.workers.dev --token KHLk_r_Dp0XX-FF8SQQ6wXVk8uuii_KC --what members
   ```
   （以 email 去重，不會覆蓋既有；注意一樣受 D1 每日寫入額度限制）

---

## 重要檔案速查

| 檔案 | 用途 |
|---|---|
| `scripts/blog_migrate.py` | 抓 blog 文章＋圖片、灌進 D1（明天要跑的） |
| `scripts/migrate.py` | 從舊 MySQL 匯入會員／活動 |
| `schema.sql` | D1 資料表結構 |
| `src/` | 網站程式（index 路由、pages 頁面、admin 後台、auth 登入、render 版型） |
| `public/media/blog/` | 專題文章圖片（1,327 張，隨 `npm run deploy` 上傳） |
| `test.mjs` | 離線端到端測試（`npm test`，34 項） |
