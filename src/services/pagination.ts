/**
 * Pagination helper utilities
 *
 * Responsibilities:
 * - Encode/decode opaque cursors (base64url JSON)
 * - Create cursors from DB rows using a list of keyset fields
 * - Build keyset comparison chains that services can translate into DB conditions
 *
 * Notes:
 * - We intentionally avoid coupling this module to any specific ORM/sql builder
 *   (e.g. Drizzle). Instead we provide small helper primitives that services can
 *   use to build their own DB-specific WHERE clauses.
 *
 * Example usage (pseudo-code inside a service using Drizzle):
 *
 * const opts = { limit: 10, sortOrder: 'desc', cursor: decodeCursor(cursorString) };
 * // Build base query with ordering...
 * // Apply keyset WHERE if provided:
 * const chains = buildKeysetComparisons(opts.cursor, ['startDate', 'id'], opts.sortOrder);
 * if (chains) {
 *   // translate chains into drizzle conditions using eq/lt/gt/and/or
 *   whereClause = exampleBuildDrizzleWhere(chains, name => events[name], {
 *     eq, lt, gt, lte, gte, and, or,
 *   });
 * }
 *
 * // Query using limit+1 to detect if there's another page
 * const rows = await db.select().from(events).where(whereClause).orderBy(...).limit(limit + 1);
 * const nextCursor = getNextCursorFromRows(rows, ['startDate', 'id'], limit);
 * const items = rows.slice(0, limit);
 * return { items, nextCursor };
 */

export type Cursor = Record<string, any> | null;

export type PaginationParams = {
  limit?: number;
  sortOrder?: "asc" | "desc";
  cursor?: string | null;
};

export type PagedResult<T> = {
  items: T[];
  nextCursor?: string | null;
};

/**
 * Encode a plain object into a URL-safe base64 cursor.
 */
export function encodeCursor(obj: Record<string, any>): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, "utf-8").toString("base64url");
}

/**
 * Decode a cursor created with `encodeCursor`. Returns `null` for missing/invalid cursors.
 */
export function decodeCursor(
  cursor?: string | null,
): Record<string, any> | null {
  if (!cursor) return null;
  const json = Buffer.from(cursor, "base64url").toString("utf-8");
  return JSON.parse(json);
}

/**
 * Create a cursor from a single DB row object using the given fields.
 * Dates are automatically converted to ISO strings.
 *
 * Example:
 *  createCursorFromItem(item, ['createdAt', 'id'])
 */
export function createCursorFromItem<T extends Record<string, any>>(
  item: T,
  fields: string[],
): string {
  const payload: Record<string, any> = {};
  for (const f of fields) {
    let v = (item as any)[f];
    if (v instanceof Date) {
      v = v.toISOString();
    }
    payload[f] = v;
  }
  return encodeCursor(payload);
}

/**
 * Given the fetched rows (where services usually fetch `limit + 1` rows to detect
 * whether another page exists), return the next cursor if there is another page.
 *
 * - `fetchedRows` should be the array returned from the DB (possibly with one extra item)
 * - `fields` is the ordered list of fields used for keyset ordering (e.g. ['createdAt', 'id'])
 * - `limit` is the requested page size (not the DB's fetch count). If omitted, the function
 *   will return a cursor for the last row regardless (useful when callers know what they fetched).
 *
 * Returns `undefined` when no subsequent page exists.
 */
export function getNextCursorFromRows<T extends Record<string, any>>(
  fetchedRows: T[],
  fields: string[],
  limit?: number,
): string | undefined {
  if (!fetchedRows || fetchedRows.length === 0) return undefined;

  if (typeof limit === "number") {
    // If the service fetched limit + 1 rows, presence of the extra row indicates another page.
    if (fetchedRows.length <= limit) return undefined;
    const lastItemForPage = fetchedRows[limit - 1];
    return createCursorFromItem(lastItemForPage, fields);
  } else {
    // No limit provided — return a cursor for the last row
    const last = fetchedRows[fetchedRows.length - 1];
    return createCursorFromItem(last, fields);
  }
}

/**
 * Helper types for building keyset comparison chains.
 *
 * The returned structure encodes the typical keyset logic:
 *   (a < cursor.a) OR (a = cursor.a AND b < cursor.b) OR ...
 *
 * Each inner chain should be combined with AND, and the chains combined with OR.
 */
export type KeysetChainItem = {
  column: string;
  operator: "lt" | "lte" | "gt" | "gte" | "eq";
  value: any;
};

/**
 * Build keyset comparison chains from a decoded cursor object.
 *
 * Example:
 *  buildKeysetComparisons({createdAt:'2025-01-01', id:'uuid'}, ['createdAt','id'], 'desc')
 *  => [
 *       [{ column: 'createdAt', operator: 'lt', value: '2025-01-01' }],
 *       [
 *         { column: 'createdAt', operator: 'eq', value: '2025-01-01' },
 *         { column: 'id', operator: 'lt', value: 'uuid' }
 *       ]
 *     ]
 *
 * This function does not depend on any DB library; callers translate chains into actual conditions.
 */
export function buildKeysetComparisons(
  cursorObj: Record<string, any> | null,
  fields: string[],
  order: "asc" | "desc" = "desc",
): KeysetChainItem[][] | null {
  if (!cursorObj) return null;
  const chains: KeysetChainItem[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const chain: KeysetChainItem[] = [];
    // equality on previous fields
    for (let j = 0; j < i; j++) {
      chain.push({
        column: fields[j],
        operator: "eq",
        value: cursorObj[fields[j]],
      });
    }
    // on the ith field we use < for desc and > for asc
    const op: KeysetChainItem["operator"] = order === "asc" ? "gt" : "lt";
    chain.push({
      column: fields[i],
      operator: op,
      value: cursorObj[fields[i]],
    });
    chains.push(chain);
  }
  return chains;
}

/**
 * Convenience: translate keyset chains into drizzle-like boolean expressions by
 * supplying a `getColumn` accessor and an ops object containing eq/lt/gt/and/or functions.
 *
 * This is only a helper for services to translate the generic chains into their
 * database-specific predicates. We deliberately avoid importing Drizzle here to
 * keep this module portable and testable.
 */
export function exampleBuildDrizzleWhere(
  chains: KeysetChainItem[][] | null,
  getColumn: (name: string) => any,
  ops: {
    eq: (col: any, val: any) => any;
    lt: (col: any, val: any) => any;
    gt: (col: any, val: any) => any;
    lte?: (col: any, val: any) => any;
    gte?: (col: any, val: any) => any;
    and: (...conds: any[]) => any;
    or: (...conds: any[]) => any;
  },
): any | null {
  if (!chains) return null;
  const { eq, lt, gt, lte, gte, and, or } = ops;
  const mapped = chains.map((chain) => {
    const andConds = chain.map((c) => {
      switch (c.operator) {
        case "eq":
          return eq(getColumn(c.column), c.value);
        case "lt":
          return lt(getColumn(c.column), c.value);
        case "lte":
          return lte
            ? lte(getColumn(c.column), c.value)
            : lt(getColumn(c.column), c.value);
        case "gt":
          return gt(getColumn(c.column), c.value);
        case "gte":
          return gte
            ? gte(getColumn(c.column), c.value)
            : gt(getColumn(c.column), c.value);
        default:
          throw new Error(`Unsupported operator ${c.operator}`);
      }
    });
    return and(...andConds);
  });
  return or(...mapped);
}
