"use client";

import { useEffect, useRef } from "react";

export type HotkeyHandlers = Partial<{
  playPause: () => void;
  prevScene: () => void;
  nextScene: () => void;
  seekBack: () => void;
  seekForward: () => void;
  addScene: () => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  export: () => void;
}>;

/** Người dùng đang gõ chữ thì `Space` là dấu cách, không phải lệnh phát video. */
const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
};

/**
 * Phím tắt của phòng dựng.
 *
 * Handler được giữ trong ref nên listener chỉ gắn một lần: gắn lại mỗi lần render sẽ làm
 * mất phím trong đúng khoảnh khắc React đang thay listener.
 */
export function useHotkeys(handlers: HotkeyHandlers): void {
  const ref = useRef(handlers);

  // Gán trong effect chứ không phải giữa render: React có thể render lại mà không commit,
  // lúc đó ref sẽ mang handler của một lần render bị bỏ đi.
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;

      const current = ref.current;
      const mod = event.ctrlKey || event.metaKey;

      const run = (action: (() => void) | undefined) => {
        if (!action) return;
        event.preventDefault();
        action();
      };

      if (mod) {
        switch (event.key.toLowerCase()) {
          case "enter":
            return run(current.addScene);
          case "z":
            return run(event.shiftKey ? current.redo : current.undo);
          case "y":
            return run(current.redo);
          case "s":
            return run(current.save);
          case "e":
            return run(current.export);
          default:
            return;
        }
      }

      switch (event.key) {
        case " ":
          return run(current.playPause);
        case "[":
          return run(current.prevScene);
        case "]":
          return run(current.nextScene);
        case "ArrowLeft":
          return run(current.seekBack);
        case "ArrowRight":
          return run(current.seekForward);
        default:
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
