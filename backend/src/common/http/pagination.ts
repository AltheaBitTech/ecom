/**
 * Opaque cursor pagination. Cursors encode the last row's `id`; pages are read
 * with `where id > cursor` ordered by `id asc`, so paging is stable under
 * concurrent inserts. Callers fetch `limit + 1` rows and pass the batch here.
 */
export interface Page<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return undefined;
  }
}

/**
 * Split an over-fetched batch (`limit + 1` rows) into a page. `rows` must be
 * ordered by id asc and each row must expose an `id`.
 */
export function buildPage<T extends { id: string }>(rows: T[], limit: number, map: (row: T) => unknown): Page<unknown> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1].id) : null;
  return { data: slice.map(map), next_cursor: nextCursor, has_more: hasMore };
}

/**
 * Composite (keyset) cursor for sorted lists. A stable sort orders by a chosen
 * column then `id` as a tiebreaker, so the cursor must carry BOTH the last row's
 * sort value and its id. `where (sortCol, id) > (v, id)` then reads the next page
 * without offsets — stable under concurrent inserts, like the id-only cursor.
 */
export interface Keyset {
  v: string | number;
  id: string;
}

export function encodeKeyset(k: Keyset): string {
  return Buffer.from(JSON.stringify(k), 'utf8').toString('base64url');
}

export function decodeKeyset(cursor: string | undefined): Keyset | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Keyset;
    if (parsed && (typeof parsed.v === 'string' || typeof parsed.v === 'number') && typeof parsed.id === 'string') {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Split an over-fetched keyset batch into a page, deriving the next cursor. */
export function buildKeysetPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  keyOf: (row: T) => string | number,
  map: (row: T) => unknown,
): Page<unknown> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? encodeKeyset({ v: keyOf(last), id: last.id }) : null;
  return { data: slice.map(map), next_cursor: nextCursor, has_more: hasMore };
}
