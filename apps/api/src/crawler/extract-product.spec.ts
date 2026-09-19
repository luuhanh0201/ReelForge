import { readFileSync } from 'node:fs';
import type { ShopPlatform } from '@repo/shared';
import { extractProduct, formatVnd, missingFields } from './extract-product.js';

/**
 * HTML trong `fixtures/` được rút gọn từ trang thật tải về ngày 2026-09-16, giữ nguyên cấu
 * trúc các thẻ và khối dữ liệu mà parser đọc. Sàn đổi giao diện thì tải lại trang, rút gọn
 * lại, và các test này cho biết ngay chỗ nào vỡ.
 */
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');

const run = (name: string, platform: ShopPlatform, url: string) =>
  extractProduct(fixture(name), platform, new URL(url));

describe('extractProduct — TikTok Shop', () => {
  const product = run('tiktok-product', 'tiktok_shop', 'https://shop.tiktok.com/vn/pdp/1734403691296490661');

  it('đọc tên từ dữ liệu sản phẩm', () => {
    expect(product.name).toMatch(/^Tai nghe bluetooth K29/);
  });

  it('lấy giá khuyến mãi, không bắt nhầm phí vận chuyển', () => {
    expect(product.price).toBe('134.400đ');
    expect(product.originalPrice).toBe('1.168.705đ');
  });

  it('ghép mô tả rich text thành từng dòng', () => {
    expect(product.description.split('\n')[0]).toBe('Mô Tả Sản Phẩm:');
    expect(product.description).toContain('Bluetooth 5.1');
  });

  it('lấy ảnh sản phẩm và bỏ trùng với og:image', () => {
    expect(product.images).toHaveLength(3);
    expect(product.images.every((url) => url.startsWith('https://'))).toBe(true);
  });

  it('coi trang chưa điền {product_name} là không đọc được', () => {
    const empty = run('tiktok-placeholder', 'tiktok_shop', 'https://shop.tiktok.com/vn/pdp/1');
    expect(empty.name).toBe('');
    expect(empty.description).toBe('');
    expect(missingFields(empty)).toEqual(['name', 'price', 'description', 'images']);
  });
});

describe('extractProduct — Shopee', () => {
  it('đọc tên và ảnh từ OpenGraph, cắt hậu tố sàn, bỏ mô tả khuôn mẫu', () => {
    const product = run('shopee-product', 'shopee', 'https://shopee.vn/product/395295057/29704866711');

    expect(product.name).toBe(
      'Tai Nghe Bluetooth Chụp Tai EDIFIER W830NB | Chống Ồn Chủ Động | Thời Gian Sử Dụng Tới 96H | Bảo Hành 15 Tháng',
    );
    expect(product.images).toEqual([
      'https://down-vn.img.susercontent.com/file/vn-11134201-81ztc-mt65kjgkqpl1dd',
    ]);
    expect(product.description).toBe('');
    // Shopee không bao giờ trả giá trong HTML cho bot.
    expect(missingFields(product)).toEqual(['price', 'description']);
  });

  it('coi trang chủ trả về thay cho sản phẩm là không đọc được', () => {
    const product = run('shopee-generic', 'shopee', 'https://shopee.vn/product/1/2');
    expect(product.name).toBe('');
    expect(product.images).toEqual([]);
  });
});

describe('extractProduct — Lazada', () => {
  const product = run(
    'lazada-product',
    'lazada',
    'https://www.lazada.vn/products/tai-nghe-bluetooth-pamu-slide-mini-i456096674.html',
  );

  it('đọc tên từ JSON-LD, không lấy tiêu đề có hậu tố sàn', () => {
    expect(product.name).toBe('Tai nghe Bluetooth Pamu Slide Mini');
  });

  it('bỏ giá 0 trong JSON-LD, lấy giá thật từ dữ liệu trang', () => {
    expect(product.price).toBe('2.490.000đ');
    expect(product.originalPrice).toBe('');
  });

  it('có mô tả thật', () => {
    expect(product.description).toMatch(/^Thiết kế hiện đại/);
  });

  it('gộp cùng một ảnh xuất hiện qua hai CDN, sửa link thiếu giao thức', () => {
    expect(product.images).toEqual(['https://vn-test-11.slatic.net/p/mdc/043ec92964f626e1979eaa2a8912bc05.jpg']);
  });
});

describe('formatVnd', () => {
  it.each([
    ['2.490.000 ₫', '2.490.000đ'],
    ['134400', '134.400đ'],
    [134400, '134.400đ'],
    ['134400.00', '134.400đ'],
    ['0', ''],
    ['', ''],
    ['liên hệ', ''],
  ])('%s → %s', (raw, expected) => {
    expect(formatVnd(raw)).toBe(expected);
  });
});
