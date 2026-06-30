# 🧠 RINK LLM Integration Report
*Auto-generated on: Tue, 30 Jun 2026 01:02:09 GMT*

This document outlines how AI models (ChatGPT, Claude, Cursor) can consume the RINK dataset at zero token-waste.

## 🌐 1. Web AI Integration (ChatGPT, Claude Web)
For cloud-based LLMs that cannot run local scripts, the dataset is pre-chunked to prevent token bloat.

> **Frontend Routing Note:** Our AI Indexes automatically embed frontend UI links (e.g., `URL: https://...`) using the `frontendBaseUrl` property in `sheets.yaml`!

### instrument
- **Search Index:** [`/api/instrument/llms.txt`](/api/instrument/llms.txt) (Highly compressed metadata for spatial/categorical search)
- **Data Chunks:** `/api/instrument/{id}.json` (892 zero-token endpoints generated)

## 🔌 2. Local AI MCP Server (Cursor, Claude Desktop)
For local development environments, we expose a native Model Context Protocol (MCP) server.
Add the following to your AI configuration (e.g., `claude_desktop_config.json` or Cursor Settings):
```json
{
  "mcpServers": {
    "rink-data": {
      "command": "node",
      "args": ["scripts/mcp-server.js"]
    }
  }
}
```

**Available MCP Tools:**
- `search_instrument`: Deep semantic search over all columns in instrument.
