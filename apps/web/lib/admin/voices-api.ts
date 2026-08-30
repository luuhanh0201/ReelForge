import type { VoiceEntry, VoiceGender } from "@/config/admin/models.config";
import { request } from "./api-client";

/** Một giọng trong danh mục nhà cung cấp (chưa chắc đã nhập vào hệ thống). */
export interface ProviderVoice {
  providerVoiceId: string;
  gender: "female" | "male" | null;
  tierCostUsd: number;
  supportsTimepoints: boolean;
  imported: boolean;
}

export interface VoicePayload {
  personaName: string;
  originName?: string;
  providerVoiceId: string;
  modelId: string;
  gender: VoiceGender;
  region?: string;
  speed?: number;
  supportsTimepoints?: boolean;
  costPerMillionUsd?: number;
  sampleText?: string;
}

export const fetchVoices = async (): Promise<VoiceEntry[]> => {
  const { items } = await request<{ items: VoiceEntry[] }>("/admin/voices");
  return items;
};

export const createVoice = (payload: VoicePayload) =>
  request<VoiceEntry>("/admin/voices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateVoice = (id: string, payload: Partial<VoicePayload>) =>
  request<VoiceEntry>(`/admin/voices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const setVoiceEnabled = (id: string, enabled: boolean) =>
  request<VoiceEntry>(`/admin/voices/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const deleteVoice = (id: string) =>
  request<{ removed: boolean }>(`/admin/voices/${id}`, { method: "DELETE" });

export const verifyVoice = (id: string) =>
  request<VoiceEntry>(`/admin/voices/${id}/verify`, { method: "POST" });

export const fetchProviderCatalog = (languageCode = "vi-VN") =>
  request<{ languageCode: string; items: ProviderVoice[] }>(
    `/admin/voices/provider-catalog?languageCode=${languageCode}`,
  );

export const importVoices = (
  providerVoiceIds: string[],
  modelId: string,
  languageCode = "vi-VN",
) =>
  request<{ imported: number; skipped: number }>("/admin/voices/import", {
    method: "POST",
    body: JSON.stringify({ providerVoiceIds, modelId, languageCode }),
  });

export interface VoicePreview {
  audioBase64: string;
  /** Đổi theo audioEncoding trong cấu hình model: audio/mpeg, audio/wav, audio/ogg. */
  mimeType: string;
  /** Phiên bản API đã dùng — v1beta1 mới có timepoints. */
  apiVersion: string;
  /** true = lấy từ bộ nhớ đệm, không gọi Google và không tốn ký tự nào. */
  cached: boolean;
  /** Số ký tự Google tính tiền cho lần nghe thử này. */
  charCount: number;
  latencyMs: number;
}

/**
 * Lấy audio nghe thử. Lần đầu gọi Google (tốn phí theo ký tự), các lần sau lấy từ
 * bộ nhớ đệm. `force` bắt tổng hợp lại dù đã có bản lưu.
 */
export const previewVoice = (id: string, force = false) =>
  request<VoicePreview>(
    `/admin/voices/${id}/preview${force ? "?force=true" : ""}`,
    { method: "POST" },
  );
