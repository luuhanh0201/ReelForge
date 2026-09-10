/// <reference lib="webworker" />

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import {
  ALL_FORMATS,
  BufferSource,
  Input,
  VideoSampleSink,
  type VideoSample,
} from "mediabunny";
import { drawFrame, type FrameSource } from "@repo/render-core";
import type { RenderConfig } from "@repo/shared";

/**
 * Bộ xuất MP4 chạy trong Web Worker.
 *
 * Phải là Worker chứ không phải luồng chính vì hai lý do, cả hai đều là lỗi thật chứ không
 * phải tối ưu:
 *
 * 1. `requestAnimationFrame` **bị trình duyệt dừng khi tab chạy nền**. Người dùng chuyển
 *    tab giữa chừng — chuyện chắc chắn xảy ra với video 60 giây — thì quá trình xuất đứng
 *    im cho tới khi họ quay lại.
 * 2. Encode 1800 khung hình khoá luồng giao diện; cả trang đơ và trình duyệt hỏi "trang
 *    này không phản hồi, đóng lại?".
 */

export type ExportRequest = {
  type: "start";
  config: RenderConfig;
  /**
   * Media của các cảnh, đã chuyển quyền sở hữu sang worker.
   *
   * Ảnh gửi sang dạng `ImageBitmap` đã giải mã sẵn; video và GIF gửi **byte thô** vì worker
   * phải tự giải mã theo từng mốc thời gian, không thể dùng `<video>` hay `<img>` — hai thứ
   * đó không tồn tại ngoài luồng chính.
   */
  media: {
    url: string;
    kind: "image" | "video" | "gif";
    bitmap?: ImageBitmap;
    buffer?: ArrayBuffer;
  }[];
  /** WAV thô của từng đoạn tiếng, worker tự giải mã lấy PCM. */
  voice: { startMs: number; buffer: ArrayBuffer }[];
  fontUrl: string;
};

export type ExportMessage =
  | { type: "progress"; done: number; total: number; stage: "video" | "audio" | "mux" }
  | { type: "warning"; message: string }
  | { type: "done"; buffer: ArrayBuffer; durationMs: number }
  | { type: "error"; message: string };

/**
 * Số khung hình cho phép nằm chờ trong hàng đợi encoder.
 *
 * Không chặn ở đây thì RAM tăng tuyến tính theo độ dài video và tab bị hệ điều hành thu
 * hồi quanh giây thứ 20. Có chặn thì RAM đứng yên bất kể video dài bao nhiêu.
 */
const MAX_QUEUE = 8;

/** Đủ trong cho giọng nói mono; cao hơn chỉ làm file nặng mà tai không nghe ra. */
const AUDIO_BITRATE = 96_000;

const post = (message: ExportMessage, transfer?: Transferable[]) =>
  transfer
    ? self.postMessage(message, transfer)
    : self.postMessage(message);

/**
 * Nạp font vào worker.
 *
 * Worker có `FontFaceSet` riêng, **không thừa hưởng font của trang**. Bỏ bước này thì phụ
 * đề tiếng Việt trong file xuất ra mất dấu, trong khi bản xem trước vẫn đẹp — đúng loại
 * lỗi chỉ lộ ra sau khi người dùng đã tải file về.
 */
const loadFont = async (url: string): Promise<void> => {
  try {
    const face = new FontFace("Be Vietnam Pro", `url(${url})`, { weight: "100 900" });
    await face.load();
    (self as unknown as { fonts: FontFaceSet }).fonts.add(face);
  } catch {
    // Thiếu font thì vẫn xuất được bằng font hệ thống; dừng cả video vì lý do này thì tệ hơn.
  }
};

/**
 * Giải mã một file WAV PCM 16-bit thành mẫu số thực.
 *
 * Phải tự đọc vì **Web Audio API không tồn tại trong Web Worker** — không có
 * `OfflineAudioContext`, không có `decodeAudioData`. Đây chính là lý do `TtsService` ép
 * Google trả `LINEAR16` thay vì MP3: WAV thì giải mã được bằng vài dòng `DataView`, còn
 * MP3 thì cần cả một bộ giải mã.
 *
 * Duyệt chunk chứ không nhảy tới offset 44 cố định: WAV cho phép chèn `LIST`/`fact` trước
 * `data`, đọc nhầm thì tiếng ra thành nhiễu.
 */
