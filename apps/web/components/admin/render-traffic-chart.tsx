"use client";

import { useState } from "react";
import {
  RANGE_UNIT,
  TRAFFIC_BY_RANGE,
  type RangeId,
} from "@/config/admin/overview.config";

/** Số nhãn trục X tối đa cho mỗi khoảng, tránh chữ chồng lên nhau. */
const LABEL_STEP: Record<RangeId, number> = { today: 3, "7d": 1, "30d": 5, "90d": 10 };

const formatNumber = (value: number) => value.toLocaleString("vi-VN");

/**
 * Lưu lượng render — một chuỗi dữ liệu duy nhất nên dùng một màu brand, không legend.
 * Mỗi cột là một hit target riêng (hover và cả focus bàn phím) kèm tooltip;
 * cột cao nhất được gắn nhãn trực tiếp nên số liệu đỉnh đọc được mà không cần rê chuột.
 */
export function RenderTrafficChart({ range }: { range: RangeId }) {
  const [active, setActive] = useState<number | null>(null);
  const points = TRAFFIC_BY_RANGE[range];
  const max = Math.max(...points.map((point) => point.videos));
  const total = points.reduce((sum, point) => sum + point.videos, 0);
  const peakIndex = points.reduce(
    (best, point, index) => (point.videos > points[best]!.videos ? index : best),
    0,
  );
  const activePoint = active === null ? null : points[active];
  const labelStep = LABEL_STEP[range];
  const activeHeight = activePoint ? Math.max(3, (activePoint.videos / max) * 100) : 0;
  const tooltipLeft = active === null ? 0 : ((active + 0.5) / points.length) * 100;
  const tooltipTransform =
    tooltipLeft < 18
      ? "translateX(-12px)"
      : tooltipLeft > 82
        ? "translateX(calc(-100% + 12px))"
        : "translateX(-50%)";

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Lưu lượng render</h2>
          <p className="mt-0.5 text-xs text-muted">
            {formatNumber(total)} video trong {RANGE_UNIT[range]} · đỉnh{" "}
            {points[peakIndex]?.label} với {formatNumber(points[peakIndex]?.videos ?? 0)} video
          </p>
        </div>
      </figcaption>

      <div className="relative mt-5">
        {/* Lưới ngang mờ, không cạnh tranh với dữ liệu */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[220px]">
          <div className="flex h-full flex-col justify-between">
            {[0, 1, 2, 3].map((line) => (
              <span key={line} className="h-px w-full bg-line" />
            ))}
          </div>
        </div>

        <div className="relative flex h-[220px] items-end gap-[2px]">
          {points.map((point, index) => {
            const height = Math.max(3, Math.round((point.videos / max) * 100));
            const highlighted = active === index || (active === null && index === peakIndex);

            return (
              <button
                key={`${point.label}-${index}`}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${point.fullLabel}: ${formatNumber(point.videos)} video`}
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                {point.peak ? (
                  <span aria-hidden className="absolute inset-0 rounded-[3px] bg-brand/5" />
                ) : null}

                <span
                  style={{ height: `${height}%` }}
                  className={`relative w-full rounded-t-[4px] transition-colors ${
                    highlighted ? "bg-brand" : "bg-brand/55 group-hover:bg-brand"
                  }`}
                />
              </button>
            );
          })}

          {/* Tooltip bám ngay trên đỉnh cột đang hover; số liệu đậm, nhãn thời gian đứng sau */}
          {activePoint ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-card border border-line bg-canvas px-3 py-2 shadow-xl"
              style={{
                left: `${tooltipLeft}%`,
                bottom: `calc(${Math.min(activeHeight, 78)}% + 10px)`,
                transform: tooltipTransform,
              }}
            >
              <p className="font-mono text-sm font-bold text-ink">
                {formatNumber(activePoint.videos)}{" "}
                <span className="text-xs font-medium text-muted">video</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{activePoint.fullLabel}</p>
              <p className="mt-1 border-t border-line pt-1 font-mono text-[11px] text-muted">
                {Math.round((activePoint.videos / max) * 100)}% so với đỉnh
                {activePoint.peak ? " · khung giờ cao điểm" : ""}
              </p>
            </div>
          ) : null}
        </div>

      </div>

      <div className="mt-2 flex gap-[2px] font-mono text-[10px] text-muted">
        {points.map((point, index) => (
          <span key={`${point.label}-axis-${index}`} className="flex-1 truncate text-center">
            {index % labelStep === 0 ? point.label : ""}
          </span>
        ))}
      </div>

      {/* Bản dữ liệu dạng bảng cho trình đọc màn hình */}
      <table className="sr-only">
        <caption>Số video render theo {RANGE_UNIT[range]}</caption>
        <thead>
          <tr>
            <th>Mốc thời gian</th>
            <th>Số video</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${point.label}-row-${index}`}>
              <td>{point.fullLabel}</td>
              <td>{point.videos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
