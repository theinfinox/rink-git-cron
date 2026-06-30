# 🤖 RINK Project — Agent Handoff Report
**Session Date:** 2026-06-30  
**Prepared by:** Antigravity (Google DeepMind)  
**Purpose:** Full context transfer for incoming AI agent

---

## 🗺️ Project Overview

**RINK** is a research instrument discovery platform for Kerala, India. It lets users search and filter scientific instruments available across institutions (IITs, state universities, government labs, etc.).

### Two Repositories

| Repo | Path | Role |
|---|---|---|
| `rink-git-cron` | `c:\Users\1sree\Documents\rink-git-cron` | Backend/Sync Engine + CDN data store |
| `rink-frontend` | `c:\Users\1sree\Desktop\rink-frontend` | Next.js UI (Vercel) |

**CDN pattern:** Backend syncs Google Sheets → generates static JSON → commits to GitHub → Vercel frontend fetches those JSONs via CDN URL.

**No API keys used anywhere.** Google Sheets are public, fetched as CSV export URLs.

---

## 🏗️ Architecture: How Everything Works

### Data Pipeline (Backend)
```
config/sheets.yaml
       ↓
scripts/sync.js
       ↓
Fetches Google Sheets as CSV (no API key — public export URL)
       ↓
Parses, normalizes, applies excludeRowsWhere, splitColumns, imageColumns
       ↓
Generates:
  public/instrument.json          ← main multi-tab data object
  public/api/instrument/filters.json  ← dynamic taxonomy for sidebar
  public/api/instrument/inst_XXXXX.json  ← per-instrument detail pages
  public/llms.txt                 ← AI/LLM bridge file
  public/API_DIRECTORY.md         ← human-readable data map
```

### Frontend Data Flow
```
Next.js App (Vercel)
       ↓
useStore.ts (Zustand store)
  → fetch instrument.json  ← CDN
  → fetch filters.json     ← CDN
  → reads tabKey from filters.json to know which tab's rows to load
  → indexes with OramaDB for full-text search
       ↓
FilterSidebar.tsx   ← reads dynamicTaxonomy from store
InstrumentGrid.tsx  ← reads filteredInstruments from store
```

---

## 📁 Key Files Reference

### Backend (`rink-git-cron`)
| File | Purpose |
|---|---|
| `config/sheets.yaml` | Single source of truth — defines all sheets, tabs, filter taxonomy |
| `scripts/sync.js` | The sync engine — fetches, normalizes, generates all output files |
| `public/instrument.json` | Multi-tab data: `{ main_data: [...], instituitiion_list: [...] }` |
| `public/api/instrument/filters.json` | Filter taxonomy consumed by frontend |

### Frontend (`rink-frontend`)
| File | Purpose |
|---|---|
| `src/store/useStore.ts` | Zustand store — central state, search, filter logic |
| `src/components/domain/FilterSidebar.tsx` | Filter UI — renders dynamicTaxonomy |
| `src/components/yaml-builder/` | Visual YAML editor for `sheets.yaml` |
| `src/components/yaml-builder/types.ts` | TypeScript interfaces for YAML structure |
| `src/components/yaml-builder/TaxonomyBuilder.tsx` | Filter taxonomy editor component |
| `src/components/yaml-builder/SheetCard.tsx` | Sheet config editor |
| `src/components/yaml-builder/TabCard.tsx` | Tab config editor with column auto-fetch |

---

## 🔧 Everything Built This Session

### 1. YAML Builder — Auto-fetch Sheet Metadata
**Problem:** User had to manually type column names.  
**Solution:** Added `/api/sheet-metadata` proxy endpoint in Next.js. When user pastes a Sheet ID, the YAML builder auto-fetches all available GIDs and column headers from each tab. Dropdowns replace raw text inputs.

### 2. Dynamic Filter Taxonomy (Phase 1: GID Scoping)
**Problem:** `filters.json` was built by scanning ALL tabs — mixing main data with institution list, causing wrong filter values.

**Solution:** Added `gid` field to each `filterTaxonomy` category in `sheets.yaml`. `sync.js` now:
- Builds a `gidToTabKey` map from the sheet's tabs
- Scans **only** the tab matching `config.gid` when collecting filter values
- Emits `gid` and `tabKey` in `filters.json`

Frontend now reads `tabKey` from `filters.json` and dynamically loads items from the correct tab instead of hardcoding `rawData.main_data`.

```yaml
# sheets.yaml example
filterTaxonomy:
  - id: standardized_district
    title: Districts
    gid: 5695880        # ← now scoped to this tab only
    groups:
      South Zone:
        - Thiruvananthapuram
```

### 3. Tag-Bubble Input in TaxonomyBuilder
**Problem:** Group values were a plain comma-separated text field — error-prone and ugly.  
**Solution:** Built a `TagInput` component — YouTube-style tag bubbles. Pressing `,`, `Space`, or `Enter` creates a new pill tag. Backspace removes the last tag. Paste support (splits by comma/newline).

