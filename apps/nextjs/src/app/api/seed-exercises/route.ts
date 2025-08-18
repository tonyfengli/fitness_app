import { NextResponse } from "next/server";

import { db } from "@acme/db/client";
import { exercises } from "@acme/db/schema";

const testExercises = [
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
    name: "Dumbbell Press",
    primaryMuscle: "chest" as const,
    secondaryMuscles: ["triceps", "shoulders"],
    loadedJoints: ["shoulders"],
    movementPattern: "horizontal_push" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"],
    functionTags: ["foundational"],
    fatigueProfile: "moderate_systemic" as const,
    complexityLevel: "low" as const,
    equipment: ["dumbbells", "bench"],
    strengthLevel: "low" as const,
  },
  {
    name: "Incline Dumbbell Press",
    primaryMuscle: "upper_chest" as const,
    secondaryMuscles: ["triceps", "shoulders"],
    loadedJoints: ["shoulders"],
    movementPattern: "horizontal_push" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control"],
    functionTags: ["foundational"],
    fatigueProfile: "moderate_systemic" as const,
    complexityLevel: "low" as const,
    equipment: ["dumbbells", "bench"],
    strengthLevel: "low" as const,
  },
  {
    name: "Dumbbell Bench Row",
    primaryMuscle: "lats" as const,
    secondaryMuscles: ["biceps", "upper_back"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "strength" as const,
    movementTags: ["unilateral", "scapular_control", "core_stability"],
    functionTags: ["foundational", "rehab_friendly"],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "low" as const,
    equipment: ["dumbbells", "bench"],
    strengthLevel: "low" as const,
  },
  {
    name: "Landmine T Bar Row",
    primaryMuscle: "lats" as const,
    secondaryMuscles: ["biceps", "upper_back"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "strength" as const,
    movementTags: ["bilateral", "scapular_control", "postural_control"],
    functionTags: [],
    fatigueProfile: "moderate_systemic" as const,
    complexityLevel: "moderate" as const,
    equipment: ["barbell", "landmine"],
    strengthLevel: "moderate" as const,
  },
  {
    name: "TRX Mid Row",
    primaryMuscle: "upper_back" as const,
    secondaryMuscles: ["biceps", "lats"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "stability" as const,
    movementTags: ["bilateral", "scapular_control", "core_stability"],
    functionTags: ["rehab_friendly"],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["trx"],
    strengthLevel: "low" as const,
  },
  {
    name: "Dumbbell Pullover",
    primaryMuscle: "lats" as const,
    secondaryMuscles: ["chest", "triceps"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "strength" as const,
    movementTags: ["scapular_control", "core_stability", "bilateral"],
    functionTags: [],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["dumbbells"],
    strengthLevel: "moderate" as const,
  },
  {
    name: "Bent-Over Single Arm Kettlebell Row (Gorilla Row)",
    primaryMuscle: "lats" as const,
    secondaryMuscles: ["biceps", "upper_back"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "strength" as const,
    movementTags: ["unilateral", "scapular_control", "hip_dominant"],
    functionTags: ["foundational"],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["kettlebell"],
    strengthLevel: "low" as const,
  },
  {
    name: "Batwing Chest-Supported Row",
    primaryMuscle: "upper_back" as const,
    secondaryMuscles: ["lats", "biceps"],
    loadedJoints: [],
    movementPattern: "horizontal_pull" as const,
    modality: "strength" as const,
    movementTags: ["isometric_control", "scapular_control", "bilateral"],
    functionTags: [],
    fatigueProfile: "moderate_local" as const,
    complexityLevel: "moderate" as const,
    equipment: ["dumbbells", "bench"],
    strengthLevel: "moderate" as const,
  },
];

export async function POST() {
  try {
    const insertedExercises = await db
      .insert(exercises)
      .values(testExercises)
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
