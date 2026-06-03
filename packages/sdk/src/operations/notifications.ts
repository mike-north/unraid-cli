/**
 * Notification operations.
 *
 * `listNotifications` returns notifications filtered by type (unread/archive)
 * and optional importance, paged server-side via the `NotificationFilter`
 * (offset/limit) and size-capped client-side. `getNotificationOverview` returns
 * the cached unread/archive counts by severity.
 *
 * @see https://docs.unraid.net/API/
 */

import { gql } from 'graphql-request';
import type { UnraidClient } from '../client.js';
import { toUnraidError } from '../errors.js';
import { type UnraidResult, success, failure } from '../result.js';
import { CHARACTER_LIMIT } from '../constants.js';
import {
  type PaginationParams,
  type PaginatedList,
  paginateList,
  validatePagination,
} from '../pagination.js';
import type {
  ListNotificationsQuery,
  ListNotificationsQueryVariables,
  GetNotificationOverviewQuery,
  NotificationType,
  NotificationImportance,
  CreateNotificationMutation,
  CreateNotificationMutationVariables,
  ArchiveNotificationMutation,
  UnarchiveNotificationMutation,
} from '../unraid/generated.js';

/** A single notification. */
export type NotificationItem = ListNotificationsQuery['notifications']['list'][number];

/** Unread/archive notification counts by severity. */
export type NotificationOverview = GetNotificationOverviewQuery['notifications']['overview'];

/** Default page size when a caller does not specify `limit`. */
const DEFAULT_NOTIFICATION_LIMIT = 50;

/** Options for {@link listNotifications}. */
export interface ListNotificationsParams extends PaginationParams {
  /** Which queue to read: `UNREAD` (default) or `ARCHIVE`. */
  readonly type?: NotificationType | undefined;
  /** Filter to a single severity (`INFO`/`WARNING`/`ALERT`). */
  readonly importance?: NotificationImportance | undefined;
}

const LIST_NOTIFICATIONS_QUERY = gql`
  query ListNotifications($filter: NotificationFilter!) {
    notifications {
      list(filter: $filter) {
        id
        title
        subject
        description
        importance
        link
        type
        timestamp
        formattedTimestamp
      }
    }
  }
`;

/**
 * List notifications by type/importance, paged and size-capped.
 *
 * Note: the underlying query is paged server-side via `NotificationFilter`, so
 * the returned `PaginatedList.total` reflects the size of the returned page
 * (after the server applied `offset`/`limit`), not the grand total in the queue.
 * Use {@link getNotificationOverview} for queue-wide counts by severity.
 */
