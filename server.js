import express from 'express';
import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Web Server: Serve the generated JSON and images to the public
app.use(express.static(path.join(__dirname, 'public')));

// 2. Cron Job: Run the sync and download scripts every 1 hour (at minute 0)
// This will only execute if running via PM2, Docker, or raw node on a persistent server
cron.schedule('0 * * * *', () => {
    console.log('[CRON] Starting scheduled RINK data sync...');
    
    // Execute both the sync script and the image downloader sequentially
    exec('npm run sync && npm run download-images', (error, stdout, stderr) => {
        if (error) {
            console.error(`[CRON] Error executing sync: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`[CRON] stderr: ${stderr}`);
        }
        console.log(`[CRON] Sync Output:\n${stdout}`);
        console.log('[CRON] Sync complete.');
    });
});

app.listen(PORT, () => {
    console.log(`🚀 RINK Universal Data API running on port ${PORT}`);
    console.log(`📂 Serving static files from ./public`);
    console.log(`⏳ Cron scheduler initialized (Runs every hour)`);
});
