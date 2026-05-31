/**
 * Tool registration dispatcher. Each domain has its own `register*Tools`
 * function; this wires them all onto the server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerContext } from '../server.js';
import { registerSystemTools } from './system.js';
import { registerArrayTools } from './array.js';
import { registerDiskTools } from './disks.js';
import { registerDockerTools } from './docker.js';
import { registerVmTools } from './vm.js';
import { registerShareTools } from './shares.js';
import { registerNotificationTools } from './notifications.js';
import { registerUpsTools } from './ups.js';

/** Register every tool group on the given server. */
export function registerAllTools(server: McpServer, ctx: ServerContext): void {
  registerSystemTools(server, ctx);
  registerArrayTools(server, ctx);
  registerDiskTools(server, ctx);
  registerDockerTools(server, ctx);
  registerVmTools(server, ctx);
  registerShareTools(server, ctx);
  registerNotificationTools(server, ctx);
  registerUpsTools(server, ctx);
}
