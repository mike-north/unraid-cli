/**
 * Docker tools. Thin adapters over the SDK Docker operations.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listContainers, getContainer, getContainerLogs, getUpdateStatuses } from '@unraid-cli/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register Docker tools on the given server. */
export function registerDockerTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_containers',
    {
      title: 'List Unraid Docker Containers',
      description: `List Docker containers with name, image, state (running/exited/paused), status text, autostart settings, update availability, and published ports. Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await listContainers(ctx.client, { limit, offset })),
  );

  server.registerTool(
    'unraid_get_container',
    {
      title: 'Get Unraid Docker Container',
      description: `Get detailed information about a single Docker container by id, including image, command, sizes, network mode, ports, autostart, template path, and WebUI/support URLs. Fails with NOT_FOUND if no container has that id.`,
      inputSchema: { id: z.string().describe('The container id (PrefixedID)') },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ id }) => formatResult(await getContainer(ctx.client, id)),
  );

  server.registerTool(
    'unraid_container_logs',
    {
      title: 'Get Unraid Docker Container Logs',
      description: `Fetch recent log lines for a container. Use 'tail' to limit to the last N lines and 'since' (ISO timestamp or cursor) to resume. Output is size-capped; 'truncated' indicates older lines were dropped to fit.`,
      inputSchema: {
        id: z.string().describe('The container id (PrefixedID)'),
        tail: z.number().int().optional().describe('Return only the last N lines'),
        since: z
          .string()
          .optional()
          .describe('Only return lines after this ISO timestamp / cursor'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ id, tail, since }) =>
      formatResult(await getContainerLogs(ctx.client, { id, tail, since })),
  );

  server.registerTool(
    'unraid_container_update_statuses',
    {
      title: 'Get Unraid Container Update Statuses',
      description: `Report per-container update availability (UP_TO_DATE / UPDATE_AVAILABLE / REBUILD_READY / UNKNOWN). Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) =>
      formatResult(await getUpdateStatuses(ctx.client, { limit, offset })),
  );
}
