/**
 * So sánh hai câu thoại xem **lời đọc** có thật sự đổi hay không.
 *
 * Đây là thứ quyết định một lần sửa chữ có phải gọi TTS hay không, nên nó đụng thẳng vào
 * ba thứ người dùng cảm nhận được: tiền, thời gian chờ, và việc mất đoạn tiếng đã có.
 *
 * Rất nhiều lần sửa **không hề đổi cách đọc**: viết hoa lại một chữ, thêm dấu chấm than,
 * chèn emoji, tách một dòng dài thành hai. Coi tất cả là "đã đổi" nghĩa là mỗi lần sửa
 * chính tả đều đốt một lượt hạn mức và bắt người dùng chờ vài giây vô ích.
 *
 * Đặt ở `packages/shared` vì cả máy chủ (quyết định có gỡ đoạn tiếng cũ không) lẫn trình
 * duyệt (quyết định có hiện chỉ báo đang đọc lại không) phải trả lời giống hệt nhau.
 */

/**
 * Đưa câu về dạng chỉ còn những gì ảnh hưởng tới cách đọc.
 *
 * Cụ thể là bỏ dấu câu, bỏ emoji và mọi ký hiệu, gộp khoảng trắng, rồi hạ chữ thường.
 * **Không bỏ dấu tiếng Việt**: "ma" và "mà" là hai từ đọc khác nhau.
 */
export const normalizeSpeech = (text: string): string =>
  text
    .toLowerCase()
    // Giữ chữ và số của mọi bảng chữ cái (có dấu tiếng Việt), bỏ phần còn lại.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

/**
 * Lời đọc có đổi không.
 *
 * Trả `false` nghĩa là **giữ nguyên đoạn tiếng đã có**: chữ trên màn hình đổi ngay, còn
 * audio không phải tạo lại.
 */
export const speechChanged = (before: string, after: string): boolean =>
  normalizeSpeech(before) !== normalizeSpeech(after);
