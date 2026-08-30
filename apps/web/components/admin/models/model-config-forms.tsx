"use client";

import type {
  ModelConfig,
  ModelKind,
  ScriptModelConfig,
  VideoModelConfig,
  VoiceModelConfig,
} from "@/config/admin/models.config";
import { AdminInput, AdminSelect } from "@/components/admin/primitives";

/** Nhãn + ô nhập dùng chung cho ba form cấu hình. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

function EndpointField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field
      label="Endpoint URL"
      hint="Để trống dùng endpoint mặc định của nhà cung cấp; đặt khi cần endpoint theo vùng."
    >
      <AdminInput ariaLabel="Endpoint URL" value={value} onChange={onChange} />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Voice — tham số của TTS, không có token hay temperature              */
/* ------------------------------------------------------------------ */

function VoiceConfigForm({
  config,
  onChange,
}: {
  config: VoiceModelConfig;
  onChange: (next: VoiceModelConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <EndpointField
        value={config.apiEndpoint}
        onChange={(apiEndpoint) => onChange({ ...config, apiEndpoint })}
      />

      <Field
        label="Phiên bản API"
        hint="Chỉ v1beta1 trả timepoints — quyết định karaoke chuẩn hay phải căn lại từ audio."
      >
        <AdminSelect
          ariaLabel="Phiên bản API"
          value={config.apiVersion}
          onChange={(apiVersion) =>
            onChange({ ...config, apiVersion: apiVersion as VoiceModelConfig["apiVersion"] })
          }
          options={[
            { id: "v1", label: "v1 — ổn định, không có timepoints" },
            { id: "v1beta1", label: "v1beta1 — có timepoints cho karaoke" },
          ]}
          className="w-full"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Giới hạn ký tự mỗi request" hint="Google TTS tối đa 5.000.">
          <AdminInput
            ariaLabel="Giới hạn ký tự mỗi request"
            value={String(config.maxCharsPerRequest)}
            onChange={(value) =>
              onChange({ ...config, maxCharsPerRequest: Number(value) || 0 })
            }
          />
        </Field>

        <Field label="Định dạng âm thanh">
          <AdminSelect
            ariaLabel="Định dạng âm thanh"
            value={config.audioEncoding}
            onChange={(audioEncoding) =>
              onChange({
                ...config,
                audioEncoding: audioEncoding as VoiceModelConfig["audioEncoding"],
              })
            }
            options={[
              { id: "MP3", label: "MP3" },
              { id: "LINEAR16", label: "LINEAR16 (WAV)" },
              { id: "OGG_OPUS", label: "OGG_OPUS" },
            ]}
            className="w-full"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Trần ký tự mỗi ngày"
          hint="0 = không giới hạn. Chặn khách hàng spam nghe thử."
        >
          <AdminInput
            ariaLabel="Trần ký tự mỗi ngày"
            value={String(config.dailyCharLimit)}
            onChange={(value) =>
              onChange({ ...config, dailyCharLimit: Number(value) || 0 })
            }
          />
        </Field>

        <Field
          label="Trần ký tự mỗi tháng"
          hint="Đặt bằng hạn mức miễn phí để không bao giờ vượt sang phần trả phí."
        >
          <AdminInput
            ariaLabel="Trần ký tự mỗi tháng"
            value={String(config.monthlyCharLimit)}
            onChange={(value) =>
              onChange({ ...config, monthlyCharLimit: Number(value) || 0 })
            }
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tốc độ đọc mặc định" hint="0.25 – 4">
          <AdminInput
            ariaLabel="Tốc độ đọc mặc định"
            value={String(config.defaultSpeakingRate)}
            onChange={(value) =>
              onChange({ ...config, defaultSpeakingRate: Number(value) || 1 })
            }
          />
        </Field>

        <Field label="Cao độ mặc định" hint="-20 – 20">
          <AdminInput
            ariaLabel="Cao độ mặc định"
            value={String(config.defaultPitch)}
            onChange={(value) => onChange({ ...config, defaultPitch: Number(value) || 0 })}
          />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Video                                                                */
/* ------------------------------------------------------------------ */

const ASPECT_RATIOS: VideoModelConfig["aspectRatios"] = ["9:16", "16:9", "1:1"];

function VideoConfigForm({
  config,
  onChange,
}: {
  config: VideoModelConfig;
  onChange: (next: VideoModelConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <EndpointField
        value={config.apiEndpoint}
        onChange={(apiEndpoint) => onChange({ ...config, apiEndpoint })}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Độ phân giải">
          <AdminSelect
            ariaLabel="Độ phân giải"
            value={config.resolution}
            onChange={(resolution) =>
              onChange({ ...config, resolution: resolution as VideoModelConfig["resolution"] })
            }
            options={[
              { id: "720p", label: "720p" },
              { id: "1080p", label: "1080p" },
              { id: "4K", label: "4K" },
            ]}
            className="w-full"
          />
        </Field>

        <Field label="FPS">
          <AdminSelect
            ariaLabel="FPS"
            value={String(config.fps)}
            onChange={(fps) =>
              onChange({ ...config, fps: Number(fps) as VideoModelConfig["fps"] })
            }
            options={[
              { id: "24", label: "24" },
              { id: "30", label: "30" },
              { id: "60", label: "60" },
            ]}
            className="w-full"
          />
        </Field>

        <Field label="Thời lượng tối đa (giây)">
          <AdminInput
            ariaLabel="Thời lượng tối đa"
            value={String(config.maxDurationSec)}
            onChange={(value) =>
              onChange({ ...config, maxDurationSec: Number(value) || 0 })
            }
          />
        </Field>
      </div>

      <Field label="Tỷ lệ khung hình hỗ trợ">
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((ratio) => {
            const checked = config.aspectRatios.includes(ratio);

            return (
              <button
                key={ratio}
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    aspectRatios: checked
                      ? config.aspectRatios.filter((item) => item !== ratio)
                      : [...config.aspectRatios, ratio],
                  })
                }
                className={`h-9 rounded-btn border px-3 text-xs font-semibold transition-colors ${
                  checked
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line bg-subtle text-muted hover:text-ink"
                }`}
              >
                {ratio}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Script — tham số của LLM                                             */
/* ------------------------------------------------------------------ */

function ScriptConfigForm({
  config,
  onChange,
}: {
  config: ScriptModelConfig;
  onChange: (next: ScriptModelConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <EndpointField
        value={config.apiEndpoint}
        onChange={(apiEndpoint) => onChange({ ...config, apiEndpoint })}
      />

      <Field label="Phiên bản API">
        <AdminInput
          ariaLabel="Phiên bản API"
          value={config.apiVersion}
          onChange={(apiVersion) => onChange({ ...config, apiVersion })}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Max tokens">
          <AdminInput
            ariaLabel="Max tokens"
            value={String(config.maxTokens)}
            onChange={(value) => onChange({ ...config, maxTokens: Number(value) || 0 })}
          />
        </Field>

        <Field label="Temperature" hint="0 – 2">
          <AdminInput
            ariaLabel="Temperature"
            value={String(config.temperature)}
            onChange={(value) => onChange({ ...config, temperature: Number(value) || 0 })}
          />
        </Field>

        <Field label="Top P" hint="Để trống nếu không dùng">
          <AdminInput
            ariaLabel="Top P"
            value={config.topP === null ? "" : String(config.topP)}
            onChange={(value) =>
              onChange({ ...config, topP: value.trim() === "" ? null : Number(value) })
            }
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * Chọn form theo loại model.
 *
 * Đây là chỗ chống lẫn lộn: trang voice không bao giờ thấy `temperature`, trang video
 * không thấy `maxTokens`. Backend cũng từ chối trường sai loại nên hai tầng khớp nhau.
 */
export function ModelConfigForm({
  kind,
  config,
  onChange,
}: {
  kind: ModelKind;
  config: ModelConfig;
  onChange: (next: ModelConfig) => void;
}) {
  if (kind === "voice") {
    return (
      <VoiceConfigForm
        config={config as VoiceModelConfig}
        onChange={(next) => onChange(next)}
      />
    );
  }

  if (kind === "video") {
    return (
      <VideoConfigForm
        config={config as VideoModelConfig}
        onChange={(next) => onChange(next)}
      />
    );
  }

  return (
    <ScriptConfigForm
      config={config as ScriptModelConfig}
      onChange={(next) => onChange(next)}
    />
  );
}
