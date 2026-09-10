"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Tour, TourStep } from "@repo/shared";
import { fetchTour, saveTourProgress, type TourStatus } from "@/lib/tour/tour-api";
import { TourOverlay } from "./tour-overlay";

/**
 * Bộ máy tour dùng chung cho **mọi khu vực của sản phẩm**.
 *
 * Không có một dòng nào biết Studio là gì. Nơi dùng chỉ cung cấp hai thứ:
 *
 * 1. `data-tour="…"` gắn vào các điểm cần chỉ tới.
 * 2. `preparers` — bảng hành động để tour mở sẵn trạng thái trước một bước (ví dụ mở đúng
 *    tab). Bộ máy chỉ tra bảng theo tên, không bao giờ thực thi chuỗi do dữ liệu cung cấp.
 *
 * Nhờ vậy các tính năng sắp mở (tạo từ link, biên dịch video) chỉ cần khai báo thêm neo
 * trong `TOUR_SCOPES` và bọc trang bằng provider này.
 */

/** Thời gian chờ một neo xuất hiện trước khi bỏ qua bước. */
const ANCHOR_TIMEOUT_MS = 1500;

export interface TourController {
  /** Mở tour bằng tay, kể cả khi người dùng đã bỏ qua trước đó. */
  start: () => void;
  /** `false` khi tour đang tắt hoặc chưa có bước nào — giao diện ẩn nút "Xem hướng dẫn". */
  available: boolean;
  running: boolean;
}

const TourContext = createContext<TourController>({
  start: () => undefined,
  available: false,
  running: false,
});

export const useTourController = (): TourController => useContext(TourContext);

/** Chờ neo xuất hiện trong DOM; trả `null` nếu quá hạn. */
const waitForAnchor = (anchor: string): Promise<HTMLElement | null> =>
  new Promise((resolve) => {
    const selector = `[data-tour="${CSS.escape(anchor)}"]`;
    const found = document.querySelector<HTMLElement>(selector);
    if (found) {
      resolve(found);
      return;
    }

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, ANCHOR_TIMEOUT_MS);

    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return;

      clearTimeout(timer);
      observer.disconnect();
      resolve(element);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

export function TourProvider({
  tourKey,
  preparers,
  enabled = true,
  children,
}: {
  tourKey: string;
  /**
   * Các hành động tour được phép gọi trước một bước, khớp `actions` của khu vực trong
   * `TOUR_SCOPES`. Hành động nào không có ở đây thì bước đó vẫn chạy, chỉ là không chuẩn bị
   * gì — thà chỉ sai chỗ một bước còn hơn treo cả tour.
   */
  preparers?: Record<string, (value?: string) => void>;
  /** Tắt khi trang chưa sẵn sàng (đang tải, chưa đăng nhập, màn hình quá hẹp). */
  enabled?: boolean;
  children: ReactNode;
}) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [seen, setSeen] = useState<TourStatus | null | undefined>(undefined);
  const [index, setIndex] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // Đọc trong hiệu ứng bất đồng bộ mà không phải đưa vào deps.
  const preparersRef = useRef(preparers);
  useEffect(() => {
    preparersRef.current = preparers;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void fetchTour(tourKey)
      .then((result) => {
        if (cancelled) return;
        setTour(result.tour);
        setSeen(result.state?.status ?? null);
      })
      // Hướng dẫn hỏng không được làm hỏng trang; im lặng bỏ qua là đúng ở đây.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled, tourKey]);

  // `useMemo` để mảng giữ nguyên tham chiếu giữa các lần render, nếu không mọi callback
  // phụ thuộc vào nó sẽ được dựng lại liên tục.
  const steps = useMemo(() => (tour?.enabled ? tour.steps : []), [tour]);
  const available = steps.length > 0;
  const step: TourStep | undefined = index === null ? undefined : steps[index];

  /**
   * Đi tới bước đầu tiên **thật sự hiển thị được** kể từ vị trí `from`.
   *
   * Neo không xuất hiện kịp thì bỏ qua bước đó và đi tiếp. Giao diện thay đổi theo thời
   * gian; một bước trỏ vào chỗ không còn tồn tại mà làm treo cả tour thì tệ hơn hẳn việc
   * người dùng thiếu mất một lời giải thích.
   */
  const goTo = useCallback(
    async (from: number) => {
      // Vòng lặp chứ không đệ quy: một tour mà mọi neo đều biến mất sẽ tạo ra chuỗi lời
      // gọi lồng nhau dài bằng số bước, và ngăn xếp lỗi khi đó rất khó đọc.
      let next = from;

      while (next < steps.length) {
        const target = steps[next]!;

        if (target.prepare) {
          preparersRef.current?.[target.prepare.action]?.(target.prepare.value);
        }

        const element = await waitForAnchor(target.anchor);

        if (element) {
          setIndex(next);
          setAnchor(element);
          element.scrollIntoView({ block: "nearest", behavior: "smooth" });
          void saveTourProgress(tourKey, "running", target.id).catch(() => undefined);
          return;
        }

        next += 1;
      }

      // Hết bước, hoặc mọi bước còn lại đều trỏ vào neo không còn tồn tại.
      setIndex(null);
      setAnchor(null);
      setSeen("done");
      void saveTourProgress(tourKey, "done", steps[steps.length - 1]?.id ?? null).catch(
        () => undefined,
      );
    },
    [steps, tourKey],
  );

  /**
   * Tự mở cho người chưa từng thấy. Đã bỏ qua thì không bao giờ tự bật lại.
   *
   * Hoãn một nhịp trước khi tìm neo: effect này chạy ngay sau khi trang commit, nhưng các
   * panel con có thể còn đang mount. Tìm neo quá sớm thì bước đầu tiên bị bỏ qua oan.
   */
  useEffect(() => {
    if (!enabled || seen !== null || !available || !tour?.autoStart) return;

    const timer = setTimeout(() => void goTo(0), 0);
    return () => clearTimeout(timer);
    // `goTo` đổi theo `steps`; chỉ cần chạy một lần khi đủ điều kiện.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, seen, available, tour?.autoStart]);

  const finish = useCallback(
    (status: TourStatus) => {
      const current = index === null ? null : (steps[index]?.id ?? null);
      setIndex(null);
      setAnchor(null);
      setSeen(status);
      void saveTourProgress(tourKey, status, current).catch(() => undefined);
    },
    [index, steps, tourKey],
  );

  const controller = useMemo<TourController>(
    () => ({
      available,
      running: index !== null,
      start: () => void goTo(0),
    }),
    [available, index, goTo],
  );

  return (
    <TourContext.Provider value={controller}>
      {children}

      {step && anchor ? (
        <TourOverlay
          anchor={anchor}
          step={step}
          index={index ?? 0}
          total={steps.length}
          onNext={() => void goTo((index ?? 0) + 1)}
          onBack={() => void goTo(Math.max(0, (index ?? 0) - 1))}
          onSkip={() => finish("skipped")}
        />
      ) : null}
    </TourContext.Provider>
  );
}
