export type PaginationParams = Record<string, string | string[] | undefined>;

export function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function pagination(total: number, requested: string | string[] | undefined, pageSize: number) {
  const value = Number(queryValue(requested));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isSafeInteger(value) && value > 0 ? Math.min(value, pageCount) : 1;
  return { total, page, pageSize, pageCount, offset: (page - 1) * pageSize };
}

export type Pagination = ReturnType<typeof pagination>;

export function paginationHref(pathname: string, params: PaginationParams, key: string, page: number) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === key || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(name, item);
  }
  if (page > 1) query.set(key, String(page));
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
