"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  CDN_OPTIONS,
  PAYMENT_OPTIONS,
  SYSTEM_SETTINGS,
} from "@/config/admin/infra.config";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  ToggleSwitch,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

export default function SettingsPage() {
  const toast = useToast();
  const [maxSize, setMaxSize] = useState(String(SYSTEM_SETTINGS.maxVideoSizeMb));
  const [maxDuration, setMaxDuration] = useState(String(SYSTEM_SETTINGS.maxVideoDurationSec));
  const [watermark, setWatermark] = useState<boolean>(SYSTEM_SETTINGS.freeWatermark);
  const [autoRefund, setAutoRefund] = useState<boolean>(
    SYSTEM_SETTINGS.autoRefundOnRenderFail,
  );
  const [cdn, setCdn] = useState(SYSTEM_SETTINGS.cdnProvider as string);
  const [gateway, setGateway] = useState(SYSTEM_SETTINGS.paymentGateway as string);
  const [maintenance, setMaintenance] = useState<boolean>(SYSTEM_SETTINGS.maintenanceMode);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <AdminPageHeader
        title="Cài đặt chung hệ thống"
        description="Giới hạn xuất video, watermark, CDN, cổng thanh toán và chế độ bảo trì."
        actions={
          <AdminButton variant="primary" onClick={() => toast("Đã lưu cấu hình hệ thống")}>
            Lưu cấu hình
          </AdminButton>
        }
      />

      <AdminCard>
        <h2 className="font-display text-base font-bold text-ink">Giới hạn xuất video</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Dung lượng tối đa (MB)</span>
            <AdminInput ariaLabel="Dung lượng tối đa" value={maxSize} onChange={setMaxSize} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Thời lượng tối đa (giây)</span>
            <AdminInput
              ariaLabel="Thời lượng tối đa"
              value={maxDuration}
              onChange={setMaxDuration}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">Watermark cho tài khoản Free</p>
              <p className="text-xs text-muted">Gói Starter luôn đóng dấu ReelForge lên video.</p>
            </div>
            <ToggleSwitch
              checked={watermark}
              label="Watermark cho tài khoản Free"
              onChange={(next) => {
                setWatermark(next);
                toast(next ? "Đã bật watermark gói Free" : "Đã tắt watermark gói Free", next ? "success" : "warning");
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">Hoàn credits khi render lỗi</p>
              <p className="text-xs text-muted">Tự động trả lại credit nếu job thất bại giữa chừng.</p>
            </div>
            <ToggleSwitch
              checked={autoRefund}
              label="Hoàn credits khi render lỗi"
              onChange={(next) => {
                setAutoRefund(next);
                toast(next ? "Đã bật hoàn credits tự động" : "Đã tắt hoàn credits tự động", next ? "success" : "warning");
              }}
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-display text-base font-bold text-ink">Hạ tầng phân phối & thanh toán</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Máy chủ CDN</span>
            <AdminSelect
              ariaLabel="Máy chủ CDN"
              value={cdn}
              onChange={setCdn}
              options={CDN_OPTIONS}
              className="w-full"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Cổng thanh toán</span>
            <AdminSelect
              ariaLabel="Cổng thanh toán"
              value={gateway}
              onChange={setGateway}
              options={PAYMENT_OPTIONS}
              className="w-full"
            />
          </label>
        </div>
      </AdminCard>

      <AdminCard className={maintenance ? "border-danger/40 bg-danger/5" : ""}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Chế độ bảo trì</h2>
            <p className="mt-0.5 text-xs text-muted">
              Khi bật, toàn bộ người dùng bị chặn khỏi Studio và mọi job render đang chờ sẽ dừng.
            </p>
          </div>

          <ToggleSwitch
            checked={maintenance}
            label="Chế độ bảo trì"
            onChange={(next) => {
              if (next) {
                setConfirmOpen(true);
                return;
              }
              setMaintenance(false);
              toast("Đã tắt chế độ bảo trì, hệ thống hoạt động trở lại");
            }}
          />
        </div>

        {maintenance ? (
          <p className="mt-4 flex items-center gap-2 rounded-btn border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            <AlertTriangle size={14} />
            Hệ thống đang ở chế độ bảo trì — người dùng không truy cập được Studio.
          </p>
        ) : null}
      </AdminCard>

      <AdminModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Bật chế độ bảo trì?"
        description="Mọi người dùng sẽ bị chặn khỏi Studio ngay lập tức."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setConfirmOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton
              variant="danger"
              onClick={() => {
                setMaintenance(true);
                setConfirmOpen(false);
                toast("Đã bật chế độ bảo trì toàn hệ thống", "warning");
              }}
            >
              Bật bảo trì
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Hành động này ghi vào nhật ký ở mức <span className="font-bold text-danger">CRITICAL</span>{" "}
          và gửi cảnh báo cho Super Admin.
        </p>
      </AdminModal>
    </>
  );
}
