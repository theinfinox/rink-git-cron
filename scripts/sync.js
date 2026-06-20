import fs from 'fs';
import Papa from 'papaparse';

// Paths (Running from the root of the repository)
const DATA_DIR = './data';
const BACKUP_DIR = './data/backups';
const MASTER_JSON = `${DATA_DIR}/master_directory.json`;
const HISTORY_JSON = `${DATA_DIR}/sync_history.json`;

// Environment Variables passed from GitHub Actions
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_GID = process.env.SHEET_GID || '0'; 

async function runSync() {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, status: 'SUCCESS', error_code: null, rows_total: 0, rows_approved: 0 };

    try {
        console.log("🚀 Starting RINK Data Sync Engine...");

        if (!SPREADSHEET_ID) {
            throw { code: 'ERR_NO_SPREADSHEET_ID', message: 'SPREADSHEET_ID secret is missing.' };
        }

        // 1. Fetch Public CSV Data using standard web fetch
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
        console.log(`📥 Fetching data from Google Sheets (GID: ${SHEET_GID})...`);
        
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw { code: 'ERR_FETCH_FAILED', message: `HTTP Error ${response.status}: Failed to download CSV. Ensure sheet is set to 'Anyone with the link can view'.` };
        }
        const csvText = await response.text();

        // 2. Parse the CSV Safely (Handles commas inside text fields)
        const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
        const rows = parsed.data;

        if (!rows || rows.length < 2) {
            throw { code: 'ERR_EMPTY_SHEET', message: 'The Google Sheet returned zero data rows.' };
        }

        logEntry.rows_total = rows.length - 1; // Exclude header row

        // 3. Dynamic Header Formatting (The Failsafe)
        // Turns "Instrument Type!" into "instrument_type"
        const rawHeaders = rows[0];
        const headers = rawHeaders.map(header => {
            return header.toString().toLowerCase()
                .replace(/[^a-z0-9]+/g, '_') // Replace symbols/spaces with underscore
                .replace(/^_+|_+$/g, '');    // Trim trailing and leading underscores
        });

        if (!headers.includes('id') || !headers.includes('approval_status')) {
            throw { code: 'ERR_MISSING_COLUMNS', message: 'Mandatory columns (id, approval_status) are missing from Row 1.' };
        }

        // 4. Filter and Build the Database
        const approvedData = [];
        for (let i = 1; i < rows.length; i++) {
            let rowObj = {};
            headers.forEach((header, index) => {
                rowObj[header] = rows[i][index] ? rows[i][index].trim() : "";
            });

            // ONLY push to live database if strictly marked as 'Approved'
            if (rowObj.approval_status && rowObj.approval_status.toLowerCase() === 'approved') {
                approvedData.push(rowObj);
            }
        }
        logEntry.rows_approved = approvedData.length;

        // 5. The "Fail-Loud" Drop Protection
        // Aborts the sync if a reviewer accidentally deletes >20% of the live database
        if (fs.existsSync(MASTER_JSON)) {
            const oldData = JSON.parse(fs.readFileSync(MASTER_JSON, 'utf8'));
            const oldLength = oldData.length;
            
            // Allow bypassing this failsafe if the database is extremely small (e.g., < 10 items) during initial testing
            if (oldLength > 10 && approvedData.length < (oldLength * 0.8)) {
                throw { 
                    code: 'ERR_MASS_DELETION', 
                    message: `Data drop detected! Old: ${oldLength}, New: ${approvedData.length}. Sync aborted to protect live site.` 
                };
            }
        }

        // 6. Save Artifacts Securely
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

        // Overwrite the master database file
        fs.writeFileSync(MASTER_JSON, JSON.stringify(approvedData, null, 2));
        
        // Save a timestamped backup copy
        const safeTime = timestamp.replace(/:/g, '-');
        fs.writeFileSync(`${BACKUP_DIR}/master_${safeTime}.json`, JSON.stringify(approvedData));

        console.log(`✅ Sync Complete! ${approvedData.length} approved records updated.`);

    } catch (error) {
        console.error(`❌ SYNC FAILED: ${error.code || 'ERR_UNKNOWN'} - ${error.message || error}`);
        logEntry.status = 'FAILED';
        logEntry.error_code = error.code || 'ERR_UNKNOWN';
        logEntry.error_message = error.message || error.toString();
        
        // Throwing the error ensures the GitHub Action is marked as "Failed" (Red X)
        throw error; 
    } finally {
        // Always write to the history log, even if it failed
        let history = [];
        if (fs.existsSync(HISTORY_JSON)) {
            try {
                history = JSON.parse(fs.readFileSync(HISTORY_JSON, 'utf8'));
            } catch (e) {
                history = []; // Reset if history file is corrupted
            }
        }
        history.unshift(logEntry); // Add latest run to the top
        // Keep only the last 50 logs to prevent file bloat in the repository
        fs.writeFileSync(HISTORY_JSON, JSON.stringify(history.slice(0, 50), null, 2));
    }
}

runSync();