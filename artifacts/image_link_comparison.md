# 🖼️ Frontend Breaking Changes: Image Links

When we upgraded the data pipeline with the auto-image optimizer and you renamed your sheet from `Master Directory` to `instrument`, the structure of the image links within the JSON changed drastically. 

Here is exactly what changed so your frontend agent can adapt:

---

## 🟥 OLD Approach (Raw Google Drive Links)

Previously, the JSON provided the raw, unoptimized link directly from Google Sheets.

```json
{
  "id": "inst_100001",
  "instruments": "Scanning Electron Microscope",
  "image_link": "https://drive.google.com/file/d/10DBUxivXS4FFTpJwUaVPBMLo60Q3DhLa/view?usp=sharing"
}
```

**Why this was bad for the frontend:**
- The frontend had to download a massive, raw 5MB JPG file directly from Google Servers, slowing down page loads.
- Google Drive links often broke due to permission issues or rate limits.

---

## 🟩 NEW Approach (Local WebP Optimization)

The backend now actively intercepts that Google Drive link, downloads the image, converts it to a tiny `.webp` format, and stores it in the `public/assets/` folder. 

Crucially, because you changed the sheet name in `sheets.yaml` to `instrument`, the folder slug updated automatically!

```json
{
  "id": "inst_100001",
  "instruments": "Scanning Electron Microscope",
  "image_link": "/assets/instrument/inst_100001_image_link.webp",
  "original_image_link": "https://drive.google.com/file/d/10DBUxivXS4FFTpJwUaVPBMLo60Q3DhLa/view?usp=sharing"
}
```

### 🔍 Anatomy of the New Slug Structure

The string `"/assets/instrument/inst_100001_image_link.webp"` is dynamically generated based on three rules:

1. **The Sheet Name (`instrument`):** It uses the `snake_case` version of whatever you name the sheet in `sheets.yaml`.
2. **The Row ID (`inst_100001`):** It prefixes the image name with the unique `id` of that specific row.
3. **The Column Name (`image_link`):** It appends the `snake_case` version of the column header from Google Sheets where it found the link.

### 🛠️ How to Fix the Frontend

Pass this directly to your frontend agent:

**Frontend Action:**
The frontend component `<img src={item.image_link} />` will still work perfectly if it's pointing to the root URL of where this data is hosted.
- Because it is a relative path starting with `/assets/...`, the frontend Next.js app needs to ensure it fetches the image from the correct backend domain (e.g., `https://rink-git-cron.vercel.app/assets/instrument/inst_100001_image_link.webp`), rather than trying to look for the image inside its own local `public/` folder.
- If the frontend and backend are hosted on different Vercel projects, you simply need to prepend the backend domain to the image source: `<img src={\`https://rink-git-cron.vercel.app${item.image_link}\`} />`
