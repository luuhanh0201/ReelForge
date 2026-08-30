import { request } from "./api-client";

export type CredentialStatus = "connected" | "disabled" | "error";

/** Chỉ chứa metadata đã che — API không bao giờ trả credential gốc. */
export interface CredentialStatusView {
  provider: string;
  configured: boolean;
  projectId: string | null;
  clientEmailMasked: string | null;
  privateKeyIdSuffix: string | null;
  status: CredentialStatus | null;
  latencyMs: number | null;
  lastVerifiedAt: string | null;
  keyVersion: number | null;
}

const BASE = "/admin/provider-credentials/google-tts";

export const fetchGoogleTtsCredential = () => request<CredentialStatusView>(BASE);

export const uploadGoogleTtsCredential = (file: File) => {
  const form = new FormData();
  form.append("file", file);

  return request<CredentialStatusView>(BASE, { method: "PUT", body: form });
};

export const testGoogleTtsCredential = () =>
  request<CredentialStatusView>(`${BASE}/test`, { method: "POST" });

export const setGoogleTtsCredentialStatus = (status: "connected" | "disabled") =>
  request<CredentialStatusView>(`${BASE}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const deleteGoogleTtsCredential = () =>
  request<{ removed: boolean }>(BASE, { method: "DELETE" });
