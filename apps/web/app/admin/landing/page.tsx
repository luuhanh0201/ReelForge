"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LandingCmsPage, CMS_TABS, type CmsTab } from "@/components/admin/landing/cms-page";

/**
 * Một trang cho toàn bộ CMS Landing Page, thay cho năm mục menu trước đây.
 *
 * Năm route cũ chỉ khác nhau đúng giá trị `tab` truyền vào `LandingCmsPage` — cùng header,
 * cùng bản nháp, cùng khung xem trước. Gộp lại thì menu ngắn đi năm dòng mà không mất chức
 * năng nào: tab vẫn nằm trong URL nên link cũ và bookmark vẫn dẫn đúng chỗ.
 */
export default function LandingAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: CmsTab = CMS_TABS.some((item) => item.id === requested)
    ? (requested as CmsTab)
    : "all";

  return (
    <LandingCmsPage
      tab={tab}
      onTabChange={(next) => router.replace(`/admin/landing?tab=${next}`, { scroll: false })}
    />
  );
}
