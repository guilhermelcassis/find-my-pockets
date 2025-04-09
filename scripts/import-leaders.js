/**
 * Script to import leaders data from leaders.txt
 * 
 * Make sure to set up your .env file with Supabase credentials before running this script.
 * 
 * To run: node scripts/import-leaders.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { normalizeCourse } = require('./normalize-courses');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Path to the leaders.txt file
const leadersFilePath = path.resolve(process.cwd(), 'leaders.txt');

// Function to sanitize phone numbers
function sanitizePhone(phone) {
  // Remove all non-numeric characters except the leading +
  const hasPlus = phone.trim().startsWith('+');
  const digits = phone.replace(/\D/g, '');
  
  // If it already has a plus sign, preserve the international format
  if (hasPlus) {
    return `+${digits}`;
  }
  
  // For Brazilian numbers (assuming 10-11 digits), add the Brazilian country code
  if (digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }
  
  // If it already has a country code or other format, add + prefix
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  // Default case for shorter numbers (might be incomplete) - still add Brazilian code
  return `+55${digits}`;
}

// Function to clean strings (trim, handle empty strings)
function cleanString(str) {
  if (!str) return '';
  return str.trim();
}

// Function to process the leaders file
async function processLeadersFile() {
  try {
    // Read the file
    const fileContent = fs.readFileSync(leadersFilePath, 'utf-8');
    
    // Split into lines and remove empty lines
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    // Extract the header to identify columns
    const header = lines[0].split('\t').map(col => col.trim().toLowerCase());
    
    // Map column indices
    const nameIndex = header.indexOf('nome');
    const phoneIndex = header.indexOf('telefone');
    const emailIndex = header.indexOf('email');
    const cursoIndex = header.indexOf('curso');
    
    if (nameIndex === -1 || phoneIndex === -1) {
      console.error('Required columns "Nome" and "Telefone" not found in the file');
      process.exit(1);
    }
    
    // Process data rows (skip the header)
    const leaders = lines.slice(1).map(line => {
      const columns = line.split('\t');
      
      // Handle tabs correctly even if there are missing fields
      const name = cleanString(columns[nameIndex] || '');
      const phone = sanitizePhone(cleanString(columns[phoneIndex] || ''));
      const email = cleanString(columns[emailIndex] !== undefined ? columns[emailIndex] : '');
      
      // Use the normalize function for courses
      const rawCurso = cleanString(columns[cursoIndex] !== undefined ? columns[cursoIndex] : '');
      const curso = normalizeCourse(rawCurso);
      
      return {
        name,
        phone,
        email,
        curso
      };
    }).filter(leader => leader.name && leader.phone); // Only include records with name and phone
    
    // Create a summary of the normalized courses for verification
    const courseSummary = {};
    leaders.forEach(leader => {
      if (leader.curso) {
        if (!courseSummary[leader.curso]) {
          courseSummary[leader.curso] = 1;
        } else {
          courseSummary[leader.curso]++;
        }
      }
    });
    
    console.log(`Processed ${leaders.length} valid leader records`);
    console.log('\nCourse normalization summary:');
    Object.entries(courseSummary)
      .sort((a, b) => b[1] - a[1]) // Sort by count
      .forEach(([course, count]) => {
        console.log(`${course}: ${count} record(s)`);
      });
    
    // Ask for confirmation before inserting into database
    console.log('\nReady to import these leaders into Supabase?');
    console.log('Press Ctrl+C to cancel or any key to continue...');
    
    // Wait for user input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      
      try {
        // Insert leaders into Supabase
        const { data, error } = await supabase
          .from('leaders')
          .insert(leaders);
        
        if (error) {
          console.error('Error inserting leaders into Supabase:', error);
          process.exit(1);
        }
        
        console.log(`Successfully imported ${leaders.length} leaders into Supabase!`);
        process.exit(0);
      } catch (error) {
        console.error('Error inserting data:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('Error processing leaders file:', error);
    process.exit(1);
  }
}

// Run the import
processLeadersFile(); 