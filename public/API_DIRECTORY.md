# 📡 RINK Data API Directory
*Auto-generated on: Tue, 15 Sep 2026 11:34:15 GMT*

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
- **Total Data Endpoints:** 4
- **Total Active Records:** 1476

---

## 📄 instrument
- **Endpoint URL:** `/instrument.json`
- **Dynamic Filters Taxonomy:** `/api/instrument/filters.json`
- **Total Records:** 964
- **Images Directory:** `/assets/instrument/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `Main Data` (892 items)
  - `Instituitiion list` (23 items)
  - `mou` (24 items)
  - `Subsidized` (25 items)
- **JSON Structure:**
  - `data.main_data`: Array containing **892** items.
  - `data.instituitiion_list`: Array containing **23** items.
  - `data.mou`: Array containing **24** items.
  - `data.subsidized`: Array containing **25** items.

---

## 📄 rink_tech
- **Endpoint URL:** `/rink_tech.json`
- **Total Records:** 465
- **Images Directory:** `/assets/rink_tech/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `technologies` (439 items)
  - `institutions` (26 items)
- **JSON Structure:**
  - `data.technologies`: Array containing **439** items.
  - `data.institutions`: Array containing **26** items.

---

## 📄 services
- **Endpoint URL:** `/services.json`
- **Dynamic Filters Taxonomy:** `/api/services/filters.json`
- **Total Records:** 23
- **Images Directory:** `/assets/services/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `main_services` (23 items)
- **JSON Structure:**
  - `data.main_services`: Array containing **23** items.

---

## 📄 RINK_instrumentation_portal_form
- **Endpoint URL:** `/rink_instrumentation_portal_form.json`
- **Total Records:** 24
- **Images Directory:** `/assets/rink_instrumentation_portal_form/`
- **Image Naming Structure:** `<row_id>_<column_name>.webp` *(Fallback: random hash if row lacks an `id` column)*
- **Tabs Synced:**
  - `Sheet1` (24 items)
- **JSON Structure:**
  - `data.sheet1`: Array containing **24** items.

---

