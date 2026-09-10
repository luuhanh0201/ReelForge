import type { RenderConfig, Scene, SubtitleStyle } from "@repo/shared";

/**
 * Trái tim của hệ thống: vẽ **một** khung hình tại một mốc thời gian.
 *
 * Preview gọi hàm này ở nhịp phát lại, bộ xuất video gọi đúng hàm này cho từng frame.
 * Tách thành hai bộ mã riêng thì trong vài tháng chúng sẽ trôi khỏi nhau và tạo ra loại
 * lỗi rất khó tìm — bản xuất khác bản người dùng vừa xem mà không ai biết vì sao.
 *
 * Hàm **không tự tính toán gì ngoài nội suy**: mọi mốc thời gian, thứ tự cảnh và vị trí
 * chữ đều đã nằm sẵn trong `RenderConfig`.
 */

/**
 * Một nguồn hình đã sẵn sàng vẽ, khoá theo `assetUrl` trong config.
 *
 * Kích thước đi kèm tường minh chứ không đọc từ chính đối tượng: `HTMLVideoElement.width`
 * là thuộc tính thẻ HTML, mặc định bằng 0, còn kích thước thật nằm ở `videoWidth`. Bắt nơi
 * nạp phải khai báo rõ thì `drawFrame` không cần biết mình đang vẽ ảnh, video hay GIF.
 */
export interface FrameSource {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export type ImageMap = ReadonlyMap<string, FrameSource>;

/** Giữ tên cũ cho các nơi đã dùng; là bí danh của `FrameSource`. */
export type ImageSource = FrameSource;

export interface DrawOptions {
  /** Vẽ khung an toàn của TikTok. Bật khi preview, tắt khi xuất file. */
  showSafeZone?: boolean;
  /**
   * Vẽ phụ đề. Mặc định bật.
   *
   * Đây là **tuỳ chọn xem trước**, không phải thuộc tính của video: người dựng tắt đi để
   * nhìn rõ ảnh sản phẩm phía sau. Vì vậy nó nằm ở đây chứ không nằm trong `RenderConfig`
   * — cùng một config vẫn phải cho ra cùng một video.
   */
  showCaption?: boolean;
  /** Vẽ ảnh nền. Tắt để soi riêng phần chữ; cũng chỉ là tuỳ chọn xem trước. */
  showImage?: boolean;
}

/** Cảnh đang hiển thị tại mốc `timeMs`, và cảnh kế tiếp nếu đang chuyển cảnh. */
export const sceneAt = (config: RenderConfig, timeMs: number): Scene | null =>
  config.scenes.find(
    (scene) => timeMs >= scene.startMs && timeMs < scene.startMs + scene.durationMs,
  ) ??
  // Quá cuối video thì giữ khung cuối thay vì trả về nền đen.
  (timeMs >= config.meta.totalDurationMs
    ? (config.scenes[config.scenes.length - 1] ?? null)
    : null);

/** Chữ hoa hay không do preset quyết định, nhưng đo bề rộng phải dùng đúng chuỗi sẽ vẽ. */
const label = (text: string, style: { uppercase: boolean }): string =>
  style.uppercase ? text.toUpperCase() : text;

const lerp = (from: number, to: number, ratio: number): number =>
  from + (to - from) * ratio;

/** Chặn khoảng [0, 1] để nội suy không vọt ra ngoài khi thời gian lệch một vài ms. */
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  config: RenderConfig,
  timeMs: number,
  images: ImageMap,
  options: DrawOptions = {},
): void => {
  const { width, height } = config.output;

  ctx.save();
  ctx.fillStyle = "#0B0F17";
  ctx.fillRect(0, 0, width, height);

  const scene = sceneAt(config, timeMs);
  if (!scene) {
    ctx.restore();
    return;
  }

  const progress = clamp01((timeMs - scene.startMs) / scene.durationMs);

  if (options.showImage !== false) {
    drawSceneImage(ctx, config, scene, progress, images);
  }
  if (options.showCaption !== false) drawCaption(ctx, config, scene, timeMs);

  if (options.showSafeZone) drawSafeZone(ctx, config);

  ctx.restore();
};

/**
 * Vẽ ảnh sản phẩm kèm hiệu ứng Ken Burns.
 *
 * `kenBurns.from`/`to` là `[x, y, zoom]` — tâm khung nhìn theo tỉ lệ ảnh và mức phóng.
 * Nội suy tuyến tính theo tiến độ cảnh; mọi giá trị đều đến từ config nên cùng một mốc
 * thời gian luôn cho cùng một khung hình.
 */
