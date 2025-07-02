#!/usr/bin/env tsx

import { db } from "@acme/db/client";
import { exercises } from "@acme/db/schema";
import type { InferInsertModel } from "drizzle-orm";

const allExercises: InferInsertModel<typeof exercises>[] = [
  {
    name: "Barbell Bench Press",
    primaryMuscle: "chest" as const,
    secondaryMuscles: ["triceps", "shoulders"] as const,
    loadedJoints: ["shoulders"] as const,
    movementPattern: "horizontal_push" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"] as const,
    functionTags: ["foundational"] as const,
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["barbell", "bench"] as const,
    strengthLevel: "moderate" as const,
  },
  {
    name: "Dumbbell Press",
    primaryMuscle: "chest" as const,
    secondaryMuscles: ["triceps", "shoulders"] as const,
    loadedJoints: ["shoulders"] as const,
    movementPattern: "horizontal_push" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"] as const,
    functionTags: ["foundational"] as const,
    fatigueProfile: "moderate_systemic" as const,
    complexityLevel: "low" as const,
    equipment: ["dumbbells", "bench"],
    strengthLevel: "low" as const,
  },
  // Add more exercises here...
];

async function seedExercises() {
  try {
    console.log("Starting to seed exercises...");
    
    const insertedExercises = await db.insert(exercises).values(allExercises).returning();
    
    console.log(`✅ Successfully inserted ${insertedExercises.length} exercises`);
    console.log("Exercises:", insertedExercises.map(ex => ({ id: ex.id, name: ex.name })));
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to insert exercises:", error);
    process.exit(1);
  }
}

seedExercises();