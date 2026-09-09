import type { ProjectLine } from './project.entity.js';

/**
 * Kịch bản mẫu — dùng trước khi cắm AI.
 *
 * Đây **không phải giải pháp tạm bợ**: kể cả khi có LLM, bộ mẫu vẫn cần cho lúc nhà cung
 * cấp lỗi, hết quota, hoặc người dùng chỉ muốn một khung nhanh để sửa tay. `ScriptsService`
 * sau này chỉ thay bước sinh nội dung, mọi thứ phía sau giữ nguyên.
 *
 * Mỗi dòng viết cho **khoảng 10 giây đọc** — tiếng Việt đọc tốc độ bình thường rơi vào
 * 25–30 từ. Video 30 giây lấy 3 dòng đầu, 60 giây lấy đủ 6 dòng.
 */

export type ScriptTone =
  | 'review'
  | 'listicle'
  | 'problem_solution'
  | 'warning'
  | 'storytelling';

export const SCRIPT_TONES: readonly ScriptTone[] = [
  'review',
  'listicle',
  'problem_solution',
  'warning',
  'storytelling',
];

/** Số giây một cảnh chiếm chỗ khi chưa có audio thật để đo. */
export const SECONDS_PER_LINE = 10;
export const MIN_DURATION_SEC = 30;
export const MAX_DURATION_SEC = 60;

export interface ScriptTemplate {
  code: string;
  tone: ScriptTone;
  label: string;
  description: string;
  /** Luôn 6 dòng; cắt bớt theo độ dài mục tiêu người dùng chọn. */
  lines: { text: string; role: ProjectLine['role']; emphasis: string[] }[];
}

/**
 * `{ten}` và `{gia}` được thay bằng dữ liệu sản phẩm. Thiếu dữ liệu thì thay bằng chữ
 * trung tính chứ **không để lộ dấu ngoặc nhọn ra màn hình** — người dùng sẽ tưởng lỗi.
 */
