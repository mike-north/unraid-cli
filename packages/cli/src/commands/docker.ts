/**
 * Docker command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { listContainers, getContainer, getContainerLogs, getUpdateStatuses } from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register `docker containers|container|logs|update-status` commands. */
export function registerDockerCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const docker = program.command('docker').description('Docker container operations');

  docker
    .command('containers')
    .description('List Docker containers.')
    .option('--limit <n>', 'Maximum number of containers to return', parseIntFlag)
    .option('--offset <n>', 'Number of containers to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        listContainers(client, { limit: opts.limit, offset: opts.offset }),
      );
    });

  docker
    .command('container')
    .description('Show details for a single container by id.')
    .argument('<id>', 'The container id')
    .action(async function (this: Command, id: string) {
      await runAction(getGlobals(this), (client) => getContainer(client, id));
    });

  docker
    .command('logs')
    .description('Show recent log lines for a container.')
    .argument('<id>', 'The container id')
    .option('--tail <n>', 'Return only the last N lines', parseIntFlag)
    .option('--since <ts>', 'Only return lines after this ISO timestamp / cursor')
    .action(async function (this: Command, id: string) {
      const opts = this.opts<{ tail?: number; since?: string }>();
      await runAction(getGlobals(this), (client) =>
        getContainerLogs(client, { id, tail: opts.tail, since: opts.since }),
      );
    });

  docker
    .command('update-status')
    .description('Show per-container update availability.')
    .option('--limit <n>', 'Maximum number of containers to return', parseIntFlag)
    .option('--offset <n>', 'Number of containers to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        getUpdateStatuses(client, { limit: opts.limit, offset: opts.offset }),
      );
    });
}
