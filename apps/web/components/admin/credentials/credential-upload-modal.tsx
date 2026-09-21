"use client";

import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  uploadCredentialFile,
  uploadCredentialKey,
  type CredentialStatusView,
} from "@/lib/admin/credentials-api";
import { AdminButton, AdminInput } from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";

/**
 * Modal nhận credential mới, dùng chung cho trang API Keys và cho thẻ model.
 *
 * Tách ra vì cùng một việc xuất hiện ở hai chỗ: quản trị viên đang đứng ở danh sách model,
 * thấy model thiếu khoá thì phải dán được ngay tại đó, không phải nhớ đường sang trang khác.
 *
 * Bí mật **không ở lại trình duyệt**: file đi thẳng vào `FormData`, khoá dán vào bị xoá khỏi
 * state ngay khi modal đóng.
 */
export function CredentialUploadModal({
  view,
  open,
  onClose,
  onSaved,
}: {
  view: CredentialStatusView;
  open: boolean;
  onClose: () => void;
  onSaved: (next: CredentialStatusView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFile = view.type === "service_account";

  const close = () => {
    setSelected(null);
    setKeyValue("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      const next = isFile
        ? await uploadCredentialFile(view.provider, selected!)
        : await uploadCredentialKey(view.provider, keyValue);

      onSaved(next);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tải lên thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={close}
      title={`${view.configured ? "Thay thế" : "Thêm"} credential ${view.label}`}
      description={
        isFile
          ? "Chọn đúng một file .json tải từ Google Cloud Console. Credential cũ chỉ bị thay sau khi file mới gọi thử thành công."
          : "Dán khoá lấy từ trang của nhà cung cấp. Credential cũ chỉ bị thay sau khi khoá mới gọi thử thành công."
      }
      footer={
        <>
          <AdminButton variant="ghost" onClick={close}>
            Hủy
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => void submit()}
            disabled={(isFile ? !selected : keyValue.trim() === "") || busy}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {busy ? "Đang gọi thử..." : "Kiểm tra và lưu"}
          </AdminButton>
        </>
      }
    >
      <div aria-busy={busy}>
        {isFile ? (
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
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">API key</span>
            <AdminInput
              type="password"
              ariaLabel={`API key của ${view.label}`}
              placeholder="AQ.Ab... hoặc AIza..."
              value={keyValue}
              onChange={(value) => {
                setKeyValue(value);
                setError(null);
              }}
            />
            <span className="text-xs text-muted">
              Lấy khoá tại{" "}
              <a
                href={view.docsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-brand hover:underline"
              >
                trang của nhà cung cấp
              </a>
              . Lưu xong chỉ còn thấy bốn ký tự cuối.
            </span>
          </label>
        )}

        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </AdminModal>
  );
}
