import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { GOOGLE_TTS_PROVIDER } from '../provider-credentials/provider-credential.entity.js';
import { GoogleTtsCredentialVerifierService } from '../provider-credentials/google-tts-credential-verifier.service.js';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service.js';
import { TtsUsageService, type UsageSummary } from '../tts-usage/tts-usage.service.js';
import { Voice } from '../voices/voice.entity.js';
import {
  AiModel,
  type ModelBadge,
  type ModelKind,
} from './ai-model.entity.js';
import type { VoiceModelConfig } from './model-config.schema.js';
import {
  COST_DEFAULT,
  formatModelCost,
  parseModelConfig,
  parseModelCost,
  readModelConfig,
  type CostUnit,
  type ModelConfig,
  type ModelCost,
} from './model-config.schema.js';

/** Hình dạng trả về cho admin — giữ nguyên cấu trúc lồng `config` mà giao diện đang dùng. */
export interface AiModelView {
  id: string;
  kind: ModelKind;
  name: string;
  vendor: string;
  enabled: boolean;
  badge: ModelBadge;
  latency: string;
  capability: string;
  /** Cấu hình theo đúng loại model — xem `model-config.schema.ts`. */
  config: ModelConfig;
  cost: ModelCost;
  /** Chuỗi hiển thị dựng từ `cost`, không lưu trong database. */
  costLabel: string;
  comingSoon?: boolean;
  /** Nhà cung cấp credential dùng để gọi model; null = không có luồng xác minh. */
  credentialProvider: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  lastLatencyMs: number | null;
}

export interface AiModelInput {
  id?: string;
  kind?: ModelKind;
  name?: string;
  vendor?: string;
  badge?: ModelBadge;
  latency?: string;
  capability?: string;
  config?: unknown;
  cost?: unknown;
  credentialProvider?: string | null;
}

/** Nhà cung cấp có luồng xác minh thật. Thêm provider mới thì bổ sung vào đây. */
export const VERIFIABLE_PROVIDERS = [GOOGLE_TTS_PROVIDER] as const;

const KINDS: ModelKind[] = ['video', 'voice', 'script'];

const BADGES: ModelBadge[] = [
  'Default Primary',
  'Fallback Tier-1',
  'Fallback Tier-2',
  'Enterprise Only',
  'Experimental',
];

const invalid = (message: string): BusinessException =>
  new BusinessException('VALIDATION_FAILED', { message });

/** "Google Cloud TTS · Chirp 3 HD" -> "google-cloud-tts-chirp-3-hd" */
const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

@Injectable()
export class AiModelsService {
  constructor(
    @InjectRepository(AiModel) private readonly repository: Repository<AiModel>,
    @InjectRepository(Voice) private readonly voices: Repository<Voice>,
    private readonly credentials: ProviderCredentialsService,
    private readonly googleTts: GoogleTtsCredentialVerifierService,
    private readonly usageTracker: TtsUsageService,
    private readonly auditLogs: AuditLogService,
  ) {}

  private view(model: AiModel): AiModelView {
    const cost: ModelCost = {
      amount: Number(model.costAmount),
      unit: model.costUnit as CostUnit,
      freeTierAmount:
        model.freeTierAmount === null ? null : Number(model.freeTierAmount),
    };

    return {
      id: model.id,
      kind: model.kind,
      name: model.name,
      vendor: model.vendor,
      enabled: model.enabled,
      badge: model.badge,
      latency: model.latency,
      capability: model.capability,
      // Khoan dung khi đọc: bản ghi cũ thiếu trường vẫn hiện được.
      config: readModelConfig(model.kind, model.config),
      cost,
      costLabel: formatModelCost(cost),
      ...(model.comingSoon ? { comingSoon: true } : {}),
      credentialProvider: model.credentialProvider,
      verifiedAt: model.verifiedAt?.toISOString() ?? null,
      verificationNote: model.verificationNote,
      lastLatencyMs: model.lastLatencyMs,
    };
  }

