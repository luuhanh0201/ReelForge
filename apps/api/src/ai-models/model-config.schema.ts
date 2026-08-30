import { BusinessException } from '../common/exceptions/business.exception.js';
import type { ModelKind } from './ai-model.entity.js';

/* ------------------------------------------------------------------ */
/* Kiểu cấu hình theo từng loại model                                   */
/* ------------------------------------------------------------------ */

export interface VoiceModelConfig {
  /** Rỗng = endpoint toàn cầu của nhà cung cấp; đặt để dùng endpoint theo vùng. */
  apiEndpoint: string;
  /** `v1beta1` là bản duy nhất trả timepoints — quyết định karaoke chuẩn hay phải align lại. */
  apiVersion: 'v1' | 'v1beta1';
  /** Giới hạn thật của Google TTS là 5.000 byte mỗi request. */
  maxCharsPerRequest: number;
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
  defaultSpeakingRate: number;
  defaultPitch: number;
  /** Trần ký tự mỗi ngày cho model này; 0 = không giới hạn. Chặn spam. */
  dailyCharLimit: number;
  /** Trần ký tự mỗi tháng; 0 = không giới hạn. Chặn vỡ ngân sách. */
  monthlyCharLimit: number;
}

export interface VideoModelConfig {
  apiEndpoint: string;
  resolution: '720p' | '1080p' | '4K';
  fps: 24 | 30 | 60;
  maxDurationSec: number;
  aspectRatios: ('9:16' | '16:9' | '1:1')[];
}

export interface ScriptModelConfig {
  apiEndpoint: string;
  apiVersion: string;
  maxTokens: number;
  temperature: number;
  /** Không phải nhà cung cấp nào cũng hỗ trợ, nên để tuỳ chọn. */
  topP: number | null;
}

export type ModelConfig = VoiceModelConfig | VideoModelConfig | ScriptModelConfig;

export const VOICE_CONFIG_DEFAULT: VoiceModelConfig = {
  apiEndpoint: '',
  apiVersion: 'v1',
  maxCharsPerRequest: 5000,
  audioEncoding: 'MP3',
  defaultSpeakingRate: 1,
  defaultPitch: 0,
  // Mặc định bằng hạn mức miễn phí của Chirp 3 HD: chạm trần là hết phần miễn phí,
  // chưa mất tiền. Đặt 0 nếu chấp nhận trả phí vượt.
  dailyCharLimit: 50_000,
  monthlyCharLimit: 1_000_000,
};

export const VIDEO_CONFIG_DEFAULT: VideoModelConfig = {
  apiEndpoint: '',
  resolution: '1080p',
  fps: 30,
  maxDurationSec: 60,
  aspectRatios: ['9:16'],
};

export const SCRIPT_CONFIG_DEFAULT: ScriptModelConfig = {
  apiEndpoint: '',
  apiVersion: 'v1',
  maxTokens: 8192,
  temperature: 0.7,
  topP: null,
};

/* ------------------------------------------------------------------ */
/* Công cụ kiểm tra dùng chung                                          */
/* ------------------------------------------------------------------ */

const invalid = (field: string, reason: string): BusinessException =>
  new BusinessException('VALIDATION_FAILED', {
    message: `Trường cấu hình "${field}" ${reason}`,
  });

const asRecord = (input: unknown, kind: string): Record<string, unknown> => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BusinessException('VALIDATION_FAILED', {
      message: `Cấu hình của model ${kind} phải là một object`,
    });
  }
  return input as Record<string, unknown>;
};

/** Chặn trường lạ để cấu hình của loại này không lẫn sang loại khác. */
const rejectUnknown = (
  source: Record<string, unknown>,
  allowed: readonly string[],
  kind: string,
): void => {
  const unknownKeys = Object.keys(source).filter((key) => !allowed.includes(key));

  if (unknownKeys.length > 0) {
    throw new BusinessException('VALIDATION_FAILED', {
      message: `Model ${kind} không có trường cấu hình: ${unknownKeys.join(', ')}`,
    });
  }
};

const optionalText = (
  source: Record<string, unknown>,
  field: string,
  fallback: string,
  maxLength = 300,
): string => {
  const value = source[field];
  if (value === undefined || value === null) return fallback;

  if (typeof value !== 'string') throw invalid(field, 'phải là chuỗi');
  if (value.trim().length > maxLength) {
    throw invalid(field, `vượt quá ${maxLength} ký tự`);
  }
  return value.trim();
};

