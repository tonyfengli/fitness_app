import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useOptimisticWorkout } from '../../src/hooks/useOptimisticWorkout';
import { createMockApi, createMockWorkout, renderHookWithWrapper } from '../test-utils';

describe('useOptimisticWorkout', () => {
  let mockApi: ReturnType<typeof createMockApi>['mockApi'];
  let mockUtils: ReturnType<typeof createMockApi>['mockUtils'];
  let mockWorkout = createMockWorkout();

  beforeEach(() => {
    const mocks = createMockApi();
    mockApi = mocks.mockApi;
    mockUtils = mocks.mockUtils;
    mockWorkout = createMockWorkout();
    
    // Setup query to return workout data
    mockApi.workout.getById.useQuery.mockReturnValue({ data: mockWorkout });
  });

  it('should return workout data from query', () => {
    const { result } = renderHookWithWrapper(() => 
      useOptimisticWorkout('workout-1', mockApi)
    );

    expect(result.current.workout).toEqual(mockWorkout);
  });

  describe('optimisticDeleteExercise', () => {
    it('should remove exercise and update cache optimistically', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      act(() => {
        result.current.optimisticDeleteExercise('we-1');
      });

      // Check that setData was called
      expect(mockUtils.workout.getById.setData).toHaveBeenCalledWith(
        { id: 'workout-1' },
        expect.any(Function)
      );

      // Test the updater function
      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(mockWorkout);
      
      expect(updated.exercises).toHaveLength(2);
      expect(updated.exercises.find(ex => ex.id === 'we-1')).toBeUndefined();
    });

    it('should reorder remaining exercises in the same group', () => {
      const workout = createMockWorkout({
        exercises: [
          { id: 'we-1', orderIndex: 1, groupName: 'Block A', setsCompleted: 3, exercise: {} as any, createdAt: new Date() },
          { id: 'we-2', orderIndex: 2, groupName: 'Block A', setsCompleted: 3, exercise: {} as any, createdAt: new Date() },
          { id: 'we-3', orderIndex: 3, groupName: 'Block A', setsCompleted: 3, exercise: {} as any, createdAt: new Date() },
        ],
      });
      
      mockApi.workout.getById.useQuery.mockReturnValue({ data: workout });
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      act(() => {
        result.current.optimisticDeleteExercise('we-2');
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(workout);
      
      expect(updated.exercises[0].orderIndex).toBe(1); // we-1 stays at 1
      expect(updated.exercises[1].orderIndex).toBe(2); // we-3 moves to 2
    });
  });

  describe('optimisticReorderExercise', () => {
    it('should swap exercises when moving up', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      act(() => {
        result.current.optimisticReorderExercise('we-2', 'up');
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(mockWorkout);
      
      // Check that exercises swapped positions
      const ex1 = updated.exercises.find(ex => ex.id === 'we-1');
      const ex2 = updated.exercises.find(ex => ex.id === 'we-2');
      
      expect(ex1?.orderIndex).toBe(2);
      expect(ex2?.orderIndex).toBe(1);
    });

    it('should not reorder across block boundaries', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      // Try to move the last exercise in Block A down (would cross to Block B)
      act(() => {
        result.current.optimisticReorderExercise('we-2', 'down');
      });

      // setData should not be called if move is invalid
      expect(mockUtils.workout.getById.setData).not.toHaveBeenCalled();
    });

    it('should not reorder at boundaries', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      // Try to move first exercise up
      act(() => {
        result.current.optimisticReorderExercise('we-1', 'up');
      });

      expect(mockUtils.workout.getById.setData).not.toHaveBeenCalled();
    });
  });

  describe('optimisticDeleteBlock', () => {
    it('should remove all exercises in a block', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      act(() => {
        result.current.optimisticDeleteBlock('Block A');
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(mockWorkout);
      
      expect(updated.exercises).toHaveLength(1);
      expect(updated.exercises[0].groupName).toBe('Block B');
    });
  });

  describe('optimisticReplaceExercise', () => {
    it('should update exercise details', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      const newExerciseData = {
        name: 'Squat',
        primaryMuscle: 'quads',
        equipment: ['barbell'],
      };

      act(() => {
        result.current.optimisticReplaceExercise('we-1', newExerciseData);
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(mockWorkout);
      
      const replacedExercise = updated.exercises.find(ex => ex.id === 'we-1');
      expect(replacedExercise?.exercise.name).toBe('Squat');
      expect(replacedExercise?.exercise.primaryMuscle).toBe('quads');
    });
  });

  describe('optimisticAddExercise', () => {
    it('should add exercise at end of group', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      const newExercise = {
        id: 'new-ex-1',
        name: 'Deadlift',
        primaryMuscle: 'hamstrings',
      };

      act(() => {
        result.current.optimisticAddExercise(newExercise, 'Block A', 'end', 4);
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(mockWorkout);
      
      expect(updated.exercises).toHaveLength(4);
      const added = updated.exercises.find(ex => ex.exercise.name === 'Deadlift');
      expect(added?.orderIndex).toBe(3); // After existing Block A exercises
      expect(added?.setsCompleted).toBe(4);
      expect(added?.groupName).toBe('Block A');
    });

    it('should add exercise at beginning of group and shift others', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      act(() => {
        result.current.optimisticAddExercise(
          { name: 'Front Squat' },
          'Block A',
          'beginning'
        );
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(mockWorkout);
      
      // Original first exercise should now be second
      const originalFirst = updated.exercises.find(ex => ex.id === 'we-1');
      expect(originalFirst?.orderIndex).toBe(2);
    });

    it('should add to empty workout', () => {
      const emptyWorkout = createMockWorkout({ exercises: [] });
      mockApi.workout.getById.useQuery.mockReturnValue({ data: emptyWorkout });
      
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      act(() => {
        result.current.optimisticAddExercise(
          { name: 'First Exercise' },
          'Block A'
        );
      });

      const updater = mockUtils.workout.getById.setData.mock.calls[0][1];
      const updated = updater(emptyWorkout);
      
      expect(updated.exercises).toHaveLength(1);
      expect(updated.exercises[0].orderIndex).toBe(1);
    });
  });

  describe('rollback', () => {
    it('should restore previous data when called', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      // Make an optimistic change
      act(() => {
        result.current.optimisticDeleteExercise('we-1');
      });

      // Clear mock to check rollback call
      mockUtils.workout.getById.setData.mockClear();

      // Rollback
      act(() => {
        result.current.rollback();
      });

      expect(mockUtils.workout.getById.setData).toHaveBeenCalledWith(
        { id: 'workout-1' },
        mockWorkout
      );
    });

    it('should not rollback if no previous data', () => {
      const { result } = renderHookWithWrapper(() => 
        useOptimisticWorkout('workout-1', mockApi)
      );

      // Rollback without making changes
      act(() => {
        result.current.rollback();
      });

      expect(mockUtils.workout.getById.setData).not.toHaveBeenCalled();
    });
  });
});