const decodeWav = (
  buffer: ArrayBuffer,
): { samples: Float32Array; sampleRate: number } | null => {
  const view = new DataView(buffer);
  const ascii = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );

  if (buffer.byteLength < 12 || ascii(0) !== "RIFF" || ascii(8) !== "WAVE") return null;

  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  let dataStart = 0;
  let dataBytes = 0;
  let cursor = 12;

  while (cursor + 8 <= buffer.byteLength) {
    const id = ascii(cursor);
    const size = view.getUint32(cursor + 4, true);
    const body = cursor + 8;

    if (id === "fmt " && body + 16 <= buffer.byteLength) {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === "data") {
      dataStart = body;
      dataBytes = Math.min(size, buffer.byteLength - body);
      break;
    }

    cursor = body + size + (size % 2);
  }

  if (sampleRate === 0 || bits !== 16 || dataBytes === 0) return null;

  const frames = Math.floor(dataBytes / 2 / Math.max(1, channels));
  const samples = new Float32Array(frames);

  for (let frame = 0; frame < frames; frame += 1) {
    // Chỉ lấy kênh đầu: giọng đọc là mono, và video dọc không cần stereo.
    samples[frame] = view.getInt16(dataStart + frame * 2 * channels, true) / 32768;
  }

  return { samples, sampleRate };
};

/** Đổi tần số lấy mẫu bằng nội suy tuyến tính — đủ cho giọng nói, không cần bộ lọc. */
const resample = (
  samples: Float32Array,
  from: number,
  to: number,
): Float32Array => {
  if (from === to) return samples;

  const ratio = from / to;
  const output = new Float32Array(Math.round(samples.length / ratio));

  for (let index = 0; index < output.length; index += 1) {
    const source = index * ratio;
    const left = Math.floor(source);
    const right = Math.min(left + 1, samples.length - 1);
    const weight = source - left;
    output[index] = samples[left]! * (1 - weight) + samples[right]! * weight;
  }

  return output;
};

/**
 * Ghép các đoạn tiếng vào một dải PCM duy nhất theo đúng mốc thời gian của chúng.
 *
 * Cộng dồn thay vì ghi đè: hai đoạn chồng nhau — chuyện xảy ra khi người dùng rút ngắn một
 * cảnh — thì nghe thành hai giọng chồng, còn ghi đè sẽ cắt cụt câu trước mà không báo gì.
 */
const buildAudioTrack = (
  voice: { startMs: number; buffer: ArrayBuffer }[],
  totalDurationMs: number,
): { samples: Float32Array; sampleRate: number } | null => {
  const decoded = voice
    .map((clip) => ({ startMs: clip.startMs, wav: decodeWav(clip.buffer) }))
    .filter((item): item is { startMs: number; wav: NonNullable<ReturnType<typeof decodeWav>> } =>
      item.wav !== null,
    );

  if (decoded.length === 0) return null;

  const sampleRate = decoded[0]!.wav.sampleRate;
  const total = new Float32Array(Math.ceil((totalDurationMs / 1000) * sampleRate));

  for (const { startMs, wav } of decoded) {
    const samples = resample(wav.samples, wav.sampleRate, sampleRate);
    const offset = Math.round((startMs / 1000) * sampleRate);

    for (let index = 0; index < samples.length; index += 1) {
      const target = offset + index;
      if (target >= total.length) break;
      total[target] = Math.max(-1, Math.min(1, total[target]! + samples[index]!));
    }
  }

  return { samples: total, sampleRate };
};

/**
 * Chọn bộ mã hoá tiếng theo **năng lực thật của máy**, không theo giả định.
 *
 * AAC là lựa chọn đầu vì mọi nơi phát được, nhưng bản Chromium trên Linux không kèm bộ mã
 * hoá AAC (lý do bản quyền) nên `mp4a.40.2` báo không hỗ trợ. Opus trong MP4 là phương án
 * thay thế: nhẹ hơn, chất lượng tốt hơn ở cùng bitrate, và các nền tảng lớn đều đọc được.
 *
 * Không có cái nào thì **vẫn xuất video, chỉ không có tiếng** — người dùng nhận được thứ
 * dùng được thay vì một thông báo lỗi và không có gì.
 */
const pickAudioCodec = async (
  sampleRate: number,
): Promise<{ muxer: "aac" | "opus"; encoder: string } | null> => {
  const candidates = [
    { muxer: "aac" as const, encoder: "mp4a.40.2" },
    { muxer: "opus" as const, encoder: "opus" },
  ];

  for (const candidate of candidates) {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: candidate.encoder,
        numberOfChannels: 1,
        sampleRate,
        bitrate: AUDIO_BITRATE,
      });
      if (support.supported) return candidate;
    } catch {
      // Cấu hình không hợp lệ với máy này; thử phương án sau.
    }
  }

  return null;
};

/**
 * Nguồn khung hình của một cảnh, đã sẵn sàng cho vòng lặp encode.
 *
 * Ba loại media cần ba cách lấy khung hình hoàn toàn khác nhau, nhưng vòng lặp encode chỉ
 * muốn biết một điều: "tại mốc này thì vẽ cái gì". Kiểu này giấu toàn bộ khác biệt đó.
 */
