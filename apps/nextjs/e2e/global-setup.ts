import { chromium, FullConfig } from "@playwright/test";

import { loginAsTrainer } from "./helpers/auth";

async function globalSetup(config: FullConfig) {
  // Get test credentials from environment variables
  const testEmail =
    process.env.TEST_TRAINER_EMAIL || "test-trainer@example.com";
  const testPassword = process.env.TEST_TRAINER_PASSWORD || "test-password";

  console.log("🔐 Setting up authentication for E2E tests...");
  console.log(`📧 Using test email: ${testEmail}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Attempt to login
    await loginAsTrainer(page, testEmail, testPassword);

    // Save authentication state
    await page.context().storageState({ path: "playwright/.auth/user.json" });

    console.log("✅ Authentication successful!");

    // Seed test data
    console.log("🌱 Seeding test data...");

    const response = await page.request.post(
      "http://localhost:3000/api/seed-test-data",
      {
        data: {
          trainerEmail: testEmail,
          clientEmail: "tony.feng.li@gmail.com", // Always use this client
        },
      },
    );

    if (response.ok()) {
      const data = await response.json();
      console.log(
        `✅ Test data seeded: ${data.workout.notes} with ${data.workout.exerciseCount} exercises`,
      );
    } else {
      const errorData = await response.text();
      console.error("❌ Failed to seed test data:", response.status, errorData);
      throw new Error(`Seeding failed: ${errorData}`);
    }
  } catch (error) {
    console.error("❌ Authentication failed:", error);
    console.log(
      "\n⚠️  Make sure you have a test user with the following credentials:",
    );
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(
      "\n   Or set TEST_TRAINER_EMAIL and TEST_TRAINER_PASSWORD environment variables",
    );
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
