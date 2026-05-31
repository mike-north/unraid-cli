/**
 * Notification tools. Thin adapters over the SDK notification operations.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listNotifications, getNotificationOverview } from '@unraid-cli/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register notification tools on the given server. */
export function registerNotificationTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_notifications',
    {
      title: 'List Unraid Notifications',
      description: `List notifications filtered by queue ('UNREAD' default, or 'ARCHIVE') and optional severity ('INFO'/'WARNING'/'ALERT'). Use limit/offset to page. For aggregate counts use unraid_notifications_overview.`,
      inputSchema: {
        type: z
          .enum(['UNREAD', 'ARCHIVE'])
          .optional()
          .describe('Which queue to read (default UNREAD)'),
        importance: z
          .enum(['INFO', 'WARNING', 'ALERT'])
          .optional()
          .describe('Filter to a single severity'),
        ...PAGINATION_INPUT,
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ type, importance, limit, offset }) =>
      formatResult(await listNotifications(ctx.client, { type, importance, limit, offset })),
  );

  server.registerTool(
    'unraid_notifications_overview',
    {
      title: 'Get Unraid Notifications Overview',
      description: `Get unread and archived notification counts broken down by severity (info/warning/alert/total). A fast way to check whether the server needs attention.`,
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getNotificationOverview(ctx.client)),
  );
}
