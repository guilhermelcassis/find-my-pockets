const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Instructions for manually generating PWA icons
console.log(`
PWA Icon Generation Instructions:

Your PWA requires multiple icon sizes for different devices and contexts.
Since this script requires the 'sharp' image processing library which needs to be installed,
here are manual instructions for generating the icons:

1. Start with your logo file (preferably FMP_LaranjaGradient.svg or pockets-logo.svg)
2. Use an online tool like https://app-manifest.firebaseapp.com/ or https://maskable.app/editor
   to generate the PWA icons in various sizes
3. Required sizes are: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
4. Save all generated icons to the public/icons/ directory
5. Make sure the icon filenames match what's in the manifest.json file

If you want to use this script:
1. Run 'npm install sharp --save-dev' to install the sharp library
2. Place your source logo file in the public directory
3. Update the SOURCE_LOGO variable below with your logo filename
4. Run 'node scripts/generate-pwa-icons.js'
`);

// Configuration
const SOURCE_LOGO = '../public/FMP_LaranjaGradient.svg'; // Update this to your logo path
const OUTPUT_DIR = '../public/icons';
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Create output directory if it doesn't exist
try {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }
} catch (err) {
  console.error(`Error creating directory: ${err.message}`);
}

// Generate icons for each size
async function generateIcons() {
  try {
    const sourcePath = path.resolve(__dirname, SOURCE_LOGO);
    
    if (!fs.existsSync(sourcePath)) {
      console.error(`Source logo not found at: ${sourcePath}`);
      return;
    }
    
    for (const size of ICON_SIZES) {
      const outputPath = path.resolve(__dirname, OUTPUT_DIR, `icon-${size}x${size}.png`);
      
      try {
        await sharp(sourcePath)
          .resize(size, size)
          .png()
          .toFile(outputPath);
        
        console.log(`Generated icon: ${outputPath}`);
      } catch (err) {
        console.error(`Error generating icon size ${size}x${size}: ${err.message}`);
      }
    }
    
    console.log('Icon generation complete!');
  } catch (err) {
    console.error(`Error during icon generation: ${err.message}`);
  }
}

// Comment out the automatic execution
// generateIcons(); 