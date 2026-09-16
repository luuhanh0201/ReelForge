import { describe, expect, it } from "vitest";
import {
  distributeWordTimings,
  RenderConfigSchema,
  type RenderConfig,
} from "@repo/shared";
import { captionBounds, sceneAt } from "./draw-frame.js";

/** Config tối thiểu nhưng hợp lệ, đủ để kiểm tra luật thời gian. */
const buildConfig = (): RenderConfig =>
  RenderConfigSchema.parse({
    version: 2,
    output: {
      aspectRatio: "9:16",
      resolution: "1080p",
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 6_000_000,
    },
    template: {
      code: "bold_sale",
      primaryColor: "#ff6b35",
      subtitle: {},
      layout: { subtitleY: 0.78, imageFit: "cover", safeBottom: 0.22, padding: 0 },
    },
    scenes: [0, 1, 2].map((index) => ({
      index,
      startMs: index * 3000,
      durationMs: 3000,
      assetUrl: `https://cdn.test/anh-${index}.jpg`,
      kenBurns: { from: [0.5, 0.5, 1], to: [0.5, 0.5, 1.1] },
      transition: "cut",
      caption: { text: `Cảnh ${index}`, emphasis: [], words: [] },
    })),
    audio: {
      voiceClips: [0, 1, 2].map((index) => ({
        sceneIndex: index,
        url: `https://cdn.test/tieng-${index}.mp3`,
        durationMs: 3000,
        startMs: index * 3000,
      })),
      music: { url: "https://cdn.test/nhac.mp3", volumeDb: -18, fadeOutMs: 8200 },
    },
    meta: {
      projectId: "11111111-1111-4111-8111-111111111111",
      variationSeed: "seed-co-dinh",
      totalDurationMs: 9000,
    },
  });

describe("sceneAt", () => {
  const config = buildConfig();

  it("trả về đúng cảnh theo mốc thời gian", () => {
    expect(sceneAt(config, 0)?.index).toBe(0);
    expect(sceneAt(config, 2999)?.index).toBe(0);
    expect(sceneAt(config, 3000)?.index).toBe(1);
    expect(sceneAt(config, 8999)?.index).toBe(2);
  });

  /** Frame cuối hay rơi đúng vào ranh giới do làm tròn; trả nền đen sẽ thành một nháy đen. */
  it("quá cuối video thì giữ khung cuối thay vì trả về rỗng", () => {
    expect(sceneAt(config, 9000)?.index).toBe(2);
    expect(sceneAt(config, 999_999)?.index).toBe(2);
  });
});

describe("distributeWordTimings", () => {
  it("tổng thời lượng các từ khớp đúng thời lượng dòng", () => {
    const words = distributeWordTimings("Bàn phím này gõ rất êm tay", 4000);

    expect(words[0]!.startMs).toBe(0);
    expect(words[words.length - 1]!.endMs).toBe(4000);
  });

  it("các từ nối tiếp nhau, không hở và không chồng", () => {
    const words = distributeWordTimings("Một hai ba bốn năm", 2500);

    for (let i = 1; i < words.length; i += 1) {
      expect(words[i]!.startMs).toBe(words[i - 1]!.endMs);
    }
  });

  it("từ có dấu câu được cộng thêm khoảng nghỉ", () => {
    const [first, second] = distributeWordTimings("Rẻ, tốt", 1000);
    const firstSpan = first!.endMs - first!.startMs;
    const secondSpan = second!.endMs - second!.startMs;

    // "Rẻ," và "tốt" cùng 3 ký tự, nhưng dấu phẩy cộng thêm trọng số nghỉ.
    expect(firstSpan).toBeGreaterThan(secondSpan);
  });

  it("cộng offset để ghép được vào mốc tuyệt đối của cảnh", () => {
    const words = distributeWordTimings("Hai từ", 1000, 5000);

    expect(words[0]!.startMs).toBe(5000);
    expect(words[words.length - 1]!.endMs).toBe(6000);
  });

  it("dòng rỗng không sinh từ nào", () => {
    expect(distributeWordTimings("   ", 1000)).toEqual([]);
  });
});

