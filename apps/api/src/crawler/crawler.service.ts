import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  parseShopLink,
  platformOfHost,
  ProductInfoSchema,
  type ProductCrawl,
  type ProductInfo,
  type ShopPlatform,
} from '@repo/shared';
import type { Redis } from 'ioredis';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { MAX_ASSETS_PER_PROJECT, MAX_IMAGE_BYTES, MediaService } from '../media/media.service.js';
import type { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { CRAWLER_CONFIG, IMAGE_DOMAINS, PLATFORM_RULES } from './crawler.config.js';
import { extractProduct, missingFields, type ExtractedProduct } from './extract-product.js';
import { safeFetch } from './safe-fetch.js';

export interface ImportLinkInput {
  /** Link mới; bỏ trống thì đọc lại `sourceUrl` đã lưu. */
  url?: string;
  /** `true` — ghi đè cả những trường người dùng đã điền. */
  overwrite?: boolean;
}

export interface ImportLinkResult {
  project: Project;
  crawl: ProductCrawl;
  importedImages: number;
}

/** Các trường chữ được gộp từ kết quả đọc vào `product`. */
const TEXT_FIELDS = ['name', 'price', 'originalPrice', 'description'] as const;

const EMPTY: ExtractedProduct = {
  name: '',
  price: '',
  originalPrice: '',
  description: '',
  images: [],
};

const matchesDomain = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

/**
 * Link Shopee dạng `/Ten-san-pham-i.{shop}.{item}` về dạng `/product/{shop}/{item}`: thử thật
 * cho thấy bot xem trước link chỉ nhận được meta sản phẩm ở dạng thứ hai. Cũng dùng làm
 * khoá cache để hai kiểu link của cùng một sản phẩm không bị đọc hai lần.
 */
export function canonicalUrl(url: URL, platform: ShopPlatform): URL {
  const canonical = new URL(url.pathname, url.origin);

  if (platform === 'shopee' && matchesDomain(url.hostname, 'shopee.vn')) {
    const slug = /-i\.(\d+)\.(\d+)\/?$/.exec(url.pathname);
    if (slug) canonical.pathname = `/product/${slug[1]}/${slug[2]}`;
  }

  return canonical;
}

/**
 * Đọc link sản phẩm rồi điền vào dự án.
 *
 * Đọc hỏng **không phải lỗi của request**: sàn chặn bot là chuyện thường ngày, và người
 * dùng vẫn phải đi tiếp bằng cách điền tay. Vì thế mọi lỗi mạng hay lỗi phân tích chỉ
 * biến thành `crawl.status = 'failed'`; chỉ link sai sàn hoặc dùng quá nhanh mới trả lỗi.
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly projects: ProjectsService,
    private readonly media: MediaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async importLink(
    projectId: string,
    userId: string,
    input: ImportLinkInput,
  ): Promise<ImportLinkResult> {
    const project = await this.projects.detail(projectId, userId);

    if (project.mode !== 'link') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Chỉ dự án tạo từ link sản phẩm mới đọc link được',
      });
    }

    const rawUrl = (input.url ?? project.sourceUrl ?? '').trim();
    const link = parseShopLink(rawUrl);
    if (!link) throw new BusinessException('LINK_UNSUPPORTED');

    await this.assertNotRateLimited(userId);

    const { platform, extracted } = await this.read(link.url, link.platform);
    const missing = missingFields(extracted);
    const crawl: ProductCrawl = {
      status: !extracted.name && extracted.images.length === 0
        ? 'failed'
        : missing.length === 0
          ? 'success'
          : 'partial',
      missingFields: missing,
      at: new Date().toISOString(),
    };

    const current = ProductInfoSchema.safeParse(project.product);
    const product: ProductInfo = current.success
      ? current.data
      : ProductInfoSchema.parse({});

    for (const field of TEXT_FIELDS) {
      if (extracted[field] && (input.overwrite || !product[field])) {
        product[field] = extracted[field];
      }
    }
    product.platform = platform;
    product.crawl = crawl;

    // Lưu link đã bóc (trang chặn bot → link sản phẩm), để lần đọc lại đi thẳng vào sản phẩm.
    const saved = await this.projects.recordImport(project.id, userId, link.url.href, product);
    const importedImages = await this.importImages(saved, extracted.images);

    return { project: saved, crawl, importedImages };
  }

  private async assertNotRateLimited(userId: string): Promise<void> {
    const key = `crawler:import:${userId}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, CRAWLER_CONFIG.rateLimit.windowSec);
    }

    if (count > CRAWLER_CONFIG.rateLimit.maxPerWindow) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: 'Bạn đọc link quá nhanh, vui lòng đợi một phút rồi thử lại',
      });
    }
  }

  /** Đọc trang, có cache theo link đã chuẩn hoá. */
  private async read(
    url: URL,
    platform: ShopPlatform,
  ): Promise<{ platform: ShopPlatform; extracted: ExtractedProduct }> {
    const cacheKey = `crawler:page:${canonicalUrl(url, platform).href}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as { platform: ShopPlatform; extracted: ExtractedProduct };
    }

    const result = await this.fetchAndExtract(url, platform);

    // Chỉ cache lần đọc được: lần hỏng thường do sàn chặn nhất thời, thử lại có khi được.
    if (result.extracted.name || result.extracted.images.length > 0) {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CRAWLER_CONFIG.cacheTtlSec);
    }

    return result;
  }

  private async fetchAndExtract(
    url: URL,
    platform: ShopPlatform,
  ): Promise<{ platform: ShopPlatform; extracted: ExtractedProduct }> {
    try {
      let page = await this.fetchPage(canonicalUrl(url, platform), platform);
      let actual = platformOfHost(page.url.hostname) ?? platform;

      // Link rút gọn chỉ lộ ra link thật sau redirect, và link thật đó có thể vẫn cần chuẩn
      // hoá (Shopee). Đọc thêm đúng một lần nếu dạng chuẩn khác chỗ vừa tới.
      const resolved = canonicalUrl(page.url, actual);
      if (resolved.pathname !== page.url.pathname) {
        page = await this.fetchPage(resolved, actual);
        actual = platformOfHost(page.url.hostname) ?? actual;
      }

      return {
        platform: actual,
        extracted: extractProduct(page.body.toString('utf8'), actual, page.url),
      };
    } catch (error) {
      this.logger.warn(
        `Không đọc được ${url.href}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { platform, extracted: EMPTY };
    }
  }

  private fetchPage(url: URL, platform: ShopPlatform) {
    return safeFetch(url, {
      isHostAllowed: (host) => platformOfHost(host) !== null,
      userAgent: PLATFORM_RULES[platform].userAgent,
      accept: 'text/html,application/xhtml+xml',
      ...CRAWLER_CONFIG.page,
    });
  }

  /**
   * Tải ảnh song song, lưu tuần tự: `MediaService.upload` đánh số thứ tự bằng cách đếm tài
   * nguyên hiện có, chạy song song sẽ ra hai ảnh cùng số.
   *
   * Ảnh đã tải ở lần đọc trước (so theo URL gốc) thì bỏ qua, để bấm "Đọc lại" không nhân
   * đôi thư viện ảnh.
   */
  private async importImages(project: Project, urls: string[]): Promise<number> {
    const existing = await this.media.listByProject(project.id);
    const known = new Set(existing.map((asset) => asset.sourceUrl).filter(Boolean));
    const room = MAX_ASSETS_PER_PROJECT - existing.length;
    const pending = urls.filter((url) => !known.has(url)).slice(0, Math.max(room, 0));

    const downloads = await Promise.allSettled(
      pending.map((url) =>
        safeFetch(new URL(url), {
          isHostAllowed: (host) => IMAGE_DOMAINS.some((domain) => matchesDomain(host, domain)),
          userAgent: PLATFORM_RULES.tiktok_shop.userAgent,
          accept: 'image/webp,image/jpeg,image/png,image/*;q=0.8',
          timeoutMs: CRAWLER_CONFIG.image.timeoutMs,
          maxBytes: MAX_IMAGE_BYTES,
          maxRedirects: CRAWLER_CONFIG.page.maxRedirects,
        }),
      ),
    );

    let imported = 0;

    for (const [index, download] of downloads.entries()) {
      const url = pending[index] ?? '';

      if (download.status === 'rejected') {
        this.logger.warn(`Bỏ qua ảnh ${url}: ${String(download.reason)}`);
        continue;
      }

      try {
        await this.media.upload(project, { buffer: download.value.body }, 'crawled', url);
        imported += 1;
      } catch (error) {
        // Ảnh quá nhỏ, hỏng hoặc sai định dạng: bỏ ảnh đó, không làm hỏng cả lần đọc.
        this.logger.warn(
          `Bỏ qua ảnh ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return imported;
  }
}
