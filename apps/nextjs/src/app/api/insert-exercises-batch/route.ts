import { NextResponse } from "next/server";

import { db } from "@acme/db/client";
import { exercises } from "@acme/db/schema";

// First batch of 20 exercises to test
const firstBatch = [
  {
    name: "Barbell Bench Press",
    primaryMuscle: "chest" as const,
    secondaryMuscles: ["triceps", "shoulders"],
    loadedJoints: ["shoulders"],
    movementPattern: "horizontal_push" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"],
    functionTags: ["foundational"],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["barbell", "bench"],
    strengthLevel: "moderate" as const,
  },
  {
    name: "Face Pulls",
    primaryMuscle: "delts" as const,
    secondaryMuscles: ["traps"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "stability" as const,
    movementTags: ["scapular_control", "bilateral"],
    functionTags: ["rehab_friendly", "warmup_friendly"],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["cable_machine"],
    strengthLevel: "low" as const,
  },
  {
    name: "Band Pull-Apart",
    primaryMuscle: "traps" as const,
    secondaryMuscles: ["delts"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "stability" as const,
    movementTags: ["bilateral", "scapular_control"],
    functionTags: ["rehab_friendly", "warmup_friendly"],
    fatigueProfile: "low_local" as const,
    complexityLevel: "very_low" as const,
    equipment: ["bands"],
    strengthLevel: "very_low" as const,
  },
  {
    name: "Lateral Shoulder Raise",
    primaryMuscle: "delts" as const,
    secondaryMuscles: [],
    loadedJoints: ["shoulders"],
    movementPattern: "shoulder_isolation" as const,
    modality: "strength" as const,
    movementTags: ["bilateral"],
    functionTags: [],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "low" as const,
    equipment: ["dumbbells"],
    strengthLevel: "low" as const,
  },
  {
    name: "Barbell Back Squat",
    primaryMuscle: "quads" as const,
    secondaryMuscles: ["glutes", "hamstrings"],
    loadedJoints: ["knees", "lower_back"],
    movementPattern: "squat" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "knee_dominant", "postural_control"],
    functionTags: ["foundational"],
    fatigueProfile: "high_systemic" as const,
    complexityLevel: "moderate" as const,
    equipment: ["barbell"],
    strengthLevel: "moderate" as const,
  },
  {
    name: "Goblet Squat",
    primaryMuscle: "quads" as const,
    secondaryMuscles: ["glutes", "core"],
    loadedJoints: ["knees", "hips"],
    movementPattern: "squat" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "knee_dominant", "postural_control"],
    functionTags: ["foundational", "warmup_friendly"],
    fatigueProfile: "moderate_systemic" as const,
    complexityLevel: "low" as const,
    equipment: ["dumbbells"],
    strengthLevel: "low" as const,
  },
  {
    name: "Jump Squat",
    primaryMuscle: "quads" as const,
    secondaryMuscles: ["glutes", "calves"],
    loadedJoints: ["knees", "hips", "ankles"],
    movementPattern: "squat" as const,
    modality: "power" as const,
    movementTags: ["bilateral", "knee_dominant", "explosive"],
    functionTags: ["finisher_friendly"],
    fatigueProfile: "metabolic" as const,
    complexityLevel: "moderate" as const,
    equipment: [],
    strengthLevel: "moderate" as const,
  },
  {
    name: "Pull-Ups",
    primaryMuscle: "lats" as const,
    secondaryMuscles: ["biceps", "upper_back"],
    loadedJoints: ["shoulders"],
    movementPattern: "vertical_pull" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"],
    functionTags: ["foundational"],
    fatigueProfile: "high_local" as const,
    complexityLevel: "high" as const,
    equipment: ["pull_up_bar"],
    strengthLevel: "high" as const,
  },
  {
    name: "Push-Ups",
    primaryMuscle: "chest" as const,
    secondaryMuscles: ["triceps", "shoulders"],
    loadedJoints: ["shoulders"],
    movementPattern: "horizontal_push" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"],
    functionTags: ["foundational"],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "low" as const,
    equipment: [],
    strengthLevel: "moderate" as const,
  },
  {
    name: "Deadlift",
    primaryMuscle: "hamstrings" as const,
    secondaryMuscles: ["glutes", "lower_back"],
    loadedJoints: ["hips", "knees", "lower_back"],
    movementPattern: "hinge" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "hip_dominant", "postural_control"],
    functionTags: ["foundational"],
    fatigueProfile: "high_systemic" as const,
    complexityLevel: "moderate" as const,
    equipment: ["platform", "barbell"],
    strengthLevel: "moderate" as const,
  },
];

export async function POST() {
  try {
    const insertedExercises = await db
      .insert(exercises)
      .values(firstBatch)
      .returning();

    return NextResponse.json({
      success: true,
      message: `Successfully inserted ${insertedExercises.length} exercises`,
      exercises: insertedExercises.map((ex) => ({ id: ex.id, name: ex.name })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to insert exercises",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
