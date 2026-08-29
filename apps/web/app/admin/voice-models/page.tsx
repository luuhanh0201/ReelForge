"use client";

import { VOICE_MODELS } from "@/config/admin/models.config";
import { AdminPageHeader } from "@/components/admin/primitives";
import { ModelsSection } from "@/components/admin/models-section";
import { VoiceCatalog } from "@/components/admin/voice-catalog";

export default function VoiceModelsPage() {
  return (
    <>
      <AdminPageHeader
        title="AI Voice & TTS Models"
        description="Động cơ tổng hợp giọng đọc. Bật/tắt, chỉnh tham số và đo độ trễ thực tế của từng nhà cung cấp."
      />
      <ModelsSection kind="voice" initialModels={VOICE_MODELS} />
      <VoiceCatalog />
    </>
  );
}
