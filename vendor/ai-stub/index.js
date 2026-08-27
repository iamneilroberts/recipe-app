// Local build stub for the `ai` (Vercel AI SDK) package. See package.json.
// `jsonSchema` is the only symbol the agents MCP client destructures; it is
// never actually invoked because we use only the MCP server half.
export function jsonSchema(schema) {
  return schema;
}
