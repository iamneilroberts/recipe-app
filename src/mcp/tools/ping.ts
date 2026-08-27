// Health-check + identity tools for the recipe MCP.
//
// `ping`   — server metadata + echo. Proves the connector loop end-to-end on
//            both claude.ai and ChatGPT (Phase 0 acceptance).
// `whoami` — returns the authenticated user's id (prefix only) + tier, so the
//            model can preflight which features are available this session.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../../types";
import type { AuthedUser } from "../../auth/url-token";

const SERVER_VERSION = "0.0.1";

export function registerPingTool(server: McpServer, env: Env): void {
  server.tool(
    "ping",
    "Health check for the recipe MCP server. Returns server metadata and echoes an optional message. Use once at session start to confirm the connector is reachable.",
    {
      message: z.string().optional().describe("Optional message to echo back"),
    },
    async ({ message }) => {
      const payload = {
        ok: true,
        server: "recipe-app",
        version: SERVER_VERSION,
        env: env.WORKER_ENV ?? "production",
        timestamp: new Date().toISOString(),
        echo: message ?? null,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        isError: false,
      };
    },
  );
}

export function registerWhoamiTool(
  server: McpServer,
  _env: Env,
  user: AuthedUser,
): void {
  server.tool(
    "whoami",
    "Returns the authenticated user's tier and an identity prefix. Use it to preflight which features are available: `free` covers capture/organize/cook/search/share; `premium` adds metered features (video transcription, nutrition API, household sharing). No secrets are returned.",
    {},
    async () => {
      const payload = {
        // Identity prefix only — never the full user_id or any token material.
        userPrefix: user.userId.slice(0, 8),
        tier: user.tier,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        isError: false,
      };
    },
  );
}
