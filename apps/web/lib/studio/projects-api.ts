import type { SubtitleStyle } from "@repo/shared";
import { API_BASE_URL, request } from "@/lib/admin/api-client";

export type ProjectMode = "link" | "manual";
export type ProjectStatus = "draft" | "ready" | "archived";
export type AspectRatio = "9:16" | "1:1" | "16:9";
export type Resolution = "720p" | "1080p" | "2k";
export type LineRole = "hook" | "usp" | "cta";

export interface ProjectLine {
  index: number;
  text: string;
  role: LineRole;
  assetId: string | null;
  emphasis: string[];
  /** Độ dài cảnh. Kéo tay được **chừng nào chưa lồng tiếng**; có tiếng rồi thì do audio quyết. */
  durationMs: number;
  /** Đoạn tiếng đã tổng hợp cho câu này; `null` khi chưa lồng tiếng. */
  voiceClipId: string | null;
}

export interface Project {
  id: string;
  title: string;
  mode: ProjectMode;
  status: ProjectStatus;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  sourceUrl: string | null;
  product: { name?: string; price?: string; description?: string };
  lines: ProjectLine[];
  scriptTemplate: string | null;
  /** Rỗng nghĩa là chưa chỉnh gì; `SubtitleStyleSchema` sẽ điền mặc định. */
  subtitleStyle: Partial<SubtitleStyle>;
  /** `null` khi chưa chọn, hoặc khi giọng đã chọn bị gỡ khỏi danh mục. */
  voiceId: string | null;
  /** 0.8–1.5. */
  voiceSpeed: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptTemplateOption {
  code: string;
  tone: string;
  label: string;
  description: string;
  maxLines: number;
}

/** Giọng đọc admin đã bật, nhìn từ phía người dùng cuối. */
export interface StudioVoice {
  id: string;
  personaName: string;
  gender: "female" | "male";
  region: string;
  supportsTimepoints: boolean;
  sampleText: string;
  /** Có bản nghe thử sẵn trong kho hay chưa. */
  hasPreview: boolean;
}

export type MediaKind = "image" | "video" | "gif";

export interface MediaAssetView {
  id: string;
  kind: MediaKind;
  /** Chỉ video mới có; ảnh và GIF do người dùng đặt thời lượng cảnh. */
  durationMs: number | null;
  /** URL đã ký, sống một giờ — đủ cho một phiên chỉnh sửa. */
  url: string;
  width: number;
  height: number;
  sortOrder: number;
}

export const fetchProjects = async (): Promise<Project[]> => {
  const { items } = await request<{ items: Project[] }>("/projects");
  return items;
};

export const fetchProject = (id: string): Promise<Project> =>
  request<Project>(`/projects/${id}`);

export const createProject = (input: {
  mode: ProjectMode;
  title?: string;
  aspectRatio?: AspectRatio;
  sourceUrl?: string;
}): Promise<Project> =>
  request<Project>("/projects", { method: "POST", body: JSON.stringify(input) });

export const updateProject = (
  id: string,
  patch: Partial<
    Pick<
      Project,
      | "title"
      | "aspectRatio"
      | "resolution"
      | "product"
      | "subtitleStyle"
      | "voiceId"
      | "voiceSpeed"
    >
  >,
): Promise<Project> =>
  request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deleteProject = (id: string): Promise<void> =>
  request<void>(`/projects/${id}`, { method: "DELETE" });

export const fetchScriptTemplates = async (): Promise<ScriptTemplateOption[]> => {
  const { items } = await request<{ items: ScriptTemplateOption[] }>(
    "/projects/templates",
  );
  return items;
};

export const applyScriptTemplate = (
  id: string,
  templateCode: string,
  durationSec: number,
): Promise<Project> =>
  request<Project>(`/projects/${id}/script/template`, {
    method: "POST",
    body: JSON.stringify({ templateCode, durationSec }),
  });

export const updateLine = (
  id: string,
  index: number,
  patch: Partial<Pick<ProjectLine, "text" | "assetId" | "emphasis" | "durationMs">>,
): Promise<Project> =>
  request<Project>(`/projects/${id}/lines/${index}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const addLine = (id: string, text: string): Promise<Project> =>
  request<Project>(`/projects/${id}/lines`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

/** Thay cả danh sách cảnh trong một lần gọi — nền cho thao tác hoàn tác. */
export const replaceLines = (id: string, lines: ProjectLine[]): Promise<Project> =>
  request<Project>(`/projects/${id}/lines`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
  });

export const duplicateLine = (id: string, index: number): Promise<Project> =>
  request<Project>(`/projects/${id}/lines/${index}/duplicate`, { method: "POST" });

/** `order[i]` là vị trí cũ của cảnh sẽ đứng thứ `i` sau khi sắp xếp. */
export const reorderLines = (id: string, order: number[]): Promise<Project> =>
  request<Project>(`/projects/${id}/lines/reorder`, {
    method: "POST",
    body: JSON.stringify({ order }),
  });

export const removeLine = (id: string, index: number): Promise<Project> =>
  request<Project>(`/projects/${id}/lines/${index}`, { method: "DELETE" });

/** Một cảnh đã có tiếng, kèm đường dẫn tải về để phát và để ghép vào MP4. */
export interface VoiceClipView {
  index: number;
  clipId: string;
  /** URL đã ký, sống một giờ. */
  url: string;
  durationMs: number;
  sampleRate: number;
}

export interface TtsQuota {
  used: number;
  /** `0` là không giới hạn. */
  limit: number;
}

export const fetchVoiceClips = async (
  projectId: string,
): Promise<{ items: VoiceClipView[]; quota: TtsQuota }> =>
  request<{ items: VoiceClipView[]; quota: TtsQuota }>(`/projects/${projectId}/voice`);

/**
 * Lồng tiếng cho cả video.
 *
 * `force` đọc lại **mọi** câu kể cả câu đã có tiếng — chỉ dùng khi người dùng chủ động
 * muốn vậy, vì nó gọi lại nhà cung cấp và tốn hạn mức trong ngày.
 */
export const synthesizeVoice = (
  projectId: string,
  force = false,
): Promise<{
  project: Project;
  clips: VoiceClipView[];
  synthesized: number;
  quota: TtsQuota;
}> =>
  request(`/projects/${projectId}/voice`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });

export const fetchVoices = async (): Promise<StudioVoice[]> => {
  const { items } = await request<{ items: StudioVoice[] }>("/voices");
  return items;
};

/**
 * Bản nghe thử của một giọng.
 *
 * Máy chủ **chỉ trả bản đã có sẵn**, không tổng hợp mới — nghe thử bao nhiêu lần cũng
 * không chạm vào hoá đơn Google.
 */
export const fetchVoicePreview = (
  voiceId: string,
): Promise<{ audioBase64: string; mimeType: string; sampleText: string }> =>
  request(`/voices/${voiceId}/preview`);

export const fetchAssets = async (projectId: string): Promise<MediaAssetView[]> => {
  const { items } = await request<{ items: MediaAssetView[] }>(
    `/projects/${projectId}/assets`,
  );
  return items;
};

/**
 * Tải ảnh lên. Dùng `fetch` trực tiếp vì `request()` đặt sẵn `Content-Type: application/json`
 * cho mọi thân không phải FormData — ở đây trình duyệt phải tự sinh boundary của multipart.
 */
export const uploadAsset = async (
  projectId: string,
  file: File,
): Promise<MediaAssetView> => {
  const form = new FormData();
  form.append("file", file);

  return request<MediaAssetView>(`/projects/${projectId}/assets`, {
    method: "POST",
    body: form,
  });
};

export const deleteAsset = (projectId: string, assetId: string): Promise<void> =>
  request<void>(`/projects/${projectId}/assets/${assetId}`, { method: "DELETE" });

/** Khổ video kèm nhãn cho giao diện chọn. */
export const ASPECT_OPTIONS: { id: AspectRatio; label: string; hint: string }[] = [
  { id: "9:16", label: "9:16", hint: "TikTok, Reels, Shorts" },
  { id: "1:1", label: "1:1", hint: "Facebook, Instagram" },
  { id: "16:9", label: "16:9", hint: "YouTube, website" },
];

/** Mỗi cảnh khoảng 10 giây, nên độ dài nhảy theo bước 10. */
export const DURATION_OPTIONS = [30, 40, 50, 60] as const;

/** Trần số cảnh, khớp `MAX_LINES` phía API (60 giây / 10 giây mỗi cảnh). */
export const MAX_LINES = 6;

/** Hai đầu của thanh trượt thời lượng cảnh, khớp validate của API. */
export const MIN_SCENE_MS = 1000;
export const MAX_SCENE_MS = 20_000;

/** Hai đầu tốc độ đọc, khớp validate của API. */
export const MIN_VOICE_SPEED = 0.8;
export const MAX_VOICE_SPEED = 1.5;

export { API_BASE_URL };
