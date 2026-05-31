/**
 * Array & parity tools. Thin adapters over the SDK array operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getArrayStatus, getParityHistory } from '@unraid-cli/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register array/parity tools on the given server. */
export function registerArrayTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_array_status',
    {
      title: 'Get Unraid Array Status',
      description: `Get the storage array's current state (STARTED/STOPPED/...), total/used/free capacity, parity-check status, and every member disk (parity, data, cache, boot) with size, filesystem usage, temperature, and health color.`,
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getArrayStatus(ctx.client)),
  );

  server.registerTool(
    'unraid_parity_history',
    {
      title: 'Get Unraid Parity-Check History',
      description: `List past parity checks (date, duration, speed, error count, status). Newest entries first as returned by the server. Use limit/offset to page through a long history.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) =>
      formatResult(await getParityHistory(ctx.client, { limit, offset })),
  );
}
