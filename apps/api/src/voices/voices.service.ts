import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { GOOGLE_TTS_PROVIDER } from '../provider-credentials/provider-credential.entity.js';
import { GoogleTtsCredentialVerifierService } from '../provider-credentials/google-tts-credential-verifier.service.js';
import {
  GoogleTtsSynthesisService,
  MAX_SAMPLE_CHARS,
} from '../provider-credentials/google-tts-synthesis.service.js';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service.js';
import { AiModel } from '../ai-models/ai-model.entity.js';
import {
  readModelConfig,
  type VoiceModelConfig,
} from '../ai-models/model-config.schema.js';
import { TtsUsageService } from '../tts-usage/tts-usage.service.js';
import { VoicePreview } from './voice-preview.entity.js';
import { DEFAULT_SAMPLE_TEXT, Voice, type VoiceGender } from './voice.entity.js';

/** Hình dạng trả về cho admin — numeric của Postgres đã đổi sang number. */
export interface VoiceView {
  id: string;
  personaName: string;
  originName: string;
  providerVoiceId: string;
  modelId: string;
  gender: VoiceGender;
  region: string;
  speed: number;
  usageCount: number;
  supportsTimepoints: boolean;
  costPerMillionUsd: number;
  durationSec: number;
  enabled: boolean;
  verifiedAt: string | null;
  verificationNote: string | null;
  sampleText: string;
}

/**
 * Giọng đọc nhìn từ phía người dùng cuối.
 *
 * Cố ý **không** trả `providerVoiceId`, giá vốn hay lượt dùng: đó là dữ liệu vận hành,
 * không phải thứ khách hàng cần thấy, và lộ ID nhà cung cấp là lộ luôn ta đang mua của ai.
 */
export interface StudioVoiceView {
  id: string;
  personaName: string;
  gender: VoiceGender;
  region: string;
  /** Giọng không trả timepoint thì phụ đề phải chia theo độ dài ký tự. */
  supportsTimepoints: boolean;
  sampleText: string;
}

export interface VoiceInput {
  personaName: string;
  originName?: string;
  providerVoiceId: string;
  modelId: string;
  gender: VoiceGender;
  region?: string;
  speed?: number;
  supportsTimepoints?: boolean;
  costPerMillionUsd?: number;
  durationSec?: number;
  sampleText?: string;
}

/** Chặn bấm nghe thử liên tục: mỗi lần đều tính tiền theo số ký tự. */
const PREVIEW_COOLDOWN_MS = 3000;

const GENDERS: VoiceGender[] = ['female', 'male'];

/**
 * Giá niêm yết Google Cloud TTS theo dòng giọng (USD / 1 triệu ký tự).
 * Chỉ là giá trị điền sẵn khi nhập — Google đổi giá thì sửa lại ở đây hoặc sửa tay
 * từng giọng trong admin.
 */
const COST_BY_TIER: { match: RegExp; costUsd: number; timepoints: boolean }[] = [
  { match: /-Chirp3-HD-/i, costUsd: 30, timepoints: false },
  { match: /-Chirp-HD-/i, costUsd: 30, timepoints: false },
  { match: /-Studio-/i, costUsd: 160, timepoints: false },
  { match: /-Journey-/i, costUsd: 30, timepoints: false },
  { match: /-Neural2-/i, costUsd: 16, timepoints: true },
  { match: /-Polyglot-/i, costUsd: 16, timepoints: true },
  { match: /-Wavenet-/i, costUsd: 16, timepoints: true },
  { match: /-Standard-/i, costUsd: 4, timepoints: true },
];

/** Giọng Chirp/Studio không trả timepoint nên karaoke phải forced-align lại. */
const describeTier = (voiceName: string) =>
  COST_BY_TIER.find((tier) => tier.match.test(voiceName)) ?? {
    costUsd: 0,
    timepoints: false,
  };

const GENDER_BY_SSML: Record<string, VoiceGender> = {
  FEMALE: 'female',
  MALE: 'male',
};

const invalid = (message: string): BusinessException =>
  new BusinessException('VALIDATION_FAILED', { message });

@Injectable()
export class VoicesService {
  private readonly logger = new Logger(VoicesService.name);

  constructor(
    @InjectRepository(Voice) private readonly repository: Repository<Voice>,
    @InjectRepository(AiModel) private readonly models: Repository<AiModel>,
    @InjectRepository(VoicePreview)
    private readonly previews: Repository<VoicePreview>,
    private readonly credentials: ProviderCredentialsService,
    private readonly googleTts: GoogleTtsCredentialVerifierService,
    private readonly synthesis: GoogleTtsSynthesisService,
    private readonly usage: TtsUsageService,
    private readonly auditLogs: AuditLogService,
  ) {}

