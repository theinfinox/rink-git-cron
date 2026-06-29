# 🏗️ Backend Structure Evolution (Old vs New)

By simply renaming `- name: Master Directory` to `- name: instrument` in your `sheets.yaml`, the entire backend structure has automatically shifted to support your exact frontend slug requirements!

Here is a side-by-side comparison of exactly how the generated data structure has evolved.

---

## 🟥 OLD Structure (Before AI Updates & Rename)

Previously, everything was bundled into a single massive JSON array, and the images were stored under `master_directory`.

```text
📁 public/
 ├── 📄 master_directory.json        (2.1 MB - The entire database in one file)
 └── 📁 assets/
      └── 📁 master_directory/
           ├── 🖼️ inst_100001_image_link.webp
           ├── 🖼️ inst_100002_image_link.webp
           └── ... (890+ images)
```

**Why this was bad:**
- **AI Token Bloat:** ChatGPT would have to read 2.1 MB of JSON just to find one instrument.
- **Frontend Mismatch:** The URL slug naturally generated `.../master_directory/...`, which doesn't match your frontend requirement of `/instrument/...`.

---

## 🟩 NEW Structure (After AI Updates & Rename)

Because you renamed the sheet to `instrument`, the `sync.js` engine dynamically generated an incredibly robust, token-efficient, and frontend-aligned folder structure.

```text
📁 public/
 ├── 📄 instrument.json              (The primary database for the frontend)
 ├── 📄 API_DIRECTORY.md             (Auto-updated Documentation)
 ├── 📄 LLM_REPORT.md                (Auto-updated AI Handbook)
 │
 ├── 📁 api/
 │    └── 📁 instrument/             <-- Notice the new exact route!
 │         ├── 📄 llms.txt           (The 100KB Search Index for ChatGPT)
 │         ├── 📄 inst_100001.json   (A tiny 1KB chunk containing only this item)
 │         ├── 📄 inst_100002.json
 │         └── ... (890+ tiny JSON files)
 │
 └── 📁 assets/
      └── 📁 instrument/             <-- Image assets now route correctly!
           ├── 🖼️ inst_100001_image_link.webp
           ├── 🖼️ inst_100002_image_link.webp
           └── ... (890+ images)
```

### 🧠 The LLM Routing Magic

Because of your YAML update, the generated `llms.txt` file now produces the absolute perfect URL structure naturally:

**Inside `public/api/instrument/llms.txt`:**
> `[inst_100001] Transmission Electron Microscope | Location: Ernakulam | Tags: nanotech`
> `URL: https://rink-ui.vercel.app/instrument/inst_100001`

**The Impact:**
When ChatGPT or Claude recommends `inst_100001` to a user, it explicitly outputs `https://rink-ui.vercel.app/instrument/inst_100001` as the clickable link. It perfectly matches the Next.js `[id]` dynamic route on your frontend without requiring any complex regex or code changes!