Also added **standalone mode** — filter values with no named group, stored as group key `""`. `FilterSidebar` renders these flat (no group header).

### 4. Cross-Tab Join Filter (Phase 2: The Big Feature)
**Problem:** Institution type filter needed to link two tabs via a shared key (`correct_provider_key`). Main data has `correct_provider_key` per instrument; institution list has `institution_name`, `correct_provider_key`, `reason_classification`.

**Concept:** When user clicks "Kerala State Public University", the system:
1. Looks up all institutions in that classification from the institution list
2. Gets their `correct_provider_key` values
3. Filters main data rows where `correct_provider_key` matches

**Solution:** New `linkType: join` filter mode with full YAML config.

#### `sheets.yaml` join config:
```yaml
filterTaxonomy:
  - id: correct_provider_key      # column in main_data to match
    title: Institution Type
    gid: 5695880                   # primary tab (items come from here)
    linkType: join
    joinSource:
      gid: 1583764603              # lookup tab (institution list)
      foreignKey: correct_provider_key   # key in lookup tab = main_data's column
      groupByColumn: reason_classification  # groups by this column's values
      displayColumn: institution_name       # shown to users
      groupByDelimiter: ','                 # handles multi-value cells
      autoDiscover: true                    # auto-build groups from data
    groups: {}                     # optional manual override groups
```

#### `filters.json` output for join filter:
```json
{
  "id": "correct_provider_key",
  "title": "Institution Type",
  "linkType": "join",
  "tabKey": "main_data",
  "groups": {
    "Kerala State Public University": [
      { "label": "Cochin University of Science and Technology", "value": "state_univ" },
      { "label": "Kerala University", "value": "state_univ" }
    ],
    "Institute of National Importance (IIT)": [
      { "label": "Indian Institute of Technology Palakkad", "value": "ini_iit" }
    ]
  }
}
```

Direct filters still use `string[]` groups (unchanged). Join filters use `{ label, value }[]`.

#### Frontend adaptation:
- `FilterGroupItem = { label: string, value: string }` type added to `useStore.ts`
- `TaxonomyCategory.groups` is now `Record<string, Array<string | FilterGroupItem>>`
- `getItemValue()` and `getItemLabel()` helpers in `FilterSidebar.tsx` transparently handle both types
- `performSearch` matches `item[category.id]` against `value` (the foreign key) — never the display label
- `handleDynamicParentToggle` uses `getItemValue()` for correct toggling

#### TaxonomyBuilder UI for join:
- Toggle button per category: 🔗 Cross-Tab Join / 📋 Direct Column
- Green panel appears for join config with all fields:
  - Lookup Tab dropdown (from defined tabs)
  - Foreign Key input
  - Group By Column input
  - Display Name Column input
  - Delimiter input
  - Auto-discover checkbox
- `+ Manual Override Group` button for edge cases

### 5. Header Hidden on YAML Builder
`Header.tsx` uses `usePathname()` to conditionally hide itself on `/yaml-builder` route.

### 6. Backend: toSnakeCase Normalization
All column names from CSV are normalized via `toSnakeCase()` before storage. This is **critical** — the YAML `id`, `foreignKey`, `groupByColumn`, `displayColumn` fields must all use snake_case to match processed row keys.

---

## 📐 Design Decisions & Reasoning

### Why `tabKey` over raw GID in frontend?
GID is a Google Sheets concept. After sync, data is stored by tab name in snake_case (e.g. `main_data`, `instituitiion_list`). Storing the resolved `tabKey` in `filters.json` means the frontend never needs to know about GIDs — those are an internal backend concern.

### Why `{ label, value }` objects for join groups?
The filter matching logic works on raw data column values (e.g. `"state_univ"`). But users need to see human-readable names (e.g. `"Cochin University of Science and Technology"`). Keeping `label` and `value` as separate fields in the JSON output makes the frontend's job unambiguous — display `label`, filter by `value`.

### Why are manual groups merged after auto-discover?
User may need to define groups that don't exist as a type in the institution list (e.g. a custom "Government Labs" group combining different `reason_classification` values). Manual groups take precedence for ordering; auto-discovered groups fill in everything else.

### Why `groupByDelimiter`?
Institution type cells can have multiple values like `"ICAR, Under KSCSTE"`. Supporting delimiter-based splitting allows one institution to appear in multiple filter groups simultaneously — a many-to-many relationship without changing the sheet.

---

## 🐛 Bugs Found & Fixed This Session

1. **Hardcoded `rawData.main_data`** in `useStore.ts` — broke if tab was renamed. Fixed: now reads `tabKey` from `filters.json`.
2. **`handleDynamicParentToggle` passing full item objects** instead of string values — broke parent checkbox toggle for join filters. Fixed: uses `getItemValue()`.
3. **Leftover duplicate code block** in `sync.js` after a failed replace — removed.
4. **Wrong column names** in initial `sheets.yaml` join config (`provider_key`, `institution_type`) — corrected to actual sheet columns (`correct_provider_key`, `reason_classification`) discovered by inspecting `instrument.json`.
5. **`correct_provider_key` not mapped** in `safeData` in `useStore.ts` — added.
6. **Orama schema missing `correct_provider_key`** field — added.

