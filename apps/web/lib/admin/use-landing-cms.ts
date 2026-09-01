"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LANDING_DRAFT_KEY } from "@/config/admin/landing.config";
import {
  fetchLandingSettings,
  publishLandingSettings,
  resetLandingSettings,
  type LandingConfig,
  type LandingSettingView,
} from "./landing-cms-api";

/**
 * Trạng thái dùng chung cho cả 5 trang CMS.
 *
 * Bản nháp nằm trong `localStorage` để sửa dở dang không ảnh hưởng trang chủ; chỉ khi
 * bấm **Xuất bản** cấu hình mới ghi xuống database và khách mới thấy.
 */
export interface LandingCmsState {
  draft: LandingConfig | null;
  server: LandingSettingView | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  /** Bản nháp đang khác bản đã xuất bản. */
  dirty: boolean;
  update: (patch: (current: LandingConfig) => LandingConfig) => void;
  discard: () => void;
  publish: (note?: string) => Promise<boolean>;
  reset: () => Promise<boolean>;
}

const readDraft = (): LandingConfig | null => {
  try {
    const raw = window.localStorage.getItem(LANDING_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as LandingConfig) : null;
  } catch {
    // localStorage hỏng hoặc bị chặn thì coi như chưa có nháp.
    return null;
  }
};

const writeDraft = (config: LandingConfig | null) => {
  try {
    if (config) {
      window.localStorage.setItem(LANDING_DRAFT_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(LANDING_DRAFT_KEY);
    }
  } catch {
    /* không lưu được nháp thì vẫn cho sửa tiếp trong phiên */
  }
};

export function useLandingCms(): LandingCmsState {
  const [server, setServer] = useState<LandingSettingView | null>(null);
  const [draft, setDraft] = useState<LandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const current = await fetchLandingSettings();
      setServer(current);
      // Có nháp dở dang thì ưu tiên nháp, không đè lên công sức đang làm.
      setDraft(readDraft() ?? current.config);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gọi được API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = useCallback((patch: (current: LandingConfig) => LandingConfig) => {
    setDraft((current) => {
      if (!current) return current;
      const next = patch(current);
      writeDraft(next);
      return next;
    });
  }, []);

  const discard = useCallback(() => {
    writeDraft(null);
    setDraft(server?.config ?? null);
  }, [server]);

  const publish = useCallback(
    async (note?: string) => {
      if (!draft) return false;
      setSaving(true);

      try {
        const saved = await publishLandingSettings(draft, note);
        setServer(saved);
        setDraft(saved.config);
        writeDraft(null);
        setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Xuất bản thất bại");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draft],
  );

  const reset = useCallback(async () => {
    setSaving(true);

    try {
      const saved = await resetLandingSettings();
      setServer(saved);
      setDraft(saved.config);
      writeDraft(null);
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Khôi phục thất bại");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const dirty = useMemo(
    () =>
      draft !== null &&
      server !== null &&
      JSON.stringify(draft) !== JSON.stringify(server.config),
    [draft, server],
  );

  return { draft, server, loading, error, saving, dirty, update, discard, publish, reset };
}
