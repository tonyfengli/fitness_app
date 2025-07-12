/**
 * Script to seed test users for E2E tests
 * This should be run before running E2E tests
 */

import { db } from '@acme/db/client';
import { user, business } from '@acme/db/schema';
import { testUsers } from '../fixtures/auth';
import { authClient } from '@acme/auth/client';

async function seedTestUsers() {
  console.log('🌱 Seeding test users...');

  try {
    // First, get or create a test business
    const testBusinessName = 'E2E Test Gym';
    let testBusiness = await db.query.business.findFirst({
      where: (business, { eq }) => eq(business.name, testBusinessName),
    });

    if (!testBusiness) {
      const [newBusiness] = await db.insert(business).values({
        id: 'test-business-e2e',
        name: testBusinessName,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      testBusiness = newBusiness;
      console.log('✅ Created test business');
    }

    // Create test users
    for (const [role, userData] of Object.entries(testUsers)) {
      // Check if user exists
      const existingUser = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.email, userData.email),
      });

      if (!existingUser) {
        // Use Better Auth to create user (handles password hashing)
        console.log(`Creating ${role} user: ${userData.email}`);
        
        // Note: This is a simplified version. In practice, you might need to:
        // 1. Call the signup API endpoint directly, or
        // 2. Use Better Auth's server-side user creation method
        console.log(`⚠️  Please create ${role} user manually through signup flow:`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Password: ${userData.password}`);
        console.log(`   Name: ${userData.name}`);
        console.log(`   Role: ${userData.role}`);
        console.log(`   Business: ${testBusiness.name}\n`);
      } else {
        console.log(`✅ User ${userData.email} already exists`);
      }
    }

    console.log('\n📝 Test user setup complete!');
    console.log('If users need to be created manually, use the signup flow with the details above.');
    
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}