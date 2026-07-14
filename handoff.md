# Project Handoff: RINK Sync Engine

## Current Project Objective and Vision
The **RINK Sync Engine** (`rink-git-cron`) is a serverless data pipeline designed to intelligently sync Google Sheets data into optimized JSON endpoints. The core vision is to allow non-technical users to manage a backend database entirely through Google Sheets, while providing frontend developers and AI agents with a robust, highly optimized, and automatically documented API.

## Overall Application Purpose
It bridges the gap between simple spreadsheets and complex frontends/AIs by converting human-readable Google Sheets into developer-friendly JSON APIs. It also automatically intercepts, downloads, resizes, and optimizes images (to WebP), and builds specialized data chunks and indexes for zero-token-waste AI consumption.

## Current Implementation Status
The core pipeline is complete and fully functional. Key completed features include:
*   **Zero-Code Configuration:** All pipeline rules are defined in `config/sheets.yaml`.
*   **Multi-Sheet & Multi-Tab Support:** Capable of handling categorized data.
*   **Auto-Image Optimization:** Automatic detection of Google Drive/standard image URLs, downloading, and WebP conversion.
*   **Incremental Sync Logic:** Hash-based caching prevents redundant processing of unchanged tabs.
*   **Dynamic Filters Generation:** Automatically builds a `filters.json` taxonomy based on live data.
*   **Dual AI Architecture:** Generates static `llms.txt` indexes and zero-token chunks for Web AI, plus an integrated Model Context Protocol (MCP) server for local AI (Cursor/Claude Desktop).
*   **Universal Hosting Capability:** Supports Vercel (Stateless), Docker (Containerized), and PM2 (Bare Metal).

## Data Flow & Architecture Philosophy
Instead of a traditional database, the single source of truth is Google Sheets. 
1.  **Ingestion:** The sync engine fetches CSV data from Google Sheets based on `sheets.yaml`.
2.  **Transformation:** Columns are filtered, strings are split into arrays, markdown is parsed, and image links are intercepted.
3.  **Optimization:** Images are downloaded and converted to WebP locally.
4.  **Distribution:** The final data is written atomically to the `public/` directory as JSON files, alongside AI-specific chunks.
5.  **Documentation:** The system dynamically writes `API_DIRECTORY.md` and `LLM_REPORT.md` to describe the live endpoints.

## Persistent Storage Strategy
The system uses the local file system to store artifacts.
*   **Public Output (`public/`):** Contains the live APIs (`*.json`), optimized images (`assets/`), and AI indexes.
*   **Internal Data (`data/`):** Contains backup JSON files (rolling history of the last 3 syncs), sync logs (`*_sync_history.json`), and MD5 hash caches for incremental sync.
In containerized environments (Docker), this storage is persisted using named volumes (`rink-public-data`). In stateless environments (Vercel), it regenerates on every build phase.

## Important Architectural Decisions & Rationale
*   **File-Based API over REST Server:** By compiling the sheets directly to static `.json` files, the API can be served via a free global CDN (Vercel) with zero latency and infinite scalability, removing the need for a traditional database server.
*   **Hash-Based Caching:** Hashing the CSV response combined with the YAML configuration ensures the sync script runs instantly if no data or config has changed, preventing rate-limiting from Google.
*   **AI "Zero-Token Waste" Strategy:** Rather than feeding an entire 2MB JSON to an LLM, the system generates a condensed `llms.txt` search index and tiny individual `{id}.json` files. This allows the AI to discover items and fetch only what it needs.
*   **Dynamic Taxonomy:** Building filter lists programmatically from the sheet data eliminates the need for hardcoded UI filters on the frontend. If a user adds a new category in the sheet, it automatically appears in the API and UI.

## Future Considerations
*   **Webhooks:** Implementing Google Sheets trigger webhooks to run the sync instantly upon cell edits rather than relying strictly on cron schedules.
*   **Cloud Storage Integrations:** Option to offload downloaded images to AWS S3 or Google Cloud Storage instead of the local filesystem for distributed architectures.
*   **Expanded MCP Capabilities:** Adding mutation tools to the MCP server to allow local AIs to directly update Google Sheets rows.
