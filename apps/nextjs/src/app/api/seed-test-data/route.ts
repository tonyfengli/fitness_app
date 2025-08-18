import { NextResponse } from "next/server";

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Business,
  exercises,
  user,
  Workout,
  WorkoutExercise,
} from "@acme/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trainerEmail, clientEmail } = body;

    console.log("Seed request received:", { trainerEmail, clientEmail });

    if (!trainerEmail) {
      return NextResponse.json(
        { error: "Trainer email required" },
        { status: 400 },
      );
    }

    // Find the trainer
    const trainer = await db.query.user.findFirst({
      where: eq(user.email, trainerEmail),
    });

    if (!trainer || trainer.role !== "trainer") {
      return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
    }

    // Get the trainer's businessId
    const businessId = trainer.businessId;

    if (!businessId) {
      return NextResponse.json(
        { error: "Trainer has no associated business" },
        { status: 404 },
      );
    }

    // Get specific client or first client
    let testClient;

    if (clientEmail) {
      // Use specific client
      testClient = await db.query.user.findFirst({
        where: and(
          eq(user.email, clientEmail),
          eq(user.businessId, businessId),
        ),
      });

      if (!testClient) {
        return NextResponse.json(
          { error: `Client ${clientEmail} not found in business` },
          { status: 404 },
        );
      }
    } else {
      // Get the first client in the business
      testClient = await db.query.user.findFirst({
        where: and(eq(user.role, "client"), eq(user.businessId, businessId)),
      });

      if (!testClient) {
        return NextResponse.json(
          {
            error:
              "No clients found in business. Please create a client first.",
          },
          { status: 404 },
        );
      }
    }

    // Get some exercises to use
    const availableExercises = await db.query.exercises.findMany({
      limit: 15,
    });

    if (availableExercises.length < 9) {
      return NextResponse.json(
        { error: "Not enough exercises in database" },
        { status: 400 },
      );
    }

    // Delete any existing E2E test workouts to keep things clean
    const existingWorkouts = await db.query.Workout.findMany({
      where: and(
        eq(Workout.userId, testClient.id),
        eq(Workout.notes, "E2E Test Workout - auto-generated"),
      ),
    });

    if (existingWorkouts.length > 0) {
      await db.delete(Workout).where(eq(Workout.id, existingWorkouts[0].id));
    }

    // Create a fresh test workout
    const [newWorkout] = await db
      .insert(Workout)
      .values({
        userId: testClient.id,
        businessId: businessId,
        createdByTrainerId: trainer.id,
        notes: "E2E Test Workout - auto-generated",
        workoutType: "standard",
        context: "individual",
        totalPlannedSets: 27, // 3+3+3+4+4+4+3+3+3 = 27 sets total
      })
      .returning();

    // Add exercises to the workout (3 per block for proper move up/down testing)
    const exercisesToAdd = [
      // Block A - 3 exercises
      {
        exercise: availableExercises[0],
        groupName: "Block A",
        order: 1,
        sets: 3,
      },
      {
        exercise: availableExercises[1],
        groupName: "Block A",
        order: 2,
        sets: 3,
      },
      {
        exercise: availableExercises[2],
        groupName: "Block A",
        order: 3,
        sets: 3,
      },
      // Block B - 3 exercises
      {
        exercise: availableExercises[3],
        groupName: "Block B",
        order: 1,
        sets: 4,
      },
      {
        exercise: availableExercises[4],
        groupName: "Block B",
        order: 2,
        sets: 4,
      },
      {
        exercise: availableExercises[5],
        groupName: "Block B",
        order: 3,
        sets: 4,
      },
      // Block C - 3 exercises
      {
        exercise: availableExercises[6],
        groupName: "Block C",
        order: 1,
        sets: 3,
      },
      {
        exercise: availableExercises[7],
        groupName: "Block C",
        order: 2,
        sets: 3,
      },
      {
        exercise: availableExercises[8],
        groupName: "Block C",
        order: 3,
        sets: 3,
      },
    ];

    for (let i = 0; i < exercisesToAdd.length; i++) {
      const item = exercisesToAdd[i];
      await db.insert(WorkoutExercise).values({
        workoutId: newWorkout.id,
        exerciseId: item.exercise.id,
        groupName: item.groupName,
        orderIndex: i + 1, // Sequential order across all exercises
        setsCompleted: item.sets,
      });
    }

    return NextResponse.json({
      success: true,
      workout: {
        id: newWorkout.id,
        notes: newWorkout.notes,
        client: testClient.email,
        clientName: testClient.name,
        exerciseCount: exercisesToAdd.length,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to seed test data",
        details: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
