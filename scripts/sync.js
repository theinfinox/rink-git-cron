import fs from 'fs';
import Papa from 'papaparse';
import yaml from 'yaml';
import crypto from 'crypto';
import { marked } from 'marked';

const DATA_DIR = './data';
const PUBLIC_DIR = './public';
const BACKUP_DIR = './data/backups';
const CONFIG_PATH = './config/sheets.yaml';

function toSnakeCase(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '');
}

// Helper to extract Drive ID
const extractDriveId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:id=|v\/|vi\/|u\/\w\/|embed\/|e\/|file\/d\/|uc\?id=)([^#&?/\s]+)/);
    return match ? match[1] : null;
};

// Helper to identify standard image extensions
const isImageExtension = (url) => {
    if (!url) return false;
    return /\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(url.trim());
};

// Sleep utility to prevent rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSync() {
    console.log("🚀 Starting Adaptive RINK Data Sync...");

    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`❌ Configuration file not found at ${CONFIG_PATH}`);
        process.exit(1);
    }

    let sheetsConfig = [];
    let frontendBaseUrl = "";
    
    try {
        const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
        const parsed = yaml.parse(fileContents);
        
        if (Array.isArray(parsed)) {
            sheetsConfig = parsed;
        } else if (parsed && typeof parsed === 'object') {
            frontendBaseUrl = parsed.frontendBaseUrl || "";
            sheetsConfig = parsed.sheets || [];
        }
    } catch (error) {
        console.error(`❌ Failed to read or parse configuration file at ${CONFIG_PATH}:`, error.message);
        process.exit(1);
    }

    // Ensure ALL directories exist before saving
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    if (sheetsConfig.length === 0) {
        console.warn("⚠️ Configuration file is empty or invalid.");
    }

    const apiReport = [];

    for (const sheet of sheetsConfig) {
        const timestamp = new Date().toISOString();
        const snakeCaseName = toSnakeCase(sheet.name);
        
        let logEntry = { 
            timestamp, 
            sheet_name: sheet.name, 
            status: 'SUCCESS', 
            error_code: null, 
            rows_total: 0, 
            rows_exported: 0 
        };

        const HISTORY_JSON = `${DATA_DIR}/${snakeCaseName}_sync_history.json`;
        const MASTER_JSON = `${PUBLIC_DIR}/${snakeCaseName}.json`;

        try {
            if (!sheet.spreadsheetId) {
                throw { code: 'ERR_NO_SPREADSHEET_ID', message: `spreadsheetId is missing for sheet ${sheet.name}.` };
            }

            const tabsToFetch = sheet.tabs || [{ name: sheet.name, gid: sheet.gid || '0' }];
            const isMultiTab = !!sheet.tabs;
            
            const finalData = isMultiTab ? {} : [];

            for (let tIndex = 0; tIndex < tabsToFetch.length; tIndex++) {
                const tab = tabsToFetch[tIndex];
                if (tIndex > 0) await sleep(1000); // 1s delay between tabs to prevent Google HTTP 429 Rate Limiting

                const gid = tab.gid || '0';
                const csvUrl = `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/export?format=csv&gid=${gid}`;
                console.log(`📥 Fetching data for ${sheet.name} (Tab: ${tab.name}) from Google Sheets...`);
                
                const response = await fetch(csvUrl);
                if (!response.ok) {
                    throw { code: 'ERR_FETCH_FAILED', message: `HTTP Error ${response.status}: Failed to download CSV for tab ${tab.name}.` };
                }
                const csvText = await response.text();

                // INCREMENTAL SYNC LOGIC
                const hash = crypto.createHash('md5').update(csvText).digest('hex');
                const HASH_FILE = `${DATA_DIR}/${snakeCaseName}_${toSnakeCase(tab.name)}_hash.json`;
                let previousHash = null;
                if (fs.existsSync(HASH_FILE)) {
                    try { previousHash = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8')).hash; } catch(e) {}
                }

                if (previousHash === hash && fs.existsSync(MASTER_JSON)) {
                    console.log(`⏭️  No changes detected for ${sheet.name} (Tab: ${tab.name}). Using cached data to save compute time!`);
                    
                    const cachedMaster = JSON.parse(fs.readFileSync(MASTER_JSON, 'utf8'));
                    let cachedData = [];
                    if (isMultiTab && cachedMaster[toSnakeCase(tab.name)]) {
                        cachedData = cachedMaster[toSnakeCase(tab.name)];
                        finalData[toSnakeCase(tab.name)] = cachedData;
                    } else if (!isMultiTab && Array.isArray(cachedMaster)) {
                        cachedData = cachedMaster;
                        finalData.push(...cachedData);
                    }
                    
                    logEntry.rows_total += cachedData.length;
                    logEntry.rows_exported += cachedData.length;
                    continue; // Skip the heavy processing for this tab!
                }

                const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
                const rows = parsed.data;

                if (!rows || rows.length < 2) {
                    console.warn(`⚠️ The Google Sheet for ${sheet.name} (Tab: ${tab.name}) returned zero data rows.`);
                    if (isMultiTab) {
                        finalData[toSnakeCase(tab.name)] = [];
                    }
                    continue;
                }

                logEntry.rows_total += (rows.length - 1); 

                // ADAPTIVE HEADER SYSTEM
                const rawHeaders = rows[0];
                const headers = rawHeaders.map((header, idx) => {
                    let cleanHeader = header.toString().toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_') 
                        .replace(/^_+|_+$/g, '');
                    
                    // Auto-correct known Google Sheet header typos
                    if (cleanHeader === 'fid') cleanHeader = 'id';
                    if (cleanHeader === 'instrtnents') cleanHeader = 'instruments';
                    
                    return cleanHeader || `column_${idx + 1}`; // Prevent empty headers from overwriting each other
                });

                // ADAPTIVE ROW PARSING
                const exportData = [];
                for (let i = 1; i < rows.length; i++) {
                    let rowObj = {};
                    let isRowEmpty = true;
                    
                    headers.forEach((header, index) => {
                        // EXCLUDE COLUMNS
                        if (tab.excludeColumns && tab.excludeColumns.map(toSnakeCase).includes(header)) {
                            return; // Skip mapping this column completely
                        }

                        let cellValue = rows[i][index] ? rows[i][index].trim() : "";
                        
                        // MARKDOWN AUTO-CONVERSION
                        // If cell contains potential markdown (bold, italic, list, links) and is not a raw URL
                        if (cellValue && /[\*\_\-\[\]\n]/.test(cellValue) && !cellValue.startsWith('http')) {
                            try { cellValue = marked.parseInline(cellValue); } catch(e) {}
                        }

                        // TAG SPLITTING (Orama Facets)
                        if (tab.splitColumns && Array.isArray(tab.splitColumns)) {
                            for (const splitConfig of tab.splitColumns) {
                                if (toSnakeCase(splitConfig.column) === header && typeof cellValue === 'string') {
                                    const delimiter = splitConfig.delimiter || ",";
                                    // Split by delimiter, trim whitespace, and drop empty items
                                    cellValue = cellValue.split(delimiter)
                                        .map(v => v.trim())
                                        .filter(v => v !== "");
                                }
                            }
                        }

                        rowObj[header] = cellValue;
                        if (cellValue !== "" && (!Array.isArray(cellValue) || cellValue.length > 0)) isRowEmpty = false;
                    });

                    if (isRowEmpty) continue;

                    // EXCLUDE ROWS LOGIC
                    if (tab.excludeRowsWhere && Array.isArray(tab.excludeRowsWhere)) {
                        let shouldExcludeRow = false;
                        for (const filter of tab.excludeRowsWhere) {
                            const col = toSnakeCase(filter.column);
                            if (filter.equals !== undefined && rowObj[col] === filter.equals.toString()) {
                                shouldExcludeRow = true;
                                break;
                            }
                        }
                        if (shouldExcludeRow) {
                            logEntry.rows_dropped += 1;
                            continue; // Drop the entire row
                        }
                    }

                    // DATA VALIDATION RULES
                    if (tab.required && Array.isArray(tab.required)) {
                        let missingRequired = false;
                        for (const reqCol of tab.required) {
                            if (!rowObj[reqCol] || rowObj[reqCol] === "") {
                                console.warn(`⚠️ Row ${i+1} in ${tab.name} is missing required column '${reqCol}'. Skipping row.`);
                                missingRequired = true;
                                break;
                            }
                        }
                        if (missingRequired) continue;
                    }

                    // 🧠 TRANSFORM ALL IMAGE LINKS FOR FRONTEND
                    let imageColumnsList = null;
                    if (tab.imageColumns) {
                        if (Array.isArray(tab.imageColumns)) {
                            imageColumnsList = tab.imageColumns.map(toSnakeCase);
                        } else if (typeof tab.imageColumns === 'string') {
                            imageColumnsList = tab.imageColumns.split(',').map(s => toSnakeCase(s.trim()));
                        }
                    }

                    for (const key of Object.keys(rowObj)) {
                        // If imageColumns is explicitly defined in yaml, skip any columns not in that list
                        if (imageColumnsList && !imageColumnsList.includes(key)) continue;

                        const cellValue = rowObj[key];
                        if (typeof cellValue !== 'string') continue;
                        
                        const driveId = extractDriveId(cellValue);
                        const isImage = isImageExtension(cellValue);
                        
                        if (driveId || isImage) {
                            rowObj[`original_${key}`] = cellValue;
                            let fallbackId = driveId || Buffer.from(cellValue).toString('base64').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
                            let imageId = rowObj.id ? `${rowObj.id}_${key}` : fallbackId;
                            rowObj[key] = `/assets/${snakeCaseName}/${imageId}.webp`;
                        }
                    }

                    if (rowObj.hasOwnProperty('approval_status')) {
                        if (rowObj.approval_status.toLowerCase() === 'approved') {
                            exportData.push(rowObj);
                        }
                    } else {
                        exportData.push(rowObj); 
                    }
                }
                
                logEntry.rows_exported += exportData.length;
                
                if (isMultiTab) {
                    finalData[toSnakeCase(tab.name)] = exportData;
                } else {
                    finalData.push(...exportData);
                }

                // Update hash cache after successful processing
                fs.writeFileSync(HASH_FILE, JSON.stringify({ hash, timestamp: new Date().toISOString() }));
            }

            // Generate Static AI Endpoints (Chunking) & Metadata Index
            console.log(`🤖 Generating Static Web AI API for ${sheet.name}...`);
            const apiSheetDir = `${PUBLIC_DIR}/api/${snakeCaseName}`;
            if (!fs.existsSync(apiSheetDir)) fs.mkdirSync(apiSheetDir, { recursive: true });
            
            const validFileNames = new Set();
            let llmsText = `# 📡 ${sheet.name} - AI Search Index\nTo fetch full details, request the corresponding JSON file at: https://rink-git-cron.vercel.app/api/${snakeCaseName}/{ID}.json\n\n`;

            const processRowForAI = (row) => {
                const rowId = row.id || crypto.createHash('md5').update(JSON.stringify(row)).digest('hex').substring(0, 10);
                const fileName = `${rowId}.json`;
                validFileNames.add(fileName);
                
                fs.writeFileSync(`${apiSheetDir}/${fileName}`, JSON.stringify(row, null, 2));

                const name = row.instruments || row.title || row.name || 'Unknown Item';
                const inst = row.institution_name || row.institute || '';
                const loc = row.district || row.location || row.state || '';
                const tags = row.tag || row.category || '';
                
                let metadata = `[${rowId}] ${name}`;
                if (inst) metadata += ` | Institute: ${inst}`;
                if (loc) metadata += ` | Location: ${loc}`;
                if (tags) metadata += ` | Tags: ${tags}`;
                
                if (frontendBaseUrl) {
                    // Make sure frontend URL doesn't end with slash, then append the slug structure
                    const base = frontendBaseUrl.endsWith('/') ? frontendBaseUrl.slice(0, -1) : frontendBaseUrl;
                    metadata += ` | URL: ${base}/${snakeCaseName}/${rowId}`;
                }
                
                llmsText += `${metadata}\n`;
            };

            if (isMultiTab) {
                for (const key of Object.keys(finalData)) {
                    finalData[key].forEach(processRowForAI);
                }
            } else {
                finalData.forEach(processRowForAI);
            }

            fs.writeFileSync(`${apiSheetDir}/llms.txt`, llmsText);

            // Orphan Cleanup: delete old JSON files that no longer exist
            const existingFiles = fs.readdirSync(apiSheetDir).filter(f => f.endsWith('.json'));
            let deletedCount = 0;
            for (const oldFile of existingFiles) {
                if (!validFileNames.has(oldFile)) {
                    fs.unlinkSync(`${apiSheetDir}/${oldFile}`);
                    deletedCount++;
                }
            }
            if (deletedCount > 0) console.log(`🧹 Deleted ${deletedCount} orphaned API files.`);

            // Save the LIVE API file safely using atomic write
            const tempMaster = `${MASTER_JSON}.tmp`;
            fs.writeFileSync(tempMaster, JSON.stringify(finalData, null, 2));
            fs.renameSync(tempMaster, MASTER_JSON); // Atomic replacement prevents corruption if process crashes
            
            // Keep the backups hidden safely in the data folder
            const safeTime = timestamp.replace(/:/g, '-');
            fs.writeFileSync(`${BACKUP_DIR}/${snakeCaseName}_${safeTime}.json`, JSON.stringify(finalData));

            // Clean up old backups (keep only the last 3)
            const allBackups = fs.readdirSync(BACKUP_DIR)
                .filter(file => file.startsWith(`${snakeCaseName}_`) && file.endsWith('.json'))
                .sort();
            
            if (allBackups.length > 3) {
                const backupsToDelete = allBackups.slice(0, allBackups.length - 3);
                for (const oldBackup of backupsToDelete) {
                    fs.unlinkSync(`${BACKUP_DIR}/${oldBackup}`);
                }
            }

            console.log(`✅ Sync Complete for ${sheet.name}! ${logEntry.rows_exported} total records processed and exported.`);

            // Collect data for the automated API Report
            let tabDocs = [];
            if (isMultiTab) {
                for (const tab of tabsToFetch) {
                    const snakeKey = toSnakeCase(tab.name);
                    const count = finalData[snakeKey] ? finalData[snakeKey].length : 0;
                    tabDocs.push({ originalName: tab.name, snakeKey: snakeKey, count: count });
                }
            } else {
                tabDocs.push({ originalName: 'Root Array', snakeKey: 'Root Array', count: finalData.length });
            }

            apiReport.push({
                endpoint: `/${snakeCaseName}.json`,
                sheetName: sheet.name,
                snakeCaseName: snakeCaseName,
                tabs: tabDocs,
                totalRecords: logEntry.rows_exported,
                totalDropped: logEntry.rows_total - logEntry.rows_exported
            });

        } catch (error) {
            console.error(`❌ SYNC FAILED for ${sheet.name}: ${error.code || 'ERR_UNKNOWN'} - ${error.message || error}`);
            logEntry.status = 'FAILED';
            logEntry.error_code = error.code || 'ERR_UNKNOWN';
            logEntry.error_message = error.message || error.toString();
        } finally {
            let history = [];
            if (fs.existsSync(HISTORY_JSON)) {
                try { history = JSON.parse(fs.readFileSync(HISTORY_JSON, 'utf8')); } catch (e) { history = []; }
            }
            history.unshift(logEntry);
            fs.writeFileSync(HISTORY_JSON, JSON.stringify(history.slice(0, 50), null, 2));
        }
    }

    // Generate the Automated API Directory Report
    console.log("📝 Generating API Directory Report...");
    
    let totalEndpoints = apiReport.length;
    let totalRecordsAcrossAll = apiReport.reduce((sum, doc) => sum + doc.totalRecords, 0);
    let totalDroppedAcrossAll = apiReport.reduce((sum, doc) => sum + doc.totalDropped, 0);

    let markdown = `# 📡 RINK Data API Directory\n`;
    markdown += `*Auto-generated on: ${new Date().toUTCString()}*\n\n`;
    markdown += `This document serves as a live map and analytics overview of your JSON data endpoints.\n\n`;
    
    markdown += `## 🤖 AI Integrations\n`;
    markdown += `- **LLM Static Search Index:** The metadata index for ChatGPT/Claude is automatically generated at \`/api/{sheet_name}/llms.txt\`.\n`;
    markdown += `- **Individual Item Chunks:** Individual row endpoints (Zero Token Waste) are generated at \`/api/{sheet_name}/{id}.json\`.\n\n`;
    
    markdown += `### 🔌 Local MCP Server (For Claude Desktop & Cursor)\n`;
    markdown += `To allow local AI agents to natively query and search this database, add this to your AI's MCP configuration:\n`;
    markdown += "```json\n";
    markdown += `{\n  "mcpServers": {\n    "rink-data": {\n      "command": "node",\n      "args": ["scripts/mcp-server.js"]\n    }\n  }\n}\n`;
    markdown += "```\n\n";

    markdown += `## 📊 Global Analytics\n`;
    markdown += `- **Total Data Endpoints:** ${totalEndpoints}\n`;
    markdown += `- **Total Active Records:** ${totalRecordsAcrossAll}\n`;
    if (totalDroppedAcrossAll > 0) {
        markdown += `- **Total Discarded Records:** ⚠️ ${totalDroppedAcrossAll} (Failed validation)\n`;
    }
    markdown += `\n---\n\n`;

    for (const doc of apiReport) {
        markdown += `## 📄 ${doc.sheetName}\n`;
        markdown += `- **Endpoint URL:** \`${doc.endpoint}\`\n`;
        markdown += `- **Total Records:** ${doc.totalRecords}\n`;
        if (doc.totalDropped > 0) markdown += `- **Discarded Records:** ⚠️ ${doc.totalDropped} rows failed validation rules and were dropped.\n`;
        markdown += `- **Images Directory:** \`/assets/${doc.snakeCaseName}/\`\n`;
        markdown += `- **Image Naming Structure:** \`<row_id>_<column_name>.webp\` *(Fallback: random hash if row lacks an \`id\` column)*\n`;
        markdown += `- **Tabs Synced:**\n`;
        for (const tab of doc.tabs) {
            if (tab.originalName === 'Root Array') {
                markdown += `  - Single Dataset (${tab.count} items)\n`;
            } else {
                markdown += `  - \`${tab.originalName}\` (${tab.count} items)\n`;
            }
        }
        markdown += `- **JSON Structure:**\n`;
        for (const tab of doc.tabs) {
            if (tab.originalName === 'Root Array') {
                markdown += `  - Returns a flat JSON Array (` + "`[ { ... } ]`" + `) containing **${tab.count}** items.\n`;
            } else {
                markdown += `  - \`data.${tab.snakeKey}\`: Array containing **${tab.count}** items.\n`;
            }
        }
        markdown += `\n---\n\n`;
    }

    fs.writeFileSync(`${PUBLIC_DIR}/API_DIRECTORY.md`, markdown);
    console.log(`✅ API Report saved to ./public/API_DIRECTORY.md\n`);
    
    // Generate the Automated LLM Report
    console.log("📝 Generating LLM Directory Report...");
    
    let llmMarkdown = `# 🧠 RINK LLM Integration Report\n`;
    llmMarkdown += `*Auto-generated on: ${new Date().toUTCString()}*\n\n`;
    llmMarkdown += `This document outlines how AI models (ChatGPT, Claude, Cursor) can consume the RINK dataset at zero token-waste.\n\n`;
    
    llmMarkdown += `## 🌐 1. Web AI Integration (ChatGPT, Claude Web)\n`;
    llmMarkdown += `For cloud-based LLMs that cannot run local scripts, the dataset is pre-chunked to prevent token bloat.\n\n`;
    llmMarkdown += `> **Frontend Routing Note:** Our AI Indexes automatically embed frontend UI links (e.g., \`URL: https://...\`) using the \`frontendBaseUrl\` property in \`sheets.yaml\`!\n\n`;
    
    for (const doc of apiReport) {
        llmMarkdown += `### ${doc.sheetName}\n`;
        llmMarkdown += `- **Search Index:** [\`/api/${doc.snakeCaseName}/llms.txt\`](/api/${doc.snakeCaseName}/llms.txt) (Highly compressed metadata for spatial/categorical search)\n`;
        llmMarkdown += `- **Data Chunks:** \`/api/${doc.snakeCaseName}/{id}.json\` (${doc.totalRecords} zero-token endpoints generated)\n\n`;
    }

    llmMarkdown += `## 🔌 2. Local AI MCP Server (Cursor, Claude Desktop)\n`;
    llmMarkdown += `For local development environments, we expose a native Model Context Protocol (MCP) server.\n`;
    llmMarkdown += `Add the following to your AI configuration (e.g., \`claude_desktop_config.json\` or Cursor Settings):\n`;
    llmMarkdown += "```json\n";
    llmMarkdown += `{\n  "mcpServers": {\n    "rink-data": {\n      "command": "node",\n      "args": ["scripts/mcp-server.js"]\n    }\n  }\n}\n`;
    llmMarkdown += "```\n\n";
    llmMarkdown += `**Available MCP Tools:**\n`;
    for (const doc of apiReport) {
        llmMarkdown += `- \`search_${doc.snakeCaseName}\`: Deep semantic search over all columns in ${doc.sheetName}.\n`;
    }
    
    fs.writeFileSync(`${PUBLIC_DIR}/LLM_REPORT.md`, llmMarkdown);
    console.log(`✅ LLM Report saved to ./public/LLM_REPORT.md\n`);

    // Generate the Root Directory Index (index.html)
    console.log("📄 Generating Root API Directory (index.html)...");
    
    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RINK Data API Directory</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; background: #f9fafb; color: #111827; }
        h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
        .endpoint-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #2563eb; }
        ul { padding-left: 1.5rem; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>📂 RINK Data API Directory</h1>
    <p>Welcome to the live data API. Below are the available endpoints generated directly from Google Sheets.</p>
`;

    for (const doc of apiReport) {
        htmlContent += `
    <div class="endpoint-card">
        <h2>${doc.sheetName}</h2>
        <p><strong>Primary JSON:</strong> <a href="${doc.endpoint}">${doc.endpoint}</a></p>
        <p><strong>AI Search Index:</strong> <a href="/api/${doc.snakeCaseName}/llms.txt">/api/${doc.snakeCaseName}/llms.txt</a></p>
        <p><strong>Images Folder:</strong> <code>/assets/${doc.snakeCaseName}/</code></p>
        <h3>Available Tabs</h3>
        <ul>
`;
        for (const tab of doc.tabs) {
            htmlContent += `            <li>${tab.originalName === 'Root Array' ? 'Single Dataset' : tab.originalName} (${tab.count} items)</li>\n`;
        }
        htmlContent += `        </ul>\n    </div>\n`;
    }

    htmlContent += `
    <div style="margin-top: 2rem; font-size: 0.9rem; color: #6b7280;">
        <p>For AI Integration instructions, see <a href="/LLM_REPORT.md">LLM_REPORT.md</a>.</p>
        <p>Auto-generated on: ${new Date().toUTCString()}</p>
    </div>
</body>
</html>`;

    fs.writeFileSync(`${PUBLIC_DIR}/index.html`, htmlContent);
    console.log(`✅ Root Index HTML saved to ./public/index.html\n`);

}

runSync().catch(() => process.exit(1));