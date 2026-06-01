/**
 * Shared MCP tool annotations.
 *
 * Every Phase 1 tool is a read-only observation: it never mutates server state,
 * is safe to retry, and reaches an external system (the Unraid API).
 */

/** Annotations for a read-only, idempotent tool that calls the Unraid API. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
