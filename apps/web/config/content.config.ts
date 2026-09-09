import {
  ArrowLeft,
  Award,
  FolderOpen,
  BadgePercent,
  Captions,
  Clapperboard,
  Crown,
  Gauge,
  Home,
  Layers,
  LockKeyhole,
  Mic,
  TriangleAlert,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Accent } from "@/lib/accent";
import { L, type Localized } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export interface ValueCard {
  icon: LucideIcon;
  accent: "brand" | "mint" | "amber";
  title: Localized;
  description: Localized;
}

export interface TickerStat {
  icon: LucideIcon;
  accent: "brand" | "mint" | "amber";
  /** Song ngữ vì con số cũng đổi định dạng theo locale (128.490+ / 128,490+). */
  value: Localized;
  label: Localized;
  pulse?: boolean;
}

export const HERO = {
  badge: L(
    "NỀN TẢNG VIDEO AFFILIATE TỰ ĐỘNG TOP 1",
    "THE #1 AUTOMATED AFFILIATE VIDEO PLATFORM",
  ),
  titleStart: L("Biến Sản Phẩm Thành Video", "Turn Product Links Into"),
  titleEnd: L("Tự Động Trong 30 Giây", "Automatically In 30 Seconds"),
  /** Chữ lật 3D luân phiên mỗi 2.8s. */
  cyclerWords: [
    L("Shopee Top 1", "Shopee Top 1"),
    L("TikTok Shop Viral", "TikTok Shop Viral"),
    L("Lazada Flash Deal", "Lazada Flash Deal"),
    L("Reels Affiliate", "Reels Affiliate"),
    L("Shorts Tăng Đơn", "Shorts That Sell"),
  ],
  cyclerIntervalMs: 2800,
  description: L(
    "Dán link Shopee, TikTok Shop hay Lazada — ReelForge tự trích xuất hình ảnh sản phẩm, viết kịch bản hook bán hàng, ghép phụ đề và lồng tiếng AI thành video ngắn hoàn chỉnh.",
    "Paste a Shopee, TikTok Shop or Lazada link — ReelForge extracts the product images, writes a high-converting sales hook, syncs subtitles and adds an AI voiceover into a ready-to-post short.",
  ),
  inputPlaceholder: L(
    "Dán link sản phẩm Shopee / TikTok Shop / Lazada...",
    "Paste your Shopee / TikTok Shop / Lazada product link...",
  ),
  cta: L("Tạo Video Ngay", "Create Video Now"),
  sampleLabel: L("Thử nhanh:", "Quick try:"),
  samples: [
    L("Máy lọc không khí", "Air purifier"),
    L("Son kem lì", "Matte lip cream"),
    L("Nồi chiên không dầu", "Air fryer"),
  ],
} as const;

export const HERO_TICKER: TickerStat[] = [
  {
    icon: Clapperboard,
    accent: "mint",
    value: L("128.490+", "128,490+"),
    label: L("video đã tạo", "videos created"),
    pulse: true,
  },
  {
    icon: Zap,
    accent: "brand",
    value: L("Nhanh", "Fast"),
    label: L("Tốc độ xử lý", "Performance"),
  },
  {
    icon: Star,
    accent: "amber",
    value: L("4,9/5", "4.9/5"),
    label: L("đánh giá từ KOC", "rating from KOCs"),
  },
];

