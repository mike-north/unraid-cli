/**
 * Array & parity command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { getArrayStatus, getParityHistory } from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register `array status` and `array parity-history` commands. */
export function registerArrayCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const array = program.command('array').description('Array and parity operations');

  array
    .command('status')
    .description('Show array state, capacity, parity status, and member disks.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getArrayStatus(client));
    });

  array
    .command('parity-history')
    .description('List past parity checks.')
    .option('--limit <n>', 'Maximum number of entries to return', parseIntFlag)
    .option('--offset <n>', 'Number of entries to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        getParityHistory(client, { limit: opts.limit, offset: opts.offset }),
      );
    });
}