const enumValue = <T extends string | number>(
  source: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  fallback: T,
): T => {
  const value = source[field];
  if (value === undefined || value === null) return fallback;

  // Số gửi qua JSON có thể là chuỗi ("30"), quy về đúng kiểu của danh sách cho phép.
  const normalized =
    typeof allowed[0] === 'number' && typeof value === 'string' ? Number(value) : value;

  if (!allowed.includes(normalized as T)) {
    throw invalid(field, `chỉ nhận: ${allowed.join(', ')}`);
  }
  return normalized as T;
};

const numberInRange = (
  source: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
  fallback: number,
  integer = false,
): number => {
  const value = source[field];
  if (value === undefined || value === null) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw invalid(field, 'phải là số');
  if (integer && !Number.isInteger(parsed)) throw invalid(field, 'phải là số nguyên');
  if (parsed < min || parsed > max) {
    throw invalid(field, `phải nằm trong khoảng ${min} – ${max}`);
  }
  return parsed;
};

/* ------------------------------------------------------------------ */
/* Parser cho từng loại — dùng khi GHI                                  */
/* ------------------------------------------------------------------ */

const VOICE_FIELDS = Object.keys(VOICE_CONFIG_DEFAULT);
const VIDEO_FIELDS = Object.keys(VIDEO_CONFIG_DEFAULT);
const SCRIPT_FIELDS = Object.keys(SCRIPT_CONFIG_DEFAULT);

const parseVoiceConfig = (input: unknown): VoiceModelConfig => {
  const source = asRecord(input, 'voice');
  rejectUnknown(source, VOICE_FIELDS, 'voice');

  return {
    apiEndpoint: optionalText(source, 'apiEndpoint', VOICE_CONFIG_DEFAULT.apiEndpoint),
    apiVersion: enumValue(source, 'apiVersion', ['v1', 'v1beta1'] as const, 'v1'),
    maxCharsPerRequest: numberInRange(source, 'maxCharsPerRequest', 1, 5000, 5000, true),
    audioEncoding: enumValue(
      source,
      'audioEncoding',
      ['MP3', 'LINEAR16', 'OGG_OPUS'] as const,
      'MP3',
    ),
    defaultSpeakingRate: numberInRange(source, 'defaultSpeakingRate', 0.25, 4, 1),
    defaultPitch: numberInRange(source, 'defaultPitch', -20, 20, 0),
    dailyCharLimit: numberInRange(
      source,
      'dailyCharLimit',
      0,
      1_000_000_000,
      VOICE_CONFIG_DEFAULT.dailyCharLimit,
      true,
    ),
    monthlyCharLimit: numberInRange(
      source,
      'monthlyCharLimit',
      0,
      1_000_000_000,
      VOICE_CONFIG_DEFAULT.monthlyCharLimit,
      true,
    ),
  };
};

const parseVideoConfig = (input: unknown): VideoModelConfig => {
  const source = asRecord(input, 'video');
  rejectUnknown(source, VIDEO_FIELDS, 'video');

  const ratios = source.aspectRatios;
  let aspectRatios = VIDEO_CONFIG_DEFAULT.aspectRatios;

  if (ratios !== undefined && ratios !== null) {
    if (!Array.isArray(ratios) || ratios.length === 0) {
      throw invalid('aspectRatios', 'phải là mảng có ít nhất một tỷ lệ');
    }

    const allowed = ['9:16', '16:9', '1:1'];
    for (const ratio of ratios) {
      if (typeof ratio !== 'string' || !allowed.includes(ratio)) {
        throw invalid('aspectRatios', `chỉ nhận: ${allowed.join(', ')}`);
      }
    }
    aspectRatios = [...new Set(ratios as VideoModelConfig['aspectRatios'])];
  }

  return {
    apiEndpoint: optionalText(source, 'apiEndpoint', VIDEO_CONFIG_DEFAULT.apiEndpoint),
    resolution: enumValue(source, 'resolution', ['720p', '1080p', '4K'] as const, '1080p'),
    fps: enumValue(source, 'fps', [24, 30, 60] as const, 30),
    maxDurationSec: numberInRange(source, 'maxDurationSec', 1, 600, 60, true),
    aspectRatios,
  };
};

