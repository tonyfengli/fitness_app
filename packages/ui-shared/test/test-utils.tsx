import React from 'react';
import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Exercise, WorkoutDetail, WorkoutExercise } from '../src/hooks/useOptimisticWorkout';

// Mock API factory
export function createMockApi() {
  const mockUtils = {
    workout: {
      getById: {
        invalidate: vi.fn(),
        setData: vi.fn(),
      },
      myWorkouts: {
        invalidate: vi.fn(),
      },
      clientWorkouts: {
        invalidate: vi.fn(),
      },
    },
  };

  const mockMutations = {
    deleteExercise: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    updateExerciseOrder: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    deleteBlock: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    deleteWorkout: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    replaceExercise: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    addExercise: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
    duplicateWorkout: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
  };

  const mockApi = {
    useUtils: () => mockUtils,
    workout: {
      deleteExercise: {
        useMutation: vi.fn(() => mockMutations.deleteExercise),
      },
      updateExerciseOrder: {
        useMutation: vi.fn(() => mockMutations.updateExerciseOrder),
      },
      deleteBlock: {
        useMutation: vi.fn(() => mockMutations.deleteBlock),
      },
      deleteWorkout: {
        useMutation: vi.fn(() => mockMutations.deleteWorkout),
      },
      replaceExercise: {
        useMutation: vi.fn(() => mockMutations.replaceExercise),
      },
      addExercise: {
        useMutation: vi.fn(() => mockMutations.addExercise),
      },
      duplicateWorkout: {
        useMutation: vi.fn(() => mockMutations.duplicateWorkout),
      },
      getById: {
        useQuery: vi.fn(() => ({ data: undefined })),
      },
    },
    exercise: {
      list: {
        useQuery: vi.fn(() => ({ data: [], isLoading: false })),
      },
    },
  };

  return { mockApi, mockUtils, mockMutations };
}

// Mock data factories
export function createMockExercise(overrides?: Partial<Exercise>): Exercise {
  return {
    id: 'exercise-1',
    name: 'Bench Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'horizontal_push',
    modality: 'strength',
    equipment: ['barbell'],
    ...overrides,
  };
}

export function createMockWorkoutExercise(overrides?: Partial<WorkoutExercise>): WorkoutExercise {
  return {
    id: 'workout-exercise-1',
    orderIndex: 1,
    setsCompleted: 3,
    groupName: 'Block A',
    createdAt: new Date(),
    exercise: createMockExercise(),
    ...overrides,
  };
}

export function createMockWorkout(overrides?: Partial<WorkoutDetail>): WorkoutDetail {
  return {
    id: 'workout-1',
    exercises: [
      createMockWorkoutExercise({ id: 'we-1', orderIndex: 1 }),
      createMockWorkoutExercise({ id: 'we-2', orderIndex: 2 }),
      createMockWorkoutExercise({ id: 'we-3', orderIndex: 3, groupName: 'Block B' }),
    ],
    ...overrides,
  };
}

// Test wrapper for hooks
interface WrapperProps {
  children: React.ReactNode;
}

export function createWrapper() {
  return function Wrapper({ children }: WrapperProps) {
    return <>{children}</>;
  };
}

// Render hook with wrapper
export function renderHookWithWrapper<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: {
    initialProps?: TProps;
    wrapper?: React.ComponentType<WrapperProps>;
  }
) {
  return renderHook(hook, {
    wrapper: options?.wrapper || createWrapper(),
    ...options,
  });
}