export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    code: 'review_that',
    tone: 'review',
    label: 'Review thật',
    description: 'Kể trải nghiệm dùng thật, hợp với sản phẩm gia dụng và làm đẹp.',
    lines: [
      {
        text: 'Mình đã dùng {ten} được hai tuần rồi, và đây là điều mình muốn nói thẳng với bạn trước khi bạn xuống tiền.',
        role: 'hook',
        emphasis: ['nói thẳng'],
      },
      {
        text: 'Ấn tượng đầu tiên là cảm giác cầm chắc tay, hoàn thiện gọn gàng, không có chi tiết nào làm mình thấy tiếc tiền.',
        role: 'usp',
        emphasis: ['chắc tay'],
      },
      {
        text: 'Dùng hằng ngày thì điểm mình thích nhất là tiết kiệm được thời gian, việc trước kia mất mười lăm phút giờ chỉ còn vài phút.',
        role: 'usp',
        emphasis: ['tiết kiệm được thời gian'],
      },
      {
        text: 'Tất nhiên không có gì hoàn hảo, nhưng ở tầm giá {gia} thì mình chưa tìm được lựa chọn nào đáng hơn.',
        role: 'usp',
        emphasis: ['{gia}'],
      },
      {
        text: 'Nếu bạn đang phân vân giữa vài mẫu khác nhau, mình nghĩ cái này là phương án an toàn để bắt đầu.',
        role: 'usp',
        emphasis: ['an toàn'],
      },
      {
        text: 'Link mình để ngay dưới video, bạn bấm vào xem giá hôm nay nhé, đang có ưu đãi đấy.',
        role: 'cta',
        emphasis: ['ưu đãi'],
      },
    ],
  },
  {
    code: 'ba_ly_do',
    tone: 'listicle',
    label: 'Ba lý do nên mua',
    description: 'Liệt kê ngắn gọn, dễ xem hết, hợp với sản phẩm nhiều tính năng.',
    lines: [
      {
        text: 'Có ba lý do khiến {ten} được nhắc tới nhiều đến vậy trong mấy tuần gần đây, và lý do thứ ba mới là thứ đáng nói.',
        role: 'hook',
        emphasis: ['ba lý do'],
      },
      {
        text: 'Thứ nhất, nó giải quyết đúng một việc cụ thể thay vì ôm đồm nhiều thứ rồi làm cái nào cũng nửa vời.',
        role: 'usp',
        emphasis: ['Thứ nhất'],
      },
      {
        text: 'Thứ hai, thao tác đơn giản đến mức không cần đọc hướng dẫn, mở hộp ra là dùng được ngay.',
        role: 'usp',
        emphasis: ['Thứ hai'],
      },
      {
        text: 'Thứ ba, và đây là điều mình thích nhất, giá chỉ {gia} nhưng chất lượng ngang tầm những mẫu đắt hơn nhiều.',
        role: 'usp',
        emphasis: ['Thứ ba', '{gia}'],
      },
      {
        text: 'Mình đã so với hai ba mẫu cùng tầm giá, và đây là cái mình giữ lại dùng tiếp.',
        role: 'usp',
        emphasis: ['giữ lại dùng tiếp'],
      },
      {
        text: 'Bạn xem link phía dưới nhé, số lượng ưu đãi thường không kéo dài quá lâu đâu.',
        role: 'cta',
        emphasis: ['không kéo dài'],
      },
    ],
  },
  {
    code: 'giai_quyet_van_de',
    tone: 'problem_solution',
    label: 'Vấn đề và cách giải quyết',
    description: 'Mở đầu bằng nỗi khó chịu quen thuộc rồi đưa ra lối thoát.',
    lines: [
      {
        text: 'Bạn có đang gặp cảnh loay hoay mãi mà việc vẫn không xong, ngày nào cũng lặp lại đúng một chuyện phiền phức đó không?',
        role: 'hook',
        emphasis: ['loay hoay'],
      },
      {
        text: 'Mình từng như vậy suốt một thời gian dài, thử đủ cách nhưng không cái nào giải quyết được tận gốc.',
        role: 'usp',
        emphasis: ['tận gốc'],
      },
      {
        text: 'Cho đến khi mình dùng {ten}, mọi thứ gọn lại chỉ còn một thao tác duy nhất, làm một lần là xong.',
        role: 'usp',
        emphasis: ['một thao tác duy nhất'],
      },
      {
        text: 'Điều bất ngờ là nó không hề đắt như mình tưởng, chỉ {gia} cho thứ dùng được hằng ngày.',
        role: 'usp',
        emphasis: ['{gia}'],
      },
      {
        text: 'Sau vài tuần thì mình nhận ra thứ tiết kiệm được lớn nhất không phải tiền, mà là thời gian và sự bực bội.',
        role: 'usp',
        emphasis: ['thời gian'],
      },
      {
        text: 'Nếu bạn cũng đang mắc đúng chuyện đó, link ở ngay dưới video này.',
        role: 'cta',
        emphasis: [],
      },
    ],
  },
  {
    code: 'canh_bao_truoc_khi_mua',
    tone: 'warning',
    label: 'Cảnh báo trước khi mua',
    description: 'Giọng cảnh báo, giữ chân người xem bằng thông tin họ sợ bỏ lỡ.',
    lines: [
      {
        text: 'Khoan đã, đừng mua {ten} khi bạn còn chưa biết ba điều này, nếu không rất dễ mua nhầm loại không hợp.',
        role: 'hook',
        emphasis: ['Khoan đã', 'mua nhầm'],
      },
      {
        text: 'Điều đầu tiên, trên thị trường có nhiều phiên bản trông giống hệt nhau nhưng chất lượng chênh nhau rất xa.',
        role: 'usp',
        emphasis: ['chênh nhau rất xa'],
      },
      {
        text: 'Điều thứ hai, hãy nhìn kỹ thông số thay vì nhìn ảnh, vì ảnh nào cũng đẹp như nhau cả.',
        role: 'usp',
        emphasis: ['nhìn kỹ thông số'],
      },
      {
        text: 'Điều thứ ba, giá {gia} là mức hợp lý; thấy rẻ hơn nhiều thì bạn nên xem lại nguồn gốc.',
        role: 'usp',
        emphasis: ['{gia}'],
      },
      {
        text: 'Mình để link chỗ mình đã mua và thấy yên tâm, bạn tham khảo cho đỡ mất công tìm.',
        role: 'usp',
        emphasis: ['yên tâm'],
      },
      {
        text: 'Xem kỹ rồi hãy quyết định nhé, link nằm ngay dưới video.',
        role: 'cta',
        emphasis: [],
      },
    ],
  },
  {
    code: 'cau_chuyen_ngan',
    tone: 'storytelling',
    label: 'Câu chuyện ngắn',
    description: 'Kể một tình huống có mở đầu và kết thúc, hợp với quà tặng.',
    lines: [
      {
        text: 'Tuần trước mình mua {ten} chỉ vì tò mò, không nghĩ là nó đổi luôn cả thói quen mỗi sáng của mình.',
        role: 'hook',
        emphasis: ['đổi luôn cả thói quen'],
      },
      {
        text: 'Ngày đầu tiên mình còn chưa quen, thấy hơi lạ tay và định để đó một thời gian rồi tính tiếp.',
        role: 'usp',
        emphasis: [],
      },
      {
        text: 'Nhưng đến ngày thứ ba thì mình dùng liên tục, vì hoá ra nó tiện hơn hẳn cách mình vẫn làm bấy lâu nay.',
        role: 'usp',
        emphasis: ['tiện hơn hẳn'],
      },
      {
        text: 'Đến giờ thì nó thành thứ mình dùng mỗi ngày, và mình đã mua thêm một cái nữa để tặng.',
        role: 'usp',
        emphasis: ['mua thêm một cái nữa'],
      },
      {
        text: 'Giá {gia} cho một món dùng hằng ngày thì mình thấy hoàn toàn xứng đáng.',
        role: 'usp',
        emphasis: ['{gia}'],
      },
      {
        text: 'Bạn nào muốn thử thì link mình để dưới video nhé.',
        role: 'cta',
        emphasis: [],
      },
    ],
  },
];

