import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useWorkoutMutations } from '../../src/hooks/useWorkoutMutations';
import { createMockApi, renderHookWithWrapper } from '../test-utils';

describe('useWorkoutMutations', () => {
  let mockApi: ReturnType<typeof createMockApi>['mockApi'];
  let mockUtils: ReturnType<typeof createMockApi>['mockUtils'];
  let mockMutations: ReturnType<typeof createMockApi>['mockMutations'];

  beforeEach(() => {
    const mocks = createMockApi();
    mockApi = mocks.mockApi;
    mockUtils = mocks.mockUtils;
    mockMutations = mocks.mockMutations;
  });

  it('should initialize all mutations', () => {
    const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

    expect(result.current.mutations.deleteExercise).toBeDefined();
    expect(result.current.mutations.updateExerciseOrder).toBeDefined();
    expect(result.current.mutations.deleteBlock).toBeDefined();
    expect(result.current.mutations.deleteWorkout).toBeDefined();
    expect(result.current.mutations.replaceExercise).toBeDefined();
    expect(result.current.mutations.addExercise).toBeDefined();
    expect(result.current.mutations.duplicateWorkout).toBeDefined();
  });

  describe('deleteExercise', () => {
    it('should call mutation and invalidate cache on success', async () => {
      mockMutations.deleteExercise.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.deleteExercise('workout-1', 'exercise-1');
      });

      expect(mockMutations.deleteExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        workoutExerciseId: 'exercise-1',
      });
      
      // Check that invalidate was called via mutation onSuccess
      const mutationOptions = mockApi.workout.deleteExercise.useMutation.mock.calls[0][0];
      mutationOptions.onSuccess();
      expect(mockUtils.workout.getById.invalidate).toHaveBeenCalled();
    });

    it('should handle options callbacks', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      mockMutations.deleteExercise.mutateAsync.mockResolvedValue({ success: true });
      
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.deleteExercise('workout-1', 'exercise-1', {
          onSuccess,
          onError,
        });
      });

      expect(onSuccess).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Delete failed');
      const onError = vi.fn();
      mockMutations.deleteExercise.mutateAsync.mockRejectedValue(error);
      
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await expect(
        result.current.deleteExercise('workout-1', 'exercise-1', { onError })
      ).rejects.toThrow('Delete failed');

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('updateExerciseOrder', () => {
    it('should call mutation with correct parameters', async () => {
      mockMutations.updateExerciseOrder.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.updateExerciseOrder('workout-1', 'exercise-1', 'up');
      });

      expect(mockMutations.updateExerciseOrder.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        workoutExerciseId: 'exercise-1',
        direction: 'up',
      });
    });
  });

  describe('deleteBlock', () => {
    it('should call mutation with correct parameters', async () => {
      mockMutations.deleteBlock.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.deleteBlock('workout-1', 'Block A');
      });

      expect(mockMutations.deleteBlock.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        groupName: 'Block A',
      });
    });
  });

  describe('deleteWorkout', () => {
    it('should invalidate multiple caches on success', async () => {
      mockMutations.deleteWorkout.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.deleteWorkout('workout-1');
      });

      const mutationOptions = mockApi.workout.deleteWorkout.useMutation.mock.calls[0][0];
      mutationOptions.onSuccess();
      
      expect(mockUtils.workout.myWorkouts.invalidate).toHaveBeenCalled();
      expect(mockUtils.workout.clientWorkouts.invalidate).toHaveBeenCalled();
    });
  });

  describe('replaceExercise', () => {
    it('should call mutation with correct parameters', async () => {
      mockMutations.replaceExercise.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.replaceExercise('workout-1', 'exercise-1', 'new-exercise-1');
      });

      expect(mockMutations.replaceExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        workoutExerciseId: 'exercise-1',
        newExerciseId: 'new-exercise-1',
      });
    });
  });

  describe('addExercise', () => {
    it('should use default values for position and sets', async () => {
      mockMutations.addExercise.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.addExercise('workout-1', 'exercise-1', 'Block A');
      });

      expect(mockMutations.addExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        exerciseId: 'exercise-1',
        groupName: 'Block A',
        position: 'end',
        sets: 3,
      });
    });

    it('should use provided values for position and sets', async () => {
      mockMutations.addExercise.mutateAsync.mockResolvedValue({ success: true });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.addExercise('workout-1', 'exercise-1', 'Block A', 'beginning', 5);
      });

      expect(mockMutations.addExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        exerciseId: 'exercise-1',
        groupName: 'Block A',
        position: 'beginning',
        sets: 5,
      });
    });
  });

  describe('duplicateWorkout', () => {
    it('should call mutation with optional parameters', async () => {
      mockMutations.duplicateWorkout.mutateAsync.mockResolvedValue({ 
        success: true, 
        workoutId: 'new-workout-1' 
      });
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      await act(async () => {
        await result.current.duplicateWorkout('workout-1', 'user-2', 'Copy for user');
      });

      expect(mockMutations.duplicateWorkout.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        targetUserId: 'user-2',
        notes: 'Copy for user',
      });
    });
  });

  describe('isLoading', () => {
    it('should return true when any mutation is pending', () => {
      mockMutations.deleteExercise.isPending = true;
      const { result, rerender } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));

      expect(result.current.isLoading).toBe(true);

      // Reset and test another mutation
      mockMutations.deleteExercise.isPending = false;
      mockMutations.addExercise.isPending = true;
      
      // Force re-evaluation by creating new mock
      const newMocks = createMockApi();
      newMocks.mockMutations.addExercise.isPending = true;
      
      rerender({ initialProps: newMocks.mockApi });
      expect(result.current.isLoading).toBe(true);
    });

    it('should return false when no mutations are pending', () => {
      const { result } = renderHookWithWrapper(() => useWorkoutMutations(mockApi));
      expect(result.current.isLoading).toBe(false);
    });
  });
});