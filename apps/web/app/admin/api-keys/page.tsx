"use client";

import { Copy, Eye, EyeOff, Plus, RotateCcw, ShieldAlert, Webhook, Zap } from "lucide-react";
import { useState } from "react";
import {
  API_KEYS,
  WEBHOOKS,
  type ApiKeyEntry,
  type KeyStatus,
} from "@/config/admin/infra.config";
import { usePagination } from "@/lib/admin/pagination";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  DataTable,
  StatusBadge,
  TableCell,
  TablePagination,
  TableRow,
  ToggleSwitch,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { GoogleTtsCredentialCard } from "@/components/admin/credentials/google-tts-card";
import { useToast } from "@/components/ui/toast";

export default function ApiKeysPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKeyEntry[]>(API_KEYS);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [hooks, setHooks] = useState(WEBHOOKS);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState({ provider: "", scope: "", secret: "" });
  const [addHookOpen, setAddHookOpen] = useState(false);
  const [hookDraft, setHookDraft] = useState({ event: "", url: "" });

  const pagination = usePagination(keys);

  const addKey = () => {
    if (keyDraft.provider.trim() === "" || keyDraft.secret.trim().length < 8) {
      toast("Cần nhập nhà cung cấp và khóa dài tối thiểu 8 ký tự", "warning");
      return;
    }

    const secret = keyDraft.secret.trim();
    const created: ApiKeyEntry = {
      id: `k-${Date.now()}`,
      provider: keyDraft.provider.trim(),
      scope: keyDraft.scope.trim() || "Chưa phân loại",
      // Chỉ giữ đầu/cuối, phần giữa che ngay tại client — không lưu khóa gốc vào state.
      maskedKey: `${secret.slice(0, 6)}${"•".repeat(12)}${secret.slice(-4)}`,
      lastRotatedAt: new Date().toISOString().slice(0, 10),
      status: "unknown",
      latencyMs: null,
    };

    setKeys((current) => [created, ...current]);
    setKeyDraft({ provider: "", scope: "", secret: "" });
    setAddKeyOpen(false);
    toast(`Đã thêm khóa ${created.provider} — bấm Test để kiểm tra kết nối`);
  };

  const addHook = () => {
    if (hookDraft.event.trim() === "" || !hookDraft.url.startsWith("https://")) {
      toast("Cần nhập tên sự kiện và URL bắt đầu bằng https://", "warning");
      return;
    }

    setHooks((current) => [
      {
        id: `w-${Date.now()}`,
        event: hookDraft.event.trim(),
        url: hookDraft.url.trim(),
        active: false,
        lastDeliveryAt: "chưa có",
      },
      ...current,
    ]);
    setHookDraft({ event: "", url: "" });
    setAddHookOpen(false);
    toast("Đã thêm webhook — đang tắt, bật khi endpoint sẵn sàng");
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`Đã sao chép ${label}`);
    } catch {
      toast("Trình duyệt chặn clipboard, hãy sao chép thủ công", "warning");
    }
  };

  const testConnection = (entry: ApiKeyEntry) => {
    setTesting(entry.id);

    window.setTimeout(() => {
      const failed = entry.id === "k-shopee";
      const latencyMs = failed ? null : 80 + Math.round(Math.random() * 500);
      const status: KeyStatus = failed ? "down" : latencyMs! > 400 ? "degraded" : "up";

      setKeys((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, status, latencyMs } : item,
        ),
      );
      setTesting(null);
      toast(
        failed
          ? `${entry.provider}: không kết nối được`
          : `${entry.provider}: ${latencyMs}ms — sẵn sàng`,
        failed ? "warning" : "success",
      );
    }, 900);
  };

  return (
    <>
      <AdminPageHeader
        title="API Keys & Webhooks"
        description="Két lưu trữ khóa của các nhà cung cấp và endpoint nhận sự kiện affiliate."
        actions={
          <AdminButton variant="primary" onClick={() => setAddKeyOpen(true)}>
            <Plus size={14} />
            Thêm khóa
          </AdminButton>
        }
      />

      <GoogleTtsCredentialCard />

      <AdminCard className="border-danger/30 bg-danger/5">
        <p className="flex items-start gap-2.5 text-sm text-ink">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-danger" />
          <span>
            <strong className="font-bold">Phần bên dưới chưa có backend.</strong> Khóa và
            webhook thêm ở đây chỉ tồn tại trong phiên trình duyệt, tải lại trang là mất.
            Khi nối backend thật, server{" "}
            <strong className="font-bold">không được trả khóa gốc về trình duyệt</strong> —
            chỉ trả 4 ký tự cuối, và thao tác xoay vòng khóa phải chạy phía server. Trang
            admin cũng cần đăng nhập + phân quyền trước khi mở ra môi trường thật.
          </span>
        </p>
      </AdminCard>

      <AdminCard padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="mr-auto">
            <h2 className="font-display text-base font-bold text-ink">Khóa nhà cung cấp</h2>
            <p className="mt-0.5 text-xs text-muted">
              {keys.length === 0 ? "Chưa có khóa nào" : `${keys.length} khóa đang được quản lý`}
            </p>
          </div>
          <AdminButton onClick={() => setAddKeyOpen(true)}>
            <Plus size={14} />
            Thêm khóa
          </AdminButton>
        </div>

        <DataTable
          headers={["Nhà cung cấp", "Khóa", "Xoay vòng", "Trạng thái", "Thao tác"]}
          isEmpty={keys.length === 0}
          emptyMessage="Chưa có khóa nào. Google Cloud TTS quản lý ở thẻ phía trên; nhà cung cấp khác chờ backend."
        >
          {pagination.items.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <p className="text-sm font-semibold text-ink">{entry.provider}</p>
                <p className="text-xs text-muted">{entry.scope}</p>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="rounded-btn bg-subtle px-2 py-1 font-mono text-xs text-ink">
                    {revealed[entry.id]
                      ? entry.maskedKey.replace(/•+/g, "MOCKKEY_KHONG_PHAI_KHOA_THAT")
                      : entry.maskedKey}
                  </code>
                  <AdminButton
                    variant="ghost"
                    className="w-8 px-0"
                    onClick={() =>
                      setRevealed((current) => ({ ...current, [entry.id]: !current[entry.id] }))
                    }
                    title={revealed[entry.id] ? "Ẩn khóa" : "Hiện khóa"}
                  >
                    {revealed[entry.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    title="Sao chép khóa đã che"
                    className="w-8 px-0"
                    onClick={() => copyValue(entry.maskedKey, entry.provider)}
                  >
                    <Copy size={14} />
                  </AdminButton>
                </div>
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {entry.lastRotatedAt}
              </TableCell>

              <TableCell>
                <StatusBadge status={entry.status} />
                {entry.latencyMs !== null ? (
                  <span className="ml-2 font-mono text-xs text-muted">{entry.latencyMs}ms</span>
                ) : null}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1.5">
                  <AdminButton
                    onClick={() => testConnection(entry)}
                    disabled={testing === entry.id}
                  >
                    <Zap size={14} />
                    {testing === entry.id ? "Đang ping..." : "Test"}
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    title="Xoay vòng khóa"
                    className="w-9 px-0"
                    onClick={() =>
                      toast(`Yêu cầu xoay vòng khóa ${entry.provider} đã được ghi nhận`, "warning")
                    }
                  >
                    <RotateCcw size={15} />
                  </AdminButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>

        <TablePagination pagination={pagination} unit="khóa" />
      </AdminCard>

      <AdminCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="flex items-center gap-2">
              <Webhook size={16} className="text-voice" />
              <h2 className="font-display text-base font-bold text-ink">
                Webhook nhận sự kiện
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Endpoint nhận thông báo đơn hàng affiliate mới để cập nhật báo cáo hoa hồng.
            </p>
          </div>

          <AdminButton onClick={() => setAddHookOpen(true)}>
            <Plus size={14} />
            Thêm webhook
          </AdminButton>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {hooks.map((hook) => (
            <li
              key={hook.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-canvas p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{hook.event}</p>
                <code className="mt-1 block truncate font-mono text-xs text-muted">
                  {hook.url}
                </code>
              </div>

              <span className="font-mono text-[11px] text-muted">
                Gần nhất {hook.lastDeliveryAt}
              </span>

              <AdminButton
                variant="ghost"
                className="w-9 px-0"
                onClick={() => copyValue(hook.url, "URL webhook")}
              >
                <Copy size={15} />
              </AdminButton>

              <ToggleSwitch
                checked={hook.active}
                label={`Bật tắt webhook ${hook.event}`}
                onChange={(next) => {
                  setHooks((current) =>
                    current.map((item) =>
                      item.id === hook.id ? { ...item, active: next } : item,
                    ),
                  );
                  toast(
                    `${next ? "Đã bật" : "Đã tắt"} webhook ${hook.event}`,
                    next ? "success" : "warning",
                  );
                }}
              />
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminModal
        open={addKeyOpen}
        onClose={() => setAddKeyOpen(false)}
        title="Thêm khóa nhà cung cấp"
        description="Khóa được che ngay khi lưu — hệ thống chỉ giữ phần đầu và 4 ký tự cuối."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddKeyOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={addKey}>
              Lưu khóa
            </AdminButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {[
            { key: "provider" as const, label: "Nhà cung cấp" },
            { key: "scope" as const, label: "Dùng cho" },
            { key: "secret" as const, label: "Khóa API" },
          ].map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">{field.label}</span>
              <AdminInput
                ariaLabel={field.label}
                type={field.key === "secret" ? "password" : "text"}
                value={keyDraft[field.key]}
                onChange={(value) =>
                  setKeyDraft((current) => ({ ...current, [field.key]: value }))
                }
              />
            </label>
          ))}
        </div>
      </AdminModal>

      <AdminModal
        open={addHookOpen}
        onClose={() => setAddHookOpen(false)}
        title="Thêm webhook"
        description="Webhook mới mặc định tắt, bật khi endpoint đã sẵn sàng nhận request."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddHookOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={addHook}>
              Thêm webhook
            </AdminButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Tên sự kiện</span>
            <AdminInput
              ariaLabel="Tên sự kiện"
              value={hookDraft.event}
              onChange={(value) => setHookDraft((current) => ({ ...current, event: value }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">URL nhận (https://)</span>
            <AdminInput
              ariaLabel="URL nhận"
              value={hookDraft.url}
              onChange={(value) => setHookDraft((current) => ({ ...current, url: value }))}
            />
          </label>
        </div>
      </AdminModal>
    </>
  );
}
