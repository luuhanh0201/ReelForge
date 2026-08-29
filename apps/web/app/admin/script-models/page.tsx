"use client";

import { SCRIPT_MODELS, HOOK_RETENTION } from "@/config/admin/models.config";
import { AdminCard, AdminPageHeader } from "@/components/admin/primitives";
import { ModelsSection } from "@/components/admin/models-section";

export default function ScriptModelsPage() {
  return (
    <>
      <AdminPageHeader
        title="AI Script & Hook Generator"
        description="Các LLM sinh kịch bản bán hàng và hook giữ chân. Cấu hình temperature, context window và endpoint."
      />

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">{HOOK_RETENTION.label}</p>
            <p className="mt-0.5 text-xs text-muted">{HOOK_RETENTION.hint}</p>
          </div>
          <p className="font-mono text-3xl font-bold text-brand">
            {HOOK_RETENTION.value}%
          </p>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${HOOK_RETENTION.value}%` }}
          />
        </div>
      </AdminCard>

      <ModelsSection kind="script" initialModels={SCRIPT_MODELS} />
    </>
  );
}
