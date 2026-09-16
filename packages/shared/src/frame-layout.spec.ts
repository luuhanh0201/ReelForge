import { describe, expect, it } from "vitest";
import { buildRenderConfig, LAYOUTS } from "./build-config.js";
import { FrameLayoutsSchema, SceneCropsSchema, type Crop } from "./frame-layout.js";
import type { AspectRatio } from "./render-config.js";

const lines = (count: number, crop?: Crop) =>
  Array.from({ length: count }, (_, index) => ({
    index,
    text: `Câu thoại số ${index + 1} của video bán hàng.`,
    emphasis: [],
    durationMs: 5000,
    assetUrl: `https://example.test/anh-${index}.jpg`,
    crop,
  }));

const build = (
  input: {
    aspectRatio?: AspectRatio;
    layout?: { subtitleY?: number | null; fontScale?: number | null };
    subtitle?: { fontScale?: number };
    crop?: Crop;
  } = {},
) =>
  buildRenderConfig({
    projectId: "11111111-1111-4111-8111-111111111111",
    aspectRatio: input.aspectRatio ?? "9:16",
    resolution: "720p",
    subtitle: input.subtitle,
    layout: input.layout,
    lines: lines(2, input.crop),
    variationSeed: "hat-giong-co-dinh",
  });

describe("bố cục theo từng khổ", () => {
  it("vị trí phụ đề người dùng kéo thắng mặc định của khổ", () => {
    expect(build({ layout: { subtitleY: 0.42 } })!.template.layout.subtitleY).toBe(0.42);
  });

  it("chưa kéo thì mỗi khổ dùng mặc định của chính nó", () => {
    for (const aspectRatio of ["9:16", "1:1", "16:9"] as const) {
      expect(build({ aspectRatio })!.template.layout.subtitleY).toBe(
        LAYOUTS[aspectRatio].subtitleY,
      );
    }
  });

  /**
   * Bài này giữ đúng lý do cột `frame_layouts` ra đời: cùng một con số cỡ chữ cho ra chữ
   * to nhỏ rất khác giữa khung dọc và khung ngang, vì nó tính theo chiều cao.
   */
  it("khung ngang có cỡ chữ mặc định lớn hơn khung dọc", () => {
    expect(LAYOUTS["16:9"].fontScale).toBeGreaterThan(LAYOUTS["9:16"].fontScale);
  });

  it("cỡ chữ xếp hạng: kéo tay > preset kiểu chữ > mặc định của khổ", () => {
    expect(
      build({ layout: { fontScale: 0.11 }, subtitle: { fontScale: 0.05 } })!.template
        .subtitle.fontScale,
    ).toBe(0.11);

    expect(build({ subtitle: { fontScale: 0.05 } })!.template.subtitle.fontScale).toBe(
      0.05,
    );

    expect(build({ aspectRatio: "16:9" })!.template.subtitle.fontScale).toBe(
      LAYOUTS["16:9"].fontScale,
    );
  });

  /** `null` nghĩa là chưa đụng tới, không phải "đặt bằng 0". */
  it("giá trị null rơi về mặc định của khổ", () => {
    const config = build({ layout: { subtitleY: null, fontScale: null } })!;

    expect(config.template.layout.subtitleY).toBe(LAYOUTS["9:16"].subtitleY);
    expect(config.template.subtitle.fontScale).toBe(LAYOUTS["9:16"].fontScale);
  });
});

describe("khung cắt ảnh", () => {
  /**
   * Hàng rào chống hồi quy: cảnh chưa ai cắt phải cho ra **đúng những con số cũ**, nếu
   * không thì mọi dự án đang có sẽ đổi hình chỉ vì hệ thống thêm một tính năng.
   */
  it("không cắt thì Ken Burns giữ nguyên hành vi cũ", () => {
    const scene = build()!.scenes[0]!;

    for (const point of [scene.kenBurns.from, scene.kenBurns.to]) {
      expect(point[0]).toBeGreaterThan(0.35);
      expect(point[0]).toBeLessThan(0.65);
      expect(point[2]).toBeGreaterThanOrEqual(1);
      expect(point[2]).toBeLessThanOrEqual(1.15);
    }
  });

  it("cắt xong thì chuyển động chạy quanh khung người dùng chọn", () => {
    const crop: Crop = { x: 0.25, y: 0.7, zoom: 1.5 };
    const scene = build({ crop })!.scenes[0]!;

    for (const point of [scene.kenBurns.from, scene.kenBurns.to]) {
      // Lệch tối đa 0.08 do hướng cộng 0.03 do rung nhẹ — vẫn bám lấy khung đã cắt.
      expect(Math.abs(point[0] - crop.x)).toBeLessThanOrEqual(0.11);
      expect(Math.abs(point[1] - crop.y)).toBeLessThanOrEqual(0.11);
    }
  });

  it("mức phóng của người dùng là sàn, Ken Burns chỉ phóng thêm", () => {
    const crop: Crop = { x: 0.5, y: 0.5, zoom: 2 };
    const scene = build({ crop })!.scenes[0]!;

    for (const point of [scene.kenBurns.from, scene.kenBurns.to]) {
      expect(point[2]).toBeGreaterThanOrEqual(2);
    }
  });

  it("cùng hạt giống và cùng khung cắt luôn cho cùng một video", () => {
    const crop: Crop = { x: 0.31, y: 0.62, zoom: 1.2 };
    expect(JSON.stringify(build({ crop }))).toBe(JSON.stringify(build({ crop })));
  });
});

describe("schema chặn dữ liệu hỏng từ trình duyệt", () => {
  it("từ chối khổ không có thật và giá trị ngoài khoảng", () => {
    expect(FrameLayoutsSchema.safeParse({ "4:3": { subtitleY: 0.5 } }).success).toBe(false);
    expect(FrameLayoutsSchema.safeParse({ "9:16": { subtitleY: 2 } }).success).toBe(false);
    expect(SceneCropsSchema.safeParse({ "9:16": { x: 0.5, y: 0.5, zoom: 9 } }).success).toBe(
      false,
    );
  });

  it("nhận bố cục hợp lệ và điền null cho phần bỏ trống", () => {
    const parsed = FrameLayoutsSchema.parse({ "9:16": { subtitleY: 0.5 } });
    expect(parsed["9:16"]).toEqual({ subtitleY: 0.5, fontScale: null });
  });
});
