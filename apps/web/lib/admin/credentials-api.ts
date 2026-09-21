import { request } from "./api-client";

export type CredentialStatus = "connected" | "disabled" | "error";

/** `service_account` — tải file JSON. `api_key` — dán một chuỗi. */
export type CredentialType = "service_account" | "api_key";

/** Chỉ chứa metadata đã che — API không bao giờ trả credential gốc. */
export interface CredentialStatusView {
  provider: string;
  label: string;
  type: CredentialType;
  /** Trang lấy credential của nhà cung cấp. */
  docsUrl: string;
  configured: boolean;
  /** Chuỗi ngắn để nhận ra credential đang lưu, ví dụ `AQ.A…7x2K`. */
  displayHint: string | null;
  projectId: string | null;
  clientEmailMasked: string | null;
  privateKeyIdSuffix: string | null;
  status: CredentialStatus | null;
  latencyMs: number | null;
  lastVerifiedAt: string | null;
  keyVersion: number | null;
}

const BASE = "/admin/provider-credentials";

export const fetchCredentials = async (): Promise<CredentialStatusView[]> => {
  const { items } = await request<{ items: CredentialStatusView[] }>(BASE);
  return items;
};

/** Service account: gửi file. Trình duyệt tự sinh boundary nên không đặt Content-Type. */
export const uploadCredentialFile = (provider: string, file: File) => {
  const form = new FormData();
  form.append("file", file);

  return request<CredentialStatusView>(`${BASE}/${provider}`, {
    method: "PUT",
    body: form,
  });
};

/** API key: gửi chuỗi. Khoá không bao giờ được ghi vào state lâu hơn một lần gửi. */
export const uploadCredentialKey = (provider: string, value: string) =>
  request<CredentialStatusView>(`${BASE}/${provider}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });

export const testCredential = (provider: string) =>
  request<CredentialStatusView>(`${BASE}/${provider}/test`, { method: "POST" });

export const setCredentialStatus = (provider: string, status: "connected" | "disabled") =>
  request<CredentialStatusView>(`${BASE}/${provider}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const deleteCredential = (provider: string) =>
  request<{ removed: boolean }>(`${BASE}/${provider}`, { method: "DELETE" });
