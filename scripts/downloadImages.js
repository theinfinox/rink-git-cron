process.on('uncaughtException', (err) => {
    console.error('FATAL: Uncaught Exception in Image Downloader:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('FATAL: Unhandled Rejection in Image Downloader at:', promise, 'reason:', reason);
    process.exit(1);
});

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const PUBLIC_DIR = './public';

// Extract Google Drive file ID from a URL
function extractDriveId(url) {
    if (!url) return null;
    const match = url.match(/(?:id=|v\/|vi\/|u\/\w\/|embed\/|e\/|file\/d\/|uc\?id=)([^#&?/\s]+)/);
    return match ? match[1] : null;
}

// Sleep utility to prevent rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runDownload() {
    console.log("🖼️ Starting Configuration-Free Image Download & Optimization...");

    if (!fs.existsSync(PUBLIC_DIR)) {
        console.warn(`⚠️ Public directory not found at ${PUBLIC_DIR}. Nothing to process.`);
        return;
    }

    const files = fs.readdirSync(PUBLIC_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    let globalDownloadedCount = 0;
    let globalSkippedCount = 0;
    let globalErrorCount = 0;

    for (const jsonFile of jsonFiles) {
        const snakeCaseName = path.basename(jsonFile, '.json');
        const dataJsonPath = path.join(PUBLIC_DIR, jsonFile);
        const outputDir = path.join(PUBLIC_DIR, 'assets', snakeCaseName);
        
        console.log(`\n=========================================`);
        console.log(`📦 Scanning JSON endpoint: ${jsonFile}`);
        console.log(`=========================================`);

        let data;
        try {
            data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
        } catch (e) {
            console.error(`❌ Failed to parse JSON file ${jsonFile}. Skipping... (${e.message})`);
            continue;
        }
        let downloadedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Flatten data if it's an object with tabs
        let itemsToProcess = [];
        if (Array.isArray(data)) {
            itemsToProcess = data;
        } else if (typeof data === 'object' && data !== null) {
            for (const key of Object.keys(data)) {
                if (Array.isArray(data[key])) {
                    itemsToProcess = itemsToProcess.concat(data[key]);
                }
            }
        }

        // Iterate over the JSON array
        for (const item of itemsToProcess) {
            // Find all auto-identified image links
            for (const key of Object.keys(item)) {
                if (!key.startsWith('original_')) continue;

                const originalUrl = item[key];
                const targetKey = key.replace('original_', '');
                
                // Retrieve the localized path that sync.js generated
                const localRelativePath = item[targetKey];
                if (!localRelativePath) continue;

                // Strip leading slash for robust path.join across OS environments
                const safeRelativePath = localRelativePath.startsWith('/') ? localRelativePath.slice(1) : localRelativePath;
                const outputPath = path.join(PUBLIC_DIR, safeRelativePath);
                const imageId = path.basename(outputPath, '.webp');

                // Check if image already exists and is valid
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    if (stats.size > 0) {
                        console.log(`⏭️  Skipping existing image: ${imageId}.webp`);
                        skippedCount++;
                        continue;
                    } else {
                        console.log(`⚠️  Found corrupted 0-byte image: ${imageId}.webp. Deleting and retrying...`);
                        fs.unlinkSync(outputPath);
                    }
                }

                // Determine the correct download URL
                let downloadUrl = originalUrl;
                const driveId = extractDriveId(originalUrl);
                if (driveId) {
                    downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
                }

                // Download and optimize
                try {
                    console.log(`⬇️  Downloading image for ${imageId} from ${targetKey}...`);
                    
                    const response = await axios({
                        method: 'GET',
                        url: downloadUrl,
                        responseType: 'arraybuffer',
                        timeout: 15000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        }
                    });

                    // Ensure the nested directory exists (just in case)
                    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

                    // Pipe buffer to sharp
                    await sharp(response.data)
                        .resize(800, null, { withoutEnlargement: true }) // Resize width to 800px, maintain aspect ratio
                        .webp({ quality: 80 })
                        .toFile(outputPath);
                    
                    console.log(`✅ Saved: ${imageId}.webp`);
                    downloadedCount++;
                    
                    // Delay between downloads to prevent Google Drive 403 Forbidden / 429 Too Many Requests
                    await sleep(300); 
                } catch (error) {
                    console.error(`❌ Failed to process image for ${imageId} (${originalUrl}): ${error.message}`);
                    errorCount++;
                }
            }
        }

        console.log(`\n🎉 Image Processing Complete for ${snakeCaseName}!`);
        console.log(`   Downloaded: ${downloadedCount}`);
        console.log(`   Skipped:    ${skippedCount}`);
        console.log(`   Errors:     ${errorCount}`);

        globalDownloadedCount += downloadedCount;
        globalSkippedCount += skippedCount;
        globalErrorCount += errorCount;
    }

    // Append Image Analytics to the API Directory Report
    const apiDocPath = path.join(PUBLIC_DIR, 'API_DIRECTORY.md');
    if (fs.existsSync(apiDocPath)) {
        console.log("📝 Appending Image Analytics to API Directory Report...");
        let imageMarkdown = `\n## 🖼️ Image Pipeline Analytics\n`;
        imageMarkdown += `- **Total Active Images:** ${globalDownloadedCount + globalSkippedCount}\n`;
        imageMarkdown += `- **Newly Downloaded:** ${globalDownloadedCount}\n`;
        imageMarkdown += `- **Served from Cache:** ${globalSkippedCount}\n`;
        if (globalErrorCount > 0) {
            imageMarkdown += `- **Broken Links/Errors:** ⚠️ ${globalErrorCount} (Check Action Logs)\n`;
        }
        imageMarkdown += `\n---\n`;
        fs.appendFileSync(apiDocPath, imageMarkdown);
        console.log(`✅ Image Analytics appended to ${apiDocPath}`);
    }
}

runDownload().catch(err => {
    console.error("Fatal Error in download logic:", err);
    process.exit(1);
});