export async function listNotifications(
  client: UnraidClient,
  params: ListNotificationsParams = {},
): Promise<UnraidResult<PaginatedList<NotificationItem>>> {
  const invalid = validatePagination(params);
  if (invalid) return failure(invalid);

  const offset = params.offset ?? 0;
  const limit = params.limit ?? DEFAULT_NOTIFICATION_LIMIT;

  try {
    const variables: ListNotificationsQueryVariables = {
      filter: {
        type: params.type ?? 'UNREAD',
        offset,
        limit,
        ...(params.importance !== undefined ? { importance: params.importance } : {}),
      },
    };
    const data = await client.request<ListNotificationsQuery>(LIST_NOTIFICATIONS_QUERY, variables);
    const list = data.notifications.list;
    const capped = paginateList(list, {}, CHARACTER_LIMIT);
    return success({
      items: capped.items,
      total: list.length,
      returned: capped.returned,
      limit,
      offset,
      truncated: capped.truncated,
    });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const NOTIFICATION_OVERVIEW_QUERY = gql`
  query GetNotificationOverview {
    notifications {
      overview {
        unread {
          info
          warning
          alert
          total
        }
        archive {
          info
          warning
          alert
          total
        }
      }
    }
  }
`;

/** Retrieve unread/archive notification counts by severity. */
export async function getNotificationOverview(
  client: UnraidClient,
): Promise<UnraidResult<NotificationOverview>> {
  try {
    const data = await client.request<GetNotificationOverviewQuery>(NOTIFICATION_OVERVIEW_QUERY);
    return success(data.notifications.overview);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

// --- Phase 2: notification control --------------------------------------------

/** A notification returned by a create/archive/unarchive mutation. */
export type NotificationDetail = CreateNotificationMutation['createNotification'];

/** Fields for a notification to create. */
export interface NewNotification {
  /** Short event title. */
  readonly title: string;
  /** Notification subject line. */
  readonly subject: string;
  /** Body text. */
  readonly description: string;
  /** Severity (`INFO`/`WARNING`/`ALERT`). */
  readonly importance: NotificationImportance;
  /** Optional link to more detail. */
  readonly link?: string | undefined;
}

const CREATE_NOTIFICATION_MUTATION = gql`
  mutation CreateNotification($input: NotificationData!) {
    createNotification(input: $input) {
      id
      title
      subject
      description
      importance
      link
      type
      timestamp
      formattedTimestamp
    }
  }
`;

/**
 * Resolve the server's canonical id for a just-created notification.
 *
 * Unraid's `createNotification` echoes back a UUID-based id, but stores the
 * notification under a *different*, timestamp-based id (verified on 7.2.3), so
 * the returned id cannot be used with archive/unarchive. This looks up the
 * unread queue and matches by content (title/subject/description/importance) to
 * recover the usable id.
 *
 * Best-effort: returns `null` if the lookup fails (e.g. a write-only key that
 * cannot read notifications) or no match is found, so the caller can fall back
 * to the raw create response. When several entries match the same content, the
 * most recent (by `timestamp`) wins — that is the one just created.
 */
async function resolveCanonicalNotificationId(
  client: UnraidClient,
  created: NotificationDetail,
): Promise<string | null> {
  const listed = await listNotifications(client, { type: 'UNREAD', limit: 100 });
  if (!listed.success) return null;

  const matches = listed.data.items.filter(
    (n) =>
      n.title === created.title &&
      n.subject === created.subject &&
      n.description === created.description &&
      n.importance === created.importance,
  );
  if (matches.length === 0) return null;

  // Pick the most recent match by parsed timestamp (lexical string compare is
  // unreliable across mixed ISO offsets/precision). `Date.parse` yields NaN for
  // absent/unparseable values; treat those as oldest so a parseable entry wins,
  // and keep the first match when nothing parses.
  const parse = (ts: string | null | undefined): number => {
    const ms = ts == null ? NaN : Date.parse(ts);
    return Number.isNaN(ms) ? -Infinity : ms;
  };
  const newest = matches.reduce((a, b) => (parse(b.timestamp) > parse(a.timestamp) ? b : a));
  return newest.id;
}

/**
 * Create a new notification.
 *
 * Returns the created notification with a usable `id`. Unraid's API echoes back
 * a non-canonical id from the create mutation (it stores the notification under
 * a different, timestamp-based id), so this performs a best-effort lookup of the
 * unread queue to resolve the canonical id before returning — making the
 * create → {@link archiveNotification} / {@link unarchiveNotification} flow work
 * without the caller having to list first.
 *
 * If that lookup cannot run (e.g. an API key with notification *write* but not
 * *read* scope) or finds no match, the raw create response is returned
 * unchanged; in that case its `id` may not be usable for archive/unarchive and
 * the caller should list the unread queue to obtain the canonical id.
 */
export async function createNotification(
  client: UnraidClient,
  input: NewNotification,
): Promise<UnraidResult<NotificationDetail>> {
  try {
    const variables: CreateNotificationMutationVariables = {
      input: {
        title: input.title,
        subject: input.subject,
        description: input.description,
        importance: input.importance,
        ...(input.link !== undefined ? { link: input.link } : {}),
      },
    };
    const data = await client.request<CreateNotificationMutation>(
      CREATE_NOTIFICATION_MUTATION,
      variables,
    );
    const created = data.createNotification;
    const canonicalId = await resolveCanonicalNotificationId(client, created);
    return success(canonicalId === null ? created : { ...created, id: canonicalId });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const ARCHIVE_NOTIFICATION_MUTATION = gql`
  mutation ArchiveNotification($id: PrefixedID!) {
    archiveNotification(id: $id) {
      id
      title
      subject
      description
      importance
      link
      type
      timestamp
      formattedTimestamp
    }
  }
`;

/** Archive a single notification (moves it out of the unread queue). */
export async function archiveNotification(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<NotificationDetail>> {
  try {
    const data = await client.request<ArchiveNotificationMutation>(ARCHIVE_NOTIFICATION_MUTATION, {
      id,
    });
    return success(data.archiveNotification);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const UNARCHIVE_NOTIFICATION_MUTATION = gql`
  mutation UnarchiveNotification($id: PrefixedID!) {
    unreadNotification(id: $id) {
      id
      title
      subject
      description
      importance
      link
      type
      timestamp
      formattedTimestamp
    }
  }
`;

/**
 * Unarchive a single notification — i.e. mark it unread, moving it back to the
 * unread queue (the schema field is `unreadNotification`).
 */
export async function unarchiveNotification(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<NotificationDetail>> {
  try {
    const data = await client.request<UnarchiveNotificationMutation>(
      UNARCHIVE_NOTIFICATION_MUTATION,
      { id },
    );
    return success(data.unreadNotification);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
