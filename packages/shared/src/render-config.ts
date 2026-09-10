import { z } from "zod";

/**
 * Hợp đồng giữa máy chủ, preview engine và bộ xuất video.
 *
 * Hai nguyên tắc chi phối toàn bộ tệp này:
 *
 * 1. **Config chứa mốc thời gian tuyệt đối, không chứa logic.** `drawFrame` chỉ vẽ theo
 *    những gì được cho, không tự tính gì. Nhờ vậy xuất JSON ra là biết chính xác video sẽ
 *    trông thế nào, và cùng một config phải cho cùng kết quả trên mọi máy.
 * 2. **Validate ở cả hai đầu.** Máy chủ dựng xong thì kiểm tra, máy khách nhận về cũng
 *    kiểm tra — một config hỏng phải bị chặn trước khi encode chứ không phải sau 45 giây.
 */

export const ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;
export const RESOLUTIONS = ["720p", "1080p", "2k"] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

/**
 * Kích thước và bitrate suy ra từ khổ + độ phân giải, **không để người dùng nhập**.
 * Người dùng không có cơ sở để chọn bitrate, và chọn sai thì file quá nặng hoặc quá vỡ.
 */
export const OUTPUT_PRESETS: Record<
  AspectRatio,
  Record<Resolution, { width: number; height: number; bitrate: number }>
> = {
  "9:16": {
    "720p": { width: 720, height: 1280, bitrate: 3_000_000 },
    "1080p": { width: 1080, height: 1920, bitrate: 6_000_000 },
    "2k": { width: 1440, height: 2560, bitrate: 12_000_000 },
  },
  "1:1": {
    "720p": { width: 720, height: 720, bitrate: 3_000_000 },
    "1080p": { width: 1080, height: 1080, bitrate: 5_000_000 },
    "2k": { width: 1440, height: 1440, bitrate: 10_000_000 },
  },
  "16:9": {
    "720p": { width: 1280, height: 720, bitrate: 3_000_000 },
    "1080p": { width: 1920, height: 1080, bitrate: 6_000_000 },
    "2k": { width: 2560, height: 1440, bitrate: 12_000_000 },
  },
};

/**
 * Bố cục theo từng khổ. Đổi khổ **không phải chỉ scale lại**: phụ đề đặt ở đáy khung dọc
 * thì hợp lý, đặt ở đáy khung ngang thì che mất sản phẩm; ảnh sản phẩm gần vuông thả vào
 * khung ngang sẽ thừa hai bên.
 */
export const LayoutSchema = z.object({
  /** Vị trí đáy khối phụ đề, theo tỉ lệ chiều cao khung (0 = đỉnh, 1 = đáy). */
  subtitleY: z.number().min(0).max(1),
  imageFit: z.enum(["cover", "contain"]),
  /** Vùng đáy bị giao diện TikTok che mất, theo tỉ lệ chiều cao. */
  safeBottom: z.number().min(0).max(1),
  /** Chỉ dùng khi `imageFit` là `contain`. */
  padding: z.number().min(0).max(0.5).default(0),
});

export type Layout = z.infer<typeof LayoutSchema>;

/** Một từ trong phụ đề kèm mốc sáng lên — nền tảng của hiệu ứng karaoke. */
export const WordTimingSchema = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});

export const SceneSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  /** URL đã ký sẵn, máy khách tải thẳng. */
  assetUrl: z.string(),
  /**
   * Loại media của cảnh.
   *
   * `drawFrame` cần biết để chọn cách lấy khung hình: ảnh tĩnh vẽ thẳng, còn video và GIF
   * phải được tua tới đúng mốc thời gian trước khi vẽ.
   */
  assetKind: z.enum(["image", "video", "gif"]).default("image"),
  /** Ken Burns: [x, y, zoom] lúc bắt đầu và lúc kết thúc cảnh. */
  kenBurns: z.object({
    from: z.tuple([z.number(), z.number(), z.number()]),
    to: z.tuple([z.number(), z.number(), z.number()]),
  }),
  transition: z.enum(["cut", "fade", "slide_left", "zoom_in"]),
  caption: z.object({
    text: z.string(),
    /** Các cụm được nhấn màu khác — do LLM gợi ý hoặc người dùng đánh dấu. */
    emphasis: z.array(z.string()),
    words: z.array(WordTimingSchema),
  }),
});

