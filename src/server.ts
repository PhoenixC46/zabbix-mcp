/**
 * Zabbix MCP server — library entry point.
 *
 * Exports `createZabbixServer(config)` so consumers (mcp-gateway, tests) can
 * construct a fully-wired McpServer instance and attach their own transport.
 *
 * Transport selection lives in `index.ts` (CLI).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZabbixClient, ZabbixConfig } from "./client.js";
import { registerSystemTools } from "./tools/system.js";
import { registerHostTools } from "./tools/hosts.js";
import { registerProblemTools } from "./tools/problems.js";
import { registerTriggerTools } from "./tools/triggers.js";
import { registerItemTools } from "./tools/items.js";

export const ZABBIX_SERVER_NAME = "zabbix-mcp";
export const ZABBIX_SERVER_VERSION = "0.4.1-managed247.1";

export const ZABBIX_INSTRUCTIONS =
  "Zabbix MCP server for infrastructure monitoring, incidents, host inventory, trigger analysis, and metric history. " +
  "Start with zabbix_health, then discover host groups/hosts, then inspect problems/triggers/items. " +
  "Use zabbix_acknowledge_event for operational updates only when you explicitly intend to change production monitoring state.";

export function createZabbixServer(config: ZabbixConfig): McpServer {
  const client = new ZabbixClient(config);

  const server = new McpServer(
    { name: ZABBIX_SERVER_NAME, version: ZABBIX_SERVER_VERSION },
    { instructions: ZABBIX_INSTRUCTIONS }
  );

  // --- client-compatibility shim (Managed247 fork) ----------------------
  // Upstream 0.4.x declares an `outputSchema` on every tool for structured
  // output. The MCP SDK serialises those schemas as JSON Schema draft-07,
  // and some strict MCP clients (which validate tool output against JSON
  // Schema 2020-12 only) reject every such tool before its data is returned.
  // We strip `outputSchema` at registration and drop the paired
  // `structuredContent` from results, falling back to the text `content`
  // block the handlers already produce. Net effect: identical tools and
  // data, no draft-07 schema for a client to reject. Remove this shim once
  // upstream emits 2020-12 (or makes outputSchema optional).
  const srv = server as unknown as { registerTool: (...a: any[]) => unknown };
  const originalRegisterTool = srv.registerTool.bind(server);
  srv.registerTool = (
    name: string,
    config: Record<string, unknown>,
    handler: (...args: unknown[]) => unknown
  ) => {
    const { outputSchema: _outputSchema, ...rest } = config ?? {};
    const wrappedHandler = async (...args: unknown[]) => {
      const res = await handler(...args);
      if (res && typeof res === "object" && "structuredContent" in res) {
        const { structuredContent, ...keep } = res as {
          structuredContent: unknown;
          content?: unknown;
        };
        if (!("content" in keep) || !keep.content) {
          (keep as { content: unknown }).content = [
            {
              type: "text",
              text:
                typeof structuredContent === "string"
                  ? structuredContent
                  : JSON.stringify(structuredContent, null, 2),
            },
          ];
        }
        return keep;
      }
      return res;
    };
    return originalRegisterTool(
      name as never,
      rest as never,
      wrappedHandler as never
    );
  };
  // ----------------------------------------------------------------------

  registerSystemTools(server, client);
  registerHostTools(server, client);
  registerProblemTools(server, client);
  registerTriggerTools(server, client);
  registerItemTools(server, client);

  return server;
}

export type { ZabbixConfig } from "./client.js";
export { ZabbixClient, normalizeZabbixUrl } from "./client.js";
