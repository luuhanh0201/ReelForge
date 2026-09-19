import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { MediaService } from '../media/media.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { Redis } from 'ioredis';
import { canonicalUrl, CrawlerService } from './crawler.service.js';
import { safeFetch } from './safe-fetch.js';

vi.mock('./safe-fetch.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./safe-fetch.js')>()),
  safeFetch: vi.fn(),
}));

const fetchMock = vi.mocked(safeFetch);

const LAZADA_URL = 'https://www.lazada.vn/products/tai-nghe-bluetooth-pamu-slide-mini-i456096674.html';
const lazadaHtml = readFileSync(new URL('./fixtures/lazada-product.html', import.meta.url));
const IMAGE = 'https://vn-test-11.slatic.net/p/mdc/043ec92964f626e1979eaa2a8912bc05.jpg';

const build = (options: { product?: Record<string, unknown>; mode?: string } = {}) => {
  const project = {
    id: 'p1',
    mode: options.mode ?? 'link',
    sourceUrl: null as string | null,
    product: options.product ?? {},
  };

  const store = new Map<string, string>();
  const redis = {
    incr: vi.fn(async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
  };

  const projects = {
    detail: vi.fn(async () => project),
    recordImport: vi.fn(
      async (_id: string, _user: string, sourceUrl: string, product: Record<string, unknown>) => {
        project.sourceUrl = sourceUrl;
        project.product = product;
        return { ...project };
      },
    ),
  };

  const assets: { sourceUrl: string | null }[] = [];
  const media = {
    listByProject: vi.fn(async () => assets),
    upload: vi.fn(async (_project: unknown, _file: unknown, _origin: string, sourceUrl: string) => {
      assets.push({ sourceUrl });
      return {};
    }),
  };

  const service = new CrawlerService(
    projects as unknown as ProjectsService,
    media as unknown as MediaService,
    redis as unknown as Redis,
  );

  return { service, projects, media, redis };
};

const pageResponse = (html: Buffer, url = LAZADA_URL) => ({
  url: new URL(url),
  contentType: 'text/html',
  body: html,
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: URL) =>
    url.hostname.endsWith('slatic.net')
      ? { url, contentType: 'image/jpeg', body: Buffer.from('jpeg') }
      : pageResponse(lazadaHtml),
  );
});

