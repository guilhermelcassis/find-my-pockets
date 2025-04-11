# Icon Background Processor

This script adds a dark purple gradient background to the icons in the `public/icons` directory and saves them in the `public/icons-purple` directory. The gradient matches the dark purple theme used in the main app.

## Usage

1. Install the required dependencies:
   ```
   cd scripts
   npm install
   ```

2. Run the script to generate purple gradient icons:
   ```
   npm run process-icons
   ```

3. The processed icons will be available in the `public/icons-purple` directory.

4. If you want to replace the original icons with the purple gradient versions:
   ```
   npm run replace-icons
   ```
   This will backup your original icons to `public/icons-original-backup` before replacing them.

5. If you want to restore the original icons:
   ```
   npm run restore-icons
   ```

## Available Scripts

- `process-icons`: Generate icons with dark purple gradient backgrounds in a new directory
- `replace-icons`: Replace original icons with purple gradient versions (backs up originals first)
- `restore-icons`: Restore original icons from backup

## Customization

You can modify the gradient colors by changing the `GRADIENT_START` and `GRADIENT_END` variables in the script. The default colors are dark purple shades that match the main page theme.

## Notes

- This script uses the Sharp image processing library to add the gradient background.
- The original icons are preserved, and new icons are created in a separate directory.
- If you replace the original icons, they are first backed up to `public/icons-original-backup`. 