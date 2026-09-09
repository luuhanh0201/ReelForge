"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Đầu phát dùng chung cho khung xem trước và thước thời gian.
 *
 * Phải nằm ở một chỗ duy nhất: canvas và timeline mà mỗi bên tự đếm giờ thì kim playhead
 * sẽ trôi khỏi hình đang hiển thị, và người dùng không còn tin được vị trí mình đang xem.
 *
 * Dùng `requestAnimationFrame` vì đây là phần **hiển thị**. Vòng lặp xuất file thì không
 * được dùng nó — trình duyệt dừng rAF khi tab chạy nền.
 */
export interface Playback {
  timeMs: number;
  playing: boolean;
  toggle: () => void;
  pause: () => void;
  /** Nhảy tới một mốc bất kỳ; luôn dừng phát để người dùng thấy đúng khung mình chọn. */
  seek: (value: number) => void;
  /** Tua tương đối, dùng cho phím ← →. */
  nudge: (deltaMs: number) => void;
}

export function usePlayback(totalMs: number): Playback {
  const [rawTimeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const originRef = useRef(0);

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(0, value), Math.max(0, totalMs)),
    [totalMs],
  );

  /**
   * Video ngắn lại (xoá cảnh, rút thời lượng) mà kim đứng ngoài thì canvas không có gì để
   * vẽ. Kẹp ngay lúc render thay vì sửa state trong effect: đây là giá trị **suy ra được**
   * từ `totalMs`, không phải một trạng thái độc lập.
   */
  const timeMs = Math.min(rawTimeMs, Math.max(0, totalMs));

  useEffect(() => {
    if (!playing) return;

    originRef.current = performance.now() - timeMs;

    const tick = () => {
      const elapsed = performance.now() - originRef.current;

      if (elapsed >= totalMs) {
        setTimeMs(totalMs);
        setPlaying(false);
        return;
      }

      setTimeMs(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // `timeMs` cố ý không nằm trong deps: nó đổi mỗi khung hình, đưa vào sẽ dựng lại vòng
    // lặp liên tục. Mốc lúc bắt đầu phát đã được chốt vào `originRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, totalMs]);

  const seek = useCallback(
    (value: number) => {
      setPlaying(false);
      setTimeMs(clamp(value));
    },
    [clamp],
  );

  const nudge = useCallback(
    (deltaMs: number) => {
      setPlaying(false);
      setTimeMs((current) => clamp(current + deltaMs));
    },
    [clamp],
  );

  const toggle = useCallback(() => {
    setPlaying((current) => {
      if (current) return false;
      // Bấm phát khi kim đang ở cuối thì quay về đầu, thay vì đứng im như bị treo.
      if (timeMs >= totalMs) setTimeMs(0);
      return true;
    });
  }, [timeMs, totalMs]);

  const pause = useCallback(() => setPlaying(false), []);

  return { timeMs, playing, toggle, pause, seek, nudge };
}
