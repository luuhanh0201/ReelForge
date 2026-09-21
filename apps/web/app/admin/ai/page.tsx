"use client";

import { Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminCard, AdminPageHeader, AdminTabs } from "@/components/admin/primitives";
import { ModelsSection } from "@/components/admin/models-section";
import { VoiceCatalog } from "@/components/admin/voice-catalog";
import { CredentialsSection } from "@/components/admin/credentials/credentials-section";

const TABS = [
  { id: "script", label: "Kịch bản" },
  { id: "voice", label: "Giọng đọc" },
  { id: "video", label: "Video" },
  { id: "keys", label: "Khoá nhà cung cấp" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Một trang cho toàn bộ phần AI, thay cho bốn mục menu trước đây.
 *
 * Ba mục cũ (video / voice / script) chỉ khác nhau đúng một tham số `kind`, còn mục Điều
 * phối thì toàn số liệu mô phỏng. Gộp lại thành ba tab để trả lời được câu hỏi thật sự của
 * quản trị viên: **phần nào của sản phẩm đang chạy bằng AI, và cần làm gì tiếp**.
 *
 * Tab nằm trong URL (`?tab=voice`) nên tải lại trang hay gửi link cho người khác đều giữ
 * đúng chỗ đang đứng.
 */
export default function AiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: TabId = TABS.some((item) => item.id === requested)
    ? (requested as TabId)
    : "script";

  return (
    <>
      <AdminPageHeader
        title="AI & Model"
        description="Model dùng cho kịch bản, giọng đọc và video. Mỗi model cần có khoá nhà cung cấp, được xác minh, rồi mới bật được."
      />

      <AdminTabs
        items={TABS}
        active={tab}
        onSelect={(id) => router.replace(`/admin/ai?tab=${id}`, { scroll: false })}
      />

      {tab === "script" ? (
        <>
          <Note>
            <strong className="font-bold">Chưa nối vào sản phẩm.</strong> Kịch bản hiện được
            dựng từ bộ mẫu viết sẵn. Thêm một model và khoá nhà cung cấp ở đây thì bước viết
            kịch bản sẽ chuyển sang dùng model đó, và bộ mẫu lùi về làm phương án dự phòng.
          </Note>
          <ModelsSection kind="script" />
        </>
      ) : null}

      {tab === "voice" ? (
        <>
          <ModelsSection kind="voice" />
          <VoiceCatalog />
        </>
      ) : null}

      {tab === "video" ? (
        <>
          <Note>
            <strong className="font-bold">Chưa nối vào sản phẩm.</strong> Video đang được dựng
            ngay trên máy người dùng bằng Canvas và WebCodecs nên không tốn GPU. Bật nhóm model
            này sẽ đổi hẳn cấu trúc chi phí vì tính tiền theo giây render.
          </Note>
          <ModelsSection kind="video" />
        </>
      ) : null}

      {tab === "keys" ? (
        <>
          <Note>
            Khoá được gọi thử với nhà cung cấp trước khi lưu, mã hoá AES-256-GCM trong
            database và không bao giờ hiển thị lại. Thẻ model ở các tab khác cũng dán khoá
            trực tiếp được.
          </Note>
          <CredentialsSection />
        </>
      ) : null}
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <AdminCard className="border-info/30 bg-info/5">
      <p className="flex items-start gap-2.5 text-sm text-ink">
        <Info size={16} className="mt-0.5 shrink-0 text-info" />
        <span>{children}</span>
      </p>
    </AdminCard>
  );
}
