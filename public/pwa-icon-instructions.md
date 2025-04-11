# PWA Icon Generation Instructions

Your Find My Pockets application now supports PWA (Progressive Web App) functionality! To complete the setup, you need to generate the required icons using your existing logo.

## Required Icons

The PWA requires the following icon sizes:
- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

## How to Generate Icons

You can generate the PWA icons in one of two ways:

### Option 1: Using an Online Tool (Recommended)

1. Visit [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) or [Maskable.app Editor](https://maskable.app/editor)
2. Upload your existing logo (either `FMP_LaranjaGradient.svg` or `pockets-logo.svg` from your public folder)
3. Generate icons in all the required sizes
4. Download the icons and place them in the `public/icons/` directory
5. Make sure to name them as specified in the manifest.json file (e.g., `icon-72x72.png`, `icon-96x96.png`, etc.)

### Option 2: Using Image Editing Software

1. Open your logo in image editing software like Photoshop, GIMP, or Figma
2. Create versions of your logo in each of the required sizes
3. Save each size with the appropriate filename in the `public/icons/` directory

### Option 3: Using the Script (Advanced)

There's a script available in `scripts/generate-pwa-icons.js` that can help generate the icons automatically. To use it:

1. Install the required dependencies:
   ```
   npm install sharp --save-dev
   ```

2. Run the script:
   ```
   node scripts/generate-pwa-icons.js
   ```

3. The script will generate all required icon sizes from your source logo

## Verifying Your PWA

After generating the icons:

1. Run your app in production mode:
   ```
   npm run build
   npm run start
   ```

2. Open your web browser and visit your site
3. In Chrome, open Developer Tools > Application > Manifest to verify your PWA is set up correctly
4. You should see an "Install" option in the browser's menu or address bar

Your PWA should now be fully functional and installable on supported devices! 