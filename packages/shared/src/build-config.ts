import { DEFAULT_CROP, type Crop, type FrameLayout } from "./frame-layout.js";
import {
  distributeWordTimings,
  OUTPUT_PRESETS,
  RenderConfigSchema,
  type AspectRatio,
  type RenderConfig,
  type Resolution,
  type SubtitleStyle,
} from "./render-config.js";
import { ACCENT_POOL, createVariation, sceneVariation } from "./variation.js";

/**
 * Bố cục theo khổ video.
 *
 * Đổi khổ **không phải chỉ scale lại**: phụ đề đặt ở đáy khung dọc thì hợp lý, đặt ở đáy
 * khung ngang thì che mất sản phẩm; ảnh gần vuông thả vào khung ngang sẽ thừa hai bên.
 */
export const LAYOUTS: Record<
  AspectRatio,
  {
    subtitleY: number;
    imageFit: "cover" | "contain";
    safeBottom: number;
    padding: number;
    /**
     * Cỡ chữ mặc định của khổ, theo tỉ lệ **chiều cao** khung.
     *
     * Khung ngang cần con số lớn hơn mới ra chữ cùng cỡ so với bề ngang: 0.045 của khung
     * dọc là 86px trên nền rộng 1080, còn 0.045 của khung ngang chỉ là 48px trên nền rộng
     * 1920. Giữ chung một con số cho cả ba khổ là để chữ ở 16:9 bé tới mức khó đọc trên
     * điện thoại.
     */
    fontScale: number;
  }
> = {
  "9:16": { subtitleY: 0.78, imageFit: "cover", safeBottom: 0.22, padding: 0, fontScale: 0.045 },
  "1:1": { subtitleY: 0.82, imageFit: "cover", safeBottom: 0.18, padding: 0, fontScale: 0.052 },
  "16:9": { subtitleY: 0.85, imageFit: "contain", safeBottom: 0.12, padding: 0.08, fontScale: 0.07 },
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
    /** Khung người dùng đã cắt cho **khổ đang dựng**; nơi gọi tự chọn đúng khổ. */
    crop?: Crop;
  }[];
  /** Tiếng đã tổng hợp, khoá theo chỉ số cảnh. */
  voiceClips?: { sceneIndex: number; url: string; durationMs: number }[];
  /**
   * Hạt giống của lần xuất này.
   *
   * Bỏ trống thì lấy `projectId` — khung xem trước dùng đường đó nên nhìn ổn định giữa các
   * lần mở. Lúc **xuất thật** thì máy chủ phải truyền một hạt giống mới, vì nền tảng phân
   * phối phạt nội dung trùng lặp và người dùng đăng hàng chục video mỗi ngày.
   */
  variationSeed?: string;
  /**
   * Bố cục người dùng tự kéo ở **khổ đang dựng**.
   *
   * Nơi gọi chịu trách nhiệm chọn đúng khổ trước khi truyền vào, nên hàm này không cần
   * biết tới khái niệm "lưu riêng theo khổ" — nó chỉ nhận giá trị đã chốt.
   */
  layout?: Partial<FrameLayout>;
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
  // Tách `fontScale` ra vì nó thuộc về kiểu chữ chứ không phải `LayoutSchema`; để lẫn thì
  // zod lặng lẽ vứt đi và người đọc sau không hiểu vì sao nó có ở đây.
  const { fontScale: defaultFontScale, ...layout } = LAYOUTS[input.aspectRatio];

  const seed = input.variationSeed || input.projectId;
  const variation = createVariation(seed);

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
      // Hướng, mức zoom và kiểu chuyển cảnh đều suy từ hạt giống — xem `variation.ts`.
      ...sceneVariation(variation, position, line.crop ?? DEFAULT_CROP),
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
      subtitle: {
        ...input.subtitle,
        /*
         * Cỡ chữ: khổ này người dùng đã kéo thì theo họ, chưa kéo thì theo preset kiểu
         * chữ, chưa chọn preset thì theo mặc định của khổ. Xếp đúng thứ tự này để chọn một
         * preset mới không bị con số cũ của khổ khác đè lên.
         */
        fontScale:
          input.layout?.fontScale ?? input.subtitle?.fontScale ?? defaultFontScale,
        /*
         * Màu chữ đang đọc lấy theo hạt giống, trừ khi người dùng đã tự chọn.
         *
         * Đây là cách rẻ nhất để đổi tín hiệu nhận dạng mà người xem không thấy lạ — cả
         * năm màu đều hợp lý cho video bán hàng.
         */
        activeColor:
          input.subtitle?.activeColor ??
          variation.pick("accent", ACCENT_POOL) ??
          "#FF6B35",
      },
      layout: {
        ...layout,
        // Vị trí người dùng tự kéo ở khổ này thắng bố cục mặc định của khổ.
        subtitleY: input.layout?.subtitleY ?? layout.subtitleY,
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
      variationSeed: seed,
      totalDurationMs,
    },
  };

  // Validate ngay tại nơi dựng: config hỏng phải bị chặn trước khi vẽ, không phải sau 45 giây.
  return RenderConfigSchema.parse(config);
};
