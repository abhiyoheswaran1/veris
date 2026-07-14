import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "veriskit", version: "0.6.0" },
    { capabilities: { tools: {} } },
  );
  // McpServer only wires up the tools/list handler lazily, on the first
  // registerTool() call. No tools are registered yet, so install an empty
  // list handler directly via the documented "advanced usage" escape hatch
  // (the underlying server.server Server instance). Remove this line once a
  // real tool is registered with registerTool() in a later task — that call
  // installs its own (correct) handler covering both listing and dispatch.
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [],
  }));
  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never write to stdout here; it is the protocol channel.
  process.stderr.write("veriskit-mcp: ready on stdio\n");
}
