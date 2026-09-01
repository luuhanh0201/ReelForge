"use client";

import { ExternalLink, LayoutTemplate, Loader2, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND_PRESETS } from "@/config/admin/landing.config";
import type { LandingCmsState } from "@/lib/admin/use-landing-cms";
import { AdminButton, AdminCard, Pill } from "@/components/admin/primitives";

const SUB_NAV = [
  { href: "/admin/landing-cms", label: "Tất cả danh mục" },
  { href: "/admin/landing-voice", label: "1. Giọng đọc" },
  { href: "/admin/landing-theme", label: "2. Màu & Branding" },
  { href: "/admin/landing-content", label: "3. Nội dung & Tiêu đề" },
  { href: "/admin/landing-showcase", label: "4. Video mẫu" },
];

const presetName = (hex: string): string =>
  BRAND_PRESETS.find((preset) => preset.hex.toLowerCase() === hex.toLowerCase())?.label ??
  "Màu tùy chỉnh";

/** Thanh điều khiển dùng chung cho cả 5 trang CMS. */
export function CmsHeader({
  cms,
  voiceNames,
  onPublish,
  onReset,
}: {
  cms: LandingCmsState;
  /** Tên giọng đang chọn ở Hero và Mini Studio, để hiện ở dòng tóm tắt. */
  voiceNames: { hero: string; studio: string };
  onPublish: () => void;
  onReset: () => void;
}) {
  const pathname = usePathname();
  const brandHex = cms.draft?.theme.brandHex ?? "#ff6b35";

  return (
    <>
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card"
              style={{ backgroundColor: `${brandHex}1f`, color: brandHex }}
            >
              <LayoutTemplate size={24} />
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-ink">
                  Trung tâm quản trị Landing Page
                </h2>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    cms.server?.published
                      ? "bg-mint/12 text-mint"
                      : "bg-amber/12 text-amber"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                        cms.server?.published ? "bg-mint" : "bg-amber"
                      }`}
                    />
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        cms.server?.published ? "bg-mint" : "bg-amber"
                      }`}
                    />
                  </span>
                  {cms.server?.published ? "LIVE CMS" : "CHƯA XUẤT BẢN"}
                </span>

                <span
                  className="inline-flex items-center gap-1.5 rounded-btn border px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    borderColor: `${brandHex}59`,
                    backgroundColor: `${brandHex}1a`,
                    color: brandHex,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: brandHex }}
                  />
                  {presetName(brandHex)}
                </span>

                {cms.dirty ? <Pill accent="amber">Có thay đổi chưa xuất bản</Pill> : null}
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                <span>Hero: {voiceNames.hero}</span>
                <span>Mini Studio: {voiceNames.studio}</span>
                <span>Màu: {brandHex}</span>
                <span>
                  Xuất bản:{" "}
                  {cms.server?.publishedAt
                    ? new Date(cms.server.publishedAt).toLocaleString("vi-VN")
                    : "chưa lần nào"}
                </span>
              </p>

              {cms.error ? <p className="mt-2 text-xs text-danger">{cms.error}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AdminButton>
              <Link href="/" target="_blank" className="inline-flex items-center gap-2">
                <ExternalLink size={14} />
                Xem Landing Page
              </Link>
            </AdminButton>

            <AdminButton variant="danger" onClick={onReset} disabled={cms.saving}>
              <RotateCcw size={14} />
              Khôi phục mặc định
            </AdminButton>

            <AdminButton
              variant="primary"
              onClick={onPublish}
              disabled={cms.saving || !cms.dirty}
            >
              {cms.saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {cms.saving ? "Đang xuất bản..." : "Xuất bản thay đổi"}
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      <nav className="flex flex-wrap gap-2" aria-label="Danh mục CMS">
        {SUB_NAV.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-xs font-semibold transition-colors ${
                active
                  ? "border-brand bg-brand text-[#10151e]"
                  : "border-line bg-subtle text-muted hover:border-brand/45 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
