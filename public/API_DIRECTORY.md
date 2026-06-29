# 📡 RINK Data API Directory
*Auto-generated on: Mon, 29 Jun 2026 11:55:08 GMT*

This document serves as a live map and analytics overview of your JSON data endpoints.

## 🤖 AI Integrations
- **LLM Static Search Index:** The metadata index for ChatGPT/Claude is automatically generated at `/api/{sheet_name}/llms.txt`.
- **Individual Item Chunks:** Individual row endpoints (Zero Token Waste) are generated at `/api/{sheet_name}/{id}.json`.

### 🔌 Local MCP Server (For Claude Desktop & Cursor)
To allow local AI agents to natively query and search this database, add this to your AI's MCP configuration:
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

## 📊 Global Analytics
- **Total Data Endpoints:** 1
- **Total Active Records:** 892

---

## 📄 instrument
- **Endpoint URL:** `/instrument.json`
- **Dynamic Filters Taxonomy:** `/api/instrument/filters.json`
- **Total Records:** 892
- **Images Directory:** `/assets/instrument/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `Main Data` (869 items)
  - `Instituitiion list` (23 items)
- **JSON Structure:**
  - `data.main_data`: Array containing **869** items.
  - `data.instituitiion_list`: Array containing **23** items.

---

