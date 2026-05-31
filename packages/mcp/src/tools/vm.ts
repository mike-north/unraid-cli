/**
 * Virtual machine tools. Thin adapter over the SDK VM operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listVms } from '@unraid-cli/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register VM tools on the given server. */
export function registerVmTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_vms',
    {
      title: 'List Unraid Virtual Machines',
      description: `List the virtual machines (libvirt domains) known to Unraid with their id, name, and current run state (RUNNING/SHUTOFF/PAUSED/...). Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await listVms(ctx.client, { limit, offset })),
  );
}
