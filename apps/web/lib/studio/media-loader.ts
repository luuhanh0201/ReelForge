import type { FrameSource } from "@repo/render-core";
import type { RenderConfig } from "@repo/shared";

/**
 * Nạp media cho khung xem trước.
 *
 * Ba loại nguồn, ba cách lấy khung hình khác nhau:
 *
 * - **Ảnh** — giải mã một lần, vẽ mãi.
 * - **GIF** — cũng là `<img>`, nhưng phải **nằm trong DOM** thì trình duyệt mới chạy hoạt
 *   ảnh; ảnh ngoài DOM đứng im ở khung đầu tiên và người dùng tưởng GIF hỏng.
 * - **Video** — một `<video>` phải được tua tới đúng mốc thời gian trước mỗi lần vẽ.
 *
 * `crossOrigin = "anonymous"` là **bắt buộc với cả ba**: thiếu nó thì canvas bị "nhiễm
 * bẩn" và bước xuất video sẽ ném lỗi bảo mật — lỗi chỉ lộ ra ở cuối, sau khi người dùng đã
 * dựng xong.
 */

export interface LoadedMedia {
  frames: Map<string, FrameSource>;
  /** Phần tử ẩn cần gắn vào DOM (GIF và video); trả về để nơi gọi tự dọn. */
  elements: HTMLElement[];
  /** Tua mọi video tới mốc thời gian của video đang dựng. Gọi trước mỗi lần vẽ. */
  seek: (timeMs: number) => void;
}

interface VideoEntry {
  element: HTMLVideoElement;
  startMs: number;
  durationMs: number;
}

const loadImage = (url: string): Promise<FrameSource | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () =>
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight });
    // Một tài nguyên hỏng không được làm chết cả bản xem trước.
    image.onerror = () => resolve(null);
    image.src = url;
  });

const loadVideo = (url: string): Promise<{ frame: FrameSource; element: HTMLVideoElement } | null> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    // Ngoài luồng xem: đặt ngoài màn hình chứ không `display:none`, vì phần tử bị ẩn hoàn
    // toàn có thể không được trình duyệt giải mã.
    video.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";

    video.onloadeddata = () =>
      resolve({
        frame: { source: video, width: video.videoWidth, height: video.videoHeight },
        element: video,
      });
    video.onerror = () => resolve(null);
    video.src = url;
  });

const loadGif = (url: string): Promise<{ frame: FrameSource; element: HTMLImageElement } | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";

    image.onload = () =>
      resolve({
        frame: { source: image, width: image.naturalWidth, height: image.naturalHeight },
        element: image,
      });
    image.onerror = () => resolve(null);
    image.src = url;
  });

/**
 * Nạp toàn bộ media của một cấu hình.
 *
 * Duyệt theo `config.scenes` chứ không theo danh sách URL rời: cần biết mỗi tài nguyên
 * thuộc cảnh nào để tua video về đúng mốc trong cảnh đó.
 */
export const loadMedia = async (config: RenderConfig): Promise<LoadedMedia> => {
  const frames = new Map<string, FrameSource>();
  const elements: HTMLElement[] = [];
  const videos: VideoEntry[] = [];

  // Một tài nguyên có thể dùng ở nhiều cảnh; chỉ nạp một lần.
  const seen = new Set<string>();

  for (const scene of config.scenes) {
    if (!scene.assetUrl || seen.has(scene.assetUrl)) continue;
    seen.add(scene.assetUrl);

    if (scene.assetKind === "video") {
      const loaded = await loadVideo(scene.assetUrl);
      if (!loaded) continue;

      frames.set(scene.assetUrl, loaded.frame);
      elements.push(loaded.element);
      videos.push({
        element: loaded.element,
        startMs: scene.startMs,
        durationMs: scene.durationMs,
      });
      continue;
    }

    if (scene.assetKind === "gif") {
      const loaded = await loadGif(scene.assetUrl);
      if (!loaded) continue;

      frames.set(scene.assetUrl, loaded.frame);
      elements.push(loaded.element);
      continue;
    }

    const frame = await loadImage(scene.assetUrl);
    if (frame) frames.set(scene.assetUrl, frame);
  }

  /**
   * Tua video theo playhead.
   *
   * `currentTime` chỉ được đặt lại khi lệch quá một khung hình: gán liên tục sẽ làm trình
   * duyệt huỷ và khởi động lại quá trình giải mã ở mỗi frame, và hình đứng luôn.
   *
   * Video ngắn hơn cảnh thì **giữ khung cuối** thay vì tua lại từ đầu — cảnh dài hơn video
   * là chuyện bình thường khi lời đọc dài hơn, và lặp lại đoạn phim ở giữa câu nói trông
   * như lỗi.
   */
  const seek = (timeMs: number) => {
    for (const entry of videos) {
      const offset = Math.min(
        Math.max(0, (timeMs - entry.startMs) / 1000),
        Math.max(0, entry.element.duration - 0.05) || 0,
      );

      if (Math.abs(entry.element.currentTime - offset) > 0.04) {
        entry.element.currentTime = offset;
      }
    }
  };

  return { frames, elements, seek };
};