const parseScriptConfig = (input: unknown): ScriptModelConfig => {
  const source = asRecord(input, 'script');
  rejectUnknown(source, SCRIPT_FIELDS, 'script');

  const topP = source.topP;

  return {
    apiEndpoint: optionalText(source, 'apiEndpoint', SCRIPT_CONFIG_DEFAULT.apiEndpoint),
    apiVersion: optionalText(source, 'apiVersion', SCRIPT_CONFIG_DEFAULT.apiVersion, 40),
    maxTokens: numberInRange(source, 'maxTokens', 1, 10_000_000, 8192, true),
    temperature: numberInRange(source, 'temperature', 0, 2, 0.7),
    topP: topP === undefined || topP === null ? null : numberInRange(source, 'topP', 0, 1, 1),
  };
};

/** Kiểm tra nghiêm ngặt — dùng khi admin ghi cấu hình. */
export const parseModelConfig = (kind: ModelKind, input: unknown): ModelConfig => {
  switch (kind) {
    case 'voice':
      return parseVoiceConfig(input ?? {});
    case 'video':
      return parseVideoConfig(input ?? {});
    case 'script':
      return parseScriptConfig(input ?? {});
  }
};

/**
 * Đọc cấu hình đã lưu — **khoan dung**: bản ghi cũ thiếu trường hoặc có trường lạ vẫn
 * đọc được, chỉ điền mặc định. Nghiêm ngặt lúc ghi, khoan dung lúc đọc; nếu không một
 * bản ghi cũ sẽ làm vỡ cả trang danh sách.
 */
export const readModelConfig = (kind: ModelKind, stored: unknown): ModelConfig => {
  const source =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const allowed =
    kind === 'voice' ? VOICE_FIELDS : kind === 'video' ? VIDEO_FIELDS : SCRIPT_FIELDS;
  const cleaned: Record<string, unknown> = {};

  for (const field of allowed) {
    if (source[field] !== undefined) cleaned[field] = source[field];
  }

  try {
    return parseModelConfig(kind, cleaned);
  } catch {
    // Giá trị hỏng nằm ngoài khoảng cho phép -> trả về mặc định thay vì ném lỗi.
    return kind === 'voice'
      ? { ...VOICE_CONFIG_DEFAULT }
      : kind === 'video'
        ? { ...VIDEO_CONFIG_DEFAULT }
        : { ...SCRIPT_CONFIG_DEFAULT };
  }
};

/* ------------------------------------------------------------------ */
/* Chi phí                                                              */
/* ------------------------------------------------------------------ */

export const COST_UNITS = [
  'per_million_chars',
  'per_second',
  'per_million_input_tokens',
  'contract',
] as const;

export type CostUnit = (typeof COST_UNITS)[number];

export interface ModelCost {
  amount: number;
  unit: CostUnit;
  /** Số đơn vị cơ sở miễn phí mỗi tháng (ký tự / giây / token). */
  freeTierAmount: number | null;
}

export const COST_DEFAULT: ModelCost = {
  amount: 0,
  unit: 'contract',
  freeTierAmount: null,
};

export const parseModelCost = (input: unknown): ModelCost => {
  const source = asRecord(input ?? {}, 'chi phí');
  rejectUnknown(source, ['amount', 'unit', 'freeTierAmount'], 'chi phí');

  const unit = enumValue(source, 'unit', COST_UNITS, 'contract');
  const freeTier = source.freeTierAmount;

  return {
    // Tính theo hợp đồng thì con số đơn giá không có ý nghĩa.
    amount: unit === 'contract' ? 0 : numberInRange(source, 'amount', 0, 1_000_000, 0),
    unit,
    freeTierAmount:
      freeTier === undefined || freeTier === null
        ? null
        : numberInRange(source, 'freeTierAmount', 0, 1_000_000_000_000, 0),
  };
};

const UNIT_LABEL: Record<CostUnit, string> = {
  per_million_chars: '1M ký tự',
  per_second: 'giây',
  per_million_input_tokens: '1M token vào',
  contract: '',
};

/** 1000000 -> "1M", 100000 -> "100K" */
const compact = (value: number): string => {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(2))}K`;
  return String(value);
};

/** Chuỗi hiển thị sinh từ dữ liệu, không lưu trong database. */
export const formatModelCost = (cost: ModelCost): string => {
  if (cost.unit === 'contract') return 'Theo hợp đồng';

  const price = `$${Number(cost.amount.toFixed(4))} / ${UNIT_LABEL[cost.unit]}`;

  return cost.freeTierAmount && cost.freeTierAmount > 0
    ? `${price} · ${compact(cost.freeTierAmount)} miễn phí/tháng`
    : price;
};
