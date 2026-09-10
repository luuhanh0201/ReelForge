"use client";

import {
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordAudit } from "@/lib/admin/audit-store";
import {
  deleteGoogleTtsCredential,
  fetchGoogleTtsCredential,
  setGoogleTtsCredentialStatus,
  testGoogleTtsCredential,
  uploadGoogleTtsCredential,
  type CredentialStatusView,
} from "@/lib/admin/credentials-api";
import {
  AdminButton,
  AdminCard,
  Pill,
  StatusBadge,
  ToggleSwitch,
  type StatusTone,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/ui/toast";

const STATUS_TONE: Record<string, StatusTone> = {
  connected: "up",
  disabled: "degraded",
  error: "down",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Đã kết nối",
  disabled: "Đang tắt",
  error: "Lỗi xác thực",
};

const formatTime = (iso: string | null): string => {
  if (!iso) return "chưa kiểm tra";

  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

/**
 * Thẻ quản lý credential Google Cloud TTS — trang admin duy nhất động vào bí mật thật.
 * Nội dung file không bao giờ được đọc vào state hay localStorage: chỉ đưa thẳng
 * đối tượng File vào FormData rồi gửi đi.
 */
export function GoogleTtsCredentialCard() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<CredentialStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "upload" | "test" | "status" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await fetchGoogleTtsCredential());
      setError(null);
    } catch (cause) {
      setView(null);
      setError(cause instanceof Error ? cause.message : "Không gọi được API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const closeUpload = () => {
    setUploadOpen(false);
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submitUpload = async () => {
    if (!selected) return;

    setBusy("upload");
    setError(null);

    try {
      const next = await uploadGoogleTtsCredential(selected);
      setView(next);
      toast(`Đã lưu credential cho project ${next.projectId}`);
      recordAudit({
        action: "Cập nhật credential Google TTS",
        target: next.clientEmailMasked ?? "google-tts",
        level: "critical",
      });
      closeUpload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tải lên thất bại");
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy("test");
    setError(null);

    try {
      const next = await testGoogleTtsCredential();
      setView(next);
      toast(`Google phản hồi trong ${next.latencyMs}ms`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kiểm tra thất bại");
      toast("Kiểm tra credential thất bại", "danger");
      void load();
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = async (enabled: boolean) => {
    setBusy("status");

    try {
      const next = await setGoogleTtsCredentialStatus(enabled ? "connected" : "disabled");
      setView(next);
      toast(enabled ? "Đã bật credential" : "Đã tắt credential", enabled ? "success" : "warning");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái");
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = async () => {
    setBusy("delete");

    try {
      await deleteGoogleTtsCredential();
      setRemoveOpen(false);
      toast("Đã gỡ credential Google TTS", "warning");
      recordAudit({
        action: "Gỡ credential Google TTS",
        target: view?.clientEmailMasked ?? "google-tts",
        level: "critical",
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gỡ được credential");
    } finally {
      setBusy(null);
    }
  };

  const configured = view?.configured ?? false;
  const status = view?.status ?? null;

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-voice/12 text-voice">
            <KeyRound size={18} />
          </span>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-ink">
                Thông tin xác thực dịch vụ
              </h2>
              <Pill accent="mint">Dữ liệu thật</Pill>
              {status ? (
                <StatusBadge status={STATUS_TONE[status] ?? "unknown"} label={STATUS_LABEL[status]} />
              ) : null}
            </div>

            <p className="mt-1 max-w-xl text-sm text-muted">
              Service account của Google Cloud Text-to-Speech. File được kiểm tra với Google
              trước khi lưu, mã hoá AES-256-GCM trong database và không bao giờ hiển thị lại.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminButton onClick={() => void runTest()} disabled={!configured || busy !== null}>
            {busy === "test" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Kiểm tra lại
          </AdminButton>

          <AdminButton variant="primary" onClick={() => setUploadOpen(true)} disabled={busy !== null}>
            <Upload size={14} />
            {configured ? "Thay thế file" : "Tải lên"}
          </AdminButton>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Đang đọc trạng thái credential...</p>
      ) : !configured ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-card border border-line bg-subtle px-4 py-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber" />
          <span>
            Chưa có credential trong database. Hệ thống đang dùng biến môi trường
            <code className="mx-1 font-mono text-xs">GOOGLE_APPLICATION_CREDENTIALS</code>
            làm phương án dự phòng.
          </span>
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Project", value: view?.projectId ?? "—" },
              { label: "Service account", value: view?.clientEmailMasked ?? "—" },
              { label: "Private key ID", value: `••••${view?.privateKeyIdSuffix ?? ""}` },
              {
                label: "Kiểm tra gần nhất",
                value: `${formatTime(view?.lastVerifiedAt ?? null)}${
                  view?.latencyMs ? ` · ${view.latencyMs}ms` : ""
                }`,
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 truncate font-mono text-sm text-ink" title={item.value}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-2.5">
              <ToggleSwitch
                checked={status === "connected"}
                onChange={(next) => void toggleStatus(next)}
                disabled={busy !== null}
                label="Bật hoặc tắt credential Google TTS"
              />
              <span className="text-sm text-muted">
                {status === "connected" ? "Đang dùng cho tính năng TTS" : "Tạm ngưng sử dụng"}
              </span>
              <span className="font-mono text-[11px] text-muted">
                khoá mã hoá v{view?.keyVersion ?? "?"}
              </span>
            </div>

            <AdminButton variant="danger" onClick={() => setRemoveOpen(true)} disabled={busy !== null}>
              <Trash2 size={14} />
              Gỡ credential
            </AdminButton>
          </div>
        </>
      )}

      {error && !uploadOpen ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <AdminModal
        open={uploadOpen}
        onClose={closeUpload}
        title={configured ? "Thay thế service account" : "Tải lên service account"}
        description="Chọn đúng một file .json tải từ Google Cloud Console. Credential cũ chỉ bị thay sau khi file mới gọi thử Google thành công."
        footer={
          <>
            <AdminButton variant="ghost" onClick={closeUpload}>
              Hủy
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={() => void submitUpload()}
              disabled={!selected || busy === "upload"}
            >
              {busy === "upload" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {busy === "upload" ? "Đang kiểm tra với Google..." : "Kiểm tra và lưu"}
            </AdminButton>
          </>
        }
      >
        <div aria-busy={busy === "upload"}>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line bg-subtle px-4 py-8 text-center transition-colors hover:border-brand/45">
            <Upload size={20} className="text-muted" />
            <span className="text-sm font-semibold text-ink">
              {selected ? selected.name : "Chọn file service-account.json"}
            </span>
            <span className="text-xs text-muted">
              {selected
                ? `${(selected.size / 1024).toFixed(1)} KB`
                : "Tối đa 64 KB · chỉ nhận định dạng JSON"}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                setSelected(event.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>

          {error ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </AdminModal>

      <AdminModal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Gỡ credential Google TTS?"
        description="Bản ghi đã mã hoá sẽ bị xoá khỏi database. Tính năng TTS sẽ quay về dùng biến môi trường nếu có, hoặc ngừng hoạt động."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setRemoveOpen(false)}>
              Hủy
            </AdminButton>
            <AdminButton variant="danger" onClick={() => void confirmRemove()} disabled={busy === "delete"}>
              {busy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Gỡ credential
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Service account: <span className="font-mono text-ink">{view?.clientEmailMasked}</span>
        </p>
      </AdminModal>
    </AdminCard>
  );
}
