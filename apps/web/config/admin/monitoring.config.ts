/**
 * Cấu hình dùng chung cho các trang giám sát hạ tầng (Redis, PostgreSQL...).
 * Giữ ở một nơi để chu kỳ làm mới không lệch nhau giữa các dashboard.
 */

export const REFRESH_OPTIONS = [
  { id: "5s", label: "5 giây", ms: 5000 },
  { id: "15s", label: "15 giây", ms: 15000 },
  { id: "30s", label: "30 giây", ms: 30000 },
  { id: "off", label: "Tắt", ms: 0 },
] as const;

export type RefreshOptionId = (typeof REFRESH_OPTIONS)[number]["id"];

export const resolveRefreshMs = (id: RefreshOptionId): number =>
  REFRESH_OPTIONS.find((option) => option.id === id)?.ms ?? 0;
