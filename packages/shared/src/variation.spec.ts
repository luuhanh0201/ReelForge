import { describe, expect, it } from "vitest";
import { buildRenderConfig } from "./build-config.js";
import { createVariation, sceneVariation, variedSpeed } from "./variation.js";

const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    index,
    text: `Câu thoại số ${index + 1} của video bán hàng.`,
    emphasis: [],
    durationMs: 5000,
    assetUrl: `https://example.test/anh-${index}.jpg`,
  }));

const build = (seed?: string) =>
  buildRenderConfig({
    projectId: "11111111-1111-4111-8111-111111111111",
    aspectRatio: "9:16",
    resolution: "720p",
    lines: lines(4),
    variationSeed: seed,
  });

describe("buildRenderConfig với hạt giống", () => {
  /**
   * Bài quan trọng nhất trong tệp này.
   *
   * `transition` từng được khai ở hai nơi với hai danh sách khác nhau, nên config chỉ hỏng
   * khi hạt giống rơi trúng một giá trị không có trong schema — lỗi ngẫu nhiên, chỉ lộ ra
   * lúc chạy thật. Quét nhiều hạt giống là cách rẻ nhất để chặn cả họ lỗi đó.
   */
  it("mọi hạt giống đều cho ra config hợp lệ", () => {
    for (let index = 0; index < 300; index += 1) {
      expect(() => build(`seed-${index}`)).not.toThrow();
    }
  });

  it("cùng hạt giống luôn cho cùng một video", () => {
    expect(JSON.stringify(build("abc"))).toBe(JSON.stringify(build("abc")));
  });

  /** Nếu hai lần xuất ra hai file giống hệt nhau thì nền tảng coi là nội dung trùng lặp. */
  it("hạt giống khác nhau làm đổi Ken Burns hoặc chuyển cảnh", () => {
    const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);
    const shapes = new Set(
      seeds.map((seed) =>
        JSON.stringify(
          build(seed)!.scenes.map((scene) => [scene.kenBurns, scene.transition]),
        ),
      ),
    );

    // Không đòi 20/20 khác nhau, nhưng trùng gần hết là dấu hiệu bộ sinh đã hỏng.
    expect(shapes.size).toBeGreaterThan(15);
  });

  it("bỏ trống hạt giống thì dùng mã dự án, nên khung xem trước ổn định", () => {
    const config = build();
    expect(config?.meta.variationSeed).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("màu chữ người dùng đã chọn không bị hạt giống ghi đè", () => {
    const config = buildRenderConfig({
      projectId: "22222222-2222-4222-8222-222222222222",
      aspectRatio: "9:16",
      resolution: "720p",
      subtitle: { activeColor: "#123456" },
      lines: lines(2),
      variationSeed: "bất kỳ",
    });

    expect(config?.template.subtitle.activeColor).toBe("#123456");
  });
});

describe("sceneVariation", () => {
  it("giữ zoom và điểm nhìn trong khoảng tài liệu quy định", () => {
    const variation = createVariation("kiểm-thử");

    for (let position = 0; position < 50; position += 1) {
      const { kenBurns } = sceneVariation(variation, position);

      for (const point of [kenBurns.from, kenBurns.to]) {
        // Điểm nhìn lệch tối đa 3% quanh tâm hoặc quanh một trong bốn hướng.
        expect(point[0]).toBeGreaterThan(0.35);
        expect(point[0]).toBeLessThan(0.65);
        expect(point[2]).toBeGreaterThanOrEqual(1);
        expect(point[2]).toBeLessThanOrEqual(1.15);
      }
    }
  });
});

describe("variedSpeed", () => {
  it("lệch không quá 7% so với tốc độ người dùng chọn", () => {
    for (let index = 0; index < 100; index += 1) {
      const speed = variedSpeed(createVariation(`s${index}`), 1);
      expect(speed).toBeGreaterThanOrEqual(0.93);
      expect(speed).toBeLessThanOrEqual(1.07);
    }
  });
});
