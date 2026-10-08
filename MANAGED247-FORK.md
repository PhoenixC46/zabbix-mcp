# Managed247 fork — Zabbix MCP

Fork of [`@nks-hub/zabbix-mcp`](https://github.com/nks-hub/zabbix-mcp) **v0.4.1**.

## Why this fork exists

Upstream 0.4.x declares an `outputSchema` on every tool (structured output).
The MCP TypeScript SDK serialises those output schemas as **JSON Schema
draft-07**. Some MCP clients validate tool output strictly against **JSON
Schema 2020-12** and reject any tool whose `outputSchema` uses the older
draft-07 dialect — failing every call with:

```
invalid outputSchema: JSON Schema declares an unsupported dialect
("$schema": "http://json-schema.org/draft-07/schema#").
The default validator supports JSON Schema 2020-12 only
```

## The change

A single compatibility shim in `src/server.ts` (`createZabbixServer`) wraps
`server.registerTool` and, for every tool:

1. removes `outputSchema` before registration (so the SDK never emits a
   draft-07 output schema), and
2. drops the paired `structuredContent` from each result, falling back to the
   text `content` block the handlers already return.

No tool definitions were edited; all 11 tools and their data are unchanged.
Only the structured-output layer (the thing the strict client rejects) is
removed. Input schemas are untouched (draft-07 input schemas are accepted by
the client).

Verified with an `initialize` + `tools/list` handshake:

| Build            | tools | outputSchema (draft-07) |
|------------------|-------|-------------------------|
| upstream 0.4.1   | 11    | 11  ← rejected          |
| this fork        | 11    | 0   ← accepted          |

## Run it (local, via Claude Desktop)

```bash
npm install          # runtime deps (@modelcontextprotocol/sdk, zod)
npm run build        # already built in build/, re-run if you change source
```

Then point `claude_desktop_config.json` at the built entry point:

```json
"zabbix": {
  "command": "node",
  "args": ["C:\\path\\to\\zabbix-mcp\\build\\index.js"],
  "env": {
    "ZABBIX_URL": "https://zabbix.example.com/api_jsonrpc.php",
    "ZABBIX_API_TOKEN": "<your-token>"
  }
}
```

## Removing this fork later

When upstream emits 2020-12 output schemas (or makes `outputSchema` optional),
delete the shim block in `src/server.ts` and return to `npx @nks-hub/zabbix-mcp`.
