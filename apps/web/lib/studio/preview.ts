import {
  buildRenderConfig,
  PLACEHOLDER_SCENE_MS,
  type RenderConfig,
  type SubtitleStyle,
} from "@repo/shared";
import type { MediaAssetView, Project, VoiceClipView } from "@/lib/studio/projects-api";

export { PLACEHOLDER_SCENE_MS };

/**
 * Dựng `RenderConfig` để xem trước ngay trên trình duyệt.
 *
 * Phép tính thật nằm ở `buildRenderConfig` trong `@repo/shared`, dùng chung với máy chủ.
 * Chỗ này chỉ làm một việc: **dịch dữ liệu của giao diện sang đầu vào của hàm đó** — gán
 * ảnh cho cảnh, quy đổi thời lượng. Giữ hai bản sao của phép tính thì bản xuất ra sẽ trôi
 * khỏi bản người dùng vừa xem.
 */
export const buildPreviewConfig = (
  project: Project,
  assets: MediaAssetView[],
  subtitleStyle?: Partial<SubtitleStyle>,
  sceneDurations?: number[],
  voiceClips: VoiceClipView[] = [],
): RenderConfig | null => {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  return buildRenderConfig({
    projectId: project.id,
    aspectRatio: project.aspectRatio,
    resolution: project.resolution,
    subtitle: subtitleStyle,
    lines: project.lines.map((line, position) => {
      // Cảnh chưa gán ảnh thì mượn tạm ảnh trong kho để người dùng thấy được bố cục,
      // thay vì nhìn một khung đen và không biết mình đang thiếu gì.
      const asset = line.assetId
        ? byId.get(line.assetId)
        : assets[position % Math.max(1, assets.length)];

      const base =
        sceneDurations?.[position] ?? line.durationMs ?? PLACEHOLDER_SCENE_MS;

      return {
        index: line.index,
        text: line.text,
        emphasis: line.emphasis,
        // Cùng quy tắc với máy chủ: cảnh phải đủ chứa cả video lẫn lời đọc.
        durationMs:
          asset?.kind === "video" && asset.durationMs
            ? Math.max(base, asset.durationMs)
            : base,
        assetUrl: asset?.url ?? "",
        assetKind: asset?.kind ?? "image",
      };
    }),
    voiceClips: voiceClips.map((clip) => ({
      sceneIndex: clip.index,
      url: clip.url,
      durationMs: clip.durationMs,
    })),
  });
};

export { loadMedia, type LoadedMedia } from "@/lib/studio/media-loader";
