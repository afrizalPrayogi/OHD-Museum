export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  search?: string;
  locale?: string;
  status?: string;
  category?: string;
}

export function parsePaginationParams(url: string): PaginationParams {
  const { searchParams } = new URL(url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;
  const search = searchParams.get('search') || undefined;
  const locale = searchParams.get('locale') || undefined;
  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;

  return { page, limit, offset, search, locale, status, category };
}
