# ⚠️ Frontend Breaking Changes: JSON Structure Evolution

Your frontend is stuck because two major things changed when you updated `sheets.yaml`. 

You changed the name from `Master Directory` to `instrument`, and more importantly, you switched from a single `gid` to multiple `tabs`.

---

## 1. The Endpoint URL Changed
- **OLD Endpoint:** `https://rink-git-cron.vercel.app/master_directory.json`
- **NEW Endpoint:** `https://rink-git-cron.vercel.app/instrument.json`

## 2. The JSON Data Structure Changed (Array ➡️ Object)

Because you added multiple tabs (`Main Data` and `Instituitiion list`) to the same sheet, the sync engine grouped them together. It can no longer just return a flat array. It now returns an **Object** where each key is a snake_case version of your Tab Name.

### 🟥 OLD Structure (When you used a single `gid`)
The API returned a flat **Array** of instruments.
```json
[
  {
    "id": "inst_100001",
    "instruments": "High resolution Transmission Electron Microscope",
    "image_link": "/assets/master_directory/inst_100001_image_link.webp"
  },
  {
    "id": "inst_100002",
    "instruments": "Scanning Electron Microscope"
  }
]
```
**Old Frontend Code:**
```javascript
const response = await fetch('/master_directory.json');
const data = await response.json();

// Frontend expected an array and mapped directly over it
data.map(instrument => render(instrument));
```

---

### 🟩 NEW Structure (Because you added `tabs:`)
The API now returns an **Object**. The actual array of instruments is now nested inside the `"main_data"` key!

```json
{
  "main_data": [
    {
      "id": "inst_100001",
      "instruments": "High resolution Transmission Electron Microscope",
      "image_link": "/assets/instrument/inst_100001_image_link.webp" 
    }
  ],
  "instituitiion_list": [
    {
      "institution_name": "Cochin University",
      "location": "Kerala"
    }
  ]
}
```

### 🛠️ How to Fix the Frontend

Pass this directly to your frontend agent:

**New Frontend Code:**
```javascript
const response = await fetch('https://rink-git-cron.vercel.app/instrument.json');
const data = await response.json();

// FIX: Access the specific tab array you want to map over!
const instrumentsArray = data.main_data; 
const institutionsArray = data.instituitiion_list;

instrumentsArray.map(instrument => render(instrument));
```

By making this one small change (accessing `.main_data`), the frontend will instantly start working again!
