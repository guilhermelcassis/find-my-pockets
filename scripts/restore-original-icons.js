// Script to restore original icons from backup
const fs = require('fs');
const path = require('path');

// Paths
const ICONS_DIR = path.join(__dirname, '../public/icons');
const BACKUP_DIR = path.join(__dirname, '../public/icons-original-backup');

// Check if backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  console.error('❌ Backup directory not found. Cannot restore original icons.');
  process.exit(1);
}

// Get all PNG files from the backup directory
const iconFiles = fs.readdirSync(BACKUP_DIR)
  .filter(file => file.endsWith('.png'));

if (iconFiles.length === 0) {
  console.error('❌ No backup icons found. Cannot restore original icons.');
  process.exit(1);
}

// Restore original icons from backup
for (const file of iconFiles) {
  const originalPath = path.join(ICONS_DIR, file);
  const backupPath = path.join(BACKUP_DIR, file);
  
  // Restore from backup
  fs.copyFileSync(backupPath, originalPath);
  console.log(`✅ Restored original: ${file}`);
}

console.log('Done! Original icons have been restored from backup.'); 