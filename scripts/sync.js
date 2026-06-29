import fs from 'fs';
import Papa from 'papaparse';
import yaml from 'yaml';

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
    try {
        const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
        sheetsConfig = yaml.parse(fileContents) || [];
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
                    return cleanHeader || `column_${idx + 1}`; // Prevent empty headers from overwriting each other
                });

                // ADAPTIVE ROW PARSING
                const exportData = [];
                for (let i = 1; i < rows.length; i++) {
                    let rowObj = {};
                    let isRowEmpty = true;
                    
                    headers.forEach((header, index) => {
                        const cellValue = rows[i][index] ? rows[i][index].trim() : "";
                        rowObj[header] = cellValue;
                        if (cellValue !== "") isRowEmpty = false;
                    });

                    if (isRowEmpty) continue;

                    // 🧠 TRANSFORM ALL IMAGE LINKS FOR FRONTEND
                    for (const key of Object.keys(rowObj)) {
                        const value = rowObj[key];
                        if (typeof value === 'string' && value.startsWith('http')) {
                            const driveId = extractDriveId(value);
                            const isImage = isImageExtension(value);
                            
                            if (driveId || isImage) {
                                rowObj[`original_${key}`] = value;
                                let fallbackId = driveId || Buffer.from(value).toString('base64').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
                                let imageId = rowObj.id ? `${rowObj.id}_${key}` : fallbackId;
                                rowObj[key] = `/assets/${snakeCaseName}/${imageId}.webp`;
                            }
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
            }

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
}

runSync().catch(() => process.exit(1));