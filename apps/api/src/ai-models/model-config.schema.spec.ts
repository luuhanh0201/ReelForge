import { describe, expect, it } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  COST_DEFAULT,
  formatModelCost,
  parseModelConfig,
  parseModelCost,
  readModelConfig,
  SCRIPT_CONFIG_DEFAULT,
  VIDEO_CONFIG_DEFAULT,
  VOICE_CONFIG_DEFAULT,
  type ScriptModelConfig,
  type VideoModelConfig,
  type VoiceModelConfig,
} from './model-config.schema.js';

const expectInvalid = (run: () => unknown, match?: RegExp) => {
  try {
    run();
    throw new Error('lẽ ra phải ném lỗi');
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException);
    const exception = error as BusinessException;
    expect(exception.code).toBe('VALIDATION_FAILED');
    if (match) expect(exception.message).toMatch(match);
  }
};

describe('parseModelConfig · voice', () => {
  it('điền mặc định khi bỏ trống', () => {
    expect(parseModelConfig('voice', {})).toEqual(VOICE_CONFIG_DEFAULT);
  });

  it('giữ giá trị hợp lệ', () => {
    const config = parseModelConfig('voice', {
      apiEndpoint: 'https://asia-southeast1-texttospeech.googleapis.com',
      apiVersion: 'v1beta1',
      maxCharsPerRequest: 4000,
      audioEncoding: 'LINEAR16',
      defaultSpeakingRate: 1.15,
      defaultPitch: -2,
    }) as VoiceModelConfig;

    expect(config.apiVersion).toBe('v1beta1');
    expect(config.maxCharsPerRequest).toBe(4000);
    expect(config.audioEncoding).toBe('LINEAR16');
  });

  it('từ chối trường của loại khác — đây là lý do tách cấu hình', () => {
    expectInvalid(
      () => parseModelConfig('voice', { temperature: 0.7 }),
      /không có trường cấu hình: temperature/,
    );
    expectInvalid(
      () => parseModelConfig('voice', { maxTokens: 4096 }),
      /không có trường cấu hình: maxTokens/,
    );
  });

  it('chặn maxCharsPerRequest vượt giới hạn thật của Google TTS', () => {
    expectInvalid(
      () => parseModelConfig('voice', { maxCharsPerRequest: 9000 }),
      /1 – 5000/,
    );
    expectInvalid(() => parseModelConfig('voice', { maxCharsPerRequest: 100.5 }), /số nguyên/);
  });

  it('có trần ký tự ngày/tháng, mặc định bằng hạn mức miễn phí Chirp 3 HD', () => {
    const config = parseModelConfig('voice', {}) as VoiceModelConfig;
    expect(config.dailyCharLimit).toBe(50_000);
    expect(config.monthlyCharLimit).toBe(1_000_000);

    const unlimited = parseModelConfig('voice', {
      dailyCharLimit: 0,
      monthlyCharLimit: 0,
    }) as VoiceModelConfig;
    expect(unlimited.monthlyCharLimit).toBe(0);
  });

  it('chặn trần ký tự âm hoặc không nguyên', () => {
    expectInvalid(() => parseModelConfig('voice', { dailyCharLimit: -1 }), /0 – 1000000000/);
    expectInvalid(() => parseModelConfig('voice', { monthlyCharLimit: 1.5 }), /số nguyên/);
  });

  it('chặn apiVersion lạ', () => {
    expectInvalid(() => parseModelConfig('voice', { apiVersion: 'v2' }), /v1, v1beta1/);
  });

  it('chặn tốc độ đọc ngoài khoảng', () => {
    expectInvalid(() => parseModelConfig('voice', { defaultSpeakingRate: 9 }), /0.25 – 4/);
  });
});

