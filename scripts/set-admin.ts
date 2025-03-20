import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// The email to set as admin
const EMAIL_TO_PROMOTE = 'guilhermelcassis@gmail.com';

// Function to initialize Firebase Admin
async function initializeFirebaseAdmin(): Promise<void> {
  try {
    // Check if we have service account credentials
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      // Use service account file
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('Firebase Admin initialized with service account file');
    } else {
      // Try using environment variables
      const { FIREBASE_ADMIN_CREDENTIALS, NEXT_PUBLIC_FIREBASE_PROJECT_ID } = process.env;
      
      if (FIREBASE_ADMIN_CREDENTIALS) {
        // Parse credentials from base64 encoded string
        const serviceAccount = JSON.parse(
          Buffer.from(FIREBASE_ADMIN_CREDENTIALS, 'base64').toString()
        );
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
          databaseURL: `https://${NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
        });
        
        console.log('Firebase Admin initialized with environment variables');
      } else {
        throw new Error('No Firebase Admin credentials found');
      }
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    process.exit(1);
  }
}

// Function to get user by email and set admin claim
async function setUserAsAdmin(email: string): Promise<void> {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`User found: ${userRecord.uid} (${userRecord.email})`);
    
    // Check if already an admin
    const { customClaims } = userRecord;
    if (customClaims && customClaims.admin === true) {
      console.log(`User ${email} is already an admin`);
      return;
    }
    
    // Set custom claims for the user
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
    console.log(`Successfully set admin claim for user: ${email}`);
    
    // Verify the change
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    console.log('Updated user custom claims:', updatedUser.customClaims);
  } catch (error: any) {
    console.error(`Error setting admin claim for ${email}:`, error);
    
    // Special handling for user not found
    if (error.code === 'auth/user-not-found') {
      console.log(`\nUser with email ${email} not found. Please make sure:`);
      console.log('1. The user has already registered using this email');
      console.log('2. The email is spelled correctly');
      console.log('\nYou need to sign up first before setting admin privileges.');
    }
  }
}

// Main function
async function main(): Promise<void> {
  try {
    await initializeFirebaseAdmin();
    await setUserAsAdmin(EMAIL_TO_PROMOTE);
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
main(); 