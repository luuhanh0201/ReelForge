"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AUDIT_LOGS, LOG_LEVEL_LABEL, type LogLevel } from "@/config/admin/infra.config";
import { useAuditLogs } from "@/lib/admin/audit-store";
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

type LevelFilter = LogLevel | "all";

const LEVEL_OPTIONS: { id: LevelFilter; label: string }[] = [
  { id: "all", label: "Mọi mức độ" },
  { id: "info", label: "INFO" },
  { id: "warning", label: "WARNING" },
  { id: "critical", label: "CRITICAL" },
];

const LEVEL_ACCENT = { info: "info", warning: "amber", critical: "danger" } as const;

const ADMINS = Array.from(new Set(AUDIT_LOGS.map((log) => log.admin)));

const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function LogsPage() {
  const toast = useToast();
  const auditLogs = useAuditLogs();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [admin, setAdmin] = useState<string>("all");

  const filtered = useMemo(
    () =>
      auditLogs.filter((log) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          log.action.toLowerCase().includes(keyword) ||
          log.target.toLowerCase().includes(keyword) ||
          log.ip.includes(keyword);

        return (
          matchQuery &&
          (level === "all" || log.level === level) &&
          (admin === "all" || log.admin === admin)
        );
      }),
    [auditLogs, query, level, admin],
  );

  const pagination = usePagination(filtered);

  const exportAs = (format: "csv" | "json") => {
    if (format === "json") {
      download("reelforge-audit-logs.json", JSON.stringify(filtered, null, 2), "application/json");
    } else {
      const header = "Thời gian,Admin,Hành động,Đối tượng,IP,Mức độ,Kết quả";
      const rows = filtered.map((log) =>
        [
          log.timestamp,
          log.admin,
          log.action,
          log.target,
          log.ip,
          LOG_LEVEL_LABEL[log.level],
          log.success ? "Success" : "Failed",
        ].join(","),
      );
      download("reelforge-audit-logs.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
    }

    toast(`Đã xuất ${filtered.length} dòng log ra ${format.toUpperCase()}`);
  };

  return (
    <>
      <AdminPageHeader
        title="Nhật ký hệ thống"
        description="Toàn bộ thao tác của quản trị viên và sự kiện tự động của hệ thống."
        actions={
          <>
            <AdminButton onClick={() => exportAs("csv")}>
              <Download size={14} />
              CSV
            </AdminButton>
            <AdminButton onClick={() => exportAs("json")}>
              <Download size={14} />
              JSON
            </AdminButton>
          </>
        }
      />

      <AdminCard padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <AdminInput
            ariaLabel="Tìm trong nhật ký"
            value={query}
            onChange={setQuery}
            placeholder="Tìm hành động, đối tượng, IP..."
            icon={<Search size={15} className="shrink-0 text-muted" />}
            className="w-full sm:w-72"
          />
          <AdminSelect
            ariaLabel="Lọc mức độ"
            value={level}
            onChange={setLevel}
            options={LEVEL_OPTIONS}
          />
          <AdminSelect
            ariaLabel="Lọc theo admin"
            value={admin}
            onChange={setAdmin}
            options={[
              { id: "all", label: "Mọi admin" },
              ...ADMINS.map((name) => ({ id: name, label: name })),
            ]}
          />
          <p className="ml-auto text-xs text-muted">{filtered.length} bản ghi</p>
        </div>

        <DataTable
          headers={["Thời gian", "Admin", "Hành động", "Đối tượng", "IP", "Mức độ", "Kết quả"]}
          isEmpty={filtered.length === 0}
        >
          {pagination.items.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {log.timestamp}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm font-semibold">
                {log.admin}
              </TableCell>
              <TableCell className="text-sm">{log.action}</TableCell>
              <TableCell className="max-w-xs truncate font-mono text-xs text-muted">
                {log.target}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {log.ip}
              </TableCell>
              <TableCell>
                <Pill accent={LEVEL_ACCENT[log.level]}>{LOG_LEVEL_LABEL[log.level]}</Pill>
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={log.success ? "up" : "down"}
                  label={log.success ? "Success" : "Failed"}
                />
              </TableCell>
            </TableRow>
          ))}
        </DataTable>

        <TablePagination pagination={pagination} unit="bản ghi" />
      </AdminCard>
    </>
  );
}