  private readonly lastPreviewAt = new Map<string, number>();

  /** `numeric` được driver trả về dạng chuỗi để không mất độ chính xác. */
  private view(voice: Voice): VoiceView {
    return {
      id: voice.id,
      personaName: voice.personaName,
      originName: voice.originName,
      providerVoiceId: voice.providerVoiceId,
      modelId: voice.modelId,
      gender: voice.gender,
      region: voice.region,
      speed: Number(voice.speed),
      usageCount: voice.usageCount,
      supportsTimepoints: voice.supportsTimepoints,
      costPerMillionUsd: Number(voice.costPerMillionUsd),
      durationSec: voice.durationSec,
      enabled: voice.enabled,
      verifiedAt: voice.verifiedAt?.toISOString() ?? null,
      verificationNote: voice.verificationNote,
      sampleText: voice.sampleText,
    };
  }

  private parse(input: Partial<VoiceInput>, partial: boolean): Partial<Voice> {
    const result: Partial<Voice> = {};

    const text = (value: unknown, field: string, max: number): string => {
      if (typeof value !== 'string' || value.trim() === '') {
        throw invalid(`Trường "${field}" không được để trống`);
      }
      if (value.trim().length > max) {
        throw invalid(`Trường "${field}" vượt quá ${max} ký tự`);
      }
      return value.trim();
    };

    if (input.personaName !== undefined || !partial) {
      result.personaName = text(input.personaName, 'personaName', 120);
    }
    if (input.providerVoiceId !== undefined || !partial) {
      result.providerVoiceId = text(input.providerVoiceId, 'providerVoiceId', 160);
    }
    if (input.modelId !== undefined || !partial) {
      result.modelId = text(input.modelId, 'modelId', 60);
    }
    if (input.gender !== undefined || !partial) {
      if (!GENDERS.includes(input.gender as VoiceGender)) {
        throw invalid('Trường "gender" chỉ nhận "female" hoặc "male"');
      }
      result.gender = input.gender as VoiceGender;
    }

    if (input.originName !== undefined) {
      result.originName = input.originName.trim() || result.personaName || '';
    }
    if (input.region !== undefined) {
      result.region = input.region.trim() || 'Chưa phân loại';
    }
    if (input.speed !== undefined) {
      const speed = Number(input.speed);
      if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) {
        throw invalid('Tốc độ đọc phải nằm trong khoảng 0.25 – 4');
      }
      result.speed = speed.toFixed(2);
    }
    if (input.supportsTimepoints !== undefined) {
      result.supportsTimepoints = Boolean(input.supportsTimepoints);
    }
    if (input.costPerMillionUsd !== undefined) {
      const cost = Number(input.costPerMillionUsd);
      if (!Number.isFinite(cost) || cost < 0) {
        throw invalid('Chi phí phải là số không âm');
      }
      result.costPerMillionUsd = cost.toFixed(2);
    }
    if (input.sampleText !== undefined) {
      const sample = input.sampleText.trim();
      if (sample === '') {
        throw invalid('Câu thoại nghe thử không được để trống');
      }
      if (sample.length > MAX_SAMPLE_CHARS) {
        throw invalid(`Câu thoại nghe thử tối đa ${MAX_SAMPLE_CHARS} ký tự`);
      }
      result.sampleText = sample;
    }
    if (input.durationSec !== undefined) {
      const duration = Number(input.durationSec);
      if (!Number.isInteger(duration) || duration < 0) {
        throw invalid('Thời lượng mẫu phải là số nguyên không âm');
      }
      result.durationSec = duration;
    }

