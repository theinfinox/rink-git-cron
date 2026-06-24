import fs from 'fs';
import Papa from 'papaparse';

const DATA_DIR = './data';
const PUBLIC_DIR = './public'; // 👈 NEW: Added public directory mapping
const BACKUP_DIR = './data/backups';

// 👈 CHANGED: Route the live master JSON directly to the public folder for Vercel
const MASTER_JSON = `${PUBLIC_DIR}/master_directory.json`; 
const HISTORY_JSON = `${DATA_DIR}/sync_history.json`;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_GID = process.env.SHEET_GID || '0'; 

async function runSync() {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, status: 'SUCCESS', error_code: null, rows_total: 0, rows_exported: 0 };

    try {
        console.log("🚀 Starting Adaptive RINK Data Sync...");

        if (!SPREADSHEET_ID) {
            throw { code: 'ERR_NO_SPREADSHEET_ID', message: 'SPREADSHEET_ID secret is missing.' };
        }

        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
        console.log(`📥 Fetching data from Google Sheets (GID: ${SHEET_GID})...`);
        
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw { code: 'ERR_FETCH_FAILED', message: `HTTP Error ${response.status}: Failed to download CSV.` };
        }
        const csvText = await response.text();

        const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
        const rows = parsed.data;

        if (!rows || rows.length < 2) {
            throw { code: 'ERR_EMPTY_SHEET', message: 'The Google Sheet returned zero data rows.' };
        }

        logEntry.rows_total = rows.length - 1; 

        // 🧠 ADAPTIVE HEADER SYSTEM
        const rawHeaders = rows[0];
        const headers = rawHeaders.map(header => {
            return header.toString().toLowerCase()
                .replace(/[^a-z0-9]+/g, '_') 
                .replace(/^_+|_+$/g, '');    
        });

        // 🧠 ADAPTIVE ROW PARSING
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

            if (rowObj.hasOwnProperty('approval_status')) {
                if (rowObj.approval_status.toLowerCase() === 'approved') {
                    exportData.push(rowObj);
                }
            } else {
                exportData.push(rowObj); 
            }
        }
        
        logEntry.rows_exported = exportData.length;

        // 👈 Ensure ALL directories exist before saving
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
        if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true }); // NEW

        // 👈 Save the LIVE API file to the public folder
        fs.writeFileSync(MASTER_JSON, JSON.stringify(exportData, null, 2));
        
        // Keep the backups hidden safely in the data folder
        const safeTime = timestamp.replace(/:/g, '-');
        fs.writeFileSync(`${BACKUP_DIR}/master_${safeTime}.json`, JSON.stringify(exportData));

        console.log(`✅ Sync Complete! ${exportData.length} records processed and exported.`);

    } catch (error) {
        console.error(`❌ SYNC FAILED: ${error.code || 'ERR_UNKNOWN'} - ${error.message || error}`);
        logEntry.status = 'FAILED';
        logEntry.error_code = error.code || 'ERR_UNKNOWN';
        logEntry.error_message = error.message || error.toString();
        throw error; 
    } finally {
        let history = [];
        if (fs.existsSync(HISTORY_JSON)) {
            try { history = JSON.parse(fs.readFileSync(HISTORY_JSON, 'utf8')); } catch (e) { history = []; }
        }
        history.unshift(logEntry);
        fs.writeFileSync(HISTORY_JSON, JSON.stringify(history.slice(0, 50), null, 2));
    }
}

runSync().catch(() => process.exit(1));