interface SceneSource {
  /** `timeMs` là mốc **trong cảnh**, không phải mốc toàn video. */
  frameAt: (timeMs: number) => Promise<FrameSource | null>;
  /** Giải phóng tài nguyên của khung vừa vẽ; gọi sau mỗi lần drawFrame. */
  release: () => void;
  close: () => void;
}

const imageSource = (bitmap: ImageBitmap): SceneSource => {
  const frame: FrameSource = {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
  };

  return {
    frameAt: async () => frame,
    release: () => undefined,
    close: () => bitmap.close(),
  };
};

/**
 * Video: giải mã đúng khung hình tại mốc cần vẽ.
 *
 * `VideoSample` giữ bộ nhớ ngoài heap của JS, y như `VideoFrame`. Không đóng sau mỗi lần
 * vẽ thì RAM tăng tuyến tính và tab bị thu hồi — đúng cái bẫy đã gặp ở vòng lặp encode.
 */
const videoSource = async (buffer: ArrayBuffer): Promise<SceneSource | null> => {
  const input = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) return null;

  const sink = new VideoSampleSink(track);
  let pending: VideoSample | null = null;

  return {
    frameAt: async (timeMs) => {
      const sample = await sink.getSample(Math.max(0, timeMs) / 1000);
      if (!sample) return null;

      pending = sample;

      return {
        source: sample.toCanvasImageSource(),
        width: sample.displayWidth,
        height: sample.displayHeight,
      };
    },
    release: () => {
      pending?.close();
      pending = null;
    },
    close: () => {
      pending?.close();
      pending = null;
    },
  };
};

/**
 * GIF: giải mã sẵn toàn bộ khung hình một lần.
 *
 * `mediabunny` không đọc GIF nên phải dùng `ImageDecoder` của WebCodecs. Giải mã trước cả
 * bộ thay vì giải mã theo yêu cầu: GIF thường chỉ vài chục khung nhỏ, còn gọi `decode()`
 * trong vòng lặp encode sẽ thành hàng nghìn lời gọi bất đồng bộ cho một video 60 giây.
 */
const gifSource = async (buffer: ArrayBuffer): Promise<SceneSource | null> => {
  if (typeof ImageDecoder === "undefined") return null;

  const decoder = new ImageDecoder({ data: buffer, type: "image/gif" });
  await decoder.completed;

  const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
  if (count === 0) return null;

  const frames: { bitmap: ImageBitmap; untilMs: number }[] = [];
  let elapsedMs = 0;

  for (let index = 0; index < count; index += 1) {
    const { image } = await decoder.decode({ frameIndex: index });
    // GIF không khai thời lượng thì lấy 100ms — mặc định của hầu hết trình xem.
    elapsedMs += (image.duration ?? 100_000) / 1000;
    frames.push({ bitmap: await createImageBitmap(image), untilMs: elapsedMs });
    image.close();
  }

  decoder.close();

  const totalMs = elapsedMs || 1;
  const first = frames[0]!;

  return {
    frameAt: async (timeMs) => {
      // GIF lặp vô hạn; cảnh dài hơn GIF thì chạy lại từ đầu, đúng như người dùng thấy
      // trong khung xem trước.
      const inLoop = ((timeMs % totalMs) + totalMs) % totalMs;
      const found = frames.find((frame) => inLoop < frame.untilMs) ?? first;

      return {
        source: found.bitmap,
        width: found.bitmap.width,
        height: found.bitmap.height,
      };
    },
    release: () => undefined,
    close: () => {
      for (const frame of frames) frame.bitmap.close();
    },
  };
};

const buildSources = async (
  media: ExportRequest["media"],
): Promise<Map<string, SceneSource>> => {
  const sources = new Map<string, SceneSource>();

  for (const item of media) {
    if (item.kind === "image" && item.bitmap) {
      sources.set(item.url, imageSource(item.bitmap));
      continue;
    }

    if (!item.buffer) continue;

    const source =
      item.kind === "video"
        ? await videoSource(item.buffer)
        : await gifSource(item.buffer);

    // Một tài nguyên hỏng không được làm chết cả lần xuất; cảnh đó chỉ còn nền và phụ đề.
    if (source) sources.set(item.url, source);
  }

  return sources;
};