/**
 * Kiểu chữ phụ đề — người dùng chỉnh được và **phải nằm trong config**, vì `drawFrame`
 * không được tự quyết gì: cùng một config phải cho ra cùng một khung hình trên mọi máy.
 */
export const SubtitleStyleSchema = z.object({
  fontFamily: z.string().default("Be Vietnam Pro"),
  /** Theo tỉ lệ chiều cao khung, không phải pixel — đổi độ phân giải không làm vỡ bố cục. */
  fontScale: z.number().min(0.02).max(0.12).default(0.045),
  fontWeight: z.union([z.literal(600), z.literal(700), z.literal(800), z.literal(900)]).default(700),
  color: z.string().default("#FFFFFF"),
  /** Màu của từ đang được đọc. */
  activeColor: z.string().default("#FF6B35"),
  /** Màu cụm được nhấn mạnh trong câu. */
  emphasisColor: z.string().default("#F2B237"),
  strokeColor: z.string().default("rgba(11, 15, 23, 0.75)"),
  strokeScale: z.number().min(0).max(0.3).default(0.12),
  /** Bóng đổ giúp chữ tách khỏi nền ảnh sáng. */
  shadowBlur: z.number().min(0).max(40).default(0),
  animation: z.enum(["karaoke_glow", "pop_scale", "fade_slide", "color_fill"]).default("karaoke_glow"),
  uppercase: z.boolean().default(false),
  /**
   * Vị trí khối phụ đề theo chiều dọc, tính bằng tỉ lệ chiều cao khung.
   *
   * `null` nghĩa là **theo bố cục mặc định của khổ video** — đáy khung dọc, cao hơn ở khung
   * ngang. Người dùng kéo tay thì giá trị này được ghi đè, và giữ nguyên khi họ đổi khổ
   * hoặc đổi preset, vì đó là quyết định có chủ ý của họ.
   */
  positionY: z.number().min(0.1).max(0.95).nullable().default(null),
});

export type SubtitleStyle = z.infer<typeof SubtitleStyleSchema>;

/**
 * Preset theo phong cách đang thịnh hành. Đặt ở tầng dùng chung để giao diện và bộ vẽ
 * không bao giờ hiểu khác nhau về cùng một cái tên.
 */
export const SUBTITLE_PRESETS: {
  code: string;
  label: string;
  hint: string;
  style: Partial<SubtitleStyle>;
}[] = [
  {
    code: "tiktok_bold",
    label: "TikTok Bold",
    hint: "Vàng viền đen, đọc rõ trên mọi nền",
    style: {
      color: "#FFFFFF",
      activeColor: "#F2B237",
      strokeColor: "#0B0F17",
      strokeScale: 0.16,
      fontWeight: 900,
      fontScale: 0.05,
      animation: "pop_scale",
    },
  },
  {
    code: "impact_red",
    label: "Impact đỏ",
    hint: "Chữ to, từ đang đọc tô đỏ rực",
    style: {
      color: "#FFFFFF",
      activeColor: "#F2545B",
      strokeColor: "#0B0F17",
      strokeScale: 0.18,
      fontWeight: 900,
      fontScale: 0.058,
      uppercase: true,
      animation: "pop_scale",
    },
  },
  {
    code: "minimal",
    label: "Tối giản",
    hint: "Trắng mảnh, hợp sản phẩm cao cấp",
    style: {
      color: "#FFFFFF",
      activeColor: "#FF6B35",
      strokeColor: "rgba(11, 15, 23, 0.6)",
      strokeScale: 0.08,
      fontWeight: 600,
      fontScale: 0.038,
      animation: "fade_slide",
    },
  },
  {
    code: "cyber_neon",
    label: "Neon",
    hint: "Chữ phát sáng, hợp công nghệ",
    style: {
      color: "#FFFFFF",
      activeColor: "#35C48F",
      strokeColor: "rgba(11, 15, 23, 0.9)",
      strokeScale: 0.1,
      shadowBlur: 18,
      fontWeight: 800,
      animation: "karaoke_glow",
    },
  },
];

