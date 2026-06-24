import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

const DATA_JSON_PATH = './data/master_directory.json';
const OUTPUT_DIR = './public/assets/instruments';

// Extract Google Drive file ID from a URL
function extractDriveId(url) {
    if (!url) return null;
    const match = url.match(/(?:id=|v\/|vi\/|u\/\w\/|embed\/|e\/|file\/d\/|uc\?id=)([^#&?/\s]+)/);
    return match ? match[1] : null;
}

async function runDownload() {
    console.log("🖼️ Starting Image Download & Optimization...");

    // 1. Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 2. Read JSON data
    if (!fs.existsSync(DATA_JSON_PATH)) {
        console.error(`❌ Data file not found at ${DATA_JSON_PATH}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf8'));
    let downloadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 3. Iterate over the JSON array
    for (const item of data) {
        if (!item.image_link) continue;

        const fileId = extractDriveId(item.image_link);
        if (!fileId) {
            console.log(`⚠️  Skipping invalid Drive link for item ${item.id || 'Unknown'}: ${item.image_link}`);
            continue;
        }

        // Use item.id if available, fallback to fileId if missing
        const imageId = item.id || fileId;
        const outputPath = path.join(OUTPUT_DIR, `${imageId}.webp`);

        // 4. Check if image already exists
        if (fs.existsSync(outputPath)) {
            console.log(`⏭️  Skipping existing image: ${imageId}.webp`);
            skippedCount++;
            continue;
        }

        // 5. Download and optimize
        try {
            console.log(`⬇️  Downloading image for ${imageId}...`);
            const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
            
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                // Adding a User-Agent helps avoid some basic bot blocks from Drive
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });

            // 6. Pipe buffer to sharp
            await sharp(response.data)
                .resize(800, null, { withoutEnlargement: true }) // Resize width to 800px, maintain aspect ratio
                .webp({ quality: 80 })
                .toFile(outputPath);
            
            console.log(`✅ Saved: ${imageId}.webp`);
            downloadedCount++;
        } catch (error) {
            console.error(`❌ Failed to process image for ${imageId}: ${error.message}`);
            errorCount++;
        }
    }

    console.log("-----------------------------------------");
    console.log(`🎉 Image Processing Complete!`);
    console.log(`   Downloaded: ${downloadedCount}`);
    console.log(`   Skipped:    ${skippedCount}`);
    console.log(`   Errors:     ${errorCount}`);
    console.log("-----------------------------------------");
}

runDownload().catch(err => {
    console.error("Fatal Error in download logic:", err);
    process.exit(1);
});
