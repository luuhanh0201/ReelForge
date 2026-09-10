"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Đầu phát dùng chung cho khung xem trước, thước thời gian và đồng hồ trên thanh đỉnh.
 *
 * Phải nằm ở một chỗ duy nhất: canvas và timeline mà mỗi bên tự đếm giờ thì kim playhead
 * sẽ trôi khỏi hình đang hiển thị, và người dùng không còn tin được vị trí mình đang xem.
 *
 * **Mốc thời gian không phải React state.** Nó đổi 60 lần mỗi giây; để trong `useState`
 * thì mỗi khung hình sẽ render lại cả cây component — danh sách 40 giọng đọc, danh sách
 * cảnh, mọi panel — trong khi thứ duy nhất cần vẽ lại là canvas, kim playhead và đồng hồ.
 * Vì vậy nó nằm trong một store nhỏ, và chỉ component nào **thật sự cần con số** mới đăng
 * ký qua `usePlayhead()`.
 *
 * Vòng lặp dùng `requestAnimationFrame` vì đây là phần hiển thị. Vòng lặp xuất file thì
 * không được dùng nó — trình duyệt dừng rAF khi tab chạy nền.
 */

/** Store tối giản cho `useSyncExternalStore`: một số và một tập người nghe. */
class PlayheadStore {
  private time = 0;
  private total = 0;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): number => this.time;

  set(value: number): void {
    if (value === this.time) return;
    this.time = value;
    for (const listener of this.listeners) listener();
  }

  /** Tổng thời lượng không có người nghe: nó luôn đi kèm một lần render vì lý do khác. */
  setTotal(value: number): void {
    this.total = value;
  }

  getTotal(): number {
    return this.total;
  }
}

export interface Playback {
  /** Đọc mốc hiện tại **ngoài lúc render** (event handler, effect). Không gây render lại. */
  readTimeMs: () => number;
  playing: boolean;
  totalMs: number;
  toggle: () => void;
  pause: () => void;
  /** Nhảy tới một mốc bất kỳ; luôn dừng phát để người dùng thấy đúng khung mình chọn. */
  seek: (value: number) => void;
  /** Tua tương đối, dùng cho phím ← →. */
  nudge: (deltaMs: number) => void;
  /** Dành cho `usePlayhead`; đừng gọi trực tiếp trong component. */
  store: PlayheadStore;
}

/**
 * Đăng ký nhận mốc thời gian.
 *
 * Chỉ gọi trong component **thật sự hiển thị con số hoặc vẽ theo nó**. Gọi ở một component
 * cha là kéo cả cây con vào nhịp 60fps, đúng thứ store này sinh ra để tránh.
 */
export function usePlayhead(playback: Playback): number {
  return useSyncExternalStore(
    playback.store.subscribe,
    playback.store.getSnapshot,
    () => 0,
  );
}

export function usePlayback(totalMs: number): Playback {
  const [playing, setPlaying] = useState(false);

  // `useState` với hàm khởi tạo: store được tạo đúng một lần và đọc được ngay lúc render,
  // khác với `useRef` mà React chỉ cho đọc ngoài render.
  const [store] = useState(() => new PlayheadStore());

  const rafRef = useRef<number | null>(null);

  // Tổng thời lượng đổi khi thêm/xoá cảnh; giữ trong store để các callback ổn định đọc
  // được giá trị mới nhất mà không cần dựng lại.
  store.setTotal(totalMs);

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(0, value), Math.max(0, store.getTotal())),
    [store],
  );

  /**
   * Video ngắn lại (xoá cảnh, rút thời lượng) mà kim đứng ngoài thì canvas không có gì để
   * vẽ. Kẹp lại ngay khi tổng thời lượng đổi.
   */
  useEffect(() => {
    store.set(Math.min(store.getSnapshot(), Math.max(0, totalMs)));
  }, [store, totalMs]);

  useEffect(() => {
    if (!playing) return;

    const origin = performance.now() - store.getSnapshot();

    const tick = () => {
      const elapsed = performance.now() - origin;

      if (elapsed >= store.getTotal()) {
        store.set(store.getTotal());
        setPlaying(false);
        return;
      }

      store.set(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, store]);

  const seek = useCallback(
    (value: number) => {
      setPlaying(false);
      store.set(clamp(value));
    },
    [clamp, store],
  );

  const nudge = useCallback(
    (deltaMs: number) => {
      setPlaying(false);
      store.set(clamp(store.getSnapshot() + deltaMs));
    },
    [clamp, store],
  );

  const toggle = useCallback(() => {
    setPlaying((current) => {
      if (current) return false;
      // Bấm phát khi kim đang ở cuối thì quay về đầu, thay vì đứng im như bị treo.
      if (store.getSnapshot() >= store.getTotal()) store.set(0);
      return true;
    });
  }, [store]);

  const pause = useCallback(() => setPlaying(false), []);

  return {
    readTimeMs: store.getSnapshot,
    playing,
    totalMs,
    toggle,
    pause,
    seek,
    nudge,
    store,
  };
}
