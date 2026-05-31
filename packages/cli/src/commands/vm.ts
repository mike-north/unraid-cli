/**
 * Virtual machine command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { listVms } from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register the `vm list` command. */
export function registerVmCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const vm = program.command('vm').description('Virtual machine operations');

  vm.command('list')
    .description('List virtual machines and their run state.')
    .option('--limit <n>', 'Maximum number of VMs to return', parseIntFlag)
    .option('--offset <n>', 'Number of VMs to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        listVms(client, { limit: opts.limit, offset: opts.offset }),
      );
    });
}
