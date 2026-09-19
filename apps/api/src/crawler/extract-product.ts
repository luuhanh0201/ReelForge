import { load, type CheerioAPI } from 'cheerio';
import { PRODUCT_LIMITS, type ProductField, type ShopPlatform } from '@repo/shared';
import { CRAWLER_CONFIG, PLATFORM_RULES, UNFILLED_PLACEHOLDER } from './crawler.config.js';

/** Những gì đọc được từ trang; chuỗi rỗng nghĩa là không đọc ra. */
export interface ExtractedProduct {
  name: string;
  price: string;
  originalPrice: string;
  description: string;
  images: string[];
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: Json | undefined): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const parseJson = (raw: string): Json | undefined => {
  try {
    return JSON.parse(raw) as Json;
  } catch {
    return undefined;
  }
};

/** Duyệt sâu, trả object đầu tiên thoả điều kiện. */
function findDeep(root: Json | undefined, match: (node: JsonObject) => boolean): JsonObject | null {
  const stack: (Json | undefined)[] = [root];
  let visited = 0;

  // Dữ liệu SSR của TikTok có hàng chục nghìn nút; giới hạn để một trang bất thường không
  // giữ CPU của API quá lâu.
  while (stack.length > 0 && visited < 200_000) {
    const node = stack.pop();
    visited += 1;

    if (Array.isArray(node)) {
      stack.push(...node);
    } else if (isObject(node)) {
      if (match(node)) return node;
      stack.push(...Object.values(node));
    }
  }

  return null;
}

const VND = new Intl.NumberFormat('vi-VN');

/** "2.490.000 ₫", "134400", 134400 → "134.400đ". Không ra số dương thì trả rỗng. */
export function formatVnd(raw: Json | undefined): string {
  const digits = asText(raw).split(/[.,]\d{1,2}$/)[0]?.replace(/\D/g, '') ?? '';
  const amount = Number(digits);

  return digits && Number.isSafeInteger(amount) && amount > 0 ? `${VND.format(amount)}đ` : '';
}

const priceValue = (price: string): number => Number(price.replace(/\D/g, ''));

function meta($: CheerioAPI, key: string): string[] {
  return $(`meta[property="${key}"], meta[name="${key}"]`)
    .map((_, element) => $(element).attr('content')?.trim() ?? '')
    .get()
    .filter(Boolean);
}

function ldProduct($: CheerioAPI): JsonObject | null {
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    const found = findDeep(parseJson($(element).text()), (node) => {
      const type = node['@type'];
      return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
    });
    if (found) return found;
  }

  return null;
}

function imageUrls(value: Json | undefined): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(imageUrls);
  if (isObject(value)) return imageUrls(value['url'] ?? value['contentUrl']);
  return [];
}

/** Giá và ảnh mà chỉ dữ liệu riêng của từng sàn mới có. */
interface PlatformExtra {
  name?: string;
  description?: string;
  price?: string;
  originalPrice?: string;
  images?: string[];
}

function tiktokExtra($: CheerioAPI): PlatformExtra {
  // Không bám vào id của thẻ script (`__MODERN_ROUTER_DATA__` lúc viết): id đó thuộc về
  // framework của TikTok và đổi được bất cứ lúc nào, còn cấu trúc dữ liệu sản phẩm thì ổn định hơn.
  const data = $('script[type="application/json"]')
    .map((_, element) => parseJson($(element).text()) ?? null)
    .get() as Json[];
  const info = findDeep(
    data,
    (node) => isObject(node['product_model']) && isObject(node['promotion_model']),
  );
  const product = isObject(info?.['product_model']) ? info['product_model'] : undefined;
  const promotion = isObject(info?.['promotion_model']) ? info['promotion_model'] : undefined;
  // Chỉ tin khối giá khuyến mãi của sản phẩm: cùng trang còn có `real_price` của **phí vận
  // chuyển**, bắt nhầm là video quảng cáo đọc sai giá.
  const priceBlock = promotion?.['promotion_product_price'];
  const minPrice = isObject(priceBlock) ? priceBlock['min_price'] : undefined;
  const images = product?.['images'];

  return {
    name: asText(product?.['name']),
    description: richText(parseJson(asText(product?.['description']))),
    price: isObject(minPrice) ? formatVnd(minPrice['sale_price_decimal']) : '',
    originalPrice: isObject(minPrice) ? formatVnd(minPrice['origin_price_decimal']) : '',
    images: Array.isArray(images)
      ? images.flatMap((image) =>
          isObject(image) && Array.isArray(image['url_list']) ? asText(image['url_list'][0]) : [],
        )
      : [],
  };
}

