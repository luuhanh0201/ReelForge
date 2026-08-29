import { useMemo, useState } from "react";

/** Các mức số dòng mỗi trang dùng chung cho mọi bảng trong admin. */
export const PAGE_SIZES = [5, 10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 5;

export interface Pagination<T> {
  /** Phần tử của trang hiện tại — thay cho mảng gốc khi render bảng. */
  items: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** Số thứ tự dòng đầu/cuối đang hiển thị (1-based, 0 khi bảng rỗng). */
  from: number;
  to: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/** Phần trạng thái mà thanh phân trang cần — không phụ thuộc kiểu dữ liệu của bảng. */
export type PaginationState = Omit<Pagination<unknown>, "items">;

export function usePagination<T>(
  source: T[],
  initialSize: number = DEFAULT_PAGE_SIZE,
): Pagination<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(initialSize);

  const total = source.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Kẹp trang ngay lúc render: khi bộ lọc thu hẹp danh sách, người dùng không bị
  // kẹt ở một trang trống. Làm kiểu dẫn xuất nên không cần useEffect (eslint chặn
  // setState trong effect).
  const safePage = Math.min(page, pageCount);

  const items = useMemo(
    () => source.slice((safePage - 1) * pageSize, safePage * pageSize),
    [source, safePage, pageSize],
  );

  return {
    items,
    page: safePage,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, total),
    setPage,
    setPageSize: (size: number) => {
      setSize(size);
      setPage(1);
    },
  };
}
