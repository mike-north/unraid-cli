/**
 * Notification command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import {
  listNotifications,
  getNotificationOverview,
  type ListNotificationsParams,
} from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register `notifications list` and `notifications overview` commands. */
export function registerNotificationCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const notifications = program.command('notifications').description('Notification operations');

  notifications
    .command('list')
    .description('List notifications by queue and severity.')
    .option('--type <type>', 'Queue to read: UNREAD (default) or ARCHIVE')
    .option('--importance <level>', 'Filter to a severity: INFO, WARNING, or ALERT')
    .option('--limit <n>', 'Maximum number of notifications to return', parseIntFlag)
    .option('--offset <n>', 'Number of notifications to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{
        type?: ListNotificationsParams['type'];
        importance?: ListNotificationsParams['importance'];
        limit?: number;
        offset?: number;
      }>();
      await runAction(getGlobals(this), (client) =>
        listNotifications(client, {
          type: opts.type,
          importance: opts.importance,
          limit: opts.limit,
          offset: opts.offset,
        }),
      );
    });

  notifications
    .command('overview')
    .description('Show unread/archived notification counts by severity.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getNotificationOverview(client));
    });
}
