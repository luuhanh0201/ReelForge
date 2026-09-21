import { describe, expect, it } from "vitest";
import { scriptReadiness } from "./script-readiness.js";

/**
 * Cổng này quyết định có tiêu quota của mô hình hay không, nên mỗi luật đều có một test.
 * Nới một dòng ở đây là mở đường cho AI viết kịch bản bằng dữ liệu nó tự bịa.
 */

const full = {
  product: {
    name: "Tai nghe Bluetooth K29",
    price: "136.374đ",
    description: "Bluetooth 5.1, pin 30 giờ, chống nước IPX5, micro khử ồn, đệm tai silicon",
  },
  assetCount: 5,
  hasEnabledModel: true,
};

describe("scriptReadiness", () => {
  it("đủ dữ liệu thì cho gọi AI", () => {
    const result = scriptReadiness(full);

    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.reason).toBe("Đủ dữ liệu cho AI viết kịch bản");
  });

  it.each([
    ["thiếu tên", { ...full, product: { ...full.product, name: "  " } }, "name"],
    ["thiếu giá", { ...full, product: { ...full.product, price: "" } }, "price"],
    ["chưa có ảnh", { ...full, assetCount: 0 }, "images"],
    ["chưa bật model", { ...full, hasEnabledModel: false }, "model"],
  ])("%s thì chặn", (_label, input, field) => {
    const result = scriptReadiness(input);

    expect(result.ready).toBe(false);
    expect(result.missing).toContain(field);
  });

  it("mô tả quá ngắn chỉ là cảnh báo, không chặn", () => {
    const result = scriptReadiness({
      ...full,
      product: { ...full.product, description: "Tai nghe tốt" },
    });

    expect(result.ready).toBe(true);
    expect(result.warnings).toEqual(["description"]);
    expect(result.reason).toContain("chung chung hơn");
  });

  it("nói rõ thiếu gì bằng tiếng người", () => {
    const result = scriptReadiness({
      ...full,
      product: { name: "Tai nghe" },
      assetCount: 0,
    });

    expect(result.reason).toBe("Còn thiếu giá bán, ảnh sản phẩm");
  });

  it("chưa bật model được nói riêng, vì đó là việc của quản trị viên", () => {
    expect(scriptReadiness({ ...full, hasEnabledModel: false }).reason).toBe(
      "Chưa bật model AI viết kịch bản",
    );

    expect(
      scriptReadiness({ ...full, hasEnabledModel: false, assetCount: 0 }).reason,
    ).toBe("Chưa bật model AI, và còn thiếu ảnh sản phẩm");
  });

  it("sản phẩm rỗng thì liệt kê đủ mọi thứ còn thiếu", () => {
    const result = scriptReadiness({ product: {}, assetCount: 0, hasEnabledModel: false });

    expect(result.missing).toEqual(["name", "price", "images", "model"]);
  });
});
