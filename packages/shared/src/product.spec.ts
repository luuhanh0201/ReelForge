import { describe, expect, it } from "vitest";
import { parseShopLink, platformOfHost, ProductInfoSchema } from "./product.js";

describe("parseShopLink", () => {
  it.each([
    ["https://shopee.vn/product/395295057/29704866711", "shopee"],
    ["https://shp.ee/abc123", "shopee"],
    ["https://vn.shp.ee/abc123", "shopee"],
    ["https://shop.tiktok.com/vn/pdp/1734403691296490661", "tiktok_shop"],
    ["https://vt.tiktok.com/ZSabc/", "tiktok_shop"],
    ["https://www.lazada.vn/products/abc-i456096674.html", "lazada"],
    ["  https://s.lazada.vn/s.abc  ", "lazada"],
  ])("nhận %s", (raw, platform) => {
    expect(parseShopLink(raw)?.platform).toBe(platform);
  });

  it.each([
    ["http thường", "http://shopee.vn/product/1/2"],
    ["tên miền giả mạo đuôi", "https://shopee.vn.evil.com/product/1/2"],
    ["tên miền giả mạo đầu", "https://fakeshopee.vn/product/1/2"],
    ["kèm thông tin đăng nhập", "https://user:pass@shopee.vn/product/1/2"],
    ["không phải URL", "shopee tai nghe"],
    ["sàn không hỗ trợ", "https://tiki.vn/abc"],
  ])("từ chối %s", (_label, raw) => {
    expect(parseShopLink(raw)).toBeNull();
  });

  describe("trang chặn bot của Shopee", () => {
    const product =
      "https://shopee.vn/Sac-Du-Phong-20000mAh-i.699159587.26406744573?extraParams=%7B%7D";
    const verify = (next: string) =>
      `https://shopee.vn/verify/traffic/error?home_url=https%3A%2F%2Fshopee.vn&next=${encodeURIComponent(next)}&type=4`;

    it("lấy link sản phẩm thật trong tham số next", () => {
      expect(parseShopLink(verify(product))?.url.href).toBe(product);
    });

    it.each([
      ["next trỏ ra host khác", "https://evil.com/-i.1.2"],
      ["next là http", "http://shopee.vn/-i.1.2"],
      ["next lại là trang verify", verify(product)],
      ["next không phải URL", "abc"],
    ])("giữ nguyên link khi %s", (_label, next) => {
      const raw = verify(next);
      expect(parseShopLink(raw)?.url.href).toBe(new URL(raw).href);
    });
  });

  it("không phân biệt hoa thường và dấu chấm cuối host", () => {
    expect(platformOfHost("WWW.LAZADA.VN.")).toBe("lazada");
  });
});

describe("ProductInfoSchema", () => {
  it("đọc được cột product cũ đang lưu {}", () => {
    expect(ProductInfoSchema.parse({})).toEqual({
      name: "",
      price: "",
      originalPrice: "",
      description: "",
      platform: "manual",
    });
  });

  it("từ chối tên quá dài", () => {
    expect(ProductInfoSchema.safeParse({ name: "a".repeat(301) }).success).toBe(false);
  });
});
