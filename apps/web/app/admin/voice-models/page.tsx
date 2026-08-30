"use client";

import { AdminPageHeader } from "@/components/admin/primitives";
import { ModelsSection } from "@/components/admin/models-section";
import { VoiceCatalog } from "@/components/admin/voice-catalog";

export default function VoiceModelsPage() {
  return (
    <>
      <AdminPageHeader
        title="Giọng nói AI & Chuyển văn bản thành giọng nói"
        description="Quản lý giọng nói AI, cấu hình hoạt động và theo dõi hiệu suất."
      />
      <ModelsSection kind="voice" />
      <VoiceCatalog />
    </>
  );
}
