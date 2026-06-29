# 🚀 RINK Sync Engine

A serverless data pipeline that intelligently syncs Google Sheets data into JSON endpoints while automatically intercepting, downloading, and optimizing images.

## Features
- **Zero Code Configuration:** Manage your entire data pipeline from a simple, human-readable YAML file. No dealing with strict JSON syntax!
- **Multi-Sheet & Multi-Tab Support:** Sync an infinite number of Google Sheets and merge multiple tabs into categorized JSON objects.
- **Auto-Image Optimization:** Automatically detects Google Drive links and standard image URLs in *any* column. It downloads them, converts them to WebP (saving bandwidth), and serves them locally.
- **Automated Deployments:** Built to run via GitHub Actions cron jobs to keep your frontend data constantly up to date.

---

## 🛠️ Configuration (`config/sheets.yaml`)

All configuration is handled in a clean, human-readable `config/sheets.yaml` file. You do not need any GitHub Secrets or environment variables to add new sheets.

### Top-Level Properties
- `frontendBaseUrl`: (Optional) The base URL of your frontend UI (e.g., `https://rink-ui.vercel.app`). Providing this allows the sync engine to automatically inject direct frontend links into the AI `llms.txt` search index!
- `sheets`: The list of Google Sheets to sync.

### Option A: Single Tab Sheet
If you just want to pull the default tab from a sheet, define the `gid` directly under `sheets`:
```yaml
frontendBaseUrl: "https://rink-ui.vercel.app"
sheets:
  - name: Master Directory
    spreadsheetId: YOUR_SPREADSHEET_ID_HERE
    gid: 0
```
*Result:* This generates an array of rows at `/master_directory.json`, images at `/assets/master_directory/`, and injects AI URLs pointing to `https://rink-ui.vercel.app/master_directory/{row_id}`.

### Option B: Multiple Tabs (Categorized)
If you want to pull multiple tabs from the same sheet, use the `tabs` list:
```yaml
frontendBaseUrl: "https://rink-ui.vercel.app"
sheets:
  - name: Global Inventory
    spreadsheetId: YOUR_SPREADSHEET_ID_HERE
    tabs:
      - name: Instruments
        gid: 0
      - name: Equipment
        gid: 12345
```
*Result:* This generates a single JSON object at `/global_inventory.json` where each tab is a key containing its respective rows (e.g., `data.instruments` and `data.equipment`).

### Options and Filters

The engine supports a massive amount of configuration for privacy, data formatting, and routing. You can:
- **Skip Columns**: Hide internal notes (`excludeColumns`).
- **Skip Rows**: Hide draft records (`excludeRowsWhere`).
- **Split Strings to Arrays**: Convert `"bio, chem"` to `["bio", "chem"]` for Orama search indexing (`splitColumns`).
- **Explicit Image Targeting**: Restrict the auto-downloader to specific columns so it ignores normal website links (`imageColumns`).
- **Dynamic Frontend Menus**: Provide a basic structure and let the engine auto-discover and generate a live filter menu (`filters.json`) from your live sheet data (`filterTaxonomy`).

**👉 [Read the Complete Configuration Guide](SHEETS_CONFIG_GUIDE.md)** for a deep dive into every option, complete with copy-pasteable YAML examples!

### Option D: Data Validation (Required Columns)

You **do not** need to name your columns `image_link`. 

The pipeline scans every single cell in your data sheets. If a cell contains a valid URL that is either:
1. A **Google Drive link**
2. A direct link ending in an image format (`.jpg`, `.png`, `.webp`, `.gif`, `.svg`, `.bmp`)

It will automatically:
- Download the image from the source.
- Resize and optimize it to WebP.
- Save it locally.
- Replace the Google Drive/Image URL in your generated JSON with the fast local path (e.g., `/assets/global_inventory/123_profile_pic.webp`).

**Frontend Impact:** The frontend requires 0 logic to handle images. If you name your column `cover_photo` in Google Sheets, the frontend simply reads `item.cover_photo` and it will automatically be the optimized local path!

---

## 🗺️ Automated API Documentation

Every time the pipeline runs, it automatically generates a live **API Map** at [`public/API_DIRECTORY.md`](public/API_DIRECTORY.md). 

This file serves as dynamic documentation for your frontend developers. It explicitly lists:
- Every active JSON endpoint URL.
- The total record count for each endpoint.
- Where the images for that endpoint are stored, and how their slugs are formatted.
- The exact JSON object structure and keys available.

Because it is committed to the `public/` directory, this documentation is always guaranteed to be 100% accurate to your live data.

---

## 🎨 Frontend Integration: Dynamic Filters

If you utilize the `filterTaxonomy` configuration in `sheets.yaml`, the backend will dynamically generate a `filters.json` endpoint. **This completely eliminates the need for hardcoded filter lists in your frontend.**

**The JSON Structure:**
```json
{
  "district": {
    "South Zone": ["Thiruvananthapuram", "Kollam"],
    "Other Districts": ["Palakkad"]
  },
  "tag": {
    "Life Sciences": ["genomics", "bioinformatics"],
    "Other Tags": ["robotics"]
  }
}
```

**How the Frontend Should Consume This:**
1. Fetch `https://[your-domain]/api/[sheet]/filters.json` into your state manager (e.g. Zustand).
2. Use `Object.keys(data)` to automatically discover filter sections (e.g., District, Tag).
3. For each section, use `Object.entries(data[sectionKey])` to render the group headers ("South Zone") and their respective checkboxes ("Kollam").

**Zero-Maintenance Architecture:**
- **Unknown Values:** If someone types a brand new district into Google Sheets, it automatically appears in the `"Other Districts"` array and instantly renders on the frontend.
- **New Filter Categories:** If you add a new filter category (like `funding_agency`) to `sheets.yaml`, the backend outputs a new root key, and the frontend's dynamic `Object.keys()` loop instantly spawns a new sidebar section without *any* frontend code changes!

---

## 🧠 Dual AI Architecture (Zero-Cost LLM Integration)

This repository is built not just for frontends, but specifically for AI Agents (ChatGPT, Claude, Cursor) to ingest data with **zero token waste**.

1. **Web AI Static Chunks (ChatGPT/Claude Web)**
   Instead of forcing an LLM to download a 2MB JSON file, the sync script dynamically generates:
   - **`public/api/{sheet}/llms.txt`**: A hyper-condensed spatial/categorical search index.
   - **`public/api/{sheet}/{id}.json`**: Thousands of tiny individual files. The LLM can read the index and fetch just the 1KB file it needs.

2. **Local AI MCP Server (Cursor/Claude Desktop)**
   For local development environments, we expose a native Model Context Protocol (MCP) server. To use it, simply configure your AI:
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
   *This automatically registers tools like `search_master_directory` to let the AI natively query your live JSON.*

Every sync automatically generates a fresh [`public/LLM_REPORT.md`](public/LLM_REPORT.md) detailing the AI endpoints available!

---

## 🏃‍♂️ How to Run Locally

If you want to test the sync locally on your machine:
1. Install dependencies:
   ```bash
   npm install
   ```
2. Update `config/sheets.yaml` with your real spreadsheet IDs.
3. Run the synchronization and download process:
   ```bash
   npm run sync && npm run download-images
   ```

---

## 🤖 GitHub Actions / Automation

This repository includes a GitHub Action (`.github/workflows/cron-sync.yml`) that runs every night automatically.
- It executes the scripts.
- It automatically tracks and commits any changes to `public/` and `data/`.
- **No secrets needed!** Because all IDs are in `config/sheets.yaml`, the GitHub action just runs automatically without requiring any environment setup.
