"use client";

import { AlertTriangle, Check, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONE = {
  success: { icon: Check, className: "border-mint/40 text-mint" },
  warning: { icon: AlertTriangle, className: "border-amber/40 text-amber" },
  info: { icon: Info, className: "border-info/40 text-info" },
} as const;

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(
  null,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }].slice(-4));
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      3200,
    );
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => {
            const tone = TONE[toast.tone];
            const Icon = tone.icon;

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.2 }}
                role="status"
                className={`pointer-events-auto flex items-center gap-2.5 rounded-card border bg-surface px-4 py-3 text-sm font-medium text-ink shadow-xl ${tone.className}`}
              >
                <Icon size={16} />
                <span className="text-ink">{toast.message}</span>
                <button
                  type="button"
                  onClick={() =>
                    setToasts((current) => current.filter((item) => item.id !== toast.id))
                  }
                  aria-label="Đóng thông báo"
                  className="ml-2 text-muted transition-colors hover:text-ink"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast phải dùng bên trong <ToastProvider>");
  return context;
}
