# System Architecture: RINK Sync Engine

## Overall Architecture
The system operates as a stateless data compiler. It executes a series of Node.js scripts that pull remote data (Google Sheets), apply transformations based on declarative configuration (`config/sheets.yaml`), and output static files (`public/`). It also includes an optional Express server (`server.js`) for local hosting and an MCP server (`mcp-server.js`) for AI integration.

## Folder & Module Responsibilities

### `config/`
*   `sheets.yaml`: The central declarative configuration file. Defines which sheets to fetch, how to map tabs, which rows/columns to exclude, and how to build filter taxonomies.

### `scripts/`
*   `sync.js`: The core pipeline. Fetches CSVs, compares MD5 hashes for incremental updates, parses data, transforms markdown/images, builds dynamic filters, generates AI chunks, and writes outputs to `public/` and `data/`.
*   `downloadImages.js`: Scans generated JSON for image links, downloads them, resizes them, converts to WebP using `sharp`, and saves to `public/assets/`.
*   `mcp-server.js`: Implements the Model Context Protocol, exposing local JSON data to AI agents as semantic search tools.
*   `FailSafeStore.js`: Ensures atomic writes when saving `.json` files to prevent data corruption during simultaneous read/write operations.

### `public/`
*   The final distribution directory. Contains flat `.json` API files, an `api/` folder for AI chunks, `assets/` for WebP images, and automated markdown documentation (`API_DIRECTORY.md`, `LLM_REPORT.md`).

### `data/`
*   Internal state directory. Holds incremental sync hashes (`*_hash.json`), rolling backups (`backups/`), and sync history logs.

## Data Models

### Configuration Object (`sheets.yaml`)
*   `frontendBaseUrl`: Base URL used for injecting AI return links.
*   `sheets`: Array of Sheet objects.
    *   `tabs`: Array of individual Google Sheet tabs. Supports `excludeColumns`, `excludeRowsWhere`, `splitColumns`, and `imageColumns`.
    *   `filterTaxonomy`: Array of taxonomy definitions (direct or joined) to generate dynamic UI filters.

### Transformed Row Object
*   Every parsed row is dynamically converted to a JSON object where headers become keys (snake_case format).
*   **Image Overrides:** Original URLs are saved as `original_keyName`, and the primary key is overwritten with the local optimized path (`/assets/sheet_name/id_key.webp`).
*   **AI Enrichment:** Each row receives an `_llm_instruction` key guiding AI behavior (e.g., directing users to the frontend URL).

## Data Flow (Pipeline Execution)

1.  **Trigger:** Initiated via cron job, GitHub Action, or manual `npm run sync`.
2.  **Config Load:** Parses `config/sheets.yaml`.
3.  **Fetch & Hash:** Downloads Google Sheet CSVs. Creates an MD5 hash of `(CSV Content + YAML Config)`. If hash matches previous run, the tab is skipped.
4.  **Parse & Clean:** Papaparse converts CSV to JSON. Headers are sanitized to `snake_case`. Empty rows are dropped.
5.  **Transform:**
    *   Excluded columns/rows are stripped.
    *   Comma-separated columns are split into arrays.
    *   Markdown syntax is converted to HTML where applicable.
    *   Image URLs are detected, and paths are rewritten to local `/assets/` targets.
6.  **Taxonomy Compilation:** If `filterTaxonomy` is defined, values are aggregated into groups (supporting cross-sheet foreign-key joins) and written to `filters.json`.
7.  **AI Chunking:** Generates `llms.txt` and individual `{id}.json` files per row in `public/api/`.
8.  **Atomic Save:** Final data is written to `public/sheet_name.json` using `FailSafeStore`. Backup is saved to `data/backups/`.
9.  **Image Post-Processing:** `downloadImages.js` scans the final JSON, downloads external images, processes them via `sharp`, and saves WebP files.

## Component Relationships & State Management
Because the system is designed to run statelessly (e.g., on Vercel), it relies on the filesystem for all state management. 
*   **Incremental State:** Maintained strictly via JSON hash files in the `data/` folder.
*   **Error Handling:** Missing fields trigger warnings but don't halt the pipeline unless specified in the `required` schema.
*   **Image Caching:** The image downloader checks if an optimized `.webp` file already exists with a size > 0 before initiating an external request.
