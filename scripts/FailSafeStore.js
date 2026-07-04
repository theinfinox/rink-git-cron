import fs from 'fs';

export class FailSafeStore {
    /**
     * Atomically saves data to a JSON file, keeping a backup of the previous version.
     * 
     * @param {string} filePath - The final path where the JSON should be saved
     * @param {object|array} data - The data to serialize and save
     * @returns {boolean} - True if successful
     */
    static save(filePath, data) {
        const tmpPath = `${filePath}.tmp`;
        const bakPath = `${filePath}.bak`;
        
        try {
            // Backup the old file if it exists
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, bakPath);
            }
            
            // Write to tmp file safely
            fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
            
            // Atomic swap
            fs.renameSync(tmpPath, filePath);
            
            return true;
        } catch (error) {
            console.error(`❌ FailSafeStore Error on ${filePath}: ${error.message}`);
            // If atomic write failed, check if we have a backup to restore
            if (fs.existsSync(bakPath)) {
                console.log(`♻️ Restoring from backup: ${bakPath}`);
                fs.copyFileSync(bakPath, filePath);
            }
            throw error;
        }
    }
}
