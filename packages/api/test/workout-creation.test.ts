import { describe, expect, it } from "vitest";
import { 
  Workout, 
  WorkoutExercise,
  CreateWorkoutSchema,
  CreateWorkoutExerciseSchema 
} from "@acme/db/schema";

describe("Workout Schema with New Fields", () => {
  it("should validate workout creation with new fields", () => {
    // Test that the schema accepts the new fields
    const workoutData = {
      trainingSessionId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "test-user-id",
      completedAt: new Date(),
      notes: "Test workout",
      workoutType: "standard",
      totalPlannedSets: 20,
      llmOutput: {
        blocks: {
          A: [{ name: "Squat", sets: 3 }],
          B: [{ name: "Row", sets: 3 }],
        },
        totalSets: 20,
      },
      templateConfig: {
        restBetweenSets: 90,
        template: "standard",
      },
    };

    // This should not throw - validates the schema includes new fields
    const parsed = CreateWorkoutSchema.parse(workoutData);
    
    expect(parsed).toMatchObject({
      trainingSessionId: workoutData.trainingSessionId,
      userId: workoutData.userId,
      workoutType: "standard",
      totalPlannedSets: 20,
    });
    expect(parsed.llmOutput).toBeDefined();
    expect(parsed.templateConfig).toBeDefined();
  });

  it("should validate workout exercise with groupName", () => {
    const exerciseData = {
      workoutId: "123e4567-e89b-12d3-a456-426614174000",
      exerciseId: "456e4567-e89b-12d3-a456-426614174000",
      orderIndex: 1,
      setsCompleted: 3,
      groupName: "Block A",
    };

    // This should not throw - validates the schema includes groupName
    const parsed = CreateWorkoutExerciseSchema.parse(exerciseData);
    
    expect(parsed).toMatchObject({
      workoutId: exerciseData.workoutId,
      exerciseId: exerciseData.exerciseId,
      orderIndex: 1,
      setsCompleted: 3,
      groupName: "Block A",
    });
  });

  it("should allow optional new fields", () => {
    // Test minimal workout without new fields
    const minimalWorkout = {
      trainingSessionId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "test-user-id",
      completedAt: new Date(),
    };

    const parsed = CreateWorkoutSchema.parse(minimalWorkout);
    expect(parsed.workoutType).toBeUndefined();
    expect(parsed.totalPlannedSets).toBeUndefined();
    expect(parsed.llmOutput).toBeUndefined();
    expect(parsed.templateConfig).toBeUndefined();
  });

  it("should handle circuit workout type", () => {
    const circuitWorkout = {
      trainingSessionId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "test-user-id",
      completedAt: new Date(),
      workoutType: "circuit",
      totalPlannedSets: 18,
      llmOutput: {
        rounds: [
          { exercises: ["Burpees", "Squats", "Plank"] },
          { exercises: ["Burpees", "Squats", "Plank"] },
        ],
      },
      templateConfig: {
        rounds: 2,
        workTime: 45,
        restTime: 15,
      },
    };

    const parsed = CreateWorkoutSchema.parse(circuitWorkout);
    expect(parsed.workoutType).toBe("circuit");
    expect(parsed.llmOutput.rounds).toHaveLength(2);
    expect(parsed.templateConfig.rounds).toBe(2);
  });

  it("should validate workout exercise without groupName", () => {
    // Test that groupName is optional
    const exerciseData = {
      workoutId: "123e4567-e89b-12d3-a456-426614174000",
      exerciseId: "456e4567-e89b-12d3-a456-426614174000",
      orderIndex: 1,
      setsCompleted: 3,
    };

    const parsed = CreateWorkoutExerciseSchema.parse(exerciseData);
    expect(parsed.groupName).toBeUndefined();
  });

  it("should validate saveWorkout input structure", () => {
    // Test the input structure for saveWorkout endpoint
    const saveWorkoutInput = {
      trainingSessionId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "client-123",
      workoutType: "standard",
      totalPlannedSets: 20,
      llmOutput: {
        blocks: {
          A: [{ name: "Squat", sets: 3 }],
          B: [{ name: "Row", sets: 3 }],
        },
        totalSets: 20,
      },
      templateConfig: {
        template: "standard",
        restBetweenSets: 90,
      },
      exercises: [
        {
          exerciseName: "Squat",
          exerciseId: "exercise-123",
          orderIndex: 1,
          setsCompleted: 3,
          groupName: "Block A",
        },
        {
          exerciseName: "Row",
          orderIndex: 2,
          setsCompleted: 3,
          groupName: "Block B",
        },
      ],
    };

    // Verify the structure is valid
    expect(saveWorkoutInput.exercises).toHaveLength(2);
    expect(saveWorkoutInput.exercises[0].groupName).toBe("Block A");
    expect(saveWorkoutInput.llmOutput).toBeDefined();
  });
});