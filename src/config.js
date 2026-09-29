// 站台基本設定與活動分類。品牌、統計數字沿用原站 eros.ek21.com。

// 網站掛在子網域根目錄（eros.ek21.com/），因此 BASE 為空字串。
export const BASE = '';

// 主題活動分類，slug 對應資料庫 events.category，順序即導覽/篩選順序。
export const CATEGORIES = [
  { slug: 'all', name: '所有活動' },
  { slug: 'game', name: '娛樂遊戲' },
  { slug: 'craft', name: '手作教學' },
  { slug: 'talk', name: '專業講座' },
  { slug: 'other', name: '其他活動' },
];
// 真正的資料分類（排除「所有活動」這個彙總項）
export const REAL_CATEGORIES = CATEGORIES.filter((c) => c.slug !== 'all');
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
export const categoryName = (slug) => CATEGORY_MAP[slug]?.name || '其他活動';

// 首頁三個統計數字（沿用原站呈現；之後可改為即時查資料庫）
export const STATS = [
  { key: 'party', label: '主題派對', value: 957 },
  { key: 'online', label: '線上會員', value: 103387 },
  { key: 'lecture', label: '戀愛講座', value: 724 },
];

// 精彩花絮（原站文案）
export const HIGHLIGHTS = [
  { title: '夏日泳池派對', text: '活動很棒！在水裡很涼又消暑，還可以玩遊戲認識大家，有很多的互動機會，下次還想參加！' },
  { title: '萬聖節翻糖 Party', text: '整場活動都蠻溫馨的，就像和好姊妹出來玩一樣自在，發現原來手殘的自己也能做出超可愛的小餅乾，真的很開心 XD' },
  { title: '蜜糖吐司手作趣', text: '以前想吃蜜糖吐司都要排超！級！久！！結果自己上了課發現根本超簡單嘛～突然覺得以前排這麼久是為什麼……' },
];

// 三大特色（原站文案）
export const FEATURES = [
  { title: '豐富主題活動', text: '每月不同的主題活動，讓你在歡樂互動中享受各種多彩多姿的體驗，豐富一成不變的無趣生活！' },
  { title: '提升自我魅力', text: '形象教練量身打造專屬的穿搭風格，以及傳授不冷場的聊天應對技巧，你就是最耀眼的 PARTY KING！' },
  { title: '輕鬆拓展人脈', text: '工作環境一成不變，難以拓展交友圈，eros 超過百種的主題活動，讓你找到志同道合、想法相近的好夥伴。' },
];

// 兩種會員方案（原站文案）
export const PLANS = [
  {
    key: 'normal',
    name: '一般會員',
    text: '只要加入會員，可立即收到最新消息，和超值的優惠通知！從桌遊派對到品酒活動，各種想得到、想不到的交友活動！都在 eros 主題派對，歡迎加入！',
  },
  {
    key: 'vip',
    name: 'VIP 會員',
    text: '升級 eros VIP 會員，主題活動任你選，『一整年』免費參加，相當於價值 $68,000 的優惠大禮！另外還有 eros 戀愛秘書為您進行專業諮詢，以及精心安排約會細節和對象，透過近距離互動，找到心靈契合的另一半。',
  },
];

export const SESSION_DAYS = 30; // 登入 cookie 有效天數

// 專題文章分類（對應原 blog-eros.ek21.com 的 WordPress 分類，slug 自訂、名稱沿用）
export const BLOG_CATEGORIES = [
  { slug: 'loveblog', name: '專欄文章' },
  { slug: 'news', name: '媒體報導' },
  { slug: 'selected', name: '小編精選' },
  { slug: 'couple', name: '兩性情感' },
  { slug: 'random', name: '心理測驗' },
  { slug: 'fashion', name: '時尚穿搭' },
  { slug: 'makeupdiet', name: '美妝瘦身' },
  { slug: 'travel', name: '旅遊分享' },
  { slug: 'foodrecipe', name: '美食食譜' },
  { slug: 'diy', name: 'DIY手作' },
  { slug: 'health', name: '健康養身' },
  { slug: 'blooper', name: '精彩花絮' },
  { slug: 'hot', name: '熱門話題' },
];
export const BLOG_CATEGORY_MAP = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.slug, c]));
export const blogCategoryName = (slug) => BLOG_CATEGORY_MAP[slug]?.name || '專欄文章';
