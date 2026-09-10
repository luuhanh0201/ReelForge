"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TourStep } from "@repo/shared";

/**
 * Lớp phủ của tour: khoét một lỗ quanh neo và đặt hộp giải thích cạnh đó.
 *
 * Bốn khối tối bao quanh vùng neo thay vì một lớp phủ có `clip-path`: cách này giữ cho
 * **vùng neo hoàn toàn không bị lớp nào che**, nên hiệu ứng hover và con trỏ vẫn đúng, và
 * người dùng thấy rõ mình đang được chỉ vào cái gì.
 *
 * Toàn bộ lớp phủ `pointer-events-none` trừ hộp giải thích: Studio là màn hình thao tác
 * dày đặc, chặn chuột toàn màn hình sẽ khiến người dùng tưởng trang bị treo.
 */

const PANEL_WIDTH = 300;
const GAP = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const readRect = (element: HTMLElement): Rect => {
  const box = element.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
};

/** Chọn phía đặt hộp sao cho nó nằm trọn trong màn hình. */
const placePanel = (
  rect: Rect,
  placement: TourStep["placement"],
  panelHeight: number,
): { top: number; left: number } => {
  const { innerWidth, innerHeight } = window;

  const room = {
    top: rect.top,
    bottom: innerHeight - (rect.top + rect.height),
    left: rect.left,
    right: innerWidth - (rect.left + rect.width),
  };

  const side =
    placement !== "auto"
      ? placement
      : room.right >= PANEL_WIDTH + GAP
        ? "right"
        : room.left >= PANEL_WIDTH + GAP
          ? "left"
          : room.bottom >= panelHeight + GAP
            ? "bottom"
            : "top";

  const raw =
    side === "right"
      ? { top: rect.top + rect.height / 2 - panelHeight / 2, left: rect.left + rect.width + GAP }
      : side === "left"
        ? { top: rect.top + rect.height / 2 - panelHeight / 2, left: rect.left - PANEL_WIDTH - GAP }
        : side === "bottom"
          ? { top: rect.top + rect.height + GAP, left: rect.left + rect.width / 2 - PANEL_WIDTH / 2 }
          : { top: rect.top - panelHeight - GAP, left: rect.left + rect.width / 2 - PANEL_WIDTH / 2 };

  // Kẹp vào trong màn hình: neo nằm sát mép là chuyện thường, và hộp tràn ra ngoài thì
  // người dùng mất luôn nút Tiếp.
  return {
    top: Math.min(Math.max(GAP, raw.top), Math.max(GAP, innerHeight - panelHeight - GAP)),
    left: Math.min(Math.max(GAP, raw.left), Math.max(GAP, innerWidth - PANEL_WIDTH - GAP)),
  };
};

export function TourOverlay({
  anchor,
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  anchor: HTMLElement;
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<Rect>(() => readRect(anchor));
  const [panelHeight, setPanelHeight] = useState(180);

  // Neo có thể dịch chuyển: người dùng đổi cỡ cửa sổ, hoặc panel bên dưới cuộn.
  useEffect(() => {
    const sync = () => setRect(readRect(anchor));
    sync();

    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [anchor]);

  // `Esc` bỏ qua cả tour. Bấm ra ngoài thì **không** — xem ghi chú ở lớp phủ bên dưới.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft") onBack();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onNext, onSkip]);

  const pad = 6;

  /**
   * Lỗ khoét **kẹp vào trong màn hình**.
   *
   * Neo có thể cao hơn cả khung nhìn — danh sách 40 giọng đọc là một ví dụ thật. Không kẹp
   * thì bốn khối tối được tính với chiều cao âm nên biến mất, và cả một vùng lớn của trang
   * không hề bị làm mờ: người dùng nhìn vào không biết mình đang được chỉ vào cái gì.
   */
  const hole = (() => {
    const top = Math.max(0, rect.top - pad);
    const left = Math.max(0, rect.left - pad);

    return {
      top,
      left,
      width: Math.min(rect.left + rect.width + pad, window.innerWidth) - left,
      height: Math.min(rect.top + rect.height + pad, window.innerHeight) - top,
    };
  })();

  const panel = placePanel(hole, step.placement, panelHeight);
  const last = index >= total - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/*
        Bốn khối tối quanh lỗ khoét. Không dùng một lớp phủ toàn màn hình vì như vậy sẽ
        chặn cả chuột lẫn hiệu ứng hover của chính thứ đang được chỉ tới.
      */}
      <div className="absolute inset-x-0 top-0 bg-[#04070d]/70" style={{ height: Math.max(0, hole.top) }} />
      <div
        className="absolute inset-x-0 bottom-0 bg-[#04070d]/70"
        style={{ top: hole.top + hole.height }}
      />
      <div
        className="absolute left-0 bg-[#04070d]/70"
        style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left) }}
      />
      <div
        className="absolute right-0 bg-[#04070d]/70"
        style={{ top: hole.top, height: hole.height, left: hole.left + hole.width }}
      />

      <div
        className="absolute rounded-btn ring-2 ring-brand"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
      />

      <div
        ref={(node) => {
          if (node) setPanelHeight(node.offsetHeight);
        }}
        role="dialog"
        aria-label={step.title}
        style={{ top: panel.top, left: panel.left, width: PANEL_WIDTH }}
        className="pointer-events-auto absolute rounded-card border border-line bg-surface p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
      >
        <p className="font-mono text-[10px] font-bold tabular-nums text-brand">
          BƯỚC {index + 1}/{total}
        </p>

        <h2 className="mt-1 font-display text-sm font-bold text-ink">{step.title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>

        <div className="mt-3 flex items-center gap-1.5">
          {/*
            Nút bỏ qua có mặt ở **mọi bước**: người dùng phải thoát được bất cứ lúc nào, và
            việc họ dừng ở bước nào chính là số liệu cho biết bước nào viết chưa rõ.
          */}
          <button
            type="button"
            onClick={onSkip}
            className="mr-auto inline-flex items-center gap-1 rounded-btn px-2 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            <X size={12} />
            Bỏ qua
          </button>

          {index > 0 ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Bước trước"
              className="inline-flex h-8 w-8 items-center justify-center rounded-btn border border-line bg-subtle text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={14} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-8 items-center gap-1.5 rounded-btn bg-brand px-3 text-xs font-bold text-[#10151e] transition-colors hover:bg-brand-hover"
          >
            {last ? "Xong" : "Tiếp"}
            {last ? null : <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
