import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useWorkoutActions } from '../../src/hooks/useWorkoutActions';
import { createMockApi, createMockWorkout, renderHookWithWrapper } from '../test-utils';

describe('useWorkoutActions', () => {
  let mockApi: ReturnType<typeof createMockApi>['mockApi'];
  let mockUtils: ReturnType<typeof createMockApi>['mockUtils'];
  let mockMutations: ReturnType<typeof createMockApi>['mockMutations'];
  let mockToast: { showToast: ReturnType<typeof vi.fn> };
  let onDeleteWorkoutSuccess: ReturnType<typeof vi.fn>;
  let onDuplicateSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = createMockApi();
    mockApi = mocks.mockApi;
    mockUtils = mocks.mockUtils;
    mockMutations = mocks.mockMutations;
    
    mockToast = {
      showToast: vi.fn(),
    };
    onDeleteWorkoutSuccess = vi.fn();
    onDuplicateSuccess = vi.fn();
    
    // Setup default workout data
    const mockWorkout = createMockWorkout();
    mockApi.workout.getById.useQuery.mockReturnValue({ data: mockWorkout });
    
    // Setup mutations to resolve successfully by default
    Object.values(mockMutations).forEach(mutation => {
      mutation.mutateAsync.mockResolvedValue({ success: true });
    });
  });

  const renderHook = (workoutId = 'workout-1') => {
    return renderHookWithWrapper(() => 
      useWorkoutActions({
        workoutId,
        api: mockApi,
        toast: mockToast,
        onDeleteWorkoutSuccess,
        onDuplicateSuccess,
      })
    );
  };

  describe('deleteExercise', () => {
    it('should perform optimistic update and show success toast', async () => {
      const { result } = renderHook();
      
      // Ensure hook is properly initialized
      expect(result.current).toBeDefined();
      expect(result.current.deleteExercise).toBeDefined();

      await act(async () => {
        await result.current.deleteExercise('we-1', 'Bench Press');
      });

      // Check optimistic update was called
      expect(mockUtils.workout.getById.setData).toHaveBeenCalled();
      
      // Check mutation was called
      expect(mockMutations.deleteExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        workoutExerciseId: 'we-1',
      });
      
      // Check success toast
      expect(mockToast.showToast).toHaveBeenCalledWith(
        'Deleted Bench Press from workout',
        'success'
      );
    });

    it('should rollback on error and show error toast', async () => {
      const error = new Error('Delete failed');
      mockMutations.deleteExercise.mutateAsync.mockRejectedValue(error);
      
      const { result } = renderHook();

      await act(async () => {
        try {
          await result.current.deleteExercise('we-1', 'Bench Press');
        } catch (e) {
          // Expected to throw
        }
      });

      // Check error toast
      expect(mockToast.showToast).toHaveBeenCalledWith(
        'Failed to delete exercise: Delete failed',
        'error'
      );
      
      // Check rollback was called (via setData)
      await waitFor(() => {
        expect(mockUtils.workout.getById.setData).toHaveBeenCalledTimes(2); // Once for optimistic, once for rollback
      });
    });

    it('should track action state', async () => {
      const { result } = renderHook();

      // Check initial state
      expect(result.current.getActionState('delete-exercise', 'we-1').status).toBe('idle');

      // Start action without awaiting to check pending state
      let deletePromise: Promise<void>;
      act(() => {
        deletePromise = result.current.deleteExercise('we-1');
      });

      // Check pending state immediately
      expect(result.current.getActionState('delete-exercise', 'we-1').status).toBe('pending');

      // Wait for the action to complete
      await act(async () => {
        await deletePromise;
      });

      // Check success state
      expect(result.current.getActionState('delete-exercise', 'we-1').status).toBe('success');
    });
  });

  describe('reorderExercise', () => {
    it('should perform optimistic update for valid moves', async () => {
      const { result } = renderHook();

      await act(async () => {
        await result.current.reorderExercise('we-2', 'up', 'Squat');
      });

      expect(mockUtils.workout.getById.setData).toHaveBeenCalled();
      expect(mockMutations.updateExerciseOrder.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        workoutExerciseId: 'we-2',
        direction: 'up',
      });
      expect(mockToast.showToast).toHaveBeenCalledWith('Moved Squat up', 'success');
    });
  });

  describe('deleteBlock', () => {
    it('should delete block and show success toast', async () => {
      const { result } = renderHook();

      await act(async () => {
        await result.current.deleteBlock('Block A');
      });

      expect(mockUtils.workout.getById.setData).toHaveBeenCalled();
      expect(mockMutations.deleteBlock.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        groupName: 'Block A',
      });
      expect(mockToast.showToast).toHaveBeenCalledWith('Deleted Block A', 'success');
    });
  });

  describe('deleteWorkout', () => {
    it('should delete workout and call success callback', async () => {
      const { result } = renderHook();

      await act(async () => {
        await result.current.deleteWorkout();
      });

      expect(mockMutations.deleteWorkout.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
      });
      expect(mockToast.showToast).toHaveBeenCalledWith('Workout deleted successfully', 'success');
      expect(onDeleteWorkoutSuccess).toHaveBeenCalled();
    });

    it('should not perform optimistic update', async () => {
      const { result } = renderHook();

      await act(async () => {
        await result.current.deleteWorkout();
      });

      // Should not call setData for non-optimistic operations
      expect(mockUtils.workout.getById.setData).not.toHaveBeenCalled();
    });
  });

  describe('replaceExercise', () => {
    it('should perform optimistic update when exercise data provided', async () => {
      const newExerciseData = {
        name: 'Deadlift',
        primaryMuscle: 'hamstrings',
        equipment: ['barbell'],
      };
      
      const { result } = renderHook();

      await act(async () => {
        await result.current.replaceExercise('we-1', 'new-ex-1', newExerciseData);
      });

      expect(mockUtils.workout.getById.setData).toHaveBeenCalled();
      expect(mockMutations.replaceExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        workoutExerciseId: 'we-1',
        newExerciseId: 'new-ex-1',
      });
      expect(mockToast.showToast).toHaveBeenCalledWith('Replaced with Deadlift', 'success');
    });

    it('should not perform optimistic update without exercise data', async () => {
      const { result } = renderHook();

      await act(async () => {
        await result.current.replaceExercise('we-1', 'new-ex-1');
      });

      expect(mockUtils.workout.getById.setData).not.toHaveBeenCalled();
      expect(mockMutations.replaceExercise.mutateAsync).toHaveBeenCalled();
    });
  });

  describe('addExercise', () => {
    it('should add exercise with defaults', async () => {
      const exerciseData = {
        name: 'Pull-ups',
        primaryMuscle: 'lats',
        equipment: ['pull-up bar'],
      };
      
      const { result } = renderHook();

      await act(async () => {
        await result.current.addExercise('ex-1', 'Block B', 'end', 3, exerciseData);
      });

      expect(mockUtils.workout.getById.setData).toHaveBeenCalled();
      expect(mockMutations.addExercise.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        exerciseId: 'ex-1',
        groupName: 'Block B',
        position: 'end',
        sets: 3,
      });
      expect(mockToast.showToast).toHaveBeenCalledWith('Added Pull-ups to Block B', 'success');
    });
  });

  describe('duplicateWorkout', () => {
    it('should duplicate workout and call success callback', async () => {
      mockMutations.duplicateWorkout.mutateAsync.mockResolvedValue({
        success: true,
        workoutId: 'new-workout-1',
      });
      
      const { result } = renderHook();

      await act(async () => {
        await result.current.duplicateWorkout('user-2', 'Copy for client');
      });

      expect(mockMutations.duplicateWorkout.mutateAsync).toHaveBeenCalledWith({
        workoutId: 'workout-1',
        targetUserId: 'user-2',
        notes: 'Copy for client',
      });
      expect(mockToast.showToast).toHaveBeenCalledWith('Workout duplicated successfully', 'success');
      expect(onDuplicateSuccess).toHaveBeenCalledWith('new-workout-1');
    });

    it('should return result on success', async () => {
      const mockResult = { success: true, workoutId: 'new-workout-1' };
      mockMutations.duplicateWorkout.mutateAsync.mockResolvedValue(mockResult);
      
      const { result } = renderHook();

      const duplicateResult = await act(async () => {
        return await result.current.duplicateWorkout();
      });

      expect(duplicateResult).toEqual(mockResult);
    });

    it('should return null on error', async () => {
      mockMutations.duplicateWorkout.mutateAsync.mockRejectedValue(new Error('Failed'));
      
      const { result } = renderHook();

      const duplicateResult = await act(async () => {
        return await result.current.duplicateWorkout();
      });

      expect(duplicateResult).toBeNull();
    });
  });

  describe('isLoading', () => {
    it('should reflect loading state from mutations and actions', () => {
      mockMutations.deleteExercise.isPending = true;
      const { result } = renderHook();

      expect(result.current.isLoading).toBe(true);
    });

    it('should be true when action is pending', async () => {
      // Mock a slow mutation
      mockMutations.deleteExercise.mutateAsync.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const { result } = renderHook();

      // Start the delete action without awaiting
      let deletePromise: Promise<void>;
      act(() => {
        deletePromise = result.current.deleteExercise('we-1');
      });

      // Should be loading during action
      expect(result.current.isLoading).toBe(true);

      // Wait for completion
      await act(async () => {
        await deletePromise;
      });

      // Should not be loading after completion
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('workout data', () => {
    it('should provide workout data from optimistic hook', () => {
      const { result } = renderHook();

      // The workout should match what was set up in beforeEach
      expect(result.current.workout).toBeDefined();
      expect(result.current.workout.id).toBe('workout-1');
      expect(result.current.workout.exercises).toHaveLength(3);
    });
  });

  describe('getActionState', () => {
    it('should return idle state for unknown actions', () => {
      const { result } = renderHook();

      const state = result.current.getActionState('unknown-action');
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('should track error states', async () => {
      const error = new Error('Action failed');
      mockMutations.deleteBlock.mutateAsync.mockRejectedValue(error);
      
      const { result } = renderHook();

      await act(async () => {
        try {
          await result.current.deleteBlock('Block A');
        } catch (e) {
          // Expected
        }
      });

      const state = result.current.getActionState('delete-block', 'Block A');
      expect(state.status).toBe('error');
      expect(state.error).toEqual(error);
    });
  });
});