// This script requires sharp - you can install it using: npm install --save-dev sharp

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Get the directory name using ES modules pattern
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_LOGO = path.join(__dirname, '../public/logo/logo-single.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Create the output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Define the icon sizes to generate
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generatePWAIcons() {
  try {
    // Make sure the source logo exists
    if (!fs.existsSync(SOURCE_LOGO)) {
      console.error(`Source logo not found: ${SOURCE_LOGO}`);
      process.exit(1);
    }

    console.log(`Generating PWA icons from ${SOURCE_LOGO}...`);

    // Create apple-touch-icon.png (180x180)
    await sharp(SOURCE_LOGO)
      .resize(180, 180)
      .toFile(path.join(OUTPUT_DIR, 'apple-touch-icon.png'));
    
    console.log('Generated apple-touch-icon.png');

    // Generate all the required sizes
    for (const size of ICON_SIZES) {
      const outputFile = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
      
      await sharp(SOURCE_LOGO)
        .resize(size, size)
        .toFile(outputFile);
      
      console.log(`Generated ${outputFile}`);
    }

    console.log('All PWA icons generated successfully!');
  } catch (error) {
    console.error('Error generating PWA icons:', error);
    process.exit(1);
  }
}

generatePWAIcons(); 