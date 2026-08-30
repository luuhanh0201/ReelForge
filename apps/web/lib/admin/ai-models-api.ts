import type {
  AiModel,
  ModelBadge,
  ModelConfig,
  ModelCost,
  ModelKind,
} from "@/config/admin/models.config";
import { request } from "./api-client";

export interface AiModelPayload {
  kind?: ModelKind;
  name?: string;
  vendor?: string;
  badge?: ModelBadge;
  latency?: string;
  capability?: string;
  config?: Partial<ModelConfig>;
  cost?: ModelCost;
  credentialProvider?: string | null;
}

export const fetchAiModels = async (kind: ModelKind): Promise<AiModel[]> => {
  const { items } = await request<{ items: AiModel[] }>(`/admin/ai-models?kind=${kind}`);
  return items;
};

export const createAiModel = (payload: AiModelPayload) =>
  request<AiModel>("/admin/ai-models", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAiModel = (id: string, payload: AiModelPayload) =>
  request<AiModel>(`/admin/ai-models/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const setAiModelEnabled = (id: string, enabled: boolean) =>
  request<AiModel>(`/admin/ai-models/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const deleteAiModel = (id: string) =>
  request<{ removed: boolean }>(`/admin/ai-models/${id}`, { method: "DELETE" });

export const verifyAiModel = (id: string) =>
  request<AiModel>(`/admin/ai-models/${id}/verify`, { method: "POST" });

export interface ModelUsage {
  modelId: string;
  todayChars: number;
  monthChars: number;
  todayRequests: number;
  monthRequests: number;
  dailyCharLimit: number;
  monthlyCharLimit: number;
  /** Hạn mức miễn phí còn lại trong tháng; null khi model không khai báo. */
  freeTierRemaining: number | null;
  estimatedCostUsd: number;
}

/** Số ký tự đã dùng — hệ thống tự đếm vì Google không có API trả về hạn mức còn lại. */
export const fetchModelUsage = (id: string) =>
  request<ModelUsage>(`/admin/ai-models/${id}/usage`);
