import { paginationQuerySchema } from '@smart-campus/validation';

export type Pagination = { skip?: number; take?: number };

/** Paginação opcional mantém o contrato das consultas já existentes. */
export function readPagination(query: Record<string, unknown>): Pagination {
  if (query.offset === undefined && query.limit === undefined) return {};
  const page = paginationQuerySchema.parse({ offset: query.offset, limit: query.limit });
  return { skip: page.offset, take: page.limit };
}
