import argon2 from 'argon2';

/**
 * Generate password hash for admin user setup
 * Run this script to get a proper Argon2 hash for the admin password
 */

async function generateAdminPasswordHash() {
  const adminEmail = 'bvail@smartconnx.com';
  const adminPassword = 'HenryAdmin123!'; // Change this to your desired admin password
  
  try {
    const hash = await argon2.hash(adminPassword);
    console.log('===== ADMIN USER SETUP =====');
    console.log(`Email: ${adminEmail}`);
    console.log('Password Hash (use this in database):');
    console.log(hash);
    console.log('\n⚠️  SECURITY NOTE: This hash should be stored securely in the database.');
    console.log('⚠️  Never commit the actual password to version control.');
    console.log('\nUse this hash in your database migration script.');
    console.log('Replace the placeholder hash in migration.sql with this value.');
  } catch (error) {
    console.error('Error generating password hash:', error);
  }
}

generateAdminPasswordHash();
