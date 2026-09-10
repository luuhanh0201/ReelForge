import {
  distributeWordTimings,
  OUTPUT_PRESETS,
  RenderConfigSchema,
  type AspectRatio,
  type RenderConfig,
  type Resolution,
  type SubtitleStyle,
} from "./render-config.js";

/**
 * Bố cục theo khổ video.
 *
 * Đổi khổ **không phải chỉ scale lại**: phụ đề đặt ở đáy khung dọc thì hợp lý, đặt ở đáy
 * khung ngang thì che mất sản phẩm; ảnh gần vuông thả vào khung ngang sẽ thừa hai bên.
 */
export const LAYOUTS: Record<
  AspectRatio,
  { subtitleY: number; imageFit: "cover" | "contain"; safeBottom: number; padding: number }
> = {
  "9:16": { subtitleY: 0.78, imageFit: "cover", safeBottom: 0.22, padding: 0 },
  "1:1": { subtitleY: 0.82, imageFit: "cover", safeBottom: 0.18, padding: 0 },
  "16:9": { subtitleY: 0.85, imageFit: "contain", safeBottom: 0.12, padding: 0.08 },
};

/** Thời lượng tạm cho một cảnh chưa có tiếng để đo. */
export const PLACEHOLDER_SCENE_MS = 10_000;

export interface BuildConfigInput {
  projectId: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  subtitle?: Partial<SubtitleStyle>;
  lines: {
    index: number;
    text: string;
    emphasis: string[];
    durationMs: number;
    /** URL đã ký của media cảnh này; rỗng nghĩa là cảnh chưa có gì. */
    assetUrl: string;
    assetKind?: "image" | "video" | "gif";
  }[];
  /** Tiếng đã tổng hợp, khoá theo chỉ số cảnh. */
  voiceClips?: { sceneIndex: number; url: string; durationMs: number }[];
}

/**
 * Dựng `RenderConfig` từ dữ liệu một dự án.
 *
 * Đặt ở `packages/shared` chứ không ở riêng máy chủ hay riêng trình duyệt là chủ ý: khung
 * xem trước và file MP4 xuất ra **phải sinh ra từ đúng một phép tính**. Tách làm hai bản
 * thì trong vài tháng chúng sẽ trôi khỏi nhau, và người dùng nhận được một video khác thứ
 * họ vừa duyệt — loại lỗi gần như không thể tìm ra từ báo cáo của khách.
 *
 * Hàm thuần tuý: không đọc DOM, không gọi mạng, không dùng `Date`/`Math.random`. Nhờ vậy
 * cùng một đầu vào luôn cho cùng một config, ở cả hai phía.
 */
export const buildRenderConfig = (input: BuildConfigInput): RenderConfig | null => {
  if (input.lines.length === 0) return null;

  const preset = OUTPUT_PRESETS[input.aspectRatio][input.resolution];
  const layout = LAYOUTS[input.aspectRatio];

  const starts: number[] = [];
  const scenes = input.lines.map((line, position) => {
    const previousStart = starts[position - 1] ?? 0;
    const previousDuration = input.lines[position - 1]?.durationMs ?? 0;
    const startMs = position === 0 ? 0 : previousStart + previousDuration;
    starts.push(startMs);

    const durationMs = line.durationMs > 0 ? line.durationMs : PLACEHOLDER_SCENE_MS;

    return {
      index: line.index,
      startMs,
      durationMs,
      assetUrl: line.assetUrl,
      assetKind: line.assetKind ?? "image",
      // Ken Burns luân phiên hướng để hai cảnh liền nhau không giống hệt nhau.
      kenBurns:
        position % 2 === 0
          ? {
              from: [0.5, 0.5, 1] as [number, number, number],
              to: [0.5, 0.45, 1.12] as [number, number, number],
            }
          : {
              from: [0.5, 0.45, 1.12] as [number, number, number],
              to: [0.5, 0.5, 1] as [number, number, number],
            },
      transition: "fade" as const,
      caption: {
        text: line.text,
        emphasis: line.emphasis,
        words: distributeWordTimings(line.text, durationMs, startMs),
      },
    };
  });

  const totalDurationMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);

  const config = {
    version: 2 as const,
    output: {
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      width: preset.width,
      height: preset.height,
      fps: 30 as const,
      bitrate: preset.bitrate,
    },
    template: {
      code: "bold_sale",
      primaryColor: "#ff6b35",
      subtitle: input.subtitle ?? {},
      layout: {
        ...layout,
        // Vị trí người dùng tự kéo thắng bố cục mặc định của khổ.
        subtitleY: input.subtitle?.positionY ?? layout.subtitleY,
      },
    },
    scenes,
    audio: {
      // Tiếng bắt đầu ngay đầu cảnh; khoảng lặng nằm ở cuối, sau khi câu đã đọc xong.
      voiceClips: (input.voiceClips ?? []).flatMap((clip) => {
        const position = input.lines.findIndex((line) => line.index === clip.sceneIndex);
        const startMs = starts[position];
        if (startMs === undefined) return [];

        return [
          {
            sceneIndex: clip.sceneIndex,
            url: clip.url,
            durationMs: clip.durationMs,
            startMs,
          },
        ];
      }),
      music: null,
    },
    meta: {
      projectId: input.projectId,
      variationSeed: input.projectId,
      totalDurationMs,
    },
  };

  // Validate ngay tại nơi dựng: config hỏng phải bị chặn trước khi vẽ, không phải sau 45 giây.
  return RenderConfigSchema.parse(config);
};
