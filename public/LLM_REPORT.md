# 🧠 RINK LLM Integration Report
*Auto-generated on: Mon, 29 Jun 2026 09:18:30 GMT*

This document outlines how AI models (ChatGPT, Claude, Cursor) can consume the RINK dataset at zero token-waste.

## 🌐 1. Web AI Integration (ChatGPT, Claude Web)
For cloud-based LLMs that cannot run local scripts, the dataset is pre-chunked to prevent token bloat.

### Master Directory
- **Search Index:** [`/api/master_directory/llms.txt`](/api/master_directory/llms.txt) (Highly compressed metadata for spatial/categorical search)
- **Data Chunks:** `/api/master_directory/{id}.json` (893 zero-token endpoints generated)

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
- `search_master_directory`: Deep semantic search over all columns in Master Directory.
