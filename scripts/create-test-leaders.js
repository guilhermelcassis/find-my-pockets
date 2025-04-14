// Script to create test leaders in the database
// Run this script with: node scripts/create-test-leaders.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client with service role key for admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test leaders data
const testLeaders = [
  {
    name: 'João Silva',
    phone: '(11) 98765-4321',
    email: 'joao.silva@example.com',
    curso: 'Engenharia Civil',
    active: true
  },
  {
    name: 'Ana Oliveira',
    phone: '(11) 91234-5678',
    email: 'ana.oliveira@example.com',
    curso: 'Administração',
    active: true
  },
  {
    name: 'Carlos Ferreira',
    phone: '(11) 99876-5432',
    email: 'carlos.ferreira@example.com',
    curso: 'Ciência da Computação',
    active: true
  },
  {
    name: 'Mariana Santos',
    phone: '(11) 98765-1234',
    email: 'mariana.santos@example.com',
    curso: 'Psicologia',
    active: true
  },
  {
    name: 'Pedro Costa',
    phone: '(11) 97654-3210',
    email: 'pedro.costa@example.com',
    curso: 'Medicina',
    active: false
  }
];

async function insertTestLeaders() {
  console.log('Creating test leaders...');
  
  try {
    // Insert the test leaders
    const { data, error } = await supabase
      .from('leaders')
      .upsert(testLeaders, { 
        onConflict: 'name',  // Ensure no duplicates by name
        ignoreDuplicates: false  // Update if record already exists
      });

    if (error) {
      console.error('Error inserting test leaders:', error);
      return;
    }

    console.log('Successfully created test leaders!');
    
    // Fetch and display all leaders
    const { data: allLeaders, error: fetchError } = await supabase
      .from('leaders')
      .select('*');
      
    if (fetchError) {
      console.error('Error fetching leaders:', fetchError);
      return;
    }
    
    console.log('\nCurrent leaders in database:');
    console.table(allLeaders);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the function
insertTestLeaders()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  }); 