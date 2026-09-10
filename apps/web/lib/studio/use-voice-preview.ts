"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { fetchVoicePreview } from "@/lib/studio/projects-api";

/**
 * Nghe thử giọng đọc.
 *
 * Ba quy tắc, cả ba đều nhằm để việc thử giọng **không tốn thêm đồng nào**:
 *
 * 1. Chỉ tải khi người dùng **thật sự bấm** một giọng. Tải sẵn cả danh sách nghĩa là kéo
 *    về hàng megabyte audio cho những giọng họ sẽ không bao giờ nghe.
 * 2. Nhớ lại trong phiên: bấm đi bấm lại cùng một giọng chỉ tải một lần.
 * 3. Máy chủ chỉ trả bản đã có sẵn, không tổng hợp mới — nên không có đường nào để thao
 *    tác này chạm vào hoá đơn Google.
 *
 * Tốc độ áp bằng `playbackRate` chứ không tổng hợp lại: bản nghe thử luôn được tạo ở 1.0x,
 * đúng như `VoicePreview` đã ghi. `preservesPitch` giữ cao độ để giọng không bị méo.
 *
 * Thẻ `<audio>` do **component sở hữu** và truyền vào đây qua ref, chứ hook không tự tạo
 * đối tượng media: React gỡ phần tử khi rời trang nên tiếng tắt theo, không cần dọn tay.
 */
export function useVoicePreview(
  audioRef: RefObject<HTMLAudioElement | null>,
  speed: number,
) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const cache = useRef(new Map<string, string>());

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlayingId(null);
  }, [audioRef]);

  const toggle = useCallback(
    async (voiceId: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (playingId === voiceId) {
        stop();
        return;
      }

      audio.pause();

      const cached = cache.current.get(voiceId);
      let url = cached;

      if (!url) {
        setLoadingId(voiceId);
        try {
          const preview = await fetchVoicePreview(voiceId);
          const bytes = Uint8Array.from(atob(preview.audioBase64), (char) =>
            char.charCodeAt(0),
          );
          url = URL.createObjectURL(new Blob([bytes], { type: preview.mimeType }));
          cache.current.set(voiceId, url);
        } catch {
          // Giọng chưa có bản nghe thử: im lặng bỏ qua. Nút đã bị vô hiệu ở giao diện nên
          // đường này chỉ xảy ra khi kho vừa đổi đúng lúc người dùng bấm.
          setLoadingId(null);
          return;
        }
        setLoadingId(null);
      }

      audio.src = url;
      audio.playbackRate = speed;
      // Mặc định của trình duyệt đã là giữ cao độ, nhưng đặt rõ để không phụ thuộc mặc định.
      audio.preservesPitch = true;

      setPlayingId(voiceId);
      await audio.play().catch(() => setPlayingId(null));
    },
    [audioRef, playingId, speed, stop],
  );

  /** Gắn vào `onEnded` của thẻ audio để nút trở lại hình tam giác khi nghe hết. */
  const handleEnded = useCallback(() => setPlayingId(null), []);

  return { playingId, loadingId, toggle, stop, handleEnded };
}
