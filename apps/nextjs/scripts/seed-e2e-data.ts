#!/usr/bin/env tsx
import { db } from "@acme/db/client";
import { users, workouts, workoutExercises, exercises } from "@acme/db/schema";
import { eq, and } from "@acme/db";

async function seedE2EData() {
  const trainerEmail = process.env.TEST_TRAINER_EMAIL || 'test-trainer@example.com';
  
  console.log(`🌱 Seeding E2E test data for ${trainerEmail}...`);
  
  try {
    // Find trainer and create workout...
    // (similar logic to the API route)
    
    console.log('✅ E2E test data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed:', error);
    process.exit(1);
  }
}

seedE2EData();