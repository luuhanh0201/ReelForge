"use client";

import { ACCENT, type Accent } from "@/lib/accent";
import type { KeyspaceSlice } from "@/lib/admin/redis-api";
import { AdminCard } from "@/components/admin/primitives";

/** Màu gán theo thứ tự để nhóm lớn nhất luôn mang màu thương hiệu. */
const SLICE_ACCENTS: Accent[] = ["brand", "amber", "info", "voice", "mint", "danger"];

const formatMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

/** Tầng phụ — phân bổ bộ nhớ theo tiền tố key, quét mẫu từ Redis thật. */
export function KeyspaceBreakdown({
  slices,
  loading,
}: {
  slices: KeyspaceSlice[];
  loading: boolean;
}) {
  const totalBytes = slices.reduce((sum, slice) => sum + slice.estimatedBytes, 0);

  return (
    <AdminCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Phân bổ bộ nhớ theo tiền tố
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Ước lượng từ mẫu quét, không phải số liệu đầy đủ toàn keyspace.
          </p>
        </div>
        <p className="font-mono text-xs text-muted">~{formatMb(totalBytes)} MB</p>
      </div>

      {loading ? (
        <p className="mt-6 py-6 text-center text-sm text-muted">Đang quét keyspace...</p>
      ) : slices.length === 0 ? (
        <p className="mt-6 py-6 text-center text-sm text-muted">
          Keyspace đang trống — chưa có key nào mang tiền tố của ứng dụng.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-subtle">
            {slices.map((slice, index) => (
              <span
                key={slice.prefix}
                title={`${slice.prefix} · ${slice.percent}%`}
                style={{ width: `${slice.percent}%` }}
                className={`h-full ${ACCENT[SLICE_ACCENTS[index % SLICE_ACCENTS.length]!].bg} border-r-2 border-surface last:border-0`}
              />
            ))}
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {slices.map((slice, index) => (
              <li key={slice.prefix} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${ACCENT[SLICE_ACCENTS[index % SLICE_ACCENTS.length]!].bg}`}
                />

                <code className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-ink">
                  {slice.prefix}
                </code>

                <span className="shrink-0 font-mono text-xs text-muted">
                  {slice.keys} key mẫu
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-xs font-bold text-ink">
                  {slice.percent}%
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-xs text-muted">
                  ~{formatMb(slice.estimatedBytes)} MB
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminCard>
  );
}