const run = async (request: ExportRequest): Promise<void> => {
  const { config } = request;
  const { width, height, fps, bitrate } = config.output;

  await loadFont(request.fontUrl);

  const sources = await buildSources(request.media);

  // Tần số lấy mẫu lấy theo chính file tiếng, không ép 48kHz: nâng tần số của một bản ghi
  // 24kHz không thêm được thông tin nào, chỉ làm file nặng hơn.
  const audio = buildAudioTrack(request.voice, config.meta.totalDurationMs);
  const sampleRate = audio?.sampleRate ?? 24_000;
  const audioCodec = audio ? await pickAudioCodec(sampleRate) : null;
  const pcm = audioCodec ? (audio?.samples ?? null) : null;

  if (audio && !audioCodec) {
    post({
      type: "warning",
      message:
        "Trình duyệt này không mã hoá được âm thanh nên video sẽ không có tiếng. Hãy dùng Google Chrome bản chính thức để có đủ tiếng.",
    });
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    ...(pcm && audioCodec
      ? { audio: { codec: audioCodec.muxer, numberOfChannels: 1, sampleRate } }
      : {}),
    fastStart: "in-memory",
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => post({ type: "error", message: error.message }),
  });

  videoEncoder.configure({
    // Baseline 4.2: mức tương thích rộng nhất, chạy được cả trên điện thoại đời cũ khi
    // người xem mở video trên TikTok.
    codec: "avc1.42002a",
    width,
    height,
    bitrate,
    framerate: fps,
    latencyMode: "quality",
  });

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không mở được canvas trong worker");

  const totalFrames = Math.round((config.meta.totalDurationMs / 1000) * fps);
  const frameDurationUs = Math.round(1_000_000 / fps);

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const timeMs = (frame / fps) * 1000;

    /*
     * Dựng bản đồ khung hình cho đúng mốc này.
     *
     * Ảnh tĩnh trả về cùng một đối tượng mỗi lần, còn video và GIF phải giải mã theo mốc
     * **trong cảnh** — nên phải biết cảnh nào đang chiếu chứ không chỉ mốc toàn video.
     */
    const scene = config.scenes.find(
      (item) => timeMs >= item.startMs && timeMs < item.startMs + item.durationMs,
    );

    const images = new Map<string, FrameSource>();
    const source = scene ? sources.get(scene.assetUrl) : undefined;

    if (scene && source) {
      const picture = await source.frameAt(timeMs - scene.startMs);
      if (picture) images.set(scene.assetUrl, picture);
    }

    // Không vẽ safe zone: đó là chỉ dẫn cho người dựng, không phải nội dung video.
    drawFrame(ctx as unknown as CanvasRenderingContext2D, config, timeMs, images, {
      showSafeZone: false,
    });

    // Trả lại khung hình vừa giải mã ngay sau khi vẽ, trước khi encode giữ tiếp bộ nhớ.
    source?.release();

    const videoFrame = new VideoFrame(canvas, {
      timestamp: frame * frameDurationUs,
      duration: frameDurationUs,
    });

    // Khung hình đầu mỗi 2 giây là keyframe: người xem tua giữa video không bị vỡ hình.
    videoEncoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
    // Bắt buộc: `VideoFrame` giữ bộ nhớ ngoài heap của JS, không đóng thì GC không dọn được.
    videoFrame.close();

    while (videoEncoder.encodeQueueSize > MAX_QUEUE) {
      await new Promise((resolve) => setTimeout(resolve, 4));
    }

    if (frame % 15 === 0) {
      post({ type: "progress", done: frame, total: totalFrames, stage: "video" });
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();

  if (pcm && audioCodec) {
    post({ type: "progress", done: totalFrames, total: totalFrames, stage: "audio" });

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (error) => post({ type: "error", message: error.message }),
    });

    audioEncoder.configure({
      codec: audioCodec.encoder,
      numberOfChannels: 1,
      sampleRate,
      bitrate: AUDIO_BITRATE,
    });

    // Cắt thành khối 1 giây: gửi cả dải một lần thì `AudioData` chiếm hàng chục MB liền mạch.
    const chunkFrames = sampleRate;
    for (let offset = 0; offset < pcm.length; offset += chunkFrames) {
      const slice = pcm.subarray(offset, Math.min(offset + chunkFrames, pcm.length));
      const data = new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: slice.length,
        numberOfChannels: 1,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: new Float32Array(slice),
      });

      audioEncoder.encode(data);
      data.close();
    }

    await audioEncoder.flush();
    audioEncoder.close();
  }

  for (const source of sources.values()) source.close();

  post({ type: "progress", done: totalFrames, total: totalFrames, stage: "mux" });
  muxer.finalize();

  const { buffer } = muxer.target as ArrayBufferTarget;
  post({ type: "done", buffer, durationMs: config.meta.totalDurationMs }, [buffer]);
};

self.onmessage = (event: MessageEvent<ExportRequest>) => {
  if (event.data.type !== "start") return;

  run(event.data).catch((error: unknown) => {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });
};
