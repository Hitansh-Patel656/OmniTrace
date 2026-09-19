import { Request } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse ?page= and ?limit= from the query string.
 * page  defaults to 1, minimum 1.
 * limit defaults to 20, maximum 100.
 */
export function parsePagination(query: Request["query"]): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Wrap an array of results in the standard paginated envelope.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
