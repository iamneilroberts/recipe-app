// MCP server factory. A FRESH McpServer is built per request (SDK requirement —
// avoids cross-client state leakage); tool callbacks close over env / user / ctx.
//
// Phase 0 registers only ping + whoami. Phase 1+ tools (import_recipe,
// read_recipe, list_recipes, search_recipes, preview_recipe, …) register here,
// tier-filtered by user.tier. Keep the surface DOMAIN-ROUTED and well under
// ChatGPT's ~35-tool cap (see the design refinement doc, "Fork 4").

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../types";
import type { AuthedUser } from "../auth/url-token";
import { registerPingTool, registerWhoamiTool } from "./tools/ping";

export function createRecipeServer(
  env: Env,
  user: AuthedUser,
  _ctx: ExecutionContext,
): McpServer {
  const server = new McpServer(
    { name: "recipe-app", version: "0.0.1" },
    {
      instructions:
        "Recipe capture, organize, cook, plan, and share. Import a recipe from a URL or paste, keep a clean ad-free library, scale servings, build meal plans and grocery lists, and translate or adapt recipes — all reasoning is done by your own model, so it's free to run.",
    },
  );

  // Phase 0 tools — always available.
  registerPingTool(server, env);
  registerWhoamiTool(server, env, user);

  // Phase 1+ tool registration lands here, gated on user.tier.

  return server;
}