  private text(value: unknown, field: string, max: number): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw invalid(`Trường "${field}" không được để trống`);
    }
    if (value.trim().length > max) {
      throw invalid(`Trường "${field}" vượt quá ${max} ký tự`);
    }
    return value.trim();
  }

  private parse(
    input: AiModelInput,
    partial: boolean,
    kind: ModelKind,
  ): Partial<AiModel> {
    const result: Partial<AiModel> = {};

    if (input.name !== undefined || !partial) {
      result.name = this.text(input.name, 'name', 120);
    }
    if (input.vendor !== undefined || !partial) {
      result.vendor = this.text(input.vendor, 'vendor', 80);
    }
    if (input.badge !== undefined || !partial) {
      if (!BADGES.includes(input.badge as ModelBadge)) {
        throw invalid(`Trường "badge" chỉ nhận: ${BADGES.join(', ')}`);
      }
      result.badge = input.badge as ModelBadge;
    }

    if (input.config !== undefined) {
      // Nghiêm ngặt khi ghi: gửi trường của loại khác là bị từ chối.
      result.config = parseModelConfig(kind, input.config) as unknown as Record<
        string,
        unknown
      >;
    }
    if (input.latency !== undefined) result.latency = input.latency.trim() || 'chưa đo';
    if (input.capability !== undefined) {
      result.capability = input.capability.trim() || 'chưa khai báo';
    }
    if (input.cost !== undefined) {
      const cost = parseModelCost(input.cost);
      result.costAmount = cost.amount.toFixed(4);
      result.costUnit = cost.unit;
      result.freeTierAmount =
        cost.freeTierAmount === null ? null : cost.freeTierAmount.toFixed(2);
    }
    if (input.credentialProvider !== undefined) {
      const provider = input.credentialProvider;
      if (provider !== null && !VERIFIABLE_PROVIDERS.includes(provider as never)) {
        throw invalid(
          `Nhà cung cấp "${provider}" chưa có luồng xác minh. Hiện hỗ trợ: ${VERIFIABLE_PROVIDERS.join(', ')}`,
        );
      }
      // Đổi nhà cung cấp thì kết quả xác minh cũ không còn giá trị.
      result.credentialProvider = provider;
      result.verifiedAt = null;
      result.verificationNote = null;
    }
    return result;
  }

  private async findOrFail(id: string): Promise<AiModel> {
    const model = await this.repository.findOne({ where: { id } });
    if (!model) {
      throw new BusinessException('NOT_FOUND', { message: 'Không tìm thấy model' });
    }
    return model;
  }

  /**
   * Số ký tự đã dùng và chi phí ước tính của một model voice.
   * Google không có API trả về hạn mức miễn phí còn lại nên hệ thống tự đếm.
   */
  async usage(id: string): Promise<UsageSummary> {
    const model = await this.findOrFail(id);

    if (model.kind !== 'voice') {
      throw new BusinessException('CONFLICT', {
        message: 'Chỉ model giọng đọc mới đếm được số ký tự đã dùng',
      });
    }

    const view = this.view(model);

    return this.usageTracker.summary(model.id, view.config as VoiceModelConfig, {
      amount: view.cost.amount,
      freeTierAmount: view.cost.freeTierAmount,
    });
  }

  async list(kind?: string): Promise<AiModelView[]> {
    if (kind !== undefined && !KINDS.includes(kind as ModelKind)) {
      throw invalid(`Tham số "kind" chỉ nhận: ${KINDS.join(', ')}`);
    }

    const models = await this.repository.find({
      where: kind ? { kind: kind as ModelKind } : {},
      order: { enabled: 'DESC', name: 'ASC' },
    });

    return models.map((model) => this.view(model));
  }

  /** Model mới luôn tắt sẵn để buộc benchmark trước khi mở ra hệ thống. */
  async create(input: AiModelInput, ip: string | null): Promise<AiModelView> {
    if (!KINDS.includes(input.kind as ModelKind)) {
      throw invalid(`Trường "kind" chỉ nhận: ${KINDS.join(', ')}`);
    }

    const kind = input.kind as ModelKind;
    const fields = this.parse(input, false, kind);
    const id = slugify(input.id?.trim() || fields.name!);
    if (id === '') {
      throw invalid('Không tạo được định danh từ tên model, nhập "id" tường minh');
    }

    if (await this.repository.findOne({ where: { id } })) {
      throw new BusinessException('CONFLICT', {
        message: `Model có định danh "${id}" đã tồn tại`,
      });
    }

    const model = this.repository.create({
      latency: 'chưa đo',
      capability: 'chưa khai báo',
      // Cấu hình mặc định đúng theo loại, không còn dùng chung một bộ tham số.
      config: parseModelConfig(kind, {}) as unknown as Record<string, unknown>,
      costAmount: COST_DEFAULT.amount.toFixed(4),
      costUnit: COST_DEFAULT.unit,
      freeTierAmount: null,
      ...fields,
      id,
      kind,
      enabled: false,
      comingSoon: false,
    });
    const saved = await this.repository.save(model);

    await this.auditLogs.record({
      action: 'Thêm model AI',
      target: `${saved.kind} · ${saved.name} (${saved.id})`,
      level: 'info',
      ip,
    });

    return this.view(saved);
  }

  async update(id: string, input: AiModelInput, ip: string | null): Promise<AiModelView> {
    const model = await this.findOrFail(id);

    if (input.kind !== undefined && input.kind !== model.kind) {
      throw new BusinessException('CONFLICT', {
        message: 'Không đổi được loại model vì cấu hình cũ sẽ không còn hợp lệ. Xoá và tạo lại.',
      });
    }

    Object.assign(model, this.parse(input, true, model.kind));
    const saved = await this.repository.save(model);

    await this.auditLogs.record({
      action: 'Cập nhật model AI',
      target: `${saved.kind} · ${saved.name} (${saved.id})`,
      level: 'info',
      ip,
    });

    return this.view(saved);
  }

  async setEnabled(id: string, enabled: boolean, ip: string | null): Promise<AiModelView> {
    const model = await this.findOrFail(id);

    if (model.comingSoon) {
      throw new BusinessException('CONFLICT', {
        message: `${model.name} chưa mở, không bật được`,
      });
    }

    // Model có gắn nhà cung cấp thì phải xác minh được nhà cung cấp chấp nhận đã.
    // Model không gắn provider vẫn bật được — đó là khai báo thủ công, chấp nhận rủi ro.
    if (enabled && model.credentialProvider && !model.verifiedAt) {
      throw new BusinessException('CONFLICT', {
        message: `${model.name} chưa xác minh với ${model.credentialProvider}. Bấm "Xác minh" trước khi bật.`,
      });
    }

    model.enabled = enabled;
    const saved = await this.repository.save(model);

    await this.auditLogs.record({
      action: enabled ? 'Bật model AI' : 'Tắt model AI',
      target: `${saved.kind} · ${saved.name} (${saved.id})`,
      level: 'warning',
      ip,
    });

    return this.view(saved);
  }

  /**
   * Gọi thật sang nhà cung cấp bằng credential đang lưu để xác nhận model dùng được.
   * Không phải benchmark: mục đích là chứng minh "nhà cung cấp chấp nhận", nên chỉ
   * gọi thao tác đọc rẻ nhất (với Google TTS là listVoices).
   */
  async verify(id: string, ip: string | null): Promise<AiModelView> {
    const model = await this.findOrFail(id);

    if (!model.credentialProvider) {
      throw new BusinessException('CONFLICT', {
        message: `${model.name} chưa gắn nhà cung cấp nào nên không có gì để xác minh`,
      });
    }

    if (model.credentialProvider !== GOOGLE_TTS_PROVIDER) {
      throw new BusinessException('CONFLICT', {
        message: `Chưa hỗ trợ xác minh với "${model.credentialProvider}"`,
      });
    }

    // Ném CREDENTIAL_NOT_CONFIGURED nếu chưa ai tải service account lên.
    const { account } = await this.credentials.loadAccount(GOOGLE_TTS_PROVIDER);

    try {
      const result = await this.googleTts.verify(account);

      model.verifiedAt = new Date();
      model.verificationNote = `Google chấp nhận credential · ${result.voiceCount} giọng vi-VN`;
      model.lastLatencyMs = result.latencyMs;
      const saved = await this.repository.save(model);

      await this.auditLogs.record({
        action: 'Xác minh model AI với nhà cung cấp',
        target: `${saved.kind} · ${saved.name} (${saved.id})`,
        level: 'info',
        ip,
        metadata: { latencyMs: result.latencyMs, voiceCount: result.voiceCount },
      });

      return this.view(saved);
    } catch (error) {
      model.verifiedAt = null;
      model.verificationNote =
        error instanceof BusinessException ? error.code : 'Xác minh thất bại';
      await this.repository.save(model);

      await this.auditLogs.record({
        action: 'Xác minh model AI với nhà cung cấp',
        target: `${model.kind} · ${model.name} (${model.id})`,
        level: 'warning',
        success: false,
        ip,
        metadata: {
          reason: error instanceof BusinessException ? error.code : 'UNKNOWN',
        },
      });

      throw error;
    }
  }

  async remove(id: string, ip: string | null): Promise<{ removed: boolean }> {
    const model = await this.findOrFail(id);

    // Không có khoá ngoại giữa voices và ai_models, nên phải tự chặn ở đây:
    // xoá model đang được giọng tham chiếu sẽ để lại giọng mồ côi không gọi được.
    const usedBy = await this.voices.count({ where: { modelId: id } });
    if (usedBy > 0) {
      throw new BusinessException('CONFLICT', {
        message: `Còn ${usedBy} giọng đọc đang dùng model này. Gỡ hoặc đổi model của các giọng đó trước.`,
      });
    }

    await this.repository.delete({ id });

    await this.auditLogs.record({
      action: 'Gỡ model AI',
      target: `${model.kind} · ${model.name} (${model.id})`,
      level: 'warning',
      ip,
    });

    return { removed: true };
  }
}
