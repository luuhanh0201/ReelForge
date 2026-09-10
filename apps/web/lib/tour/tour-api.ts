import type { Tour, TourScope } from "@repo/shared";
import { request } from "@/lib/admin/api-client";

export type TourStatus = "running" | "done" | "skipped";

export interface TourState {
  status: TourStatus;
  lastStepId: string | null;
}

export const fetchTour = (key: string): Promise<{ tour: Tour; state: TourState | null }> =>
  request(`/tours/${key}`);

/**
 * Ghi tiến độ. Lỗi được nuốt có chủ ý ở nơi gọi: mất một lần ghi tiến độ không đáng để
 * làm gián đoạn việc người dùng đang làm.
 */
export const saveTourProgress = (
  key: string,
  status: TourStatus,
  lastStepId: string | null,
): Promise<{ ok: true }> =>
  request(`/tours/${key}/progress`, {
    method: "POST",
    body: JSON.stringify({ status, lastStepId }),
  });

export interface TourVersionView {
  id: string;
  key: string;
  publishedAt: string;
  publishedBy: string;
  note: string | null;
}

export interface TourStats {
  key: string;
  started: number;
  completed: number;
  skipped: number;
  dropOff: { stepId: string; count: number }[];
}

export const fetchAdminTour = (
  key: string,
): Promise<{
  tour: Tour;
  scopes: TourScope[];
  history: TourVersionView[];
  stats: TourStats;
}> => request(`/admin/tours/${key}`);

export const fetchTourRegistry = (): Promise<{ scopes: TourScope[] }> =>
  request("/admin/tours");

export const publishTour = (
  key: string,
  tour: Tour,
  note: string,
): Promise<{ tour: Tour; broken: { stepId: string; reason: string }[] }> =>
  request(`/admin/tours/${key}`, {
    method: "PUT",
    body: JSON.stringify({ tour, note }),
  });
