// Script to replace original icons with purple background versions
const fs = require('fs');
const path = require('path');

// Paths
const ICONS_DIR = path.join(__dirname, '../public/icons');
const PURPLE_ICONS_DIR = path.join(__dirname, '../public/icons-purple');
const BACKUP_DIR = path.join(__dirname, '../public/icons-original-backup');

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('Created backup directory for original icons');
}

// Get all PNG files from the purple icons directory
const iconFiles = fs.readdirSync(PURPLE_ICONS_DIR)
  .filter(file => file.endsWith('.png'));

// Copy original icons to backup and replace with purple versions
for (const file of iconFiles) {
  const originalPath = path.join(ICONS_DIR, file);
  const purplePath = path.join(PURPLE_ICONS_DIR, file);
  const backupPath = path.join(BACKUP_DIR, file);
  
  // Check if original icon exists
  if (fs.existsSync(originalPath)) {
    // Backup original icon
    fs.copyFileSync(originalPath, backupPath);
    console.log(`✅ Backed up: ${file}`);
    
    // Replace with purple version
    fs.copyFileSync(purplePath, originalPath);
    console.log(`✅ Replaced with purple version: ${file}`);
  } else {
    console.log(`❌ Original icon not found: ${file}`);
  }
}

console.log('Done! Original icons have been backed up and replaced with purple versions.');
console.log(`Original icons are available in ${BACKUP_DIR} if you need to restore them.`); 