import { describe, expect, it } from "vitest";
import {
  distributeWordTimings,
  RenderConfigSchema,
  type RenderConfig,
} from "@repo/shared";
import { sceneAt } from "./draw-frame.js";

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
