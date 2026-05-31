/**
 * Shared MCP input-schema fragment for paginated tools.
 *
 * Wrappers only parse the *shape* of input; semantic validation (positive
 * limit, non-negative offset) is owned by the SDK, which returns a structured
 * `VALIDATION_ERROR` envelope.
 */

import { z } from 'zod';

/** Raw-shape fragment adding `limit`/`offset` to a tool's input schema. */
export const PAGINATION_INPUT = {
  limit: z.number().int().optional().describe('Maximum number of items to return'),
  offset: z.number().int().optional().describe('Number of items to skip from the start'),
};
