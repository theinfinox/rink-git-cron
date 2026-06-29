# 🛠️ RINK Configuration Guide (`config/sheets.yaml`)

The `sheets.yaml` file is the brain of the RINK Sync Engine. It dictates exactly which Google Sheets are synced, how they are structured in the JSON API, what data is hidden from the public, and which columns are treated as images.

This guide provides an in-depth breakdown of every configurable property available.

---

## 🏗️ The Master Template

Here is a comprehensive example showing **every possible configuration option** combined. You can copy this structure and remove what you don't need.

```yaml
# [Optional] The base URL of your frontend application.
# If provided, the engine generates direct frontend links inside the LLM index (llms.txt)
frontendBaseUrl: "https://rink-ui.vercel.app"

sheets:
  # 1. Provide a clean name for your sheet. This becomes the API endpoint name.
  # Example: "Global Inventory" becomes /api/global_inventory.json
  - name: Global Inventory
    
    # 2. The Google Spreadsheet ID (found in the Google Sheets URL)
    spreadsheetId: 1DMW9DfaLEMvNoL29Yvj7HR4e1SIGpn_QXvEhPdI4U8k
    
    # 3. 🧠 DYNAMIC FILTERS (Optional): Auto-generate an API for frontend filter menus
    # It cross-references the live Google Sheet against these predefined categories.
    filterTaxonomy:
      district:
        "South Zone": ["Thiruvananthapuram", "Kollam", "Pathanamthitta"]
        "Central Zone": ["Ernakulam", "Thrissur"]
      tag:
        "Life Sciences": ["genomics", "bioinformatics"]
        "Material Sciences": ["metallurgy", "polymers"]
    
    # 4. Define the tabs you want to extract from this spreadsheet
    tabs:
      - name: Instruments               # The exact name of the tab in Google Sheets
        gid: 0                          # The gid (found at the end of the Google Sheets URL)
        
        # 🛡️ PRIVACY: Completely remove specific columns from the generated JSON
        excludeColumns:
          - "internal_admin_notes"      # Removes the 'internal_admin_notes' column
          - "contact_email"             # Removes the 'contact_email' column
        
        # 🚫 FILTERING: Skip rows entirely based on specific conditions
        excludeRowsWhere:
          - column: "status"            # If the 'status' column...
            equals: "draft"             # ...exactly equals "draft", the row is excluded.
          - column: "published"
            equals: "FALSE"
            
        # ✂️ SPLITTING: Convert comma-separated strings into real JSON arrays
        # Perfect for Search Engines (like Orama) to filter by tags
        splitColumns:
          - column: "tag"               # The column containing the string (e.g. "bio, chem")
            delimiter: ","              # The character to split by. Result: ["bio", "chem"]
            
        # 🖼️ IMAGES: Explicitly define which columns contain images to download.
        # This prevents the engine from trying to download normal website links (like booking portals).
        # Can be a comma-separated string or a YAML list.
        imageColumns: "image_link, cover_photo"

      # You can add as many tabs as you want. They will be merged into the same JSON!
      - name: Equipment List
        gid: 12345
        # (You can apply different filters and rules to this tab)
```

---

## 📖 Deep Dive into the Properties

### `frontendBaseUrl` (String)
**Purpose**: Helps AI Agents construct direct links to your web pages.
**How it Works**: The backend engine outputs a spatial index file `llms.txt`. If you provide this URL, the engine appends `{sheet_name}/{row_id}` to it. 
*Example:* `https://rink-ui.vercel.app/global_inventory/inst_1001`

### `sheets` (List)
The main array holding all your Google Sheets configurations. You can configure multiple unrelated spreadsheets by adding them to this list.

#### `name` (String)
The human-readable name of the sheet. **Crucially**, the engine converts this to snake_case (`global_inventory`) to name the JSON files, API routes, and image folders.

#### `spreadsheetId` (String)
The unique identifier of the Google Sheet. 
*How to find:* `https://docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit`

#### `tabs` (List)
A list of specific tabs within the spreadsheet to sync.
- If you only define **one** tab, the resulting JSON is an array of objects `[{...}, {...}]`.
- If you define **multiple** tabs, the resulting JSON is an object grouping the arrays by tab name `{"instruments": [...], "equipment": [...]}`.

#### `filterTaxonomy` (Object)
*Optional but powerful.* Used to auto-generate a `filters.json` endpoint for your frontend menus.
You provide a structured taxonomy (e.g., grouping specific `district` values into zones, or `tag` values into research domains). As the engine syncs your sheet, it cross-references the live data. If a row contains a district or tag not listed in your predefined taxonomy, the engine automatically adds it to an `"Other Districts"` or `"Other Tags"` bucket. This allows your frontend to pull a perfectly structured and live filter menu natively from the backend without any hardcoding!

---

### 🎛️ Tab-Level Modifiers

These properties are applied **per tab**.

#### `excludeColumns` (List of Strings)
Takes an array of exact column headers. The engine will completely delete these columns from the final JSON payload. Perfect for hiding internal reviewer notes, pricing, or private contact information.

#### `excludeRowsWhere` (List of Objects)
Takes a list of objects containing `column` and `equals`. As the engine scans the sheet, if it finds a row where the specified column exactly matches the `equals` string (case-insensitive), it throws the entire row away. Perfect for keeping "Draft" or "Pending Review" items in Google Sheets without leaking them to the public API.

#### `splitColumns` (List of Objects)
Takes a list of objects containing `column` and `delimiter`. Converts a raw string like `"microscope, biology, lab"` into a highly-searchable JSON Array: `["microscope", "biology", "lab"]`. This is essential if your frontend is using search tools like **Orama** or **Algolia** to filter by categories/tags.

#### `imageColumns` (String or List)
*Highly Recommended.* If your spreadsheet contains multiple columns with URLs (e.g., a Google Drive link for an image, and a standard URL for an external website), the engine might accidentally try to download the external website. 
By defining `imageColumns`, you force the engine to **only** scan and optimize the specified columns, safely ignoring all other links. You can write this as a comma-separated string (`"image_link, banner"`) or a YAML list.
