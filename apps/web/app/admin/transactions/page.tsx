"use client";

import { Download, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ADMIN_TRANSACTIONS,
  METHOD_LABEL,
  RECONCILIATION,
  type TransactionMethod,
  type TransactionStatus,
} from "@/config/admin/accounts.config";
import { formatPrice } from "@/lib/format";
import { usePagination } from "@/lib/admin/pagination";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Pill,
  StatusBadge,
  TableCell,
  TablePagination,
  TableRow,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toast";

type MethodFilter = TransactionMethod | "all";
type StatusFilter = TransactionStatus | "all";

const METHOD_OPTIONS: { id: MethodFilter; label: string }[] = [
  { id: "all", label: "Mọi hình thức" },
  { id: "qr", label: "QR ngân hàng" },
  { id: "bank", label: "Chuyển khoản" },
  { id: "card", label: "Thẻ tín dụng" },
  { id: "affiliate", label: "Hoa hồng affiliate" },
];

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Mọi trạng thái" },
  { id: "success", label: "Thành công" },
  { id: "pending", label: "Chờ đối soát" },
  { id: "failed", label: "Thất bại" },
];

const STATUS_MAP = {
  success: { tone: "up" as const, label: "Thành công" },
  pending: { tone: "degraded" as const, label: "Chờ đối soát" },
  failed: { tone: "down" as const, label: "Thất bại" },
};

export default function TransactionsPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(RECONCILIATION.lastSyncAt);

  const filtered = useMemo(
    () =>
      ADMIN_TRANSACTIONS.filter((item) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          item.user.toLowerCase().includes(keyword) ||
          item.id.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword);

        return (
          matchQuery &&
          (method === "all" || item.method === method) &&
          (status === "all" || item.status === status)
        );
      }),
    [query, method, status],
  );

  const pagination = usePagination(filtered);

  const total = filtered
    .filter((item) => item.status === "success")
    .reduce((sum, item) => sum + item.amountVnd, 0);

  const runSync = () => {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date().toLocaleString("vi-VN", { hour12: false }));
      toast("Đã đồng bộ lại đối soát TikTok Shop và Shopee");
    }, 1100);
  };

  return (
    <>
      <AdminPageHeader
        title="Giao dịch & đối soát"
        description="Nạp tiền qua QR, ngân hàng, thẻ và đối soát hoa hồng affiliate từ TikTok Shop, Shopee."
        actions={
          <>
            <AdminButton onClick={runSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Đang đồng bộ..." : "Đồng bộ đối soát"}
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={() => toast(`Đã xuất ${filtered.length} giao dịch`)}
            >
              <Download size={14} />
              Xuất báo cáo
            </AdminButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Chờ đối soát TikTok Shop", value: RECONCILIATION.tiktokPendingVnd, accent: "amber" as const },
          { label: "Chờ đối soát Shopee", value: RECONCILIATION.shopeePendingVnd, accent: "danger" as const },
          { label: "Đã đối soát tháng này", value: RECONCILIATION.settledThisMonthVnd, accent: "mint" as const },
        ].map((card) => (
          <AdminCard key={card.label}>
            <p className="text-xs font-semibold text-muted">{card.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-ink">
              {formatPrice(card.value, "vi")}
            </p>
            <Pill accent={card.accent} className="mt-3">
              Cập nhật {lastSync}
            </Pill>
          </AdminCard>
        ))}
      </div>

      <AdminCard padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <AdminInput
            ariaLabel="Tìm giao dịch"
            value={query}
            onChange={setQuery}
            placeholder="Tìm mã giao dịch, user, nội dung..."
            icon={<Search size={15} className="shrink-0 text-muted" />}
            className="w-full sm:w-72"
          />
          <AdminSelect
            ariaLabel="Lọc hình thức"
            value={method}
            onChange={setMethod}
            options={METHOD_OPTIONS}
          />
          <AdminSelect
            ariaLabel="Lọc trạng thái"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
          <p className="ml-auto font-mono text-xs text-muted">
            Thành công: {formatPrice(total, "vi")}
          </p>
        </div>

        <DataTable
          headers={["Mã", "Thời gian", "Đối tượng", "Hình thức", "Nội dung", "Số tiền", "Trạng thái"]}
          isEmpty={filtered.length === 0}
        >
          {pagination.items.map((item) => {
            const state = STATUS_MAP[item.status];

            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs font-bold">{item.id}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                  {item.createdAt}
                </TableCell>
                <TableCell className="text-sm font-semibold">{item.user}</TableCell>
                <TableCell>
                  <Pill accent={item.method === "affiliate" ? "voice" : "info"}>
                    {METHOD_LABEL[item.method]}
                  </Pill>
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted">
                  {item.description}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-sm font-bold">
                  {formatPrice(item.amountVnd, "vi")}
                </TableCell>
                <TableCell>
                  <StatusBadge status={state.tone} label={state.label} />
                </TableCell>
              </TableRow>
            );
          })}
        </DataTable>

        <TablePagination pagination={pagination} unit="giao dịch" />
      </AdminCard>
    </>
  );
}