describe('CrawlerService.importLink', () => {
  it('điền sản phẩm, lưu link gốc và tải ảnh', async () => {
    const { service, projects, media } = build();

    const result = await service.importLink('p1', 'u1', { url: `  ${LAZADA_URL}?spm=abc  ` });

    expect(result.crawl.status).toBe('success');
    expect(result.importedImages).toBe(1);
    expect(projects.recordImport).toHaveBeenCalledWith(
      'p1',
      'u1',
      `${LAZADA_URL}?spm=abc`,
      expect.objectContaining({
        name: 'Tai nghe Bluetooth Pamu Slide Mini',
        price: '2.490.000đ',
        platform: 'lazada',
      }),
    );
    expect(media.upload).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'crawled', IMAGE);
  });

  it('không ghi đè trường người dùng đã sửa, trừ khi yêu cầu', async () => {
    const edited = { name: 'Tên tự đặt', price: '' };

    const keep = build({ product: edited });
    await keep.service.importLink('p1', 'u1', { url: LAZADA_URL });
    expect(keep.projects.recordImport.mock.calls[0]?.[3]).toMatchObject({
      name: 'Tên tự đặt',
      price: '2.490.000đ',
    });

    const replace = build({ product: edited });
    await replace.service.importLink('p1', 'u1', { url: LAZADA_URL, overwrite: true });
    expect(replace.projects.recordImport.mock.calls[0]?.[3]).toMatchObject({
      name: 'Tai nghe Bluetooth Pamu Slide Mini',
    });
  });

  it('đọc hỏng vẫn trả kết quả failed để giao diện mở form nhập tay', async () => {
    fetchMock.mockRejectedValue(new Error('HTTP 403'));
    const { service } = build();

    const result = await service.importLink('p1', 'u1', { url: LAZADA_URL });

    expect(result.crawl.status).toBe('failed');
    expect(result.crawl.missingFields).toEqual(['name', 'price', 'description', 'images']);
    expect(result.importedImages).toBe(0);
  });

  it('đọc lại dùng cache và không tải lại ảnh đã có', async () => {
    const { service, media } = build();

    await service.importLink('p1', 'u1', { url: LAZADA_URL });
    await service.importLink('p1', 'u1', {});

    const pageFetches = fetchMock.mock.calls.filter(([url]) => url.hostname === 'www.lazada.vn');
    expect(pageFetches).toHaveLength(1);
    expect(media.upload).toHaveBeenCalledTimes(1);
  });

  it('một ảnh lỗi không làm hỏng cả lần đọc', async () => {
    const { service, media } = build();
    media.upload.mockRejectedValueOnce(new BusinessException('IMAGE_CORRUPT'));

    const result = await service.importLink('p1', 'u1', { url: LAZADA_URL });

    expect(result.crawl.status).toBe('success');
    expect(result.importedImages).toBe(0);
  });

  it('từ chối link ngoài sàn hỗ trợ trước khi gọi mạng', async () => {
    const { service } = build();

    await expect(service.importLink('p1', 'u1', { url: 'https://tiki.vn/abc' })).rejects.toMatchObject({
      code: 'LINK_UNSUPPORTED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('từ chối dự án chế độ manual', async () => {
    const { service } = build({ mode: 'manual' });

    await expect(service.importLink('p1', 'u1', { url: LAZADA_URL })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('chặn khi đọc quá nhiều lần trong một phút', async () => {
    const { service } = build();

    for (let i = 0; i < 10; i += 1) {
      await service.importLink('p1', 'u1', { url: LAZADA_URL });
    }

    await expect(service.importLink('p1', 'u1', { url: LAZADA_URL })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('link rút gọn Shopee: đi theo redirect rồi đọc lại ở dạng chuẩn', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        pageResponse(Buffer.from('<html></html>'), 'https://shopee.vn/Tai-nghe-i.395295057.29704866711?sp_atk=x'),
      )
      .mockResolvedValueOnce(
        pageResponse(
          readFileSync(new URL('./fixtures/shopee-product.html', import.meta.url)),
          'https://shopee.vn/product/395295057/29704866711',
        ),
      )
      .mockRejectedValue(new Error('ảnh'));
    const { service } = build();

    const result = await service.importLink('p1', 'u1', { url: 'https://s.shopee.vn/abc' });

    expect(fetchMock.mock.calls[1]?.[0].href).toBe('https://shopee.vn/product/395295057/29704866711');
    expect(result.project.product).toMatchObject({ platform: 'shopee' });
    expect(result.crawl.status).toBe('partial');
  });
});

describe('canonicalUrl', () => {
  it('bỏ query, đổi link Shopee dạng slug về /product', () => {
    expect(
      canonicalUrl(new URL('https://shopee.vn/Ten-San-Pham-i.1211891129.56600520164?sp=1'), 'shopee').href,
    ).toBe('https://shopee.vn/product/1211891129/56600520164');
  });

  it('giữ nguyên đường dẫn của sàn khác', () => {
    expect(canonicalUrl(new URL(`${LAZADA_URL}?spm=1`), 'lazada').href).toBe(LAZADA_URL);
  });
});

describe('CrawlerService — link trang chặn bot của Shopee', () => {
  it('đọc link sản phẩm trong tham số next và lưu link đó', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        pageResponse(
          readFileSync(new URL('./fixtures/shopee-product.html', import.meta.url)),
          'https://shopee.vn/product/395295057/29704866711',
        ),
      )
      .mockRejectedValue(new Error('ảnh'));
    const { service, projects } = build();
    const product = 'https://shopee.vn/Tai-nghe-i.395295057.29704866711';
    const verify = `https://shopee.vn/verify/traffic/error?next=${encodeURIComponent(product)}&type=4`;

    const result = await service.importLink('p1', 'u1', { url: verify });

    expect(fetchMock.mock.calls[0]?.[0].href).toBe('https://shopee.vn/product/395295057/29704866711');
    expect(projects.recordImport.mock.calls[0]?.[2]).toBe(product);
    expect(result.crawl.status).toBe('partial');
  });
});
