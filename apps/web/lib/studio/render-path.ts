/**
 * Máy này có xuất video được không?
 *
 * Kế hoạch đã bỏ đường render trên máy chủ ở đợt này, nên **máy khách là đường duy nhất**.
 * Hệ quả phải chấp nhận: máy không có WebCodecs thì chưa xuất được. Kiểm tra ngay tại nút
 * Xuất và nói thẳng — để người dùng bấm rồi treo giữa chừng là cách tệ nhất.
 */
export type RenderPath =
  | { kind: "client" }
  | { kind: "unsupported"; reason: string };

export const pickRenderPath = (): RenderPath => {
  if (typeof window === "undefined") return { kind: "unsupported", reason: "Chưa tải xong trình duyệt" };

  if (!("VideoEncoder" in window)) {
    return {
      kind: "unsupported",
      reason:
        "Trình duyệt này chưa hỗ trợ WebCodecs nên chưa xuất được video. Hãy mở bằng Chrome hoặc Edge trên máy tính.",
    };
  }

  // Điện thoại có WebCodecs nhưng bộ nhớ tab rất dễ bị thu hồi giữa chừng khi encode 1080p.
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 900) {
    return {
      kind: "unsupported",
      reason:
        "Xuất video trên điện thoại chưa ổn định. Hãy mở dự án này trên máy tính để xuất file.",
    };
  }

  return { kind: "client" };
};