export const HERO_VALUE_CARDS: ValueCard[] = [
  {
    icon: Timer,
    accent: "brand",
    title: L("Xuất video", "Video export"),
    description: L(
      "Trích xuất link và lên kịch bản tự động.",
      "Auto link parsing and script generation.",
    ),
  },
  {
    icon: Mic,
    accent: "mint",
    title: L("4+ Giọng đọc AI", "4+ AI voices"),
    description: L(
      "Ngữ điệu tự nhiên.",
      "Natural intonation.",
    ),
  },
  {
    icon: ShieldCheck,
    accent: "amber",
    title: L("Không Watermark", "Watermark free"),
    description: L(
      "Chất lượng cao, an toàn bản quyền.",
      "High quality, copyright safe.",
    ),
  },
  {
    icon: Gauge,
    accent: "brand",
    title: L("Render 0ms", "0ms render"),
    description: L(
      "Chỉnh sửa trực tiếp trên trình duyệt.",
      "Edit straight in the browser.",
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Thẻ video thành phẩm trôi ở nền Hero                                 */
/* ------------------------------------------------------------------ */

/** Độ dài một vòng loop của video mô phỏng (progress bar + phụ đề karaoke). */
export const HERO_VIDEO_LOOP_MS = 3500;

export interface HeroVideoCard {
  id: string;
  image: string;
  thumbnailColor: string;
  accent: "brand" | "mint" | "amber";
  product: Localized;
  price: number;
  originalPrice: number;
  discount: string;
  views: string;
  likes: string;
  music: Localized;
  hookBadge: Localized;
  caption: Localized;
  keywords: string[];
  sampleLink: string;
  layout: {
    position: string;
    width: string;
    tilt: number;
    rotateX: number;
    rotateY: number;
    scale: number;
    opacity: number;
    floatDistance: number;
    floatDuration: number;
    floatDelay: number;
    phaseOffsetMs: number;
  };
}

export const HERO_VIDEO_CARDS: HeroVideoCard[] = [
  {
    id: "air-purifier",
    image: "/products/air-purifier.webp",
    thumbnailColor: "#233043",
    accent: "brand",
    product: L("Máy lọc không khí Gen4 Pro", "Gen4 Pro Air Purifier"),
    price: 1290000,
    originalPrice: 2590000,
    discount: "-50%",
    views: "1.2M",
    likes: "48.2K",
    music: L("Nhạc nền thịnh hành", "Trending sound"),
    hookBadge: L("HOOK 3S", "3S HOOK"),
    caption: L(
      "Hết mùi sau 10 phút giảm 50% hôm nay",
      "Odour gone in 10 minutes 50% off today",
    ),
    keywords: ["50%", "10"],
    sampleLink: "https://shopee.vn/may-loc-khong-khi-gen4-pro-i.128490.7736451",
    layout: {
      position: "left-[52px] top-[15%] hidden xl:block",
      width: "w-[96px] 2xl:w-[108px]",
      tilt: -8,
      rotateX: 6,
      rotateY: 14,
      scale: 1,
      opacity: 0.72,
      floatDistance: 16,
      floatDuration: 6.5,
      floatDelay: 0,
      phaseOffsetMs: 0,
    },
  },
  {
    id: "lip-cream",
    image: "/products/lip-cream.webp",
    thumbnailColor: "#3a2333",
    accent: "amber",
    product: L("Son kem lì Velvet Matte", "Velvet Matte Lip Cream"),
    price: 149000,
    originalPrice: 299000,
    discount: "-50%",
    views: "876K",
    likes: "31.4K",
    music: L("Beat quảng cáo viral", "Viral ad beat"),
    hookBadge: L("TOP 1 SHOPEE", "SHOPEE TOP 1"),
    caption: L(
      "Lì cả ngày không trôi mà chỉ 149k",
      "Stays matte all day for just 149k",
    ),
    keywords: ["149k", "không"],
    sampleLink: "https://shopee.vn/son-kem-li-velvet-matte-i.204815.9921037",
    layout: {
      position: "right-[52px] top-[24%] hidden xl:block",
      width: "w-[104px] 2xl:w-[118px]",
      tilt: 9,
      rotateX: -5,
      rotateY: -13,
      scale: 1.02,
      opacity: 0.78,
      floatDistance: 20,
      floatDuration: 7.4,
      floatDelay: 0.6,
      phaseOffsetMs: 900,
    },
  },
  {
    id: "air-fryer",
    image: "/products/air-fryer.webp",
    thumbnailColor: "#2b2a1f",
    accent: "mint",
    product: L("Nồi chiên không dầu 6L", "6L Air Fryer"),
    price: 890000,
    originalPrice: 1690000,
    discount: "-47%",
    views: "2.4M",
    likes: "92.1K",
    music: L("Nhạc bếp vui nhộn", "Upbeat kitchen tune"),
    hookBadge: L("FLASH SALE", "FLASH SALE"),
    caption: L(
      "Gà vàng ruộm 15 phút không cần dầu",
      "Golden chicken in 15 minutes no oil",
    ),
    keywords: ["15", "không"],
    sampleLink: "https://shopee.vn/noi-chien-khong-dau-6l-i.339071.5518624",
    layout: {
      position: "left-[164px] top-[54%] hidden 2xl:block",
      width: "w-[112px]",
      tilt: 6,
      rotateX: 8,
      rotateY: 11,
      scale: 0.94,
      opacity: 0.68,
      floatDistance: 14,
      floatDuration: 8.2,
      floatDelay: 1.2,
      phaseOffsetMs: 1800,
    },
  },
  {
    id: "earbuds",
    image: "/products/earbuds.webp",
    thumbnailColor: "#1f2c3a",
    accent: "mint",
    product: L("Tai nghe Bluetooth Air 5", "Air 5 Bluetooth Earbuds"),
    price: 459000,
    originalPrice: 899000,
    discount: "-49%",
    views: "634K",
    likes: "27.8K",
    music: L("Nhạc công nghệ", "Tech beat"),
    hookBadge: L("DEAL HỜI", "HOT DEAL"),
    caption: L(
      "Pin 40 giờ chống ồn mà chưa tới 500k",
      "40h battery noise cancelling under 500k",
    ),
    keywords: ["40", "500k"],
    sampleLink: "https://shopee.vn/tai-nghe-bluetooth-air-5-i.472903.8840115",
    layout: {
      position: "right-[172px] top-[62%] hidden 2xl:block",
      width: "w-[100px]",
      tilt: -6,
      rotateX: -7,
      rotateY: -10,
      scale: 0.9,
      opacity: 0.66,
      floatDistance: 18,
      floatDuration: 6.9,
      floatDelay: 0.3,
      phaseOffsetMs: 2600,
    },
  },
  {
    id: "jacket",
    image: "/products/jacket.webp",
    thumbnailColor: "#2a2436",
    accent: "brand",
    product: L("Áo khoác dù unisex", "Unisex Windbreaker"),
    price: 199000,
    originalPrice: 420000,
    discount: "-52%",
    views: "418K",
    likes: "19.6K",
    music: L("Nhạc thời trang", "Fashion track"),
    hookBadge: L("GIỮ CHÂN 3S", "3S RETENTION"),
    caption: L(
      "Form rộng che bụng mà sale còn 199k",
      "Oversized fit on sale for just 199k",
    ),
    keywords: ["199k", "sale"],
    sampleLink: "https://shopee.vn/ao-khoac-du-unisex-i.551284.6607398",
    layout: {
      position: "left-[68px] bottom-[10%] hidden min-[1800px]:block",
      width: "w-[104px]",
      tilt: -11,
      rotateX: 5,
      rotateY: 12,
      scale: 0.96,
      opacity: 0.7,
      floatDistance: 22,
      floatDuration: 9,
      floatDelay: 0.9,
      phaseOffsetMs: 1300,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Giọng đọc AI - dùng chung cho Sandbox demo và section #giong-doc     */
/* ------------------------------------------------------------------ */

export interface VoiceActor {
  id: string;
  name: string;
  region: Localized;
  gender: Localized;
  specialty: Localized;
  accent: "brand" | "mint" | "amber";
  durationSec: number;
  sampleScript: Localized;
}

export const VOICE_ACTORS: VoiceActor[] = [
  {
    id: "ban-mai",
    name: "Ban Mai",
    region: L("Giọng Bắc", "Northern accent"),
    gender: L("Nữ", "Female"),
    specialty: L("Mỹ phẩm", "Cosmetics"),
    accent: "brand",
    durationSec: 14,
    sampleScript: L(
      "Da mình dầu mụn mà dùng em này hai tuần là căng bóng luôn, link giảm 50% mình để ngay dưới nha!",
      "My skin is oily and acne-prone, but two weeks with this and it is glowing — the 50% off link is right below!",
    ),
  },
  {
    id: "minh-quang",
    name: "Minh Quang",
    region: L("Giọng Bắc", "Northern accent"),
    gender: L("Nam", "Male"),
    specialty: L("Đồ công nghệ", "Tech gadgets"),
    accent: "mint",
    durationSec: 16,
    sampleScript: L(
      "Pin 5000mAh, sạc nhanh 65W mà giá chưa tới ba triệu — deal này săn được là lời to đấy các bạn.",
      "A 5000mAh battery with 65W fast charging for under three million VND — grabbing this deal is a real win.",
    ),
  },
  {
    id: "my-an",
    name: "Mỹ An",
    region: L("Giọng Nam", "Southern accent"),
    gender: L("Nữ", "Female"),
    specialty: L("Gia dụng", "Home appliances"),
    accent: "amber",
    durationSec: 15,
    sampleScript: L(
      "Nồi này chiên gà không cần dầu, mười lăm phút là vàng ruộm, nhà có con nít là mê liền nha!",
      "This fryer cooks chicken with no oil — golden in fifteen minutes, and the kids will absolutely love it!",
    ),
  },
  {
    id: "quoc-tuan",
    name: "Quốc Tuấn",
    region: L("Giọng Nam", "Southern accent"),
    gender: L("Nam", "Male"),
    specialty: L("Thời trang", "Fashion"),
    accent: "brand",
    durationSec: 13,
    sampleScript: L(
      "Form áo này mặc lên body cực gọn, phối quần gì cũng đẹp mà sale còn có một trăm chín chín thôi.",
      "This shirt hugs the body perfectly, matches any pants, and it is on sale for just one ninety-nine.",
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Sandbox demo (#demo)                                                */
/* ------------------------------------------------------------------ */

export const ASPECT_RATIOS = [
  {
    id: "9:16",
    label: "9:16",
    platform: L("TikTok / Reels", "TikTok / Reels"),
    className: "aspect-[9/16] max-w-[320px]",
  },
  {
    id: "16:9",
    label: "16:9",
    platform: L("YouTube", "YouTube"),
    className: "aspect-[16/9]",
  },
  {
    id: "1:1",
    label: "1:1",
    platform: L("Facebook Feed", "Facebook Feed"),
    className: "aspect-square max-w-[420px]",
  },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

export const SANDBOX = {
  projectName: L(
    "[DEMO] Máy lọc không khí Gen4 Pro",
    "[DEMO] Gen4 Pro Air Purifier",
  ),
  eyebrow: L("TRÌNH MÔ PHỎNG PHÒNG DỰNG", "LIVE EDITING SANDBOX"),
  title: L(
    "Gõ thử phụ đề, nghe thử giọng đọc ngay tại đây",
    "Type a subtitle and audition a voice right here",
  ),
  description: L(
    "Đây là bản mô phỏng đúng trải nghiệm trong Studio: phụ đề hiện tức thì khi bạn gõ, lồng tiếng chạy ngầm phía sau.",
    "A faithful simulation of the Studio experience: subtitles appear the moment you type while the voiceover renders in the background.",
  ),
  defaultSubtitle: L(
    "Căn phòng hết mùi chỉ sau mười phút bật máy",
    "The whole room smells clean after just ten minutes",
  ),
  subtitleLabel: L("Phụ đề phân cảnh 1", "Scene 1 subtitle"),
  maxSubtitleLength: 120,
  statusSynced: L("Đã đồng bộ 0ms", "Synced in 0ms"),
  statusRendering: L("Đang tạo", "Rendering"),
  /** Thời gian mô phỏng lồng tiếng chạy ngầm sau khi ngừng gõ. */
  voiceRenderMs: 1200,
  karaokeStepMs: 420,
  voiceLabel: L("Chọn giọng đọc AI", "Pick an AI voice"),
  hookBadge: L("HOOK 3S ĐẦU: TOP 1 SHOPEE", "FIRST 3S HOOK: SHOPEE TOP 1"),
  cta: L(
    "Mở Toàn Bộ Tính Năng Trong Studio",
    "Unlock Every Feature In Studio",
  ),
  likeHint: L(
    "Bấm vào khung video để thả tim",
    "Tap the video frame to drop a heart",
  ),
  initialLikes: 2480,
  product: {
    name: L("Máy lọc không khí Gen4 Pro", "Gen4 Pro Air Purifier"),
    price: 1290000,
    originalPrice: 2590000,
    discountLabel: L("-50%", "-50%"),
  },
} as const;

/* ------------------------------------------------------------------ */
/* Bento tính năng (#tinh-nang)                                        */
/* ------------------------------------------------------------------ */

export interface FeatureItem {
  id: string;
  icon: LucideIcon;
  accent: "brand" | "mint" | "amber";
  title: Localized;
  description: Localized;
  /** Kích thước ô trong Bento Grid 6 cột. */
  span: string;
}

export const FEATURES_SECTION = {
  eyebrow: L("TÍNH NĂNG VƯỢT TRỘI", "STANDOUT FEATURES"),
  title: L(
    "Mọi thứ một KOC cần để lên video mỗi ngày",
    "Everything a KOC needs to ship videos daily",
  ),
  description: L(
    "Sáu khối công cụ khép kín từ lúc dán link tới lúc tải file MP4 sẵn sàng đăng.",
    "Six building blocks that cover everything from pasting a link to downloading a ready-to-post MP4.",
  ),
} as const;

export const FEATURES: FeatureItem[] = [
  {
    id: "parser",
    icon: ScanSearch,
    accent: "brand",
    title: L("Trình phân tích sản phẩm tự động", "Auto Product Parser"),
    description: L(
      "Bóc tách hình ảnh, giá khuyến mãi và điểm nổi bật của sản phẩm từ Shopee, TikTok Shop, Lazada chỉ bằng một đường link.",
      "Extracts product images, sale prices and key selling points from Shopee, TikTok Shop and Lazada with a single link.",
    ),
    span: "md:col-span-4",
  },
  {
    id: "two-phase",
    icon: Captions,
    accent: "mint",
    title: L("Phụ đề thông minh", "Smart Subtitles"),
      description: L(
      "Phụ đề hiển thị tức thì khi bạn nhập nội dung, trong khi lồng tiếng được xử lý song song mà không làm gián đoạn thao tác.",
      "Subtitles appear instantly as you type, while voiceover is processed in parallel without interrupting your workflow.",
  ),
    span: "md:col-span-2",
  },
  {
    id: "voices",
    icon: Volume2,
    accent: "amber",
    title: L("Thư viện Giọng đọc KOC", "KOC Voice Library"),
    description: L(
      "Giọng đọc chân thực, đúng nhấn nhá và ngắt nghỉ của người bán hàng thật.",
      "Lifelike voices with the pacing and emphasis of a real seller.",
    ),
    span: "md:col-span-2",
  },
  {
    id: "stickers",
    icon: BadgePercent,
    accent: "brand",
    title: L("Kho Hook & Sticker chuyển đổi", "Hook & Sticker Library"),
    description: L(
      "Bộ nhãn Flash Sale, Deal Hời, Top 1 giúp giữ chân người xem ngay ba giây đầu tiên.",
      "Flash Sale, Hot Deal and Top 1 badges that hold viewers through the first three seconds.",
    ),
    span: "md:col-span-2",
  },
  {
    id: "export",
    icon: ShieldCheck,
    accent: "mint",
    title: L(
      "Chuẩn xuất MP4 1080p No Watermark",
      "1080p MP4 Export, No Watermark",
    ),
    description: L(
      "Tải file sắc nét, tích hợp sẵn nhạc nền an toàn bản quyền cho TikTok, Reels và Shorts.",
      "Download crisp files with built-in copyright-safe music for TikTok, Reels and Shorts.",
    ),
    span: "md:col-span-2",
  },
  {
    id: "timeline",
    icon: Layers,
    accent: "amber",
    title: L("Timeline đa phân cảnh", "Multi-scene Timeline"),
    description: L(
      "Cắt ghép và chia cảnh Intro, Problem, Solution, CTA trực quan trên cùng một dòng thời gian.",
      "Cut and arrange Intro, Problem, Solution and CTA scenes visually on one timeline.",
    ),
    span: "md:col-span-6",
  },
];

/* ------------------------------------------------------------------ */
/* Voice audition (#giong-doc)                                         */
/* ------------------------------------------------------------------ */

export const VOICE_SECTION = {
  eyebrow: L("AI VOICE STUDIO", "AI VOICE STUDIO"),
  title: L("Nghe thử 4 MC ảo chốt đơn", "Audition 4 sales-ready AI hosts"),
  description: L(
    "Mỗi giọng đọc được luyện theo một ngành hàng riêng, đọc đúng đoạn kịch bản bán hàng thực tế bên dưới.",
    "Each voice is tuned for a product category and reads the real sales script shown below.",
  ),
  play: L("Nghe thử", "Play sample"),
  pause: L("Tạm dừng", "Pause"),
  simulatedNote: L(
    "Bản mô phỏng giao diện — file âm thanh thật được phát trong Studio.",
    "Interface simulation — real audio plays inside Studio.",
  ),
} as const;

/* ------------------------------------------------------------------ */
/* Bảng giá (#bang-gia)                                                */
/* ------------------------------------------------------------------ */

/**
 * Mức nhấn thị giác của thẻ giá, tăng dần theo bậc gói.
 *
 * `plain` → viền trung tính, không huy hiệu. `soft` → huy hiệu viền nhạt.
 * `strong` → huy hiệu nền đặc + quầng sáng. `elite` → thêm vòng sáng viền trong.
 * Chiều sâu tạo bằng **khối màu phẳng và blur**, không gradient — rule số 1.
 */
export type PlanEmphasis = "plain" | "soft" | "strong" | "elite";

export interface PricingPlan {
  id: string;
  name: Localized;
  monthlyPrice: number;
  credits: number;
  description: Localized;
  features: Localized[];
  cta: Localized;
  /** Tông màu của gói — khớp `PLAN_ACCENT` trong `config/plans.config.ts`. */
  accent: Accent;
  emphasis: PlanEmphasis;
  /** Huy hiệu góc thẻ. Gói thấp nhất không có, nhưng chỗ vẫn được giữ để các hàng thẳng. */
  badge: { label: Localized; icon: LucideIcon } | null;
}

export const PRICING_SECTION = {
  eyebrow: L("BẢNG GIÁ MINH BẠCH", "TRANSPARENT PRICING"),
  title: L("Trả đúng phần bạn dùng", "Pay only for what you use"),
  description: L(
    "Một Credit tương ứng một lượt xuất video hoàn chỉnh. Không phí ẩn, không ràng buộc hợp đồng.",
    "One credit equals one full video export. No hidden fees, no lock-in contract.",
  ),
  monthly: L("Thanh toán theo tháng", "Monthly billing"),
  yearly: L("Thanh toán theo năm", "Yearly billing"),
  yearlyDiscount: 0.2,
  yearlyBadge: L("Tiết kiệm 20%", "Save 20%"),
  perMonth: L("/tháng", "/month"),
  billedYearly: L("thanh toán theo năm", "billed yearly"),
  creditsLabel: L("Credits", "Credits"),
} as const;

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: L("Free", "Free"),
    monthlyPrice: 0,
    credits: 10,
    description: L(
      "Dành cho người mới thử sức với video affiliate.",
      "For creators taking their first affiliate video steps.",
    ),
    features: [
      L("10 Credits tặng kèm khi đăng ký", "10 bonus credits on signup"),
      L("Xuất video chuẩn 720p", "720p video export"),
      L("2 giọng đọc AI cơ bản", "2 standard AI voices"),
      L("Kho hook & sticker cơ bản", "Basic hook & sticker library"),
    ],
    cta: L("Dùng thử miễn phí", "Start for free"),
    accent: "mint",
    emphasis: "plain",
    badge: null,
  },
  {
    id: "advanced",
    name: L("Nâng cao", "Advanced"),
    monthlyPrice: 199000,
    credits: 60,
    description: L(
      "Gói phổ biến nhất cho KOC đăng video đều mỗi tuần.",
      "The most popular plan for KOCs posting every week.",
    ),
    features: [
      L("60 Credits mỗi tháng", "60 credits per month"),
      L("Xuất 1080p 60fps không watermark", "1080p 60fps export, no watermark"),
      L("Toàn bộ giọng đọc AI cao cấp", "Every premium AI voice"),
      L("Ưu tiên hàng đợi render", "Priority render queue"),
      L("Timeline đa phân cảnh đầy đủ", "Full multi-scene timeline"),
    ],
    cta: L("Nâng cấp gói Nâng cao", "Upgrade to Advanced"),
    accent: "mint",
    emphasis: "soft",
    badge: { label: L("Phổ biến nhất", "Most popular"), icon: Sparkles },
  },
  {
    id: "plus",
    name: L("Plus", "Plus"),
    monthlyPrice: 499000,
    credits: 200,
    description: L(
      "Cho team nhiều kênh và agency chạy affiliate quy mô lớn.",
      "For multi-channel teams and agencies running affiliate at scale.",
    ),
    features: [
      L("200 Credits mỗi tháng", "200 credits per month"),
      L("Hỗ trợ 1-1 cùng chuyên gia", "1-on-1 expert support"),
      L("Tuỳ biến kho sticker riêng", "Custom sticker library"),
      L("Quyền thương mại toàn diện", "Full commercial rights"),
      L("Quản lý nhiều kênh trong một tài khoản", "Manage multiple channels in one account"),
    ],
    cta: L("Nâng cấp gói Plus", "Upgrade to Plus"),
    accent: "brand",
    emphasis: "strong",
    badge: { label: L("Khuyên dùng", "Recommended"), icon: Zap },
  },
  {
    id: "premium",
    name: L("Premium", "Premium"),
    monthlyPrice: 999000,
    credits: 500,
    description: L(
      "Cho thương hiệu và agency cần sản lượng video lớn mỗi tháng.",
      "For brands and agencies shipping video at high volume every month.",
    ),
    features: [
      L("500 Credits mỗi tháng", "500 credits per month"),
      L("Giọng đọc riêng theo thương hiệu", "Brand-specific custom voice"),
      L("Hàng đợi render cao nhất", "Highest render priority"),
      L("Quản lý tài khoản riêng", "Dedicated account manager"),
      L("Cam kết SLA và hoá đơn doanh nghiệp", "SLA commitment and business invoicing"),
    ],
    cta: L("Liên hệ tư vấn", "Talk to sales"),
    accent: "voice",
    emphasis: "elite",
    badge: { label: L("Cao cấp nhất", "Top tier"), icon: Crown },
  },
];

/* ------------------------------------------------------------------ */
/* FAQ (#faq)                                                          */
/* ------------------------------------------------------------------ */

export const FAQ_SECTION = {
  eyebrow: L("HỎI ĐÁP", "FAQ"),
  title: L("Câu hỏi thường gặp", "Frequently asked questions"),
} as const;

export const FAQS: { id: string; question: Localized; answer: Localized }[] = [
  {
    id: "beginner",
    question: L(
      "Không biết dựng phim có dùng được không?",
      "Can I use it with zero video editing skills?",
    ),
    answer: L(
      "Được. Bạn chỉ cần dán link sản phẩm, ReelForge tự trích xuất hình ảnh, viết kịch bản theo cấu trúc Hook - Nỗi đau - Trải nghiệm - CTA và ghép phụ đề. Việc của bạn là đọc lại kịch bản và bấm xuất video.",
      "Yes. Just paste the product link and ReelForge extracts the images, writes a Hook - Pain - Experience - CTA script and syncs the subtitles. All you do is review the script and hit export.",
    ),
  },
  {
    id: "two-phase",
    question: L(
      "Cơ chế phụ đề 2 pha vận hành thế nào?",
      "How does the 2-phase subtitle engine work?",
    ),
    answer: L(
      "Pha 1 hiển thị chữ lên video ngay khi bạn gõ với độ trễ 0ms để bạn thấy bố cục thật. Pha 2 chạy ngầm để tổng hợp giọng đọc và canh lại timing từng từ, nên bạn không bao giờ phải ngồi chờ màn hình khoá.",
      "Phase 1 paints your text onto the video instantly at 0ms latency so you see the real layout. Phase 2 runs in the background to synthesise the voiceover and re-align word timing, so you never sit on a blocked screen.",
    ),
  },
  {
    id: "watermark",
    question: L(
      "Video có bị dính watermark hay bản quyền nhạc không?",
      "Will my video carry a watermark or music copyright claim?",
    ),
    answer: L(
      "Từ gói Creator Pro trở lên, video xuất ra 1080p 60fps hoàn toàn không có watermark. Toàn bộ nhạc nền trong thư viện đều đã được cấp phép thương mại, an toàn cho TikTok, Reels và YouTube Shorts.",
      "From Creator Pro upward, exports are 1080p 60fps with no watermark at all. Every track in the library is commercially licensed and safe for TikTok, Reels and YouTube Shorts.",
    ),
  },
  {
    id: "credits",
    question: L(
      "Cách tính Credit khi xuất video?",
      "How are credits counted on export?",
    ),
    answer: L(
      "Một Credit tương ứng một lượt xuất video hoàn chỉnh dưới 60 giây. Chỉnh sửa, xem trước, nghe thử giọng đọc và lưu nháp đều miễn phí, chỉ trừ Credit khi bạn bấm xuất file cuối cùng.",
      "One credit equals one completed export under 60 seconds. Editing, previewing, auditioning voices and saving drafts are all free — credits are only deducted when you export the final file.",
    ),
  },
  {
    id: "mobile",
    question: L(
      "Sử dụng trên điện thoại ra sao?",
      "What is it like on mobile?",
    ),
    answer: L(
      "Studio chạy trực tiếp trên trình duyệt di động với bố cục dọc tối ưu cho thao tác một tay. Bạn dán link, sửa phụ đề và tải file MP4 về máy ngay trong ứng dụng ảnh, không cần cài thêm phần mềm.",
      "Studio runs right in your mobile browser with a vertical layout tuned for one-handed use. Paste a link, edit subtitles and download the MP4 straight to your gallery — no extra app required.",
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Auth modal                                                          */
/* ------------------------------------------------------------------ */

export type AuthMode = "signin" | "signup";

/**
 * Nội dung hộp đăng nhập. Google là cách đăng nhập duy nhất nên ở đây **không còn** nhãn
 * cho form email/mật khẩu — giữ lại chỉ tạo ra chữ hứa hẹn một đường đăng nhập không có.
 */
export const AUTH_MODAL = {
  modes: {
    signin: {
      tab: L("Đăng nhập", "Sign in"),
      title: L("Chào mừng trở lại", "Welcome back"),
      description: L(
        "Đăng nhập một chạm bằng tài khoản Google — không cần nhớ mật khẩu.",
        "Sign in with your Google account in one tap — no password to remember.",
      ),
    },
    signup: {
      tab: L("Đăng ký", "Sign up"),
      title: L("Bắt đầu với ReelForge", "Get started with ReelForge"),
      description: L(
        "Tạo tài khoản bằng Google trong 30 giây và nhận credits dùng thử ngay.",
        "Create an account with Google in 30 seconds and get trial credits right away.",
      ),
    },
  },
  perks: [
    L("Xuất video 1080p không watermark", "1080p export with no watermark"),
    L("Toàn bộ giọng đọc AI cao cấp", "Every premium AI voice"),
    L("Ưu tiên hàng đợi render", "Priority render queue"),
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Trang trạng thái: 404 và 403                                         */
/* ------------------------------------------------------------------ */

export interface StatusPage {
  code: string;
  icon: LucideIcon;
  accent: "brand" | "mint" | "amber";
  eyebrow: Localized;
  title: Localized;
  description: Localized;
  primaryLabel: Localized;
  secondaryLabel: Localized;
}

export type StatusPageKey = "notFound" | "forbidden";

export const STATUS_PAGES: Record<StatusPageKey, StatusPage> = {
  notFound: {
    code: "404",
    icon: TriangleAlert,
    accent: "brand",
    eyebrow: L(
      "Mã lỗi 404 • Tuyến đường không tồn tại",
      "Error 404 • Route does not exist",
    ),
    title: L(
      "Lạc mất kịch bản dựng video!",
      "This video script got lost!",
    ),
    description: L(
      "Khung hình bạn tìm không có trong cuộn phim. Có thể link đã cũ, gõ sai hoặc dự án đã bị xoá — chọn một lối quay lại bên dưới để tiếp tục công việc.",
      "The frame you are looking for is not on this reel. The link may be outdated, mistyped, or the project was deleted — pick a way back below and keep working.",
    ),
    primaryLabel: L("Quay lại trang trước", "Go back"),
    secondaryLabel: L("Về Trang chủ", "Back to home"),
  },
  forbidden: {
    code: "403",
    icon: LockKeyhole,
    accent: "amber",
    eyebrow: L("KHÔNG ĐỦ QUYỀN TRUY CẬP", "ACCESS NOT ALLOWED"),
    title: L(
      "Khu vực này cần đăng nhập",
      "This area requires an account",
    ),
    description: L(
      "Studio là khu vực riêng của tài khoản ReelForge. Đăng nhập để mở toàn bộ tính năng dựng video và quản lý credits.",
      "Studio is a private area for ReelForge accounts. Sign in to unlock the full video editor and manage your credits.",
    ),
    primaryLabel: L("Đăng nhập để tiếp tục", "Sign in to continue"),
    secondaryLabel: L("Về trang chủ", "Back to home"),
  },
};

export const STATUS_PAGE_UI = {
  backIcon: ArrowLeft,
  homeIcon: Home,
  studioIcon: FolderOpen,
  quickLinksLabel: L("Hoặc đi tới:", "Or jump to:"),
  /** Nút thứ ba trong cụm hành động khôi phục (docs: Tertiary). */
  studioLabel: L("Vào Studio", "Open Studio"),
} as const;

/** Khung cuộn phim 404 — xem .agent/ui/not-found.md mục 2.2. */
export const NOT_FOUND_FRAME = {
  perforationCount: 7,
  primaryTag: "FRAME MISSING",
  secondaryTag: "NOT_FOUND",
  caption: L("Khung hình bị thiếu", "Missing frame"),
} as const;

/* ------------------------------------------------------------------ */
/* Studio (private route)                                              */
/* ------------------------------------------------------------------ */

export const STUDIO = {
  eyebrow: L("STUDIO", "STUDIO"),
  title: L("Chào mừng trở lại", "Welcome back"),
  description: L(
    "Trình dựng video đang được hoàn thiện. Trong lúc chờ, credits của bạn vẫn được giữ nguyên trong tài khoản.",
    "The video editor is still being built. Your credits stay safe in your account in the meantime.",
  ),
  creditsLabel: L("Credits khả dụng", "Available credits"),
  planLabel: L("Gói hiện tại", "Current plan"),
  backLabel: L("Về trang chủ", "Back to home"),
} as const;

/* ------------------------------------------------------------------ */
/* CTA cuối trang + Footer                                             */
/* ------------------------------------------------------------------ */

export const FINAL_CTA = {
  icon: Sparkles,
  title: L(
    "Sẵn sàng nhân 5 doanh số Affiliate tháng này?",
    "Ready to 5x your affiliate sales this month?",
  ),
  description: L(
    "Tạo tài khoản trong 30 giây và nhận ngay 10 Credits dùng thử — đủ để xuất 10 video hoàn chỉnh không watermark.",
    "Create an account in 30 seconds and get 10 trial credits — enough for 10 complete watermark-free videos.",
  ),
  primaryCta: L("Nhận 10 Credits Dùng Thử", "Claim 10 Free Credits"),
  secondaryCta: L("Xem bảng giá", "See pricing"),
  note: L("Không cần thẻ tín dụng", "No credit card required"),
} as const;

export const FOOTER_GROUPS: {
  title: Localized;
  links: { label: Localized; href: string }[];
}[] = [
  {
    title: L("Sản phẩm", "Product"),
    links: [
      { label: L("Tính năng", "Features"), href: "#tinh-nang" },
      { label: L("Trải nghiệm thử", "Live demo"), href: "#demo" },
      { label: L("Giọng đọc AI", "AI voices"), href: "#giong-doc" },
      { label: L("Bảng giá", "Pricing"), href: "#bang-gia" },
    ],
  },
  {
    title: L("Hỗ trợ", "Support"),
    links: [
      { label: L("Hỏi đáp", "FAQ"), href: "#faq" },
      { label: L("Hướng dẫn bắt đầu", "Getting started"), href: "#demo" },
      { label: L("Cách tính Credit", "Credit policy"), href: "#faq" },
    ],
  },
  {
    title: L("Pháp lý", "Legal"),
    links: [
      { label: L("Điều khoản sử dụng", "Terms of service"), href: "#faq" },
      { label: L("Chính sách bảo mật", "Privacy policy"), href: "#faq" },
      { label: L("Bản quyền nhạc nền", "Music licensing"), href: "#faq" },
    ],
  },
];

export const FOOTER = {
  description: L(
    "Công cụ tạo video affiliate tự động cho Creator và KOC tại Việt Nam.",
    "Automated affiliate video tooling for creators and KOCs in Vietnam.",
  ),
  statusLabel: L("All systems operational", "All systems operational"),
  contactLabel: L("Liên hệ", "Contact"),
  badge: { icon: Award, label: L("Top 1 Affiliate Tools 2026", "Top 1 Affiliate Tools 2026") },
} as const;