export const findTemplate = (code: string): ScriptTemplate | undefined =>
  SCRIPT_TEMPLATES.find((template) => template.code === code);

/**
 * Dựng danh sách dòng thoại từ một mẫu.
 *
 * Số dòng suy ra từ độ dài mục tiêu: 30 giây lấy 3 dòng, 60 giây lấy 6 — luôn giữ dòng
 * `hook` đầu tiên và dòng `cta` cuối cùng, vì bỏ mất một trong hai thì video mất tác dụng
 * bán hàng.
 */
export const buildLinesFromTemplate = (
  template: ScriptTemplate,
  durationSec: number,
  product: { name?: string; price?: string },
): {
  index: number;
  text: string;
  role: 'hook' | 'usp' | 'cta';
  assetId: null;
  emphasis: string[];
  durationMs: number;
}[] => {
  const clamped = Math.min(
    MAX_DURATION_SEC,
    Math.max(MIN_DURATION_SEC, Math.round(durationSec)),
  );
  const wanted = Math.max(2, Math.round(clamped / SECONDS_PER_LINE));

  const hook = template.lines[0]!;
  const cta = template.lines[template.lines.length - 1]!;
  const middle = template.lines.slice(1, -1).slice(0, Math.max(0, wanted - 2));

  const fill = (text: string): string =>
    text
      .replaceAll('{ten}', product.name?.trim() || 'sản phẩm này')
      .replaceAll('{gia}', product.price?.trim() || 'mức giá hiện tại');

  return [hook, ...middle, cta].map((line, index) => ({
    index,
    text: fill(line.text),
    role: line.role,
    assetId: null,
    emphasis: line.emphasis.map(fill),
    durationMs: SECONDS_PER_LINE * 1000,
  }));
};
