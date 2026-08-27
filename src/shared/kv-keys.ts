// Per-user KV key prefixing for the RECIPES namespace.
//
// Every stored object is namespaced under a per-user prefix derived from the
// authenticated user_id, so one user's library can never collide with or read
// another's. Unlike voygent-lite (which must stay byte-identical to a legacy
// Worker), this is a fresh namespace with no cross-Worker contract — but the
// shape is deliberately the same so the storage discipline ports cleanly.
//
// Key layout (Phase 0 defines the prefix; Phase 1 fills in the record keys):
//   <prefix>recipe:<recipeId>     one recipe JSON record
//   <prefix>index                 the user's recipe index (list/search)
//   <prefix>cookbook:<id>         a cookbook/collection
//   _render/<prefix><recipeId>    render freshness marker (side key, unscanned)

/** Derive a stable, filesystem-safe per-user key prefix. */
export function getKeyPrefix(userId: string): string {
  return userId.toLowerCase().replace(/[^a-z0-9]/g, "_") + "/";
}

export function recipeKey(userId: string, recipeId: string): string {
  return `${getKeyPrefix(userId)}recipe:${recipeId}`;
}

export function recipeIndexKey(userId: string): string {
  return `${getKeyPrefix(userId)}index`;
}

export function cookbookKey(userId: string, cookbookId: string): string {
  return `${getKeyPrefix(userId)}cookbook:${cookbookId}`;
}

export interface KvListKey {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

export interface KvListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Paginate through a KV prefix scan until complete. KV list() returns at most
 * 1000 keys per page; this flattens all pages.
 */
export async function listAllKeys(
  ns: KVNamespace,
  options: KvListOptions = {},
): Promise<KvListKey[]> {
  const keys: KvListKey[] = [];
  const { cursor: initialCursor, ...rest } = options;
  let cursor: string | undefined = initialCursor;
  while (true) {
    const result = await ns.list({ ...rest, cursor });
    keys.push(...result.keys);
    if (result.list_complete || !result.cursor) break;
    cursor = result.cursor;
  }
  return keys;
}
