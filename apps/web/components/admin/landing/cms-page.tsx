"use client";

import { useState } from "react";
import { useLandingCms } from "@/lib/admin/use-landing-cms";
import { fetchVoices, type VoiceEntry } from "@/lib/admin/voices-api";
import { useEffect } from "react";
import { AdminCard, AdminPageHeader } from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminButton } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toast";
import { CmsHeader } from "./cms-header";
import { ContentSection } from "./content-section";
import { LiveSimulator } from "./live-simulator";
import { ShowcaseSection } from "./showcase-section";
import { ThemeSection } from "./theme-section";
import { VoiceSection } from "./voice-section";

export type CmsTab = "all" | "voice" | "theme" | "content" | "showcase";

const TITLES: Record<CmsTab, { title: string; description: string }> = {
  all: {
    title: "CMS & Tùy biến chung",
    description:
      "Toàn bộ cấu hình Landing Page trong một trang, kèm khung xem trước cập nhật tức thì.",
  },
  voice: {
    title: "Cấu hình giọng Voice",
    description: "Giọng AI phát mẫu ở ba vị trí: Hero, Mini Studio và khu vực đánh giá.",
  },
  theme: {
    title: "Màu sắc & Branding",
    description: "Màu chủ đạo và ba hiệu ứng thị giác của Landing Page.",
  },
  content: {
    title: "Nội dung, Hero & Tiêu đề",
    description: "Tiêu đề, mô tả, nhãn nút và danh sách từ khoá chạy chữ.",
  },
  showcase: {
    title: "Video mẫu & Sản phẩm demo",
    description: "Link sản phẩm mẫu, số video nổi bật và số liệu xã hội.",
  },
};

/**
 * Khung chung cho cả 5 trang CMS: cùng header, cùng bản nháp, cùng khung xem trước;
 * chỉ khác phần nội dung bên dưới.
 */
export function LandingCmsPage({ tab }: { tab: CmsTab }) {
  const toast = useToast();
  const cms = useLandingCms();
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVoices()
        .then(setVoices)
        .catch(() => setVoices([]));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const nameOf = (voiceId: string) =>
    voices.find((voice) => voice.id === voiceId)?.personaName ?? "mặc định";

  const publish = async () => {
    if (await cms.publish()) {
      toast("Đã xuất bản — landing page của khách đã cập nhật");
    }
  };

  const reset = async () => {
    setResetOpen(false);
    if (await cms.reset()) {
      toast("Đã khôi phục cấu hình gốc của ReelForge", "warning");
    }
  };

  const meta = TITLES[tab];

  return (
    <>
      <AdminPageHeader title={meta.title} description={meta.description} />

      <CmsHeader
        cms={cms}
        voiceNames={{
          hero: nameOf(cms.draft?.voice.hero.voiceId ?? ""),
          studio: nameOf(cms.draft?.voice.studio.voiceId ?? ""),
        }}
        onPublish={() => void publish()}
        onReset={() => setResetOpen(true)}
      />

      {cms.loading ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-muted">Đang đọc cấu hình CMS...</p>
        </AdminCard>
      ) : !cms.draft ? (
        <AdminCard className="border-danger/40 bg-danger/5">
          <p className="text-sm text-ink">
            <strong className="font-bold">Không đọc được cấu hình Landing Page.</strong>{" "}
            {cms.error}
          </p>
        </AdminCard>
      ) : (
        <>
          <LiveSimulator config={cms.draft} />

          {(tab === "all" || tab === "voice") && (
            <VoiceSection config={cms.draft} onChange={cms.update} />
          )}
          {(tab === "all" || tab === "theme") && (
            <ThemeSection config={cms.draft} onChange={cms.update} />
          )}
          {(tab === "all" || tab === "content") && (
            <ContentSection config={cms.draft} onChange={cms.update} />
          )}
          {(tab === "all" || tab === "showcase") && (
            <ShowcaseSection config={cms.draft} onChange={cms.update} />
          )}

          {cms.dirty ? (
            <AdminCard className="border-amber/40 bg-amber/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink">
                  <strong className="font-bold">Bản nháp chưa xuất bản.</strong> Thay đổi
                  đang lưu trong trình duyệt của bạn; khách vẫn thấy bản cũ cho tới khi bấm
                  Xuất bản.
                </p>
                <AdminButton onClick={cms.discard}>Bỏ bản nháp</AdminButton>
              </div>
            </AdminCard>
          ) : null}
        </>
      )}

      <AdminModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Khôi phục cấu hình gốc?"
        description="Toàn bộ màu sắc, giọng đọc, câu chữ và link mẫu sẽ trở về cấu hình gốc của ReelForge, đồng thời xuất bản ngay cho khách."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setResetOpen(false)}>
              Hủy
            </AdminButton>
            <AdminButton variant="danger" onClick={() => void reset()} disabled={cms.saving}>
              Khôi phục và xuất bản
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Bản đang chạy vẫn được giữ trong lịch sử phiên bản, nên vẫn quay lại được.
        </p>
      </AdminModal>
    </>
  );
}
