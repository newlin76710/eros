-- eros 主題派對資料庫（Cloudflare D1 / SQLite）
-- 執行：npm run db:init（遠端）或 npm run db:init:local（本機）
-- 欄位對齊原站 MySQL（eros3.ek21.com 的 eros 資料庫），方便完整遷移會員與活動資料。

-- ─── 會員 ───────────────────────────────────────────────
-- 對應舊 member 表。password_hash 相容舊 MD5（存為 md5$<hash>），登入成功後自動升級為 PBKDF2。
CREATE TABLE IF NOT EXISTS members (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  legacy_id      INTEGER,                        -- 舊 member.id
  email          TEXT NOT NULL,
  name           TEXT,
  phone          TEXT,
  password_hash  TEXT,                           -- md5$xxx（舊）或 pbkdf2$...（新／升級後）
  fb_account     TEXT,                           -- Facebook 帳號 ID
  gender         TEXT,                           -- 對應舊 sex：'M' 男 / 'F' 女
  birth          TEXT,                           -- 生日 YYYY-MM-DD
  city           TEXT,
  zone           TEXT,
  address        TEXT,
  education      TEXT,
  job_category   TEXT,
  job_title      TEXT,
  height         TEXT,
  weight         TEXT,
  intro          TEXT,                           -- 對應舊 text（自我介紹）
  avatar         TEXT,                           -- 對應舊 img（頭像檔名）
  source         TEXT,                           -- 來源（活動／管道）
  location       TEXT,
  contact_status TEXT,                           -- 客服聯絡狀態
  is_vip         INTEGER NOT NULL DEFAULT 0,      -- 0 一般 / 1 VIP（舊表無此欄，匯入後由後台調整）
  status         INTEGER NOT NULL DEFAULT 1,      -- 1 啟用 / 0 停用（對應舊 status）
  created_at     INTEGER NOT NULL,               -- 由舊 time 轉毫秒
  updated_at     INTEGER NOT NULL,
  last_login_at  INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email  ON members (email);
CREATE INDEX        IF NOT EXISTS idx_members_phone  ON members (phone);
CREATE INDEX        IF NOT EXISTS idx_members_legacy ON members (legacy_id);
CREATE INDEX        IF NOT EXISTS idx_members_created ON members (created_at DESC);

-- ─── 登入工作階段 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  member_id  INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ua         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_member ON sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp    ON sessions (expires_at);

-- ─── 主題活動 ───────────────────────────────────────────
-- 對應舊 event 表；分類（category）由 rel_event_cate 換算成前台 4 大類的 slug。
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  legacy_id    INTEGER,
  title        TEXT NOT NULL,                     -- 舊 name
  category     TEXT NOT NULL DEFAULT 'other',     -- game/craft/talk/other
  is_vip       INTEGER NOT NULL DEFAULT 0,        -- 是否 VIP 限定（舊 rel_event_cate 含 category_id=14）
  date_text    TEXT,                              -- 舊 event_date_text（顯示用）
  event_date   TEXT,                              -- 舊 event_date（YYYY-MM-DD，排序用）
  time_text    TEXT,                              -- 舊 event_time_text
  city         TEXT,                              -- 舊 location（台北…）
  address      TEXT,
  price_m      INTEGER,                           -- 男生費用
  price_f      INTEGER,                           -- 女生費用
  limit_m      INTEGER,
  limit_f      INTEGER,
  summary      TEXT,                              -- 列表摘要（由 intro 擷取）
  intro        TEXT,                              -- 活動內容 HTML（舊 text）
  schedule     TEXT,                              -- 活動流程 HTML
  notice       TEXT,                              -- 注意事項 HTML
  notice2      TEXT,
  image        TEXT,                              -- 主圖（URL 或舊檔名）
  images       TEXT,                              -- 其他圖 JSON 陣列
  video        TEXT,
  views        INTEGER NOT NULL DEFAULT 0,
  likes        INTEGER NOT NULL DEFAULT 0,
  status       INTEGER NOT NULL DEFAULT 1,        -- 1 上架 / 0 下架
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status, event_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_cat    ON events (category, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_legacy ON events (legacy_id);

-- ─── 活動報名 ───────────────────────────────────────────（對應舊 event_join_member）
CREATE TABLE IF NOT EXISTS registrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  member_id  INTEGER,
  name       TEXT,
  email      TEXT,
  phone      TEXT,
  gender     TEXT,
  note       TEXT,
  status     INTEGER NOT NULL DEFAULT 1,          -- 1 已報名 / 0 取消
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reg_event  ON registrations (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reg_member ON registrations (member_id, created_at DESC);

-- ─── 活動許願池 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER,
  name       TEXT,
  email      TEXT,
  content    TEXT NOT NULL,
  votes      INTEGER NOT NULL DEFAULT 0,
  status     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wishes_created ON wishes (created_at DESC);

-- ─── 專題文章（部落格）─────────────────────────────────
-- 由 blog-eros.ek21.com 匯入；圖片下載存本站 Static Assets（/media/blog/…），內文不外連。
CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  legacy_id    INTEGER,                          -- 原 WordPress post id
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'loveblog', -- 對應 config BLOG_CATEGORIES 的 slug
  excerpt      TEXT,
  content      TEXT,                             -- 內文 HTML（圖片已改寫為本站路徑）
  cover        TEXT,                             -- 封面圖本站路徑
  published_at INTEGER,
  views        INTEGER NOT NULL DEFAULT 0,
  status       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_pub    ON articles (status, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_articles_cat    ON articles (category, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_legacy ON articles (legacy_id);
