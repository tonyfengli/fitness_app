# Feature Development Guide

## Overview
This document tracks feature development for the fitness app.

**User Stories**

## Trainer Dashboard
- As a trainer, I want to see all clients, with each of their strength and skill levels in my business in the left sidebar
- As a trainer, I can see all the workouts that have been programmed for the client that is selected, that I am viewing
- As a trainer, I can open up a modal, set the settings and preferences, and create the programmed workout for the client using AI

## Workout Management
- As a user (for both trainer and client), I want to be able to delete a specific exercise that is displayed in the workouts
- As a user (for both trainer and client), I want to be able to replace a exercise in a workout with another one that I have selcted
- As a user (for both trainer and client), I want to be able to move the order of the exercise up or down in the workout sequence
- As a user (for both trainer and client), I want to be able to delete the whole workout at once
- As a user (for both trainer and client), I want to be able to delete a whole section (block or circuit) at once
- As a user (for both trainer and client), I want to be able to replicate the workout
- As a user (for both trainer and client), I want to be able to pass in the inputs again in the LLM to regenerate a new one
- As a user (for both trainer and client), I want to be able to add an exercise (of my choosing) to a workout



## Sign Up 
- As a trainer, I want to see add two new fields (strength and skill capacity) to configure to the new user's profiles


TODO 
## Workout Management
Phase 1: API Layer - Core TRPC Mutations

  1.1 Basic Exercise Operations

  // packages/api/src/router/workout.ts

  // Add to existing workoutRouter:
  deleteExercise: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete and reorder remaining exercises
    }),

  updateExerciseOrder: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid(),
      direction: z.enum(['up', 'down'])
    }))
    .mutation(async ({ ctx, input }) => {
      // Swap orderIndex within same groupName
    }),

  1.2 Block and Workout Operations

  deleteBlock: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      groupName: z.string() // e.g., "Block A"
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete all exercises with this groupName
    }),

  deleteWorkout: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      // Cascade delete handles WorkoutExercise
    }),

  Phase 2: Advanced Operations & Shared Types

  2.1 Complex Mutations

  replaceExercise: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid(),
      newExerciseId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      // Update exerciseId, keep same orderIndex and groupName
    }),

  addExercise: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      exerciseId: z.string().uuid(),
      groupName: z.string(),
      position: z.enum(['start', 'end']).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Add with appropriate orderIndex
    }),

  2.2 Duplication and Regeneration

  duplicateWorkout: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid(),
      newUserId: z.string().optional(), // For trainers duplicating to clients
    }))
    .mutation(async ({ ctx, input }) => {
      // Copy workout and all exercises
    }),

  regenerateWorkout: protectedProcedure
    .input(z.object({
      workoutId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      // Extract params from llmOutput/templateConfig
      // Call AI to generate new workout
    }),

  Phase 3: Shared Hooks & Business Logic

  3.1 Shared Hooks Package

  // packages/ui-shared/src/hooks/workout/useWorkoutMutations.ts
  export const useDeleteExercise = () => {
    const utils = api.useUtils();

    return api.workout.deleteExercise.useMutation({
      onMutate: async ({ workoutId, workoutExerciseId }) => {
        // Cancel queries
        await utils.workout.getById.cancel({ id: workoutId });

        // Optimistic update
        const previous = utils.workout.getById.getData({ id: workoutId });
        utils.workout.getById.setData({ id: workoutId }, (old) => {
          if (!old) return old;
          return {
            ...old,
            exercises: old.exercises.filter(ex => ex.id !== workoutExerciseId)
          };
        });

        return { previous };
      },
      onError: (err, vars, context) => {
        if (context?.previous) {
          utils.workout.getById.setData({ id: vars.workoutId }, context.previous);
        }
      },
      onSettled: (_, __, { workoutId }) => {
        utils.workout.getById.invalidate({ id: workoutId });
      }
    });
  };

  3.2 Shared Types

  // packages/validators/src/workout-mutations.ts
  export const WorkoutMutationSchemas = {
    deleteExercise: z.object({
      workoutId: z.string().uuid(),
      workoutExerciseId: z.string().uuid()
    }),
    // ... other schemas
  };

  Phase 4: Platform-Specific UI Components

  4.1 Desktop Components

  // packages/ui-desktop/src/components/workout/WorkoutEditor.tsx
  import { useWorkoutMutations } from '@acme/ui-shared';

  export const WorkoutEditor = ({ workout }: { workout: WorkoutWithExercises }) => {
    const { deleteExercise, reorderExercise } = useWorkoutMutations();

    // Group exercises by groupName
    const exercisesByBlock = workout.exercises.reduce((acc, ex) => {
      const group = ex.groupName || 'Ungrouped';
      if (!acc[group]) acc[group] = [];
      acc[group].push(ex);
      return acc;
    }, {} as Record<string, WorkoutExercise[]>);

    return (
      <div className="space-y-6">
        {Object.entries(exercisesByBlock).map(([blockName, exercises]) => (
          <WorkoutBlock
            key={blockName}
            blockName={blockName}
            exercises={exercises}
            onDelete={() => deleteBlock.mutate({ workoutId: workout.id, groupName: blockName })}
          />
        ))}
      </div>
    );
  };

  4.2 Mobile Components

  // packages/ui-mobile/src/components/workout/WorkoutEditor.tsx
  import { SwipeListView } from 'react-native-swipe-list-view';

  export const MobileWorkoutEditor = ({ workout }) => {
    const { deleteExercise } = useWorkoutMutations();

    const renderHiddenItem = (data, rowMap) => (
      <View style={styles.rowBack}>
        <TouchableOpacity
          onPress={() => deleteExercise.mutate({
            workoutId: workout.id,
            workoutExerciseId: data.item.id
          })}
        >
          <Text>Delete</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <SwipeListView
        data={workout.exercises}
        renderItem={renderExercise}
        renderHiddenItem={renderHiddenItem}
        rightOpenValue={-75}
      />
    );
  };

  Phase 5: Exercise Selection & Final Polish

  5.1 Exercise Selection Modal

  // Shared interface
  interface ExercisePickerProps {
    onSelect: (exerciseId: string) => void;
    currentExercise?: Exercise;
    blockConstraints?: string[]; // For future AI suggestions
  }

  // Desktop version uses cmdk
  // Mobile version uses native search

  5.2 Final Integration

  - Add loading states
  - Error boundaries
  - Analytics tracking
  - Keyboard shortcuts (desktop)
  - Gesture support (mobile)
  - Offline queue for mutations

  Key Architecture Decisions

  1. Use existing schema - No migrations needed
  2. Store generation params in llmOutput - Already JSONB
  3. Respect groupName for blocks - Maintain block integrity
  4. Optimistic updates - Better UX across platforms
  5. Shared business logic - Write once, use everywhere