const drawSceneImage = (
  ctx: CanvasRenderingContext2D,
  config: RenderConfig,
  scene: Scene,
  progress: number,
  images: ImageMap,
): void => {
  const frame = images.get(scene.assetUrl);
  if (!frame) return;

  const { width, height } = config.output;
  const [fromX, fromY, fromZoom] = scene.kenBurns.from;
  const [toX, toY, toZoom] = scene.kenBurns.to;

  const zoom = lerp(fromZoom, toZoom, progress);
  const centerX = lerp(fromX, toX, progress);
  const centerY = lerp(fromY, toY, progress);

  const fit = config.template.layout.imageFit;
  const scale =
    fit === "cover"
      ? Math.max(width / frame.width, height / frame.height)
      : Math.min(
          (width * (1 - config.template.layout.padding * 2)) / frame.width,
          (height * (1 - config.template.layout.padding * 2)) / frame.height,
        );

  const drawWidth = frame.width * scale * zoom;
  const drawHeight = frame.height * scale * zoom;

  ctx.drawImage(
    frame.source,
    width * centerX - drawWidth / 2,
    height * centerY - drawHeight / 2,
    drawWidth,
    drawHeight,
  );
};

/**
 * Vẽ phụ đề với từ đang đọc được làm nổi.
 *
 * Mốc sáng của từng từ nằm sẵn trong `caption.words` (máy chủ đã chia theo độ dài ký tự),
 * nên ở đây chỉ là so sánh mốc thời gian — không đoán, không tính lại.
 */
const drawCaption = (
  ctx: CanvasRenderingContext2D,
  config: RenderConfig,
  scene: Scene,
  timeMs: number,
): void => {
  const words = scene.caption.words;
  if (words.length === 0) return;

  const { width, height } = config.output;
  const style = config.template.subtitle;
  const fontSize = Math.round(height * style.fontScale);
  const lineHeight = Math.round(fontSize * 1.35);

  ctx.font = `${style.fontWeight} ${fontSize}px "${style.fontFamily}", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Xuống dòng theo bề rộng thật của chữ, chừa lề hai bên.
  const maxWidth = width * 0.86;
  const lines: (typeof words)[] = [];
  let current: typeof words = [];

  for (const word of words) {
    const candidate = [...current, word];
    const text = candidate.map((item) => label(item.text, style)).join(" ");

    if (ctx.measureText(text).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = [word];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(current);

  const blockHeight = lines.length * lineHeight;
  const baseY = height * config.template.layout.subtitleY - blockHeight / 2;

  lines.forEach((line, lineIndex) => {
    const text = line.map((item) => label(item.text, style)).join(" ");
    const y = baseY + lineIndex * lineHeight + lineHeight / 2;
    let cursorX = width / 2 - ctx.measureText(text).width / 2;

    ctx.textAlign = "left";

    line.forEach((word, wordIndex) => {
      const spoken = timeMs >= word.startMs && timeMs < word.endMs;
      const emphasised = scene.caption.emphasis.some((phrase) =>
        phrase.toLowerCase().includes(word.text.toLowerCase()),
      );
      const text = label(word.text, style);

      ctx.save();

      // Từ đang đọc được phóng nhẹ hoặc phát sáng, tuỳ hiệu ứng đã chọn. Mọi tham số đến
      // từ config nên cùng một mốc thời gian luôn cho ra cùng một khung hình.
      if (spoken && style.animation === "pop_scale") {
        const centerX = cursorX + ctx.measureText(text).width / 2;
        ctx.translate(centerX, y);
        ctx.scale(1.12, 1.12);
        ctx.translate(-centerX, -y);
      }

      if (spoken && (style.animation === "karaoke_glow" || style.shadowBlur > 0)) {
        ctx.shadowColor = style.activeColor;
        ctx.shadowBlur = style.shadowBlur > 0 ? style.shadowBlur : 16;
      }

      ctx.fillStyle = spoken
        ? style.activeColor
        : emphasised
          ? style.emphasisColor
          : style.color;

      // Viền tối phía sau để chữ đọc được trên mọi ảnh nền.
      if (style.strokeScale > 0) {
        ctx.lineWidth = Math.max(2, fontSize * style.strokeScale);
        ctx.strokeStyle = style.strokeColor;
        ctx.lineJoin = "round";
        ctx.strokeText(text, cursorX, y);
      }

      ctx.fillText(text, cursorX, y);
      ctx.restore();

      const isLast = wordIndex === line.length - 1;
      cursorX += ctx.measureText(isLast ? text : `${text} `).width;
    });
  });
};

/** Vùng bị nút Like/Share/Giỏ hàng của TikTok che — chỉ hiện khi xem trước. */
const drawSafeZone = (ctx: CanvasRenderingContext2D, config: RenderConfig): void => {
  const { width, height } = config.output;
  const safeBottom = config.template.layout.safeBottom;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 107, 53, 0.55)";
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.strokeRect(
    width * 0.04,
    height * 0.04,
    width * 0.92,
    height * (1 - safeBottom - 0.04),
  );
  ctx.restore();
};
