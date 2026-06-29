# 🚀 RINK Sync Engine

A serverless data pipeline that intelligently syncs Google Sheets data into JSON endpoints while automatically intercepting, downloading, and optimizing images.

## Features
- **Multi-Sheet Support:** Sync an infinite number of Google Sheets at once.
- **Multi-Tab Support:** Merge multiple tabs from a single sheet into categorized JSON objects.
- **Auto-Image Optimization:** Automatically detects Google Drive links and standard image URLs in *any* column. It downloads them, converts them to WebP (saving bandwidth), and serves them locally.
- **Automated Deployments:** Built to run via GitHub Actions cron jobs to keep your frontend data constantly up to date.

---

## 🛠️ Configuration (`config/sheets.json`)

All configuration is handled in `config/sheets.json`. You do not need to modify any environment variables or code to add new sheets.

### Option A: Single Tab Sheet
If you just want to pull the default tab from a sheet, define the `gid` as a string:
```json
[
  {
    "name": "Master Directory",
    "spreadsheetId": "YOUR_SPREADSHEET_ID_HERE",
    "gid": "0"
  }
]
```
*Result:* This generates an array of rows at `/master_directory.json` and images at `/assets/master_directory/`.

### Option B: Multiple Tabs (Categorized)
If you want to pull multiple tabs from the same sheet, use the `tabs` array:
```json
[
  {
    "name": "Global Inventory",
    "spreadsheetId": "YOUR_SPREADSHEET_ID_HERE",
    "tabs": [
      { "name": "Instruments", "gid": "0" },
      { "name": "Equipment", "gid": "12345" }
    ]
  }
]
```
*Result:* This generates a single JSON object at `/global_inventory.json` where each tab is a key containing its respective rows (e.g., `data.instruments` and `data.equipment`).

---

## 📸 Image Auto-Identification

You **do not** need to name your columns `image_link`. 

The pipeline scans every single cell in your sheet. If a cell contains a valid URL that is either:
1. A **Google Drive link**
2. A direct link ending in an image format (`.jpg`, `.png`, `.webp`, `.gif`, `.svg`, `.bmp`)

It will automatically:
- Download the image from the source.
- Resize and optimize it to WebP.
- Save it to `public/assets/<snake_case_sheet_name>/`.
- Replace the Google Drive/Image URL in your JSON with the fast local path (e.g., `/assets/master_directory/123_profile_pic.webp`).

**Frontend Impact:** The frontend requires 0 logic to handle images. If you name your column `cover_photo` in Google Sheets, the frontend simply reads `item.cover_photo` and it will automatically be the optimized local path!

---

## 🏃‍♂️ How to Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Update `config/sheets.json` with your real `spreadsheetId`s.
3. Run the synchronization and download process:
   ```bash
   npm run sync && npm run download-images
   ```

---

## 🤖 GitHub Actions / Automation

This repository includes a GitHub Action (`.github/workflows/cron-sync.yml`) that runs every night automatically.
- It executes the scripts.
- It automatically tracks and commits any changes to `public/` and `data/`.
- No modifications to the workflow are necessary when adding new sheets. It dynamically scales!
