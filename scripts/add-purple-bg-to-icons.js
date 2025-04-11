// Add purple background to icons
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Colors for the dark purple gradient (matching the main page theme)
const GRADIENT_START = '#2D1B4E'; // Dark purple
const GRADIENT_END = '#3D1D6B';   // Slightly lighter purple

// Paths
const ICONS_DIR = path.join(__dirname, '../public/icons');
const OUTPUT_DIR = path.join(__dirname, '../public/icons-purple');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all PNG files from the icons directory
const iconFiles = fs.readdirSync(ICONS_DIR)
  .filter(file => file.endsWith('.png'));

// Process each icon
async function processIcons() {
  console.log('Processing icons...');
  
  for (const file of iconFiles) {
    const inputPath = path.join(ICONS_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);
    
    try {
      // Get image metadata
      const metadata = await sharp(inputPath).metadata();
      
      // Create a dark purple gradient background SVG
      const background = Buffer.from(
        `<svg width="${metadata.width}" height="${metadata.height}" viewBox="0 0 ${metadata.width} ${metadata.height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${GRADIENT_START}" />
              <stop offset="100%" stop-color="${GRADIENT_END}" />
            </linearGradient>
          </defs>
          <rect width="${metadata.width}" height="${metadata.height}" fill="url(#purpleGradient)"/>
        </svg>`
      );
      
      // Composite the original icon over the gradient background
      await sharp(background)
        .composite([{ input: inputPath }])
        .toFile(outputPath);
      
      console.log(`✅ Processed: ${file}`);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }
  
  console.log('Done! Purple gradient icons are available in public/icons-purple directory');
}

processIcons(); 