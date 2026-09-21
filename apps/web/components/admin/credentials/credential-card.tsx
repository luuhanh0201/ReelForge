"use client";

import {
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { recordAudit } from "@/lib/admin/audit-store";
import {
  deleteCredential,
  setCredentialStatus,
  testCredential,
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
import { CredentialUploadModal } from "./credential-upload-modal";
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
 * Thẻ quản lý credential của **một** nhà cung cấp.
 *
 * Hình dạng credential do máy chủ khai (`type`), nên thêm nhà cung cấp mới không phải sửa
 * component này: service account thì hiện ô chọn file, api key thì hiện ô nhập chuỗi.
 *
 * Bí mật **không bao giờ vào state lâu hơn một lần gửi**: file đi thẳng vào `FormData`, còn
 * khoá dán vào thì được xoá khỏi state ngay sau khi gửi xong. API cũng không có đường nào
 * trả credential ngược ra.
 */
export function CredentialCard({
  view,
  onChange,
}: {
  view: CredentialStatusView;
  onChange: (next: CredentialStatusView | null) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<null | "upload" | "test" | "status" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const isFile = view.type === "service_account";
  const configured = view.configured;
  const status = view.status;
  const name = view.displayHint ?? view.provider;

  const closeUpload = () => {
    setUploadOpen(false);
    setError(null);
  };

  const runTest = async () => {
    setBusy("test");
    setError(null);

    try {
      const next = await testCredential(view.provider);
      onChange(next);
      toast(`${next.label} phản hồi trong ${next.latencyMs}ms`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kiểm tra thất bại");
      toast("Kiểm tra credential thất bại", "danger");
      onChange({ ...view, status: "error" });
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = async (enabled: boolean) => {
    setBusy("status");

    try {
      const next = await setCredentialStatus(view.provider, enabled ? "connected" : "disabled");
      onChange(next);
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
      await deleteCredential(view.provider);
      setRemoveOpen(false);
      toast(`Đã gỡ credential ${view.label}`, "warning");
      recordAudit({
        action: `Gỡ credential ${view.label}`,
        target: name,
        level: "critical",
      });
      onChange(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gỡ được credential");
    } finally {
      setBusy(null);
    }
  };

  /** Các ô thông tin khác nhau theo loại: api key không có project lẫn email nào để hiện. */
  const facts = isFile
    ? [
        { label: "Project", value: view.projectId ?? "—" },
        { label: "Service account", value: view.clientEmailMasked ?? "—" },
        { label: "Private key ID", value: `••••${view.privateKeyIdSuffix ?? ""}` },
      ]
    : [{ label: "API key", value: view.displayHint ?? "—" }];

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-voice/12 text-voice">
            <KeyRound size={18} />
          </span>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-ink">{view.label}</h2>
              <Pill accent="mint">Dữ liệu thật</Pill>
              {status ? (
                <StatusBadge
                  status={STATUS_TONE[status] ?? "unknown"}
                  label={STATUS_LABEL[status] ?? status}
                />
              ) : null}
            </div>

            <p className="mt-1 max-w-xl text-sm text-muted">
              {isFile
                ? "Service account JSON. File được gọi thử với nhà cung cấp trước khi lưu, mã hoá AES-256-GCM trong database và không bao giờ hiển thị lại."
                : "API key. Khoá được gọi thử trước khi lưu, mã hoá AES-256-GCM trong database và không bao giờ hiển thị lại."}
            </p>

            <a
              href={view.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              Lấy credential tại đây
              <ExternalLink size={11} />
            </a>
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

          <AdminButton
            variant="primary"
            onClick={() => setUploadOpen(true)}
            disabled={busy !== null}
          >
            <Upload size={14} />
            {configured ? "Thay thế" : isFile ? "Tải lên" : "Dán khoá"}
          </AdminButton>
        </div>
      </div>

      {!configured ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-card border border-line bg-subtle px-4 py-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber" />
          <span>
            Chưa có credential trong database. Hệ thống dùng biến môi trường tương ứng làm
            phương án dự phòng; không có biến đó thì tính năng liên quan sẽ tự lùi về đường
            không cần nhà cung cấp này.
          </span>
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ...facts,
              {
                label: "Kiểm tra gần nhất",
                value: `${formatTime(view.lastVerifiedAt)}${
                  view.latencyMs ? ` · ${view.latencyMs}ms` : ""
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
                label={`Bật hoặc tắt credential ${view.label}`}
              />
              <span className="text-sm text-muted">
                {status === "connected" ? "Đang được sử dụng" : "Tạm ngưng sử dụng"}
              </span>
              <span className="font-mono text-[11px] text-muted">
                khoá mã hoá v{view.keyVersion ?? "?"}
              </span>
            </div>

            <AdminButton
              variant="danger"
              onClick={() => setRemoveOpen(true)}
              disabled={busy !== null}
            >
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

      <CredentialUploadModal
        view={view}
        open={uploadOpen}
        onClose={closeUpload}
        onSaved={(next) => {
          onChange(next);
          toast(`Đã lưu credential ${next.label}`);
          recordAudit({
            action: `Cập nhật credential ${next.label}`,
            target: next.displayHint ?? next.provider,
            level: "critical",
          });
        }}
      />

      <AdminModal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={`Gỡ credential ${view.label}?`}
        description="Bản ghi đã mã hoá sẽ bị xoá khỏi database. Tính năng liên quan sẽ quay về dùng biến môi trường nếu có, hoặc ngừng hoạt động."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setRemoveOpen(false)}>
              Hủy
            </AdminButton>
            <AdminButton
              variant="danger"
              onClick={() => void confirmRemove()}
              disabled={busy === "delete"}
            >
              {busy === "delete" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Gỡ credential
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Credential: <span className="font-mono text-ink">{name}</span>
        </p>
      </AdminModal>
    </AdminCard>
  );
}