---

## 📊 Current `sheets.yaml` State

```yaml
frontendBaseUrl: https://rink-ui.vercel.app
sheets:
  - name: instrument
    spreadsheetId: 1DMW9DfaLEMvNoL29Yvj7HR4e1SIGpn_QXvEhPdI4U8k
    tabs:
      - name: Main Data
        gid: 5695880
        excludeRowsWhere:
          - column: id
            equals: id
        splitColumns:
          - column: tag
            delimiter: ','
        imageColumns: image_link
      - name: Instituitiion list
        gid: 1583764603
        aiSearch:
          enabled: false
    filterTaxonomy:
      - id: standardized_district
        title: Districts
        gid: 5695880
        groups:
          South Zone: [Thiruvananthapuram, Kollam, Pathanamthitta]
          Central Zone: [Ernakulam, Thrissur, Alappuzha, Kottayam, Idukki]
          North-Central Zone: [Palakkad, Malappuram]
          North Zone: [Kozhikode, Kannur, Wayanad, Kasaragod]
      - id: correct_provider_key
        title: Institution Type
        gid: 5695880
        linkType: join
        joinSource:
          gid: 1583764603
          foreignKey: correct_provider_key
          groupByColumn: reason_classification
          displayColumn: institution_name
          groupByDelimiter: ','
          autoDiscover: true
        groups: {}
```

---

## 📦 Institution List Tab — Actual Schema

Discovered by inspecting `instrument.json`:
```
Columns: [ 'institution_name', 'correct_provider_key', 'reason_classification' ]
Sample: {
  "institution_name": "Cochin University of Science and Technology",
  "correct_provider_key": "state_univ",
  "reason_classification": "Kerala State Public University"
}
23 institutions total.
```

**⚠️ Data quality note:** Some `reason_classification` values have inconsistent formatting (e.g. `"ICAR"` vs `"ICAR (Indian Council of Agricultural Research)"` — both appear as separate groups). This is a data problem in the sheet, not a code bug.

---

## 🚀 Current Git State

- **Backend repo:** `github.com/theinfinox/rink-git-cron` — latest commit `5795dc0`  
  `feat: cross-tab join filter — auto-discover groups from institution list via shared key`
- **Frontend repo:** Local at `c:\Users\1sree\Desktop\rink-frontend` — changes not yet committed/pushed to its own repo (frontend dev server running on `npm run dev`)
- **Backend is live** — Vercel CDN serves from the GitHub `public/` folder

---

## 🔜 What's Left / Next Steps

### Immediate
1. **Commit & push frontend changes** — `rink-frontend` has all the store/FilterSidebar/TaxonomyBuilder changes locally but they haven't been pushed to its git repo yet
2. **Data quality fix** — Clean `reason_classification` column in institution list tab to have consistent group names (reduces duplicate groups in filter)

### Future Roadmap (User's Vision)
- **More filter categories** — User wants to add more cross-tab and direct filters as data grows
- **YAML Builder completeness** — The visual builder should be able to generate the full `sheets.yaml` without manual editing
- **Frontend filter display** — Currently filters show all groups; may want collapsing/search within filter accordion for large group sets
- **Multi-sheet support** — Architecture already supports multiple sheets in `sheets.yaml`; frontend could be extended to switch between sheets

---

## ⚙️ How to Run

### Backend (rink-git-cron)
```powershell
cd c:\Users\1sree\Documents\rink-git-cron
npm run sync          # sync data only
# push to git after sync to update CDN
git add -A && git commit -m "..." && git push
```

### Frontend (rink-frontend)
```powershell
cd c:\Users\1sree\Desktop\rink-frontend
npm run dev           # starts on localhost:3000
```

### One-liner (sync + push)
```powershell
cd c:\Users\1sree\Documents\rink-git-cron; npm run sync; git add -A; git commit -m "sync: data update"; git push
```

---

## 🧠 Agent Instructions for Next Session

1. **Always check actual column names** by inspecting `public/instrument.json` before configuring YAML — sheet column names often differ from what's expected
2. **`toSnakeCase()` is applied to all column names** — spaces become underscores, everything lowercase. Match this in YAML config fields
3. **Frontend CDN URL** is defined in `useStore.ts` as `CDN_HOST` — currently points to the raw GitHub content URL
4. **The YAML builder at `/yaml-builder`** generates YAML that can be copy-pasted into `config/sheets.yaml`
5. **Do NOT use Google Sheets API** — only public CSV export: `https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}`
6. **FilterSidebar handles both old and new filter formats** — backward compatible

---

*Report generated: 2026-06-30T15:30 IST*
