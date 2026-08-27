// Phase 0.5 (GATED, not yet built) — OAuth 2.1 authorization server + dynamic
// client registration.
//
// WHY THIS IS A STUB: per-user URL+token (src/auth/url-token.ts) already works
// as a PRIVATE connector on both claude.ai and ChatGPT — the token rides in the
// connector URL and the host connects with "no authentication". That unblocks
// the whole MVP without OAuth.
//
// OAuth is required only for PUBLIC DIRECTORY DISTRIBUTION (the ChatGPT Apps
// directory / claude.ai connector directory expect a real authorization-server
// surface with dynamic client registration; a static token-in-URL won't pass
// review). That is a deliberate, gated decision — see the design refinement doc,
// "Fork 1" and "Phase 0.5". Neil: keep for later, planned for now.
//
// When built, this module will own:
//   GET  /.well-known/oauth-authorization-server   (+ protected-resource metadata)
//   POST /oauth/register                            (dynamic client registration)
//   GET  /oauth/authorize                           (consent → code)
//   POST /oauth/token                               (code/refresh → access token)
// and resolveOAuthAccessToken() to turn a Bearer access token into an AuthedUser
// with RFC 8707 audience (resource) validation.
//
// The worker already calls handleOAuthRoutes() before path routing and
// resolveOAuthAccessToken() on the /mcp bearer path, so wiring the real
// implementation later is drop-in — no changes to worker.ts routing shape.

import type { AuthedUser } from "./url-token";
import type { Env } from "../types";

/** Returns a Response for an OAuth route, or null to fall through. Stub: always
 * null until Phase 0.5. */
export async function handleOAuthRoutes(
  _request: Request,
  _env: Env,
  _url: URL,
): Promise<Response | null> {
  return null;
}

/** Resolve an OAuth-issued Bearer access token to a user. Stub: always null
 * until Phase 0.5. */
export async function resolveOAuthAccessToken(
  _env: Env,
  _accessToken: string,
  _expectedResource: string,
): Promise<AuthedUser | null> {
  return null;
}

/** WWW-Authenticate challenge advertising where to discover OAuth metadata.
 * Harmless to emit now; MCP clients that don't do OAuth ignore it. */
export function mcpAuthChallengeHeader(baseUrl: string): string {
  return `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
}