    return result;
  }

  private async findOrFail(id: string): Promise<Voice> {
    const voice = await this.repository.findOne({ where: { id } });
    if (!voice) {
      throw new BusinessException('NOT_FOUND', { message: 'Không tìm thấy giọng đọc' });
    }
    return voice;
  }

  async list(): Promise<VoiceView[]> {
    const voices = await this.repository.find({
      order: { enabled: 'DESC', usageCount: 'DESC', personaName: 'ASC' },
    });

    return voices.map((voice) => this.view(voice));
  }

  /** Chỉ giọng admin đã bật. Giọng chưa nghe thử không được lọt ra trang dựng video. */
  async listEnabled(): Promise<StudioVoiceView[]> {
    const voices = await this.repository.find({
      where: { enabled: true },
      order: { region: 'ASC', personaName: 'ASC' },
    });

    return voices.map((voice) => ({
      id: voice.id,
      personaName: voice.personaName,
      gender: voice.gender,
      region: voice.region,
      supportsTimepoints: voice.supportsTimepoints,
      sampleText: voice.sampleText,
    }));
  }

  /** Giọng mới luôn tắt sẵn để buộc nghe thử trước khi mở cho người dùng. */
  async create(input: VoiceInput, ip: string | null): Promise<VoiceView> {
    const fields = this.parse(input, false);

    const duplicate = await this.repository.findOne({
      where: { providerVoiceId: fields.providerVoiceId! },
    });
    if (duplicate) {
      throw new BusinessException('CONFLICT', {
        message: `ID giọng "${fields.providerVoiceId}" đã tồn tại trong danh mục`,
      });
    }

    const voice = this.repository.create({
      originName: fields.personaName,
      region: 'Chưa phân loại',
      sampleText: DEFAULT_SAMPLE_TEXT,
      ...fields,
      usageCount: 0,
      enabled: false,
    });
    const saved = await this.repository.save(voice);

    await this.auditLogs.record({
      action: 'Thêm giọng đọc',
      target: `${saved.personaName} · ${saved.providerVoiceId}`,
      level: 'info',
      ip,
    });

    return this.view(saved);
  }

  async update(id: string, input: Partial<VoiceInput>, ip: string | null): Promise<VoiceView> {
    const voice = await this.findOrFail(id);
    const fields = this.parse(input, true);

    if (fields.providerVoiceId && fields.providerVoiceId !== voice.providerVoiceId) {
      const duplicate = await this.repository.findOne({
        where: { providerVoiceId: fields.providerVoiceId },
      });
      if (duplicate) {
        throw new BusinessException('CONFLICT', {
          message: `ID giọng "${fields.providerVoiceId}" đã thuộc về giọng khác`,
        });
      }
    }

    if (fields.providerVoiceId && fields.providerVoiceId !== voice.providerVoiceId) {
      // Đổi ID giọng thì kết quả xác minh cũ không còn nói lên điều gì.
      voice.verifiedAt = null;
      voice.verificationNote = null;
    }

    Object.assign(voice, fields);
    const saved = await this.repository.save(voice);

    await this.auditLogs.record({
      action: 'Cập nhật giọng đọc',
      target: `${saved.personaName} · ${saved.providerVoiceId}`,
      level: 'info',
      ip,
    });

    return this.view(saved);
  }

  /**
   * Danh mục giọng Google đang cung cấp cho một ngôn ngữ, kèm cờ đã nhập hay chưa.
   * Đây là nguồn duy nhất đúng: gõ tay `provider_voice_id` rất dễ sai một ký tự.
   */
  async listProviderCatalog(languageCode = 'vi-VN'): Promise<{
    languageCode: string;
    items: {
      providerVoiceId: string;
      gender: VoiceGender | null;
      tierCostUsd: number;
      supportsTimepoints: boolean;
      imported: boolean;
    }[];
  }> {
    const { account } = await this.credentials.loadAccount(GOOGLE_TTS_PROVIDER);
    const result = await this.googleTts.verify(account, languageCode);

    const existing = new Set(
      (await this.repository.find({ select: { providerVoiceId: true } })).map(
        (voice) => voice.providerVoiceId,
      ),
    );

    return {
      languageCode,
      items: result.voices
        .map((voice) => {
          const tier = describeTier(voice.name);

          return {
            providerVoiceId: voice.name,
            gender: GENDER_BY_SSML[voice.ssmlGender] ?? null,
            tierCostUsd: tier.costUsd,
            supportsTimepoints: tier.timepoints,
            imported: existing.has(voice.name),
          };
        })
        .sort((left, right) => left.providerVoiceId.localeCompare(right.providerVoiceId)),
    };
  }

  /**
   * Nhập hàng loạt giọng từ danh mục Google.
   *
   * Giọng nhập theo đường này được đánh dấu **đã xác minh sẵn** vì chính Google vừa
   * liệt kê chúng ra; vẫn tạo ở trạng thái tắt để người vận hành nghe thử trước.
   */
  async importFromProvider(
    providerVoiceIds: string[],
    modelId: string,
    languageCode: string,
    ip: string | null,
  ): Promise<{ imported: number; skipped: number }> {
    if (!Array.isArray(providerVoiceIds) || providerVoiceIds.length === 0) {
      throw invalid('Chọn ít nhất một giọng để nhập');
    }
    if (typeof modelId !== 'string' || modelId.trim() === '') {
      throw invalid('Thiếu model để gán cho giọng nhập vào');
    }

    const catalog = await this.listProviderCatalog(languageCode);
    const byId = new Map(catalog.items.map((item) => [item.providerVoiceId, item]));
    const now = new Date();
    let imported = 0;
    let skipped = 0;

    for (const providerVoiceId of providerVoiceIds) {
      const source = byId.get(providerVoiceId);

      if (!source || source.imported) {
        skipped += 1;
        continue;
      }

      const voice = new Voice();
      // Tên hiển thị tạm lấy đoạn cuối của ID ("...-Achernar" -> "Achernar"),
      // người vận hành đổi thành tên persona tiếng Việt sau.
      voice.personaName = providerVoiceId.split('-').pop() ?? providerVoiceId;
      voice.originName = providerVoiceId;
      voice.providerVoiceId = providerVoiceId;
      voice.modelId = modelId.trim();
      voice.gender = source.gender ?? 'female';
      voice.region = 'Chưa phân loại';
      voice.speed = '1.00';
      voice.usageCount = 0;
      voice.supportsTimepoints = source.supportsTimepoints;
      voice.costPerMillionUsd = source.tierCostUsd.toFixed(2);
      voice.durationSec = 0;
      voice.sampleText = DEFAULT_SAMPLE_TEXT;
      voice.enabled = false;
      voice.verifiedAt = now;
      voice.verificationNote = `Nhập trực tiếp từ danh mục Google (${languageCode})`;

      await this.repository.save(voice);
      imported += 1;
    }

    await this.auditLogs.record({
      action: 'Nhập giọng đọc từ nhà cung cấp',
      target: `${languageCode} · ${imported} giọng`,
      level: 'info',
      ip,
      metadata: { imported, skipped, modelId },
    });

    return { imported, skipped };
  }

  /**
   * Đối chiếu `provider_voice_id` với danh sách giọng Google thật sự cung cấp.
   * Đây là chỗ trả lời câu "nhà cung cấp có chấp nhận giọng này không" — gõ sai một
   * ký tự trong `vi-VN-Chirp3-HD-Achernar` là hỏng lúc render, phát hiện sớm ở đây.
   */
  async verify(id: string, ip: string | null): Promise<VoiceView> {
    const voice = await this.findOrFail(id);
    const { account } = await this.credentials.loadAccount(GOOGLE_TTS_PROVIDER);

    // Ngôn ngữ suy từ chính ID giọng: "vi-VN-Chirp3-HD-Achernar" -> "vi-VN".
    const languageCode = voice.providerVoiceId.split('-').slice(0, 2).join('-');
    const result = await this.googleTts.verify(account, languageCode);
    const accepted = result.voiceNames.includes(voice.providerVoiceId);

    voice.verifiedAt = accepted ? new Date() : null;
    voice.verificationNote = accepted
      ? `Google xác nhận giọng này tồn tại (${languageCode})`
      : `Google không có giọng "${voice.providerVoiceId}" trong ${languageCode}`;

    if (!accepted) {
      voice.enabled = false;
    }

    const saved = await this.repository.save(voice);

    await this.auditLogs.record({
      action: 'Xác minh giọng đọc với nhà cung cấp',
      target: `${saved.personaName} · ${saved.providerVoiceId}`,
      level: accepted ? 'info' : 'warning',
      success: accepted,
      ip,
      metadata: { languageCode, voiceCount: result.voiceCount },
    });

    if (!accepted) {
      throw new BusinessException('CONFLICT', {
        message: saved.verificationNote ?? 'Nhà cung cấp không chấp nhận giọng này',
      });
    }

    return this.view(saved);
  }

  /**
   * Đọc thật câu thoại mẫu bằng giọng này và trả về audio để nghe thử.
   *
   * **Tốn tiền thật** theo số ký tự, khác với `verify` chỉ gọi listVoices miễn phí.
   * Vì vậy có cooldown và số ký tự được ghi vào nhật ký để sau này cộng dồn.
   */
  async preview(
    id: string,
    ip: string | null,
    force = false,
  ): Promise<{
    audioBase64: string;
    mimeType: string;
    apiVersion: string;
    charCount: number;
    latencyMs: number;
    /** true = lấy từ bộ nhớ đệm, không gọi Google và không tốn ký tự nào. */
    cached: boolean;
  }> {
    const voice = await this.findOrFail(id);

    const model = await this.models.findOne({ where: { id: voice.modelId } });
    if (!model) {
      throw new BusinessException('NOT_FOUND', {
        message: `Giọng này trỏ tới model "${voice.modelId}" không còn tồn tại`,
      });
    }

    const config = readModelConfig('voice', model.config) as VoiceModelConfig;

    /*
     * Khoá cache cố ý KHÔNG gồm tốc độ: audio luôn tổng hợp ở 1.0x, tốc độ do trình
     * duyệt áp bằng playbackRate. Nhờ vậy đổi tốc độ không tốn thêm ký tự nào.
     */
    const inputHash = createHash('sha256')
      .update(
        [
          voice.providerVoiceId,
          voice.sampleText,
          config.audioEncoding,
          config.apiVersion,
          config.defaultPitch,
        ].join('|'),
      )
      .digest('hex');

    const cached = await this.previews.findOne({ where: { voiceId: voice.id } });

    if (!force && cached && cached.inputHash === inputHash) {
      return {
        audioBase64: cached.audio.toString('base64'),
        mimeType: cached.mimeType,
        apiVersion: cached.apiVersion,
        charCount: cached.charCount,
        latencyMs: 0,
        cached: true,
      };
    }

    // Từ đây trở đi mới thật sự tốn tiền, nên cooldown và trần ký tự chỉ chặn ở nhánh này.
    const last = this.lastPreviewAt.get(id) ?? 0;
    if (Date.now() - last < PREVIEW_COOLDOWN_MS) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: 'Vui lòng chờ vài giây trước khi tạo lại bản nghe thử',
      });
    }
    this.lastPreviewAt.set(id, Date.now());

    if (voice.supportsTimepoints && config.apiVersion !== 'v1beta1') {
      this.logger.warn(
        `${voice.providerVoiceId} hỗ trợ timepoints nhưng model đang đặt apiVersion=${config.apiVersion}; karaoke sẽ phải căn lại từ audio.`,
      );
    }

    await this.usage.assertWithinLimits(voice.modelId, config, voice.sampleText.length);

    const { account } = await this.credentials.loadAccount(GOOGLE_TTS_PROVIDER);
    const result = await this.synthesis.synthesize(account, {
      voiceName: voice.providerVoiceId,
      text: voice.sampleText,
      // Luôn 1.0x — tốc độ áp ở trình duyệt.
      speakingRate: 1,
      options: {
        apiEndpoint: config.apiEndpoint,
        apiVersion: config.apiVersion,
        audioEncoding: config.audioEncoding,
        maxCharsPerRequest: config.maxCharsPerRequest,
        pitch: config.defaultPitch,
      },
    });

    await this.usage.record(voice.modelId, voice.id, result.charCount);

    const record = cached ?? new VoicePreview();
    record.voiceId = voice.id;
    record.audio = Buffer.from(result.audioBase64, 'base64');
    record.mimeType = result.mimeType;
    record.charCount = result.charCount;
    record.inputHash = inputHash;
    record.apiVersion = result.apiVersion;
    await this.previews.save(record);

    await this.auditLogs.record({
      action: force ? 'Tạo lại bản nghe thử' : 'Nghe thử giọng đọc',
      target: `${voice.personaName} · ${voice.providerVoiceId}`,
      level: 'info',
      ip,
      metadata: {
        charCount: result.charCount,
        latencyMs: result.latencyMs,
        apiVersion: result.apiVersion,
        audioEncoding: config.audioEncoding,
      },
    });

    return { ...result, cached: false };
  }

  async setEnabled(id: string, enabled: boolean, ip: string | null): Promise<VoiceView> {
    const voice = await this.findOrFail(id);

    if (enabled && !voice.verifiedAt) {
      throw new BusinessException('CONFLICT', {
        message: `${voice.personaName} chưa được nhà cung cấp xác nhận. Bấm "Xác minh" trước khi bật.`,
      });
    }

    voice.enabled = enabled;
    const saved = await this.repository.save(voice);

    await this.auditLogs.record({
      action: enabled ? 'Bật giọng đọc' : 'Tắt giọng đọc',
      target: `${saved.personaName} · ${saved.providerVoiceId}`,
      level: 'warning',
      ip,
    });

    return this.view(saved);
  }

  async remove(id: string, ip: string | null): Promise<{ removed: boolean }> {
    const voice = await this.findOrFail(id);
    await this.repository.delete({ id });

    await this.auditLogs.record({
      action: 'Gỡ giọng đọc',
      target: `${voice.personaName} · ${voice.providerVoiceId}`,
      level: 'warning',
      ip,
    });

    return { removed: true };
  }
}