/** Mô tả của TikTok là mảng khối rich text `[{type, text, sub}]`; chỉ lấy phần chữ. */
function richText(blocks: Json | undefined): string {
  if (!Array.isArray(blocks)) return '';

  return blocks
    .map((block) => (isObject(block) && block['type'] === 'text' ? asText(block['text']) : ''))
    .filter(Boolean)
    .join('\n');
}

function lazadaExtra(html: string): PlatformExtra {
  // Giá trong JSON-LD của Lazada luôn là 0; giá thật nằm trong dữ liệu khởi tạo trang.
  const match = /"pdt_price"\s*:\s*"([^"]{1,40})"/.exec(html);
  return { price: formatVnd(match?.[1]) };
}

function platformExtra(platform: ShopPlatform, $: CheerioAPI, html: string): PlatformExtra {
  switch (platform) {
    case 'tiktok_shop':
      return tiktokExtra($);
    case 'lazada':
      return lazadaExtra(html);
    case 'shopee':
      return {};
  }
}

function cleanName(raw: string, platform: ShopPlatform): string {
  const rule = PLATFORM_RULES[platform];
  const name = raw.replace(rule.titleSuffix, '').replace(/\s+/g, ' ').trim();

  if (!name || UNFILLED_PLACEHOLDER.test(name) || rule.junkTitles.some((re) => re.test(name))) {
    return '';
  }

  return name.slice(0, PRODUCT_LIMITS.name);
}

function cleanDescription(raw: string, platform: ShopPlatform): string {
  const rule = PLATFORM_RULES[platform];
  // Giữ xuống dòng: mô tả sản phẩm thường là danh sách gạch đầu dòng.
  const text = raw
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .trim();

  if (
    !text ||
    UNFILLED_PLACEHOLDER.test(text) ||
    (rule.boilerplateDescription && rule.boilerplateDescription.test(text))
  ) {
    return '';
  }

  return text.slice(0, PRODUCT_LIMITS.description);
}

/**
 * Khoá so trùng ảnh: cùng một file thường xuất hiện qua nhiều CDN và nhiều kích thước
 * (`abc.jpg` và `abc.jpg_720x720q80.jpg`, hay `hash~tplv-…webp`).
 */
const imageKey = (url: URL): string =>
  (url.pathname.split('/').pop() ?? '').split(/[.~]/)[0] || url.href;

function cleanImages(candidates: string[], pageUrl: URL): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate.trim(), pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;

    const key = imageKey(url);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(url.href);
    if (result.length >= CRAWLER_CONFIG.image.maxCount) break;
  }

  return result;
}

/**
 * Đọc thông tin sản phẩm từ HTML. Hàm thuần — không gọi mạng — để kiểm thử bằng HTML thật
 * đã lưu lại.
 *
 * Thứ tự tin cậy: dữ liệu riêng của sàn → JSON-LD `Product` → OpenGraph → `<title>`.
 */
export function extractProduct(
  html: string,
  platform: ShopPlatform,
  pageUrl: URL,
): ExtractedProduct {
  const $ = load(html);
  const ld = ldProduct($);
  const extra = platformExtra(platform, $, html);
  const offers = ld?.['offers'];
  const offer = Array.isArray(offers) ? offers.find(isObject) : isObject(offers) ? offers : undefined;

  const name =
    [extra.name, asText(ld?.['name']), ...meta($, 'og:title'), $('title').first().text()]
      .map((candidate) => cleanName(candidate ?? '', platform))
      .find(Boolean) ?? '';

  const price =
    extra.price ||
    formatVnd(offer?.['price']) ||
    formatVnd(offer?.['lowPrice']) ||
    formatVnd(meta($, 'product:price:amount')[0]) ||
    '';

  // Giá gốc chỉ có nghĩa khi cao hơn giá bán; bằng hoặc thấp hơn là dữ liệu nhiễu.
  const originalPrice =
    extra.originalPrice && price && priceValue(extra.originalPrice) > priceValue(price)
      ? extra.originalPrice
      : '';

  const description =
    [
      extra.description ?? '',
      asText(ld?.['description']),
      ...meta($, 'og:description'),
      ...meta($, 'description'),
    ]
      .map((candidate) => cleanDescription(candidate, platform))
      .find(Boolean) ?? '';

  const images = cleanImages(
    [...(extra.images ?? []), ...imageUrls(ld?.['image']), ...meta($, 'og:image')],
    pageUrl,
  );

  return { name, price, originalPrice, description, images };
}

/** Trường còn thiếu sau khi đọc, để giao diện nhắc người dùng điền tay. */
export function missingFields(product: ExtractedProduct): ProductField[] {
  const missing: ProductField[] = [];
  if (!product.name) missing.push('name');
  if (!product.price) missing.push('price');
  if (!product.description) missing.push('description');
  if (product.images.length === 0) missing.push('images');
  return missing;
}
