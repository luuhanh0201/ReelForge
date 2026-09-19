import { z } from "zod";
import { CRAWL_STATUSES, PLATFORMS, type Platform } from "./enums.js";

/**
 * Thông tin sản phẩm của một dự án — hình dạng của cột `projects.product`.
 *
 * Mọi trường đều có mặc định để các dự án tạo trước khi có schema này (lưu `{}`) vẫn đọc
 * được mà không cần backfill.
 *
 * `price` là **chuỗi hiển thị** chứ không phải số: nó được chèn nguyên văn vào kịch bản
 * (`{gia}`), và người dùng có quyền viết "chỉ từ 99k" thay vì một con số.
 */
export const PRODUCT_LIMITS = {
  name: 300,
  price: 40,
  description: 3000,
} as const;

/** Trường nào đọc từ link không ra thì giao diện nhắc người dùng điền tay. */
export const PRODUCT_FIELDS = ["name", "price", "description", "images"] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];

export const ProductCrawlSchema = z.object({
  status: z.enum(CRAWL_STATUSES),
  missingFields: z.array(z.enum(PRODUCT_FIELDS)).default([]),
  /** ISO timestamp của lần đọc gần nhất. */
  at: z.string(),
});
export type ProductCrawl = z.infer<typeof ProductCrawlSchema>;

export const ProductInfoSchema = z.object({
  name: z.string().trim().max(PRODUCT_LIMITS.name).default(""),
  price: z.string().trim().max(PRODUCT_LIMITS.price).default(""),
  originalPrice: z.string().trim().max(PRODUCT_LIMITS.price).default(""),
  description: z.string().trim().max(PRODUCT_LIMITS.description).default(""),
  platform: z.enum(PLATFORMS).default("manual"),
  /** Kết quả lần đọc link gần nhất; vắng mặt khi dự án chưa từng đọc link. */
  crawl: ProductCrawlSchema.optional(),
});
export type ProductInfo = z.infer<typeof ProductInfoSchema>;

/** Các sàn đọc link được — `manual` không phải một sàn. */
export type ShopPlatform = Exclude<Platform, "manual">;

/**
 * Tên miền chấp nhận cho từng sàn, **kể cả tên miền link rút gọn**.
 *
 * Khớp chính xác hoặc là tên miền con: `shop.tiktok.com` khớp `tiktok.com`. Client dùng
 * để chặn sớm link sai, server dùng lại đúng danh sách này cho mọi bước redirect.
 */
export const SHOP_DOMAINS: Record<ShopPlatform, readonly string[]> = {
  shopee: ["shopee.vn", "shp.ee"],
  tiktok_shop: ["tiktok.com"],
  lazada: ["lazada.vn"],
};

export const SHOP_LABELS: Record<ShopPlatform, string> = {
  shopee: "Shopee",
  tiktok_shop: "TikTok Shop",
  lazada: "Lazada",
};

const matchesDomain = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`);

/** Sàn của một host; `null` khi host không thuộc sàn nào hỗ trợ. */
export function platformOfHost(host: string): ShopPlatform | null {
  const normalized = host.toLowerCase().replace(/\.$/, "");

  for (const [platform, domains] of Object.entries(SHOP_DOMAINS)) {
    if (domains.some((domain) => matchesDomain(normalized, domain))) {
      return platform as ShopPlatform;
    }
  }

  return null;
}

/**
 * Kiểm tra link người dùng dán. Trả `null` nếu không dùng được.
 *
 * Chỉ nhận `https` — link sàn thương mại điện tử nào cũng là https, còn `http` hay
 * `file:` chỉ có thể là gõ nhầm hoặc cố tình dò hệ thống.
 */
export function parseShopLink(
  raw: string,
): { url: URL; platform: ShopPlatform } | null {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password) return null;

  const platform = platformOfHost(url.hostname);
  if (!platform) return null;

  return { url: unwrapVerifyPage(url, platform), platform };
}

/**
 * Shopee chặn trình duyệt nghi là bot bằng trang `/verify/...`, và người dùng hay sao chép
 * nguyên link trên thanh địa chỉ lúc đó. Link sản phẩm thật nằm trong tham số `next`.
 *
 * Chỉ bóc **một lớp**, và link bên trong phải cùng sàn — tham số `next` do ai cũng gõ được,
 * không được biến nó thành đường đưa server tới một host khác.
 */
function unwrapVerifyPage(url: URL, platform: ShopPlatform): URL {
  const next = url.searchParams.get("next");
  if (platform !== "shopee" || !url.pathname.startsWith("/verify/") || !next) return url;

  try {
    const inner = new URL(next);
    const isProduct =
      inner.protocol === "https:" &&
      !inner.username &&
      !inner.password &&
      platformOfHost(inner.hostname) === "shopee" &&
      !inner.pathname.startsWith("/verify/");

    return isProduct ? inner : url;
  } catch {
    return url;
  }
}
