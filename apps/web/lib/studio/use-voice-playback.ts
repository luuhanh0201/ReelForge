"use client";

import { useEffect, useRef } from "react";
import type { VoiceClipView } from "@/lib/studio/projects-api";
import { usePlayhead, type Playback } from "@/lib/studio/use-playback";

/**
 * Phát tiếng khớp với kim playhead của khung xem trước.
 *
 * Dùng `HTMLAudioElement` chứ không phải Web Audio: ở đây chỉ cần nghe thử, và thẻ audio
 * tự lo tải dần, giải mã, đệm. Bộ xuất MP4 mới cần tới PCM thật — chỗ đó đọc lại file từ
 * đầu trong Web Worker.
 *
 * Vòng lặp thời gian **không nằm ở đây**. `usePlayback` đã có một vòng `requestAnimationFrame`;
 * thêm một vòng nữa thì hai bên sẽ trôi khỏi nhau và tiếng lệch hình.
 */
export function useVoicePlayback({
  clips,
  sceneStartMs,
  playback,
  muted,
}: {
  clips: VoiceClipView[];
  /** Mốc bắt đầu của từng cảnh, cùng công thức với `buildPreviewConfig`. */
  sceneStartMs: number[];
  playback: Playback;
  muted: boolean;
}): void {
  // Đăng ký ở đây thay vì nhận qua tham số: hook này cần biết đang tới cảnh nào, còn trang
  // gọi nó thì không — kéo con số lên trang là kéo cả trang vào nhịp 60fps.
  const timeMs = usePlayhead(playback);
  const playing = playback.playing;

  const elements = useRef(new Map<string, HTMLAudioElement>());
  // Đọc mốc thời gian mới nhất mà không phải đưa nó vào deps — nó đổi mỗi khung hình.
  // Gán trong effect: React có thể render lại mà không commit, ref khi đó sẽ mang giá trị
  // của một lần render bị bỏ đi.
  const timeRef = useRef(timeMs);
  useEffect(() => {
    timeRef.current = timeMs;
  });

  // Tải sẵn mọi đoạn tiếng; đợi tới lúc chuyển cảnh mới tải thì đầu câu bị nuốt mất.
  useEffect(() => {
    const pool = elements.current;
    const wanted = new Set(clips.map((clip) => clip.clipId));

    for (const [id, audio] of pool) {
      if (wanted.has(id)) continue;
      audio.pause();
      audio.src = "";
      pool.delete(id);
    }

    for (const clip of clips) {
      const existing = pool.get(clip.clipId);
      if (existing?.src === clip.url) continue;

      const audio = existing ?? new Audio();
      audio.preload = "auto";
      audio.src = clip.url;
      pool.set(clip.clipId, audio);
    }

    return () => {
      for (const audio of pool.values()) audio.pause();
    };
  }, [clips]);

  /**
   * Đoạn tiếng đang tới lượt tại mốc hiện tại.
   *
   * Không bọc `useMemo`: một video tối đa 6 cảnh nên phép tìm này rẻ hơn cả chi phí so
   * sánh dependency, và `timeMs` đổi mỗi khung hình nên memo hầu như không bao giờ trúng.
   */
  const active =
    clips.find((clip) => {
      const start = sceneStartMs[clip.index];
      return start !== undefined && timeMs >= start && timeMs < start + clip.durationMs;
    }) ?? null;

  const activeId = active?.clipId ?? null;
  const activeStart = active ? (sceneStartMs[active.index] ?? 0) : 0;

  useEffect(() => {
    const pool = elements.current;

    for (const [id, audio] of pool) {
      if (id !== activeId && !audio.paused) audio.pause();
    }

    if (!activeId) return;

    const audio = pool.get(activeId);
    if (!audio) return;

    audio.muted = muted;

    if (!playing) {
      audio.pause();
      return;
    }

    // Đặt lại vị trí theo playhead: người dùng có thể vừa tua tới giữa câu.
    const offset = Math.max(0, (timeRef.current - activeStart) / 1000);
    if (Math.abs(audio.currentTime - offset) > 0.2) audio.currentTime = offset;

    // Trình duyệt chặn phát tự động cho tới khi người dùng tương tác; ở đây họ vừa bấm
    // nút Phát nên chuyện đó không xảy ra, nhưng vẫn không được để lỗi làm đứt render.
    void audio.play().catch(() => undefined);

    // `activeStart` chỉ đổi cùng `activeId`, và `timeRef` cố ý nằm ngoài deps vì mốc thời
    // gian đổi mỗi khung hình.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, playing, muted]);
}

/**
 * Vỏ bọc không vẽ gì, chỉ để **giữ việc đăng ký playhead ở một chiếc lá của cây**.
 *
 * Gọi thẳng `useVoicePlayback` trong trang thì trang đăng ký playhead, và mỗi khung hình
 * sẽ render lại toàn bộ panel, danh sách cảnh, danh sách 40 giọng — đúng thứ store playhead
 * sinh ra để tránh. Đặt hook vào một component trả về `null` thì chỉ mình nó render.
 */
export function VoiceTrack(props: {
  clips: VoiceClipView[];
  sceneStartMs: number[];
  playback: Playback;
  muted: boolean;
}): null {
  useVoicePlayback(props);
  return null;
}
