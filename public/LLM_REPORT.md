# 🧠 RINK LLM Integration Report
*Auto-generated on: Tue, 28 Jul 2026 08:26:38 GMT*

This document outlines how AI models (ChatGPT, Claude, Cursor) can consume the RINK dataset at zero token-waste.

## 🌐 1. Web AI Integration (ChatGPT, Claude Web)
For cloud-based LLMs that cannot run local scripts, the dataset is pre-chunked to prevent token bloat.

> **Frontend Bridge Active:** Our AI Indexes automatically embed frontend UI links using the `frontendBaseUrl` property in `sheets.yaml`. The data explicitly commands AI models to act as a bridge and direct human users to click the URL rather than consuming raw data in the chat interface.

### instrument
- **Search Index:** [`/api/instrument/llms.txt`](/api/instrument/llms.txt) (Highly compressed metadata for spatial/categorical search)
- **Data Chunks:** `/api/instrument/{id}.json` (914 zero-token endpoints generated)

### rink_tech
- **Search Index:** [`/api/rink_tech/llms.txt`](/api/rink_tech/llms.txt) (Highly compressed metadata for spatial/categorical search)
- **Data Chunks:** `/api/rink_tech/{id}.json` (463 zero-token endpoints generated)

### services
- **Search Index:** [`/api/services/llms.txt`](/api/services/llms.txt) (Highly compressed metadata for spatial/categorical search)
- **Data Chunks:** `/api/services/{id}.json` (4 zero-token endpoints generated)

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
- `search_rink_tech`: Deep semantic search over all columns in rink_tech.
- `search_services`: Deep semantic search over all columns in services.