export const RenderConfigSchema = z.object({
  version: z.literal(2),

  output: z.object({
    aspectRatio: z.enum(ASPECT_RATIOS),
    resolution: z.enum(RESOLUTIONS),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.union([z.literal(24), z.literal(30)]),
    bitrate: z.number().int().positive(),
  }),

  template: z.object({
    code: z.string(),
    primaryColor: z.string(),
    subtitle: SubtitleStyleSchema,
    layout: LayoutSchema,
  }),

  scenes: z.array(SceneSchema).min(1),

  audio: z.object({
    voiceClips: z.array(
      z.object({
        sceneIndex: z.number().int().nonnegative(),
        url: z.string(),
        durationMs: z.number().int().positive(),
        startMs: z.number().int().nonnegative(),
      }),
    ),
    music: z
      .object({
        url: z.string(),
        volumeDb: z.number(),
        fadeOutMs: z.number().int().nonnegative(),
      })
      .nullable(),
  }),

  meta: z.object({
    projectId: z.string().uuid(),
    /** Mọi yếu tố ngẫu nhiên phải dẫn xuất từ đây, không gọi random trực tiếp — nếu không
     *  thì khi người dùng báo lỗi sẽ không dựng lại được đúng video đó. */
    variationSeed: z.string(),
    totalDurationMs: z.number().int().positive(),
  }),
});

export type RenderConfig = z.infer<typeof RenderConfigSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type WordTiming = z.infer<typeof WordTimingSchema>;

/**
 * Chia thời lượng một dòng cho từng từ theo độ dài ký tự, cộng thêm nghỉ ở dấu câu.
 *
 * Không cần speech-to-text: hệ thống đã biết chính xác `durationMs` của dòng (đo từ file
 * audio) và toàn bộ chuỗi ký tự, nên chỉ còn việc phân bổ. Cách này đủ chính xác cho
 * karaoke và chạy được với mọi giọng, kể cả giọng không trả timepoint như Chirp3-HD.
 */
export const distributeWordTimings = (
  text: string,
  durationMs: number,
  offsetMs = 0,
): WordTiming[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const weights = words.map(
    (word) => word.length + (/[,.!?;:]$/.test(word) ? 4 : 0),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let cursor = offsetMs;

  return words.map((word, index) => {
    // Từ cuối lấy trọn phần còn lại để tổng luôn khớp durationMs, không bị lệch do làm tròn.
    const isLast = index === words.length - 1;
    const span = isLast
      ? offsetMs + durationMs - cursor
      : Math.round((weights[index]! / total) * durationMs);

    const timing = { text: word, startMs: cursor, endMs: cursor + span };
    cursor += span;

    return timing;
  });
};

/**
 * Dịch mốc thời gian của các cảnh sau khi một cảnh đổi thời lượng.
 *
 * Chạy hoàn toàn trên máy khách, không có I/O, xong dưới 10ms kể cả video 60 cảnh — toàn
 * bộ độ trễ người dùng cảm nhận đến từ vòng gọi TTS chứ không phải phép tính này.
 */
export const rippleTimeline = (
  config: RenderConfig,
  sceneIndex: number,
  newDurationMs: number,
): RenderConfig => {
  const scene = config.scenes[sceneIndex];
  if (!scene) return config;

  const delta = newDurationMs - scene.durationMs;
  if (delta === 0) return config;

  const scenes = config.scenes.map((item) => {
    if (item.index === sceneIndex) {
      return { ...item, durationMs: newDurationMs };
    }
    if (item.index > sceneIndex) {
      return { ...item, startMs: item.startMs + delta };
    }
    return item;
  });

  const voiceClips = config.audio.voiceClips.map((clip) => {
    if (clip.sceneIndex === sceneIndex) {
      return { ...clip, durationMs: newDurationMs };
    }
    if (clip.sceneIndex > sceneIndex) {
      return { ...clip, startMs: clip.startMs + delta };
    }
    return clip;
  });

  const totalDurationMs = config.meta.totalDurationMs + delta;

  return {
    ...config,
    scenes,
    audio: {
      ...config.audio,
      voiceClips,
      music: config.audio.music
        ? {
            ...config.audio.music,
            fadeOutMs: Math.max(0, totalDurationMs - 800),
          }
        : null,
    },
    meta: { ...config.meta, totalDurationMs },
  };
};
