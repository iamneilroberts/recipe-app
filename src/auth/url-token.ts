// Per-user URL+token auth — the front door for BOTH claude.ai and ChatGPT
// (private connector). Resolves a request to /mcp/u/{user_id}?token=<t> against
// the users table: look up by user_id, HMAC-hash the supplied token, constant-
// time compare against the stored fingerprint.
//
// The path is deliberately asymmetric — user_id in the path (fast D1 lookup),
// token in the query string (Cloudflare access logs strip query strings by
// default). The same token is also accepted via `Authorization: Bearer <t>` for
// machine callers that refuse secret-bearing query params; ?token= wins when
// both are present so existing connector URLs are unaffected.
//
// Defense-in-depth: the WHERE user_id = ? clause scopes the lookup to the URL's
// user_id, so a valid token for user A cannot authenticate against /u/B.
//
// (Pattern lifted from voygent-lite src/auth/url_token.ts.)

import type { Env } from "../types";
import { normalizeTier, type Tier } from "../tier/catalog";
import { hashToken, constantTimeEqual } from "../crypto/hash";

export interface AuthedUser {
  userId: string;
  tier: Tier;
}

const URL_PATH_RE = /^\/mcp\/u\/([A-Za-z0-9_-]+)$/;

/** Extract a bearer token from an Authorization header, or null. The `Bearer`
 * scheme is required — a bare token must not authenticate. */
export function bearerTokenFromRequest(request: Request | undefined): string | null {
  if (!request) return null;
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match ? match[1].trim() : "";
  return token.length > 0 ? token : null;
}

export async function resolveUserFromUrl(
  env: Env,
  url: URL,
  request?: Request,
): Promise<AuthedUser | null> {
  const m = url.pathname.match(URL_PATH_RE);
  if (!m) return null;
  const userId = m[1];

  const token = url.searchParams.get("token") ?? bearerTokenFromRequest(request);
  if (!token) return null;

  if (!env.TOKEN_HASH_KEY) return null;

  const row = await env.DB.prepare(
    "SELECT user_id, mcp_url_token_hash, tier FROM users WHERE user_id = ?",
  )
    .bind(userId)
    .first<{
      user_id: string;
      mcp_url_token_hash: ArrayBuffer | Uint8Array;
      tier: string;
    }>();
  if (!row) return null;

  const candidateHash = await hashToken(env.TOKEN_HASH_KEY, token);
  const storedHash =
    row.mcp_url_token_hash instanceof Uint8Array
      ? row.mcp_url_token_hash
      : new Uint8Array(row.mcp_url_token_hash);

  if (!constantTimeEqual(candidateHash, storedHash)) return null;
  return { userId: row.user_id, tier: normalizeTier(row.tier) };
}
