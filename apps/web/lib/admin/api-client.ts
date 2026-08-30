/** Địa chỉ API — đổi bằng NEXT_PUBLIC_API_URL khi deploy. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiErrorBody {
  message?: string;
  details?: { reason?: string };
}

/**
 * Client dùng chung cho mọi trang admin đọc dữ liệu thật từ `apps/api`.
 * Lỗi được bóc từ JSON format thống nhất của backend để hiện đúng nguyên nhân.
 */
export const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  // FormData phải để trình duyệt tự sinh Content-Type kèm multipart boundary;
  // gán tay "application/json" sẽ làm server không tách được file.
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const reason = body?.details?.reason ?? body?.message;
    throw new Error(reason ?? `API ${path} trả về ${response.status}`);
  }

  return (await response.json()) as T;
};

/** Uptime dạng "24 ngày 14h 32m" từ số giây. */
export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return days > 0 ? `${days} ngày ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
};
