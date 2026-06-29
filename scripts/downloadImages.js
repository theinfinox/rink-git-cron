import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const PUBLIC_DIR = './public';
const CONFIG_PATH = './config/sheets.json';

function toSnakeCase(str) {
    return str.toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '');
}

// Extract Google Drive file ID from a URL
function extractDriveId(url) {
    if (!url) return null;
    const match = url.match(/(?:id=|v\/|vi\/|u\/\w\/|embed\/|e\/|file\/d\/|uc\?id=)([^#&?/\s]+)/);
    return match ? match[1] : null;
}

async function runDownload() {
    console.log("🖼️ Starting Image Download & Optimization for all sheets...");

    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`❌ Configuration file not found at ${CONFIG_PATH}`);
        process.exit(1);
    }

    const sheetsConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

    for (const sheet of sheetsConfig) {
        const snakeCaseName = toSnakeCase(sheet.name);
        const dataJsonPath = `${PUBLIC_DIR}/${snakeCaseName}.json`;
        const outputDir = `${PUBLIC_DIR}/assets/${snakeCaseName}`;
        
        console.log(`\n=========================================`);
        console.log(`📦 Processing sheet: ${sheet.name}`);
        console.log(`=========================================`);

        // 1. Ensure output directory exists for this sheet
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 2. Read JSON data
        if (!fs.existsSync(dataJsonPath)) {
            console.warn(`⚠️  Data file not found at ${dataJsonPath}. Has it been synced? Skipping...`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
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

        // 3. Iterate over the JSON array
        for (const item of itemsToProcess) {
            // Find all auto-identified image links
            for (const key of Object.keys(item)) {
                if (!key.startsWith('original_')) continue;

                const originalUrl = item[key];
                const targetKey = key.replace('original_', '');
                
                // Retrieve the localized path that sync.js generated
                const localRelativePath = item[targetKey];
                if (!localRelativePath) continue;

                const outputPath = path.join(PUBLIC_DIR, localRelativePath);
                const imageId = path.basename(outputPath, '.webp');

                // 4. Check if image already exists
                if (fs.existsSync(outputPath)) {
                    console.log(`⏭️  Skipping existing image: ${imageId}.webp`);
                    skippedCount++;
                    continue;
                }

                // Determine the correct download URL
                let downloadUrl = originalUrl;
                const driveId = extractDriveId(originalUrl);
                if (driveId) {
                    downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
                }

                // 5. Download and optimize
                try {
                    console.log(`⬇️  Downloading image for ${imageId} from ${targetKey}...`);
                    
                    const response = await axios({
                        method: 'GET',
                        url: downloadUrl,
                        responseType: 'arraybuffer',
                        // Adding a User-Agent helps avoid some basic bot blocks from Drive and others
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        }
                    });

                    // Ensure the nested directory exists (just in case)
                    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

                    // 6. Pipe buffer to sharp
                    await sharp(response.data)
                        .resize(800, null, { withoutEnlargement: true }) // Resize width to 800px, maintain aspect ratio
                        .webp({ quality: 80 })
                        .toFile(outputPath);
                    
                    console.log(`✅ Saved: ${imageId}.webp`);
                    downloadedCount++;
                } catch (error) {
                    console.error(`❌ Failed to process image for ${imageId} (${originalUrl}): ${error.message}`);
                    errorCount++;
                }
            }
        }

        console.log(`\n🎉 Image Processing Complete for ${sheet.name}!`);
        console.log(`   Downloaded: ${downloadedCount}`);
        console.log(`   Skipped:    ${skippedCount}`);
        console.log(`   Errors:     ${errorCount}`);
    }
}

runDownload().catch(err => {
    console.error("Fatal Error in download logic:", err);
    process.exit(1);
});
