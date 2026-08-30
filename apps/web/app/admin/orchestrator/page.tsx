"use client";

import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Plus, Trash2, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import {
  COST_LIMITS,
  DEFAULT_ROUTING,
  ROUTING_STRATEGIES,
  type AiModel,
  type RoutingRule,
} from "@/config/admin/models.config";
import { fetchAiModels } from "@/lib/admin/ai-models-api";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  Pill,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

type StrategyId = (typeof ROUTING_STRATEGIES)[number]["id"];

const TIER_LABEL = ["Ưu tiên 1 (mặc định)", "Dự phòng 1", "Dự phòng 2", "Dự phòng 3"];

export default function OrchestratorPage() {
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [strategy, setStrategy] = useState<StrategyId>("cost");
  const [rules, setRules] = useState<RoutingRule[]>(DEFAULT_ROUTING);
  const [dragging, setDragging] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pickedModel, setPickedModel] = useState("");
  const [budget, setBudget] = useState(String(COST_LIMITS.dailyBudgetUsd));
  const [threshold, setThreshold] = useState(String(COST_LIMITS.alertThresholdPercent));
  // Danh sách model lấy từ database; phần chuỗi định tuyến bên dưới vẫn là mock.
  const [scriptModels, setScriptModels] = useState<AiModel[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAiModels("script")
        .then(setScriptModels)
        .catch(() => setScriptModels([]));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const spentPercent = Math.min(
    100,
    Math.round((COST_LIMITS.spentTodayUsd / Number(budget || 1)) * 100),
  );
  const overThreshold = spentPercent >= Number(threshold || 100);

  const available = scriptModels.filter(
    (model) => !rules.some((rule) => rule.modelId === model.id),
  );

  const addRule = () => {
    const model = scriptModels.find((item) => item.id === pickedModel);
    if (!model) {
      toast("Chọn một model để thêm vào chuỗi dự phòng", "warning");
      return;
    }

    setRules((current) => [
      ...current,
      {
        id: `r-${Date.now()}`,
        modelId: model.id,
        name: model.name,
        note: `Dự phòng bổ sung · ${model.vendor}`,
      },
    ]);
    setPickedModel("");
    setAddOpen(false);
    toast(`Đã thêm ${model.name} vào cuối chuỗi dự phòng`);
  };

  const removeRule = (rule: RoutingRule) => {
    if (rules.length <= 1) {
      toast("Phải giữ ít nhất một model trong chuỗi định tuyến", "warning");
      return;
    }

    setRules((current) => current.filter((item) => item.id !== rule.id));
    toast(`Đã bỏ ${rule.name} khỏi chuỗi định tuyến`, "warning");
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rules.length) return;

    setRules((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <>
      <AdminPageHeader
        title="Điều phối AI & Phân luồng"
        description="Thứ tự ưu tiên model và cơ chế chuyển dự phòng khi nhà cung cấp chính gặp sự cố."
        actions={
          <AdminButton
            variant="primary"
            onClick={() => toast("Đã áp dụng quy tắc điều phối mới")}
          >
            Lưu quy tắc
          </AdminButton>
        }
      />

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Chiến lược định tuyến</h2>
            <p className="mt-0.5 text-xs text-muted">
              Áp dụng cho mọi request sinh kịch bản và giọng đọc.
            </p>
          </div>

          <AdminSelect
            ariaLabel="Chiến lược định tuyến"
            value={strategy}
            onChange={(value) => {
              setStrategy(value);
              toast(
                `Chuyển sang chiến lược: ${ROUTING_STRATEGIES.find((item) => item.id === value)?.label}`,
                "info",
              );
            }}
            options={ROUTING_STRATEGIES.map((item) => ({ id: item.id, label: item.label }))}
          />
        </div>
      </AdminCard>

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Thứ tự ưu tiên model</h2>
            <p className="mt-0.5 text-xs text-muted">
              Kéo thả hoặc dùng nút mũi tên · fallback trong &lt;{" "}
              {COST_LIMITS.fallbackTimeoutMs}ms
            </p>
          </div>

          <AdminButton
            onClick={() => {
              setPickedModel(available[0]?.id ?? "");
              setAddOpen(true);
            }}
            disabled={available.length === 0}
          >
            <Plus size={14} />
            Thêm bước dự phòng
          </AdminButton>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {rules.map((rule, index) => (
            <motion.li
              key={rule.id}
              layout="position"
              transition={
                reduceMotion
                  ? { layout: { duration: 0 } }
                  : { layout: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }
              }
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragging !== null) move(dragging, index);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              className={`flex items-center gap-3 rounded-card border bg-canvas p-3 transition-colors ${
                dragging === index ? "border-brand" : "border-line"
              }`}
            >
              <GripVertical size={16} className="shrink-0 cursor-grab text-muted" />

              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-brand/12 font-mono text-sm font-bold text-brand">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {rule.name}
                  <Pill accent={index === 0 ? "brand" : "info"}>
                    {TIER_LABEL[index] ?? `Dự phòng ${index}`}
                  </Pill>
                </p>
                <p className="mt-0.5 text-xs text-muted">{rule.note}</p>
              </div>

              <div className="flex shrink-0 gap-1">
                <AdminButton
                  variant="ghost"
                  title="Đẩy lên một bậc ưu tiên"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  className="w-9 px-0"
                >
                  <ArrowUp size={15} />
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  title="Hạ xuống một bậc ưu tiên"
                  onClick={() => move(index, index + 1)}
                  disabled={index === rules.length - 1}
                  className="w-9 px-0"
                >
                  <ArrowDown size={15} />
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  title="Gỡ khỏi chuỗi dự phòng"
                  onClick={() => removeRule(rule)}
                  className="w-9 px-0"
                >
                  <Trash2 size={15} />
                </AdminButton>
              </div>
            </motion.li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="font-display text-base font-bold text-ink">Hạn mức ngân sách an toàn</h2>
        <p className="mt-0.5 text-xs text-muted">
          Chạm ngưỡng cảnh báo, hệ thống gửi thông báo qua {COST_LIMITS.channels.join(" và ")}.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Ngân sách API mỗi ngày (USD)</span>
            <AdminInput ariaLabel="Ngân sách mỗi ngày" value={budget} onChange={setBudget} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Ngưỡng cảnh báo (%)</span>
            <AdminInput ariaLabel="Ngưỡng cảnh báo" value={threshold} onChange={setThreshold} />
          </label>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between font-mono text-xs">
            <span className="text-muted">Đã dùng hôm nay</span>
            <span className="font-bold text-ink">
              ${COST_LIMITS.spentTodayUsd.toFixed(2)} / ${budget} ({spentPercent}%)
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-subtle">
            <div
              className={`h-full rounded-full ${overThreshold ? "bg-danger" : "bg-mint"}`}
              style={{ width: `${spentPercent}%` }}
            />
          </div>

          {overThreshold ? (
            <p className="mt-3 flex items-center gap-2 rounded-btn border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
              <AlertTriangle size={14} />
              Đã vượt ngưỡng {threshold}% — cảnh báo đã gửi cho Super Admin.
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Zap size={14} className="text-mint" />
              Còn ${(Number(budget) - COST_LIMITS.spentTodayUsd).toFixed(2)} trong hạn mức hôm nay.
            </p>
          )}
        </div>
      </AdminCard>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm bước dự phòng"
        description="Model được thêm vào cuối chuỗi, chỉ chạy khi các bước trước đều lỗi."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={addRule}>
              Thêm vào chuỗi
            </AdminButton>
          </>
        }
      >
        {available.length === 0 ? (
          <p className="text-sm text-muted">
            Mọi model sinh kịch bản đã nằm trong chuỗi định tuyến.
          </p>
        ) : (
          <AdminSelect
            ariaLabel="Chọn model dự phòng"
            value={pickedModel}
            onChange={setPickedModel}
            options={available.map((model) => ({ id: model.id, label: model.name }))}
            className="w-full"
          />
        )}
      </AdminModal>
    </>
  );
}
