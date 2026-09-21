import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cho mỗi giọng một câu thoại mẫu riêng.
 *
 * Trước đây cả danh mục dùng chung đúng một câu ("Xin chào, đây là giọng đọc thử của
 * ReelForge..."), nên bốn thẻ nghe thử trên landing hiện y hệt nhau và người nghe không so
 * được giọng nào hợp ngành hàng nào — trong khi đó mới là việc họ đang làm.
 *
 * Câu chia theo giới tính và xoay vòng theo thứ tự tên, để nam không đọc câu viết cho nữ.
 * Chỉ đụng tới giọng **còn dùng câu mặc định cũ**: ai đã sửa tay thì giữ nguyên.
 *
 * Bản nghe thử đã cache **không bị xoá ở đây**: khoá cache có băm câu thoại nên bản cũ tự
 * hết hiệu lực, và nơi phát audio đã lọc theo băm. Giọng nào cần hiện lên landing thì vào
 * trang quản trị bấm tạo lại bản nghe thử — mỗi giọng tốn hơn trăm ký tự.
 */
const OLD_SAMPLE =
  'Xin chào, đây là giọng đọc thử của ReelForge. Sản phẩm đang giảm giá năm mươi phần trăm.';

const FEMALE_SAMPLES = [
  'Da mình dầu mụn, dùng em này hai tuần là căng bóng hẳn, link giảm năm mươi phần trăm ngay dưới nha.',
  'Nồi chiên này nấu bữa sáng cho cả nhà chỉ mười lăm phút, dọn rửa thì đúng một cái lau.',
  'Chiếc váy này lên dáng cực tôn eo, mặc đi làm hay đi chơi đều hợp, size nào cũng còn đủ.',
  'Serum này thấm nhanh, không hề bết dính, buổi sáng dùng xong lớp trang điểm vẫn mượt.',
];

const MALE_SAMPLES = [
  'Pin năm nghìn mi-li-am-pe, sạc nhanh sáu mươi lăm oát, mà giá chưa tới ba triệu, quá đáng tiền.',
  'Tai nghe này chống ồn tốt bất ngờ, đeo cả buổi làm việc vẫn êm tai, pin dùng được ba ngày.',
  'Khoan đã, đừng mua máy lọc không khí khi bạn chưa biết ba điều này, xem hết rồi quyết định.',
  'Mình đã dùng con chuột này sáu tháng, bấm vẫn nhạy, và đây là lý do mình khuyên bạn mua.',
];

export class VariedVoiceSamples1789300000000 implements MigrationInterface {
  name = 'VariedVoiceSamples1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const voices = await queryRunner.query(
      `SELECT "id", "gender" FROM "voices" WHERE "sample_text" = $1 ORDER BY "gender", "persona_name"`,
      [OLD_SAMPLE],
    );

    const counters = { female: 0, male: 0 };

    for (const voice of voices as { id: string; gender: 'female' | 'male' }[]) {
      const pool = voice.gender === 'female' ? FEMALE_SAMPLES : MALE_SAMPLES;
      const sample = pool[counters[voice.gender] % pool.length]!;
      counters[voice.gender] += 1;

      await queryRunner.query(`UPDATE "voices" SET "sample_text" = $1 WHERE "id" = $2`, [
        sample,
        voice.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const samples = [...FEMALE_SAMPLES, ...MALE_SAMPLES];

    await queryRunner.query(
      `UPDATE "voices" SET "sample_text" = $1 WHERE "sample_text" = ANY($2::text[])`,
      [OLD_SAMPLE, samples],
    );
  }
}
