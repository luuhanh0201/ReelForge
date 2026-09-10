import { z } from "zod";

/**
 * Hợp đồng của hệ thống tour hướng dẫn.
 *
 * Viết cho **mọi khu vực của sản phẩm**, không riêng Studio: các tính năng sắp mở (tạo từ
 * link, biên dịch video) sẽ khai báo thêm một `TourScope` và dùng lại nguyên bộ máy.
 *
 * Hai danh mục dưới đây là **hợp đồng ngầm giữa mã nguồn và dữ liệu quản trị viên nhập**:
 *
 * - `anchors` — những điểm neo mà giao diện có gắn `data-tour`.
 * - `actions` — những trạng thái mà tour được phép chuẩn bị trước một bước.
 *
 * Cả hai **phải do mã nguồn khai báo**, không phải do admin gõ tự do. Để admin nhập một
 * selector bất kỳ thì họ sẽ gõ sai một ký tự và tour hỏng im lặng; còn cho phép nhập lệnh
 * tự do thì đó là một lỗ hổng thực thi mã. Vì vậy trình soạn ở trang quản trị chỉ được
 * chọn từ hai danh sách này.
 */

export const TourPlacements = ["auto", "top", "bottom", "left", "right"] as const;
export type TourPlacement = (typeof TourPlacements)[number];

export interface TourAnchor {
  id: string;
  label: string;
}

export interface TourAction {
  id: string;
  label: string;
  /** Bỏ trống nghĩa là hành động không cần tham số. */
  values?: { id: string; label: string }[];
}

export interface TourScope {
  key: string;
  label: string;
  /** Đường dẫn nơi tour này chạy, để trang quản trị mở xem thử đúng chỗ. */
  path: string;
  anchors: TourAnchor[];
  actions: TourAction[];
}

/**
 * Danh mục neo và hành động của từng khu vực.
 *
 * Thêm một khu vực mới = thêm một phần tử ở đây + gắn `data-tour` tương ứng vào giao diện.
 * Không phải sửa gì trong bộ máy tour.
 */
export const TOUR_SCOPES: TourScope[] = [
  {
    key: "studio",
    label: "Phòng dựng video",
    path: "/studio",
    anchors: [
      { id: "studio.title", label: "Tên dự án" },
      { id: "studio.aspect", label: "Bộ chọn khổ video" },
      { id: "studio.history", label: "Hoàn tác / Làm lại" },
      { id: "studio.timecode", label: "Đồng hồ thời gian" },
      { id: "studio.ai", label: "Nút AI Magic" },
      { id: "studio.credits", label: "Số dư credit" },
      { id: "studio.export", label: "Nút xuất MP4" },
      { id: "studio.scenes", label: "Cột phân cảnh" },
      { id: "studio.add-scene", label: "Nút thêm cảnh" },
      { id: "studio.stage", label: "Khung xem trước" },
      { id: "studio.transport", label: "Thanh phát lại" },
      { id: "studio.panel-tabs", label: "Ba tab cột phải" },
      { id: "studio.templates", label: "Danh sách mẫu kịch bản" },
      { id: "studio.script", label: "Ô lời thoại" },
      { id: "studio.assets", label: "Khu vực ảnh sản phẩm" },
      { id: "studio.subtitle-presets", label: "Kiểu phụ đề có sẵn" },
      { id: "studio.subtitle-colors", label: "Bảng màu phụ đề" },
      { id: "studio.voice-list", label: "Danh sách giọng đọc" },
      { id: "studio.synthesize", label: "Nút lồng tiếng" },
      { id: "studio.timeline", label: "Thước thời gian" },
      { id: "studio.track-toggles", label: "Công tắc hiển thị track" },
    ],
    actions: [
      {
        id: "openTab",
        label: "Mở tab ở cột phải",
        values: [
          { id: "content", label: "Nội dung" },
          { id: "subtitle", label: "Phụ đề" },
          { id: "voice", label: "Giọng đọc" },
        ],
      },
    ],
  },
  {
    key: "dashboard",
    label: "Danh sách dự án",
    path: "/studio",
    anchors: [
      { id: "dashboard.entries", label: "Ba lối vào tạo dự án" },
      { id: "dashboard.credits", label: "Số dư credit" },
      { id: "dashboard.projects", label: "Lưới dự án" },
    ],
    actions: [],
  },
];

export const findTourScope = (key: string): TourScope | undefined =>
  TOUR_SCOPES.find((scope) => scope.key === key);

export const TourStepSchema = z.object({
  /** Ổn định qua các lần sửa: số liệu thống kê bám theo id này, không phải theo thứ tự. */
  id: z.string().min(1).max(60),
  anchor: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
  placement: z.enum(TourPlacements).default("auto"),
  /** Trạng thái cần chuẩn bị trước khi tô sáng bước này. */
  prepare: z
    .object({
      action: z.string().min(1).max(60),
      value: z.string().max(60).optional(),
    })
    .nullable()
    .default(null),
});

export const TourSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  /** Hiện tự động cho người chưa từng xem. Tắt thì chỉ mở được bằng tay. */
  autoStart: z.boolean().default(true),
  steps: z.array(TourStepSchema).max(30).default([]),
});

