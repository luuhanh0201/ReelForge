/**
 * Đồng hồ dạng `mm:ss.d` cho phòng dựng.
 *
 * Luôn hiển thị cùng số chữ số và đi kèm `font-mono tabular-nums` ở phía giao diện — nếu
 * không, con số sẽ co giãn theo từng khung hình và cả thanh điều khiển rung khi phát.
 */
export const formatTimecode = (ms: number): string => {
  const safe = Math.max(0, ms);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
};

/** Dạng ngắn cho nhãn thời lượng một cảnh: `10.0s`. */
export const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
