# 🚀 Frontend Architecture Overhaul & Optimization Prompt

Copy and paste the entire block below into Cursor, Windsurf, or ChatGPT when you open your frontend repository. 

***

You are an expert Frontend Architect building a Next.js/React application. Our backend data pipeline has undergone a massive architectural upgrade to improve performance, save bandwidth, and heavily optimize search functionalities. 

Please comprehensively review the changes below and refactor our frontend codebase to adapt to this new standard.

## 1. 🛑 Breaking JSON Structure Change
**The Problem:** The API endpoint changed from `/master_directory.json` to `/instrument.json`. More importantly, because we added multiple tabs to the backend configuration, the API no longer returns a flat Array `[...]`. It now returns an Object grouped by tabs `{ "main_data": [...], "instituitiion_list": [...] }`.
**Action Required:**
- Update all fetch calls pointing to the old URL to use the new domain URL: `https://rink-git-cron.vercel.app/instrument.json`
- Wherever the code previously mapped over the raw JSON array (`data.map`), you must now drill into the specific tab array: `data.main_data.map(item => ...)`.

## 2. 🖼️ Image Pipeline Optimization
**The Problem:** Previously, the backend served raw Google Drive links (`https://drive.google.com/...`) which were incredibly slow and unoptimized.
**The Solution:** The backend now intercepts, downloads, and converts all images to tiny `.webp` files stored locally. The `image_link` in the JSON is now a relative path (e.g., `/assets/instrument/inst_100001_image_link.webp`).
**Action Required:**
- Since the frontend is hosted on a different domain than the data, update your `<img src={...} />` tags to prepend the backend domain to the relative path. Example: `<img src={\`https://rink-git-cron.vercel.app${item.image_link}\`} />`.
- If a "Download Original" button is needed, the backend preserved the Google Drive link inside the `original_image_link` JSON key.

## 3. 📝 Rich Text / Markdown Parsing
**The Solution:** The backend now automatically converts Markdown formatting from the Google Sheets (like bolding `**text**` and bullets) into sanitized HTML strings.
**Action Required:** 
- Any long-form text fields (descriptions, specifications) might contain HTML. Ensure you render them safely using `dangerouslySetInnerHTML` in React so the formatting displays correctly, rather than outputting raw HTML strings.

## 4. ⚡ Hyper-Optimized Orama Client Search
**The Problem:** Currently, to build the Orama search index, the frontend is likely downloading the massive 2MB `instrument.json` file. This causes severe bandwidth bloat and slow time-to-interactive for users on mobile.
**The Solution:** The backend generates a highly compressed text-based search index at `https://rink-git-cron.vercel.app/api/instrument/llms.txt`. It is 90% smaller than the JSON file!
**Action Required:**
- Refactor the Orama ingestion logic. Instead of downloading `instrument.json` for search, download `/api/instrument/llms.txt`.
- The file format looks exactly like this:
  `[inst_100001] Transmission Electron Microscope | Institute: Cochin University | Location: Ernakulam | Tags: nanotech | URL: https://rink-ui.vercel.app/instrument/inst_100001`
- Write a fast regex or string-split parser in JavaScript to convert these lines into tiny Orama documents: `{ id, name, institute, location, tags, url }`. 
- Feed these tiny documents into Orama. This will make the search bar load almost instantly!
- When a user clicks a search result in Orama, you already have the `URL` parsed from the text, so just route them directly to that page!

## 5. 🤖 Zero-Cost AI Routing
**The Solution:** For deep-dive AI integration, the backend has pre-chunked the JSON into tiny 1KB files.
**Action Required:**
- If you build an AI Chatbot into the frontend, do NOT feed it `instrument.json`. 
- Have the AI fetch `llms.txt` to find the correct ID, and then have it fetch the exact item data at `https://rink-git-cron.vercel.app/api/instrument/{id}.json`. This ensures zero token waste!

Please acknowledge you understand these 5 architectural pillars, and let me know which file you would like to refactor first!