export type TourStep = z.infer<typeof TourStepSchema>;
export type Tour = z.infer<typeof TourSchema>;

/**
 * Kiểm tra một tour có trỏ vào neo hoặc hành động không còn tồn tại hay không.
 *
 * Neo là hợp đồng ngầm: đổi bố cục giao diện là có thể làm gãy một bước tour mà không có
 * gì báo lỗi lúc biên dịch. Hàm này để trang quản trị cảnh báo ngay trong trình soạn, thay
 * vì đợi người dùng thật gặp một bước treo.
 */
export const findBrokenSteps = (
  tour: Tour,
  scope: TourScope | undefined,
): { stepId: string; reason: string }[] => {
  if (!scope) return tour.steps.map((step) => ({ stepId: step.id, reason: "Không tìm thấy khu vực" }));

  const anchors = new Set(scope.anchors.map((anchor) => anchor.id));
  const actions = new Map(scope.actions.map((action) => [action.id, action]));

  return tour.steps.flatMap((step) => {
    if (!anchors.has(step.anchor)) {
      return [{ stepId: step.id, reason: `Neo "${step.anchor}" không còn trong giao diện` }];
    }

    if (!step.prepare) return [];

    const action = actions.get(step.prepare.action);
    if (!action) {
      return [{ stepId: step.id, reason: `Hành động "${step.prepare.action}" không còn` }];
    }

    if (action.values && !action.values.some((item) => item.id === step.prepare?.value)) {
      return [{ stepId: step.id, reason: `Giá trị "${step.prepare.value ?? ""}" không hợp lệ` }];
    }

    return [];
  });
};

/** Tour mặc định của Studio — dùng khi cơ sở dữ liệu chưa có bản nào được xuất bản. */
export const DEFAULT_STUDIO_TOUR: Tour = {
  key: "studio",
  label: "Làm quen phòng dựng",
  enabled: true,
  autoStart: true,
  steps: [
    {
      id: "scenes",
      anchor: "studio.scenes",
      title: "Video của bạn gồm nhiều cảnh",
      body: "Mỗi cảnh là một câu thoại kèm một tấm ảnh. Bấm vào một cảnh để sửa nội dung của riêng nó.",
      placement: "right",
      prepare: null,
    },
    {
      id: "templates",
      anchor: "studio.templates",
      title: "Bắt đầu từ một mẫu kịch bản",
      body: "Chọn một mẫu là có ngay đủ cảnh với lời thoại viết sẵn. Sửa lại theo sản phẩm của bạn sau cũng được.",
      placement: "left",
      prepare: { action: "openTab", value: "content" },
    },
    {
      id: "assets",
      anchor: "studio.assets",
      title: "Tải ảnh sản phẩm lên",
      body: "Ảnh tối thiểu 400×400. Tải xong bấm vào ảnh để gán cho cảnh đang chọn.",
      placement: "left",
      prepare: { action: "openTab", value: "content" },
    },
    {
      id: "stage",
      anchor: "studio.stage",
      title: "Xem trước ngay tại đây",
      body: "Khung này vẽ đúng bằng bộ máy dùng để xuất video, nên thứ bạn thấy chính là thứ sẽ nhận được. Kéo dải nét đứt để đổi vị trí phụ đề.",
      placement: "right",
      prepare: null,
    },
    {
      id: "subtitle",
      anchor: "studio.subtitle-presets",
      title: "Đổi kiểu phụ đề",
      body: "Bốn kiểu có sẵn để bắt đầu nhanh, rồi chỉnh màu, cỡ chữ và hiệu ứng bên dưới.",
      placement: "left",
      prepare: { action: "openTab", value: "subtitle" },
    },
    {
      id: "voice",
      anchor: "studio.voice-list",
      title: "Chọn giọng đọc",
      body: "Bấm nút tam giác để nghe thử — nghe bao nhiêu lần cũng không tốn phí.",
      placement: "left",
      prepare: { action: "openTab", value: "voice" },
    },
    {
      id: "synthesize",
      anchor: "studio.synthesize",
      title: "Lồng tiếng cho cả video",
      body: "Một lần bấm là tạo tiếng cho mọi cảnh còn thiếu. Cảnh đã có tiếng sẽ được bỏ qua để khỏi tốn hạn mức.",
      placement: "left",
      prepare: { action: "openTab", value: "voice" },
    },
    {
      id: "timeline",
      anchor: "studio.timeline",
      title: "Thước thời gian",
      body: "Kéo mép phải một khối để đổi thời lượng cảnh. Icon con mắt cạnh mỗi track để bật tắt hiển thị khi xem trước.",
      placement: "top",
      prepare: null,
    },
    {
      id: "export",
      anchor: "studio.export",
      title: "Xuất video",
      body: "Chọn độ phân giải rồi bắt đầu. Video dựng ngay trên máy bạn, mỗi lần xuất trừ 1 credit và được hoàn lại nếu thất bại.",
      placement: "bottom",
      prepare: null,
    },
  ],
};
