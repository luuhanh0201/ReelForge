import {
  distributeWordTimings,
  OUTPUT_PRESETS,
  RenderConfigSchema,
  type RenderConfig,
  type SubtitleStyle,
} from "@repo/shared";
import type { ImageMap, ImageSource } from "@repo/render-core";
import type { MediaAssetView, Project } from "@/lib/studio/projects-api";

/**
 * Thời lượng tạm cho mỗi cảnh khi **chưa có audio thật để đo**.
 *
 * Con số này sẽ được thay bằng độ dài file TTS ở bước sau; giữ ở một chỗ để lúc đó chỉ
 * phải sửa một dòng.
 */
export const PLACEHOLDER_SCENE_MS = 10_000;

/** Bố cục theo khổ — phụ đề đặt ở đáy khung dọc thì hợp lý, khung ngang thì che sản phẩm. */
const LAYOUTS: Record<
  Project["aspectRatio"],
  { subtitleY: number; imageFit: "cover" | "contain"; safeBottom: number; padding: number }
> = {
  "9:16": { subtitleY: 0.78, imageFit: "cover", safeBottom: 0.22, padding: 0 },
  "1:1": { subtitleY: 0.82, imageFit: "cover", safeBottom: 0.18, padding: 0 },
  "16:9": { subtitleY: 0.85, imageFit: "contain", safeBottom: 0.12, padding: 0.08 },
};

/**
 * Dựng `RenderConfig` từ dự án để xem trước ngay trên trình duyệt.
 *
 * Đây là **bản tạm của máy khách**: mốc thời gian dựa trên độ dài ước lượng, chưa có
 * tiếng nói. Khi backend có `RenderConfigModule`, cấu hình thật sẽ do máy chủ dựng và hàm
 * này biến mất — nhưng `drawFrame` thì không đổi, vì nó chỉ ăn `RenderConfig`.
 */
export const buildPreviewConfig = (
  project: Project,
  assets: MediaAssetView[],
  subtitleStyle?: Partial<SubtitleStyle>,
  sceneDurations?: number[],
): RenderConfig | null => {
  if (project.lines.length === 0) return null;

  const preset = OUTPUT_PRESETS[project.aspectRatio][project.resolution];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  // Mốc bắt đầu cộng dồn: cảnh dài ngắn khác nhau thì cảnh sau phải dịch theo.
  let cursorMs = 0;

  const scenes = project.lines.map((line, index) => {
    const asset = line.assetId ? byId.get(line.assetId) : assets[index % Math.max(1, assets.length)];
    const durationMs = sceneDurations?.[index] ?? PLACEHOLDER_SCENE_MS;
    const startMs = cursorMs;
    cursorMs += durationMs;

    return {
      index,
      startMs,
      durationMs,
      assetUrl: asset?.url ?? "",
      // Ken Burns luân phiên hướng để các cảnh liền nhau không giống hệt nhau.
      kenBurns:
        index % 2 === 0
          ? { from: [0.5, 0.5, 1] as const, to: [0.5, 0.45, 1.12] as const }
          : { from: [0.5, 0.45, 1.12] as const, to: [0.5, 0.5, 1] as const },
      transition: "fade" as const,
      caption: {
        text: line.text,
        emphasis: line.emphasis,
        words: distributeWordTimings(line.text, durationMs, startMs),
      },
    };
  });

  const config = {
    version: 2 as const,
    output: {
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      width: preset.width,
      height: preset.height,
      fps: 30 as const,
      bitrate: preset.bitrate,
    },
    template: {
      code: "bold_sale",
      primaryColor: "#ff6b35",
      subtitle: subtitleStyle ?? {},
      layout: {
        ...LAYOUTS[project.aspectRatio],
        // Vị trí người dùng tự kéo thắng bố cục mặc định của khổ.
        subtitleY: subtitleStyle?.positionY ?? LAYOUTS[project.aspectRatio].subtitleY,
      },
    },
    scenes: scenes.map((scene) => ({
      ...scene,
      kenBurns: {
        from: [...scene.kenBurns.from] as [number, number, number],
        to: [...scene.kenBurns.to] as [number, number, number],
      },
    })),
    audio: { voiceClips: [], music: null },
    meta: {
      projectId: project.id,
      variationSeed: project.id,
      totalDurationMs: cursorMs,
    },
  };

  // Validate cả ở đầu này: config hỏng phải bị chặn trước khi vẽ chứ không phải sau đó.
  return RenderConfigSchema.parse(config);
};

/**
 * Tải và giải mã trước toàn bộ ảnh.
 *
 * `crossOrigin = "anonymous"` là **bắt buộc**: thiếu nó thì canvas bị "nhiễm bẩn" và
 * `toBlob`/`VideoFrame` sẽ ném lỗi bảo mật ở bước xuất — lỗi chỉ lộ ra ở cuối, sau khi
 * người dùng đã dựng xong cả video.
 */
export const loadImages = async (urls: string[]): Promise<ImageMap> => {
  const unique = [...new Set(urls.filter(Boolean))];

  const entries = await Promise.all(
    unique.map(
      (url) =>
        new Promise<[string, ImageSource] | null>((resolve) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => resolve([url, image as unknown as ImageSource]);
          // Một ảnh hỏng không được làm chết cả bản xem trước.
          image.onerror = () => resolve(null);
          image.src = url;
        }),
    ),
  );

  return new Map(entries.filter((entry): entry is [string, ImageSource] => entry !== null));
};
