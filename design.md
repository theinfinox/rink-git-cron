# Design & Configuration Specification: RINK Sync Engine

## Configuration Philosophy
The RINK Sync Engine is designed with a **Zero-Code Configuration** philosophy. End-users (administrators, data entry staff) manage data strictly in Google Sheets, while developers define the exact shape, validation, and optimization rules within a single, highly readable `sheets.yaml` file.

The design eliminates the need for strict database schemas by dynamically adapting to the headers defined in the first row of any Google Sheet.

## Schema Configuration (`sheets.yaml`)

### Root Definitions
*   `frontendBaseUrl`: Essential for bridging the backend data to frontend UX. When set, the sync engine automatically embeds deep links into AI contexts, ensuring AIs direct users to the visual UI rather than rendering raw data.

### Option A: Single Tab Sheets
Ideal for flat databases. Defines a `gid: 0` directly under the sheet configuration. Compiles into a flat JSON array (`/sheet_name.json`).

### Option B: Categorized Multi-Tab Sheets
Designed for segmented data (e.g., separating "Equipment" and "Instruments"). Compiles into a structured JSON object where each tab name acts as a key containing its respective array (`data.equipment`, `data.instruments`).

## Data Transformation Design

### 1. The Adaptive Header System
Headers are automatically sanitized into developer-friendly `snake_case` keys. It proactively corrects common typos (e.g., `fid` -> `id`) to maintain API stability even if the spreadsheet owner makes a minor spelling mistake.

### 2. Validation & Filtering Rules
*   `excludeColumns`: Prevents sensitive internal columns (e.g., "Reviewer Notes") from leaking into the public API.
*   `excludeRowsWhere`: Safely drops draft rows (e.g., `status: pending`) before they enter the processing pipeline.
*   `required`: Enforces strict data integrity. Drops any row missing crucial fields.
*   `splitColumns`: Transforms string inputs (e.g., `"tag1, tag2"`) into proper JSON arrays, vital for frontend facet-filtering libraries like Orama.

## Dynamic Filter Taxonomy Design
The engine resolves one of the biggest UI maintenance burdens: hardcoded filters. 
By defining `filterTaxonomy`, developers map column keys to UI filter headers.
*   **Auto-Discovery:** Any value entered in the spreadsheet automatically populates the filter list. Unknown values are intelligently grouped into an "Other" category.
*   **Relational Joins:** The engine supports complex `join` filters, allowing it to look up a foreign key (e.g., `institution_id`) in a completely different sheet, fetch its display name, and generate grouped filter checklists.

## Auto-Image Optimization Design
**User Experience (Data Entry):** The user simply pastes any valid URL, including notoriously difficult Google Drive sharing links (`file/d/...` or `uc?id=...`).
**User Experience (Developer):** The pipeline abstracts away image downloading. The resulting JSON object magically contains a relative path to a highly optimized, resized `.webp` image (e.g., `/assets/sheet_name/123.webp`).
*   **Explicit Targeting (`imageColumns`):** To prevent the engine from accidentally downloading standard website URLs, the developer can strictly define which columns contain images.

## Automated Documentation Design
A core design tenet is that the API should document itself.
1.  **`API_DIRECTORY.md`:** On every run, the engine analyzes the generated JSON and outputs a comprehensive Markdown guide detailing the endpoints, record counts, and dropped row warnings.
2.  **`LLM_REPORT.md`:** Automatically instructs developers on how to connect local or web-based LLMs to the newly generated data chunks.

## Interaction Patterns & Fallbacks
*   **Rate Limiting Prevention:** The design incorporates purposeful `sleep()` delays between tab processing and image downloading to avoid triggering Google Drive's 429 errors.
*   **Atomic Writes:** Using `FailSafeStore.js`, the JSON files are written atomically. This guarantees that if a user visits the API at the exact millisecond the pipeline is running, they will not receive a corrupted or partial JSON string.
