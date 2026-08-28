"use client";

import { Loader2 } from "lucide-react";
import { AUTH_CONFIG } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";
import { GoogleGlyph } from "@/components/auth/google-glyph";

const LABEL = {
  idle: L("Đăng nhập bằng Google", "Sign in with Google"),
  connecting: L("Đang kết nối Google...", "Connecting to Google..."),
};

/**
 * Phương thức đăng nhập bằng Google trong Auth Modal.
 * Một chạm là chạy luôn luồng OAuth mô phỏng, có trạng thái loading.
 */
export function GoogleSignInButton({ className = "" }: { className?: string }) {
  const { t, googleStatus, signInWithGoogle } = useApp();
  const connecting = googleStatus === "connecting";

  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      disabled={connecting}
      aria-busy={connecting}
      aria-label={t(LABEL.idle)}
      className={`group inline-flex h-12 w-full items-center justify-center gap-2 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-brand/45 hover:bg-subtle disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      {connecting ? (
        <Loader2 size={16} className="animate-spin text-brand" />
      ) : (
        <GoogleGlyph size={18} />
      )}

      <span className="whitespace-nowrap">
        {connecting ? t(LABEL.connecting) : t(LABEL.idle)}
      </span>

      {connecting ? null : (
        <span className="whitespace-nowrap rounded-full bg-mint/12 px-2 py-0.5 text-[11px] font-bold text-mint">
          +{AUTH_CONFIG.googleBonusCredits} Credits
        </span>
      )}
    </button>
  );
}
