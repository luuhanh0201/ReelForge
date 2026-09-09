/** Địa chỉ API — đổi bằng NEXT_PUBLIC_API_URL khi deploy. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiErrorBody {
  message?: string;
  details?: { reason?: string };
}

/** Lỗi có kèm HTTP status để nơi gọi phân biệt 401 với lỗi nghiệp vụ. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const AUTH_PATHS = ["/auth/refresh", "/auth/google", "/auth/logout"];
let refreshInFlight: Promise<boolean> | null = null;

const refreshSession = (): Promise<boolean> => {
  refreshInFlight ??= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

const send = (path: string, init?: RequestInit): Promise<Response> => {
  // FormData phải để trình duyệt tự sinh Content-Type kèm multipart boundary;
  // gán tay "application/json" sẽ làm server không tách được file.
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
};
export const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response = await send(path, init);
  if (response.status === 401 && !AUTH_PATHS.includes(path)) {
    if (await refreshSession()) {
      response = await send(path, init);
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const reason = body?.details?.reason ?? body?.message;
    throw new ApiError(
      reason ?? `API ${path} trả về ${response.status}`,
      response.status,
    );
  }

  // 204 No Content không có thân phản hồi để parse.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
};

/** Uptime dạng "24 ngày 14h 32m" từ số giây. */
export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return days > 0 ? `${days} ngày ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
};
