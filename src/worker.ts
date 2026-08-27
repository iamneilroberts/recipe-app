// Worker entry — recipe-capture MCP server.
//
// Phase 0 scaffold: CORS, /health, StreamableHTTP MCP at /mcp/u/{user_id}?token=
// (per-user URL+token — the front door for both claude.ai and ChatGPT) and a
// transitional dev-bearer /mcp path. OAuth routes are pre-wired to a stub so the
// gated Phase 0.5 implementation is drop-in (src/auth/oauth.ts).

import { createMcpHandler } from "agents/mcp";
import { createRecipeServer } from "./mcp/server";
import { resolveUserFromUrl, type AuthedUser } from "./auth/url-token";
import { handleOAuthRoutes, resolveOAuthAccessToken, mcpAuthChallengeHeader } from "./auth/oauth";
import { normalizeTier } from "./tier/catalog";
import type { Env } from "./types";

// Hosts that may embed / call the connector from a browser context. Server-to-
// server MCP transport doesn't need CORS, but the host web apps send an Origin.
const ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://chatgpt.com",
  "https://chat.openai.com",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Allow-Credentials": "true",
  };
}

function getValidAuthKeys(env: Env): string[] {
  return (env.AUTH_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Run an authenticated MCP request through a fresh per-request server. */
async function serveMcp(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  user: AuthedUser,
  route: string,
  cors: Record<string, string>,
): Promise<Response> {
  const server = createRecipeServer(env, user, ctx);
  const handler = createMcpHandler(server, { route });
  const response = await handler(request, env, ctx);
  const merged = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) merged.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request);
    const baseUrl = `${url.protocol}//${url.host}`;
    const authChallenge = mcpAuthChallengeHeader(baseUrl);

    // OAuth 2.1 + DCR (Phase 0.5 stub — returns null today). Handled before path
    // routing so metadata/authorize/token/register resolve regardless of the
    // other auth gates once implemented.
    const oauthResponse = await handleOAuthRoutes(request, env, url);
    if (oauthResponse) return oauthResponse;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          server: "recipe-app",
          version: "0.0.1",
          env: env.WORKER_ENV ?? "production",
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Per-user URL+token auth — the front door. /mcp/u/{user_id}?token=<t>
    // (or the same token via Authorization: Bearer). Works as a private
    // connector on both claude.ai and ChatGPT.
    if (url.pathname.startsWith("/mcp/u/")) {
      const user = await resolveUserFromUrl(env, url, request);
      if (!user) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { ...cors, "WWW-Authenticate": authChallenge },
        });
      }
      return serveMcp(request, env, ctx, user, url.pathname, cors);
    }

    // Transitional /mcp path. Accepts either a dev bearer from AUTH_KEYS
    // (local/dev convenience) or an OAuth-issued access token (Phase 0.5).
    if (url.pathname === "/mcp") {
      const bearer = request.headers
        .get("Authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim();
      const devKey = bearer || url.searchParams.get("key") || url.searchParams.get("authKey");

      if (!devKey) {
        return new Response("Unauthorized — token required", {
          status: 401,
          headers: { ...cors, "WWW-Authenticate": authChallenge },
        });
      }

      // Dev-bearer allowlist: resolve to a stable synthetic identity so local
      // dev can exercise the full surface without minting a per-user token.
      if (getValidAuthKeys(env).includes(devKey)) {
        const user: AuthedUser = {
          userId: `dev-${devKey.slice(0, 8)}`,
          tier: normalizeTier(env.WORKER_ENV === "production" ? "free" : "premium"),
        };
        return serveMcp(request, env, ctx, user, "/mcp", cors);
      }

      // OAuth-issued bearer (Phase 0.5 — stub returns null today).
      const oauthUser = await resolveOAuthAccessToken(env, devKey, `${baseUrl}/mcp`);
      if (oauthUser) {
        return serveMcp(request, env, ctx, oauthUser, "/mcp", cors);
      }

      return new Response("Unauthorized — invalid token", {
        status: 401,
        headers: { ...cors, "WWW-Authenticate": authChallenge },
      });
    }

    if (url.pathname === "/") {
      return new Response(
        "recipe-app — MCP server for capturing & cooking recipes\n" +
          "Endpoints: /mcp/u/{user_id}?token=… (StreamableHTTP MCP), /health\n",
        { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
