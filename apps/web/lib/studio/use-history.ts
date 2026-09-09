"use client";

import { useCallback, useState } from "react";

/**
 * Ngăn xếp hoàn tác / làm lại cho một giá trị bất kỳ.
 *
 * Chỉ giữ trong bộ nhớ phiên làm việc, không lưu xuống máy chủ: người dùng mong hoàn tác
 * được thao tác **họ vừa làm**, không phải thao tác của lần mở trước.
 *
 * Ảnh chụp được lưu nguyên vẹn, nên nơi gọi phải truyền vào giá trị bất biến (đã sao chép)
 * chứ không phải tham chiếu tới đối tượng còn bị sửa tiếp.
 */
export interface History<T> {
  canUndo: boolean;
  canRedo: boolean;
  /** Ghi lại trạng thái **trước** khi thay đổi, gọi ngay trước mỗi thao tác sửa. */
  push: (snapshot: T) => void;
  undo: (current: T) => T | null;
  redo: (current: T) => T | null;
  clear: () => void;
}

/** Giới hạn chiều sâu: giữ vô hạn thì một phiên dài sẽ ăn hết bộ nhớ tab. */
const MAX_DEPTH = 50;

export function useHistory<T>(): History<T> {
  // Dùng state chứ không phải ref: `canUndo`/`canRedo` được đọc lúc render để bật tắt nút,
  // mà giá trị trong ref thì không kích hoạt render lại.
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const push = useCallback((snapshot: T) => {
    setPast((stack) => [...stack, snapshot].slice(-MAX_DEPTH));
    // Làm việc mới thì nhánh "làm lại" cũ không còn ý nghĩa.
    setFuture([]);
  }, []);

  const undo = useCallback(
    (current: T): T | null => {
      const previous = past[past.length - 1];
      if (previous === undefined) return null;

      setPast((stack) => stack.slice(0, -1));
      setFuture((stack) => [current, ...stack].slice(0, MAX_DEPTH));

      return previous;
    },
    [past],
  );

  const redo = useCallback(
    (current: T): T | null => {
      const next = future[0];
      if (next === undefined) return null;

      setFuture((stack) => stack.slice(1));
      setPast((stack) => [...stack, current].slice(-MAX_DEPTH));

      return next;
    },
    [future],
  );

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    push,
    undo,
    redo,
    clear,
  };
}
