/**
 * Khai báo các nhà cung cấp có credential lưu trong hệ thống.
 *
 * Trước đây mọi thứ đóng cứng cho Google TTS — tên provider, hình dạng credential, cách gọi
 * thử — nên thêm nhà cung cấp thứ hai là phải mổ cả service. Nay `ProviderCredentialsService`
 * chỉ biết tới interface này; thêm Gemini hay một nhà cung cấp video chỉ là thêm một bản
 * cài đặt và một dòng trong danh sách.
 */

/** `service_account` — tải lên file JSON. `api_key` — dán một chuỗi. */
export type CredentialType = 'service_account' | 'api_key';

/** Metadata đã che để hiển thị cho admin. Tuyệt đối không chứa mẩu bí mật nào. */
export interface CredentialDescription {
  projectId: string | null;
  clientEmailMasked: string | null;
  privateKeyIdSuffix: string | null;
  /** Chuỗi ngắn giúp admin nhận ra mình đang cầm credential nào, ví dụ `AIza…7x2K`. */
  displayHint: string;
  /** Nguồn để băm vân tay — so sánh credential mà không lưu bản rõ. */
  fingerprintSource: string;
}

export interface CredentialVerification {
  latencyMs: number;
  /** Ghi vào nhật ký kiểm toán; không được chứa bí mật. */
  metadata: Record<string, unknown>;
}

export interface CredentialProviderSpec {
  readonly id: string;
  readonly label: string;
  readonly type: CredentialType;
  /** Trang lấy credential, để giao diện chỉ đường thay vì bắt admin tự tìm. */
  readonly docsUrl: string;

  /**
   * Đọc và kiểm tra thứ admin gửi lên, ném `BusinessException` nếu sai.
   *
   * Trả về payload sẽ được mã hoá nguyên văn. Với service account đó là object JSON, với
   * api key là chính chuỗi khoá.
   */
  parse(input: { file?: Buffer; value?: string }): unknown;

  describe(payload: unknown): CredentialDescription;

  /** Gọi thật sang nhà cung cấp. Hỏng thì ném `BusinessException` đã map sang mã ổn định. */
  verify(payload: unknown): Promise<CredentialVerification>;
}

/** Token inject danh sách nhà cung cấp. */
export const CREDENTIAL_SPECS = 'CREDENTIAL_SPECS';
