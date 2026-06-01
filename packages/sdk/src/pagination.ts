/**
 * List pagination and size-capping for SDK operations.
 *
 * Most Unraid list queries return a whole collection with no server-side
 * windowing, so the SDK applies `offset`/`limit` client-side and additionally
 * trims any window whose serialized size exceeds {@link CHARACTER_LIMIT}. The
 * resulting {@link PaginatedList} is self-describing (`total`, `returned`,
 * `truncated`) so wrappers can render a faithful summary and callers know when
 * to page further.
 */

import { z } from 'zod';
import { CHARACTER_LIMIT } from './constants.js';
import { UnraidErrorCode, type UnraidError, createError } from './errors.js';

/** Caller-supplied windowing for a list operation. */
export interface PaginationParams {
  /** Maximum number of items to return. Omit for "all" (still size-capped). */
  readonly limit?: number | undefined;
  /** Number of items to skip from the start of the collection. Defaults to 0. */
  readonly offset?: number | undefined;
}

/** A windowed, size-capped slice of a larger collection. */
export interface PaginatedList<T> {
  /** The returned items (after offset/limit and size-capping). */
  readonly items: readonly T[];
  /** Total number of items available before windowing. */
  readonly total: number;
  /** Number of items actually returned (`items.length`). */
  readonly returned: number;
  /** The applied limit, or `null` when unbounded. */
  readonly limit: number | null;
  /** The applied offset. */
  readonly offset: number;
  /** True when items were dropped to stay within {@link CHARACTER_LIMIT}. */
  readonly truncated: boolean;
}

const paginationSchema = z.object({
  limit: z.number().int('limit must be an integer').positive('limit must be a positive integer'),
  offset: z
    .number()
    .int('offset must be an integer')
    .nonnegative('offset must be zero or a positive integer'),
});

/**
 * Validate pagination parameters. Returns a {@link UnraidError} with code
 * `VALIDATION_ERROR` when invalid, or `null` when the params are acceptable
 * (including when both are omitted).
 */
export function validatePagination(params: PaginationParams = {}): UnraidError | null {
  const candidate: Record<string, number> = {};
  if (params.limit !== undefined) candidate['limit'] = params.limit;
  if (params.offset !== undefined) candidate['offset'] = params.offset;

  const result = paginationSchema.partial().safeParse(candidate);
  if (result.success) return null;

  const message = result.error.issues.map((issue) => issue.message).join('; ');
  return createError(UnraidErrorCode.VALIDATION_ERROR, `Invalid pagination: ${message}`);
}

/**
 * Apply `offset`/`limit` to `all`, then drop trailing items until the serialized
 * window fits within `charLimit`. Pure and side-effect free; callers should
 * validate params with {@link validatePagination} first.
 */
export function paginateList<T>(
  all: readonly T[],
  params: PaginationParams = {},
  charLimit: number = CHARACTER_LIMIT,
): PaginatedList<T> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? null;

  const windowed = limit === null ? all.slice(offset) : all.slice(offset, offset + limit);

  // The serialized length of a prefix grows monotonically with its item count,
  // so binary-search the largest prefix that fits the character budget rather
  // than dropping (and re-serializing) one item at a time.
  let lo = 0;
  let hi = windowed.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (JSON.stringify(windowed.slice(0, mid)).length <= charLimit) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const items = windowed.slice(0, best);
  const truncated = items.length < windowed.length;

  return {
    items,
    total: all.length,
    returned: items.length,
    limit,
    offset,
    truncated,
  };
}