describe('parseModelConfig · video', () => {
  it('điền mặc định khi bỏ trống', () => {
    expect(parseModelConfig('video', {})).toEqual(VIDEO_CONFIG_DEFAULT);
  });

  it('nhận fps dạng chuỗi từ form', () => {
    const config = parseModelConfig('video', { fps: '60' }) as VideoModelConfig;
    expect(config.fps).toBe(60);
  });

  it('chặn fps không nằm trong danh sách', () => {
    expectInvalid(() => parseModelConfig('video', { fps: 45 }), /24, 30, 60/);
  });

  it('bỏ tỷ lệ trùng lặp', () => {
    const config = parseModelConfig('video', {
      aspectRatios: ['9:16', '9:16', '1:1'],
    }) as VideoModelConfig;

    expect(config.aspectRatios).toEqual(['9:16', '1:1']);
  });

  it('chặn tỷ lệ lạ và mảng rỗng', () => {
    expectInvalid(() => parseModelConfig('video', { aspectRatios: ['4:3'] }), /9:16/);
    expectInvalid(() => parseModelConfig('video', { aspectRatios: [] }), /ít nhất một/);
  });

  it('từ chối trường của loại khác', () => {
    expectInvalid(
      () => parseModelConfig('video', { maxCharsPerRequest: 5000 }),
      /không có trường cấu hình: maxCharsPerRequest/,
    );
  });
});

describe('parseModelConfig · script', () => {
  it('điền mặc định khi bỏ trống', () => {
    expect(parseModelConfig('script', {})).toEqual(SCRIPT_CONFIG_DEFAULT);
  });

  it('topP là tuỳ chọn', () => {
    expect((parseModelConfig('script', {}) as ScriptModelConfig).topP).toBeNull();
    expect((parseModelConfig('script', { topP: 0.9 }) as ScriptModelConfig).topP).toBe(0.9);
  });

  it('chặn temperature ngoài khoảng', () => {
    expectInvalid(() => parseModelConfig('script', { temperature: 5 }), /0 – 2/);
  });

  it('từ chối trường của loại khác', () => {
    expectInvalid(
      () => parseModelConfig('script', { audioEncoding: 'MP3' }),
      /không có trường cấu hình: audioEncoding/,
    );
  });
});

describe('readModelConfig — khoan dung khi đọc', () => {
  it('bản ghi cũ thiếu trường vẫn đọc được', () => {
    expect(readModelConfig('voice', { apiVersion: 'v1beta1' })).toEqual({
      ...VOICE_CONFIG_DEFAULT,
      apiVersion: 'v1beta1',
    });
  });

  it('trường lạ bị bỏ qua thay vì ném lỗi', () => {
    expect(readModelConfig('voice', { temperature: 0.7, maxCharsPerRequest: 3000 })).toEqual({
      ...VOICE_CONFIG_DEFAULT,
      maxCharsPerRequest: 3000,
    });
  });

  it('giá trị hỏng thì rơi về mặc định', () => {
    expect(readModelConfig('voice', { maxCharsPerRequest: 99999 })).toEqual(
      VOICE_CONFIG_DEFAULT,
    );
    expect(readModelConfig('script', null)).toEqual(SCRIPT_CONFIG_DEFAULT);
    expect(readModelConfig('video', 'hỏng')).toEqual(VIDEO_CONFIG_DEFAULT);
  });
});

describe('chi phí', () => {
  it('mặc định là theo hợp đồng', () => {
    expect(parseModelCost(undefined)).toEqual(COST_DEFAULT);
  });

  it('giữ đơn giá và hạn mức miễn phí', () => {
    const cost = parseModelCost({
      amount: 30,
      unit: 'per_million_chars',
      freeTierAmount: 1_000_000,
    });

    expect(cost).toEqual({
      amount: 30,
      unit: 'per_million_chars',
      freeTierAmount: 1_000_000,
    });
  });

  it('theo hợp đồng thì bỏ qua đơn giá', () => {
    expect(parseModelCost({ amount: 99, unit: 'contract' }).amount).toBe(0);
  });

  it('chặn đơn vị lạ và số âm', () => {
    expectInvalid(() => parseModelCost({ unit: 'per_video' }), /per_million_chars/);
    expectInvalid(() => parseModelCost({ amount: -5, unit: 'per_second' }), /0 – 1000000/);
  });

  it('dựng chuỗi hiển thị từ dữ liệu', () => {
    expect(
      formatModelCost({ amount: 30, unit: 'per_million_chars', freeTierAmount: 1_000_000 }),
    ).toBe('$30 / 1M ký tự · 1M miễn phí/tháng');

    expect(formatModelCost({ amount: 0.05, unit: 'per_second', freeTierAmount: null })).toBe(
      '$0.05 / giây',
    );

    expect(
      formatModelCost({ amount: 0.3, unit: 'per_million_input_tokens', freeTierAmount: null }),
    ).toBe('$0.3 / 1M token vào');

    expect(formatModelCost({ amount: 0, unit: 'contract', freeTierAmount: null })).toBe(
      'Theo hợp đồng',
    );
  });
});
