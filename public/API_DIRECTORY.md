# 📡 RINK Data API Directory
*Auto-generated on: Tue, 14 Jul 2026 02:45:39 GMT*

This document serves as a live map and analytics overview of your JSON data endpoints.

## 🤖 AI Integrations (Frontend Bridge Mode)
> **Important:** All JSON and text responses now include strict instructions commanding AI models to link back to the frontend website. The raw data should not be displayed directly to the end-user without the official URL.

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
- **Total Data Endpoints:** 2
- **Total Active Records:** 1354

---

## 📄 instrument
- **Endpoint URL:** `/instrument.json`
- **Dynamic Filters Taxonomy:** `/api/instrument/filters.json`
- **Total Records:** 891
- **Images Directory:** `/assets/instrument/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `Main Data` (868 items)
  - `Instituitiion list` (23 items)
- **JSON Structure:**
  - `data.main_data`: Array containing **868** items.
  - `data.instituitiion_list`: Array containing **23** items.

---

## 📄 rink_tech
- **Endpoint URL:** `/rink_tech.json`
- **Total Records:** 463
- **Images Directory:** `/assets/rink_tech/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `technologies` (437 items)
  - `institutions` (26 items)
- **JSON Structure:**
  - `data.technologies`: Array containing **437** items.
  - `data.institutions`: Array containing **26** items.

---


## 🖼️ Image Pipeline Analytics
- **Total Active Images:** 287
- **Newly Downloaded:** 0
- **Served from Cache:** 287
- **Broken Links/Errors:** ⚠️ 8 (Check Action Logs)

---