/**
 * Ngữ cảnh canvas giả, chỉ đủ cho phép đo.
 *
 * `captionBounds` chỉ đụng tới `font` và `measureText`; dựng một canvas thật trong Node
 * đòi thêm phụ thuộc native mà không làm bài kiểm tra chặt hơn chút nào. Mỗi ký tự coi như
 * rộng 30px, đủ để một câu dài phải xuống nhiều dòng.
 */
const fakeContext = () => {
  const ctx = {
    font: "",
    measureText: (text: string) => ({ width: text.length * 30 }),
  };

  return ctx as unknown as CanvasRenderingContext2D;
};

const withCaption = (text: string, subtitleY: number, fontScale: number): RenderConfig => {
  const base = buildConfig();

  return {
    ...base,
    template: {
      ...base.template,
      subtitle: { ...base.template.subtitle, fontScale },
      layout: { ...base.template.layout, subtitleY },
    },
    scenes: base.scenes.map((scene) => ({
      ...scene,
      caption: {
        ...scene.caption,
        words: distributeWordTimings(text, scene.durationMs, scene.startMs),
      },
    })),
  };
};

describe("captionBounds", () => {
  it("cảnh chưa có chữ thì không có gì để đo", () => {
    const config = buildConfig();
    expect(captionBounds(fakeContext(), config, config.scenes[0]!)).toBeNull();
  });

  it("khối chữ nằm cân hai bên vị trí phụ đề", () => {
    const config = withCaption("Bàn phím này gõ rất êm tay", 0.78, 0.045);
    const bounds = captionBounds(fakeContext(), config, config.scenes[0]!)!;

    expect((bounds.top + bounds.bottom) / 2).toBeCloseTo(0.78, 2);
  });

  it("câu dài hơn thì xuống nhiều dòng và khối chữ cao hơn", () => {
    const ctx = fakeContext();
    const ngan = withCaption("Rẻ lắm", 0.78, 0.045);
    const dai = withCaption(
      "Bàn phím cơ này gõ rất êm tay và dùng được cả ngày không mỏi",
      0.78,
      0.045,
    );

    const a = captionBounds(ctx, ngan, ngan.scenes[0]!)!;
    const b = captionBounds(ctx, dai, dai.scenes[0]!)!;

    expect(b.lineCount).toBeGreaterThan(a.lineCount);
    expect(b.bottom - b.top).toBeGreaterThan(a.bottom - a.top);
  });

  /**
   * Đây là điều kiện mà khung xem trước dùng để cảnh báo. Đo sai ở đây nghĩa là người dùng
   * được báo an toàn rồi tải về một video bị nút nền tảng che mất chữ.
   */
  it("kéo phụ đề xuống đáy thì chữ lấn vào vùng bị che", () => {
    const ctx = fakeContext();
    const config = buildConfig();
    const safeBottom = 1 - config.template.layout.safeBottom;

    const giua = withCaption("Rẻ lắm", 0.5, 0.045);
    const day = withCaption("Rẻ lắm", 0.95, 0.045);

    expect(captionBounds(ctx, giua, giua.scenes[0]!)!.bottom).toBeLessThan(safeBottom);
    expect(captionBounds(ctx, day, day.scenes[0]!)!.bottom).toBeGreaterThan(safeBottom);
  });

  it("phóng cỡ chữ lên cũng đẩy chữ ra ngoài vùng an toàn", () => {
    const ctx = fakeContext();
    const safeBottom = 1 - buildConfig().template.layout.safeBottom;

    const nho = withCaption("Rẻ lắm", 0.74, 0.03);
    const to = withCaption("Rẻ lắm", 0.74, 0.14);

    expect(captionBounds(ctx, nho, nho.scenes[0]!)!.bottom).toBeLessThan(safeBottom);
    expect(captionBounds(ctx, to, to.scenes[0]!)!.bottom).toBeGreaterThan(safeBottom);
  });
});
