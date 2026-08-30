"use client";

import { Info } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/primitives";
import { ModelsSection } from "@/components/admin/models-section";

export default function VideoModelsPage() {
  return (
    <>
      <AdminPageHeader
        title="AI Video Models"
        description="Các mô hình sinh và ghép video. Hiện ReelForge dựng video phía trình duyệt nên nhóm này chưa được kích hoạt."
      />

      <AdminCard className="border-info/30 bg-info/5">
        <p className="flex items-start gap-2.5 text-sm text-ink">
          <Info size={16} className="mt-0.5 shrink-0 text-info" />
          <span>
            <strong className="font-bold">Sắp ra mắt.</strong> Pipeline hiện tại render
            video ngay trên máy người dùng bằng Canvas + Web Audio nên không tốn GPU. Bật
            nhóm model này sẽ thay đổi cấu trúc chi phí — cần duyệt ngân sách trước khi mở.
          </span>
        </p>
      </AdminCard>

      <ModelsSection kind="video" />
    </>
  );
}
