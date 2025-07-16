import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useExerciseSelection } from '../../src/hooks/useExerciseSelection';
import { createMockApi, createMockExercise, renderHookWithWrapper } from '../test-utils';

describe('useExerciseSelection', () => {
  let mockApi: ReturnType<typeof createMockApi>['mockApi'];
  
  const mockExercises = [
    createMockExercise({ 
      id: '1', 
      name: 'Bench Press',
      primaryMuscle: 'chest',
      equipment: ['barbell'],
      modality: 'strength'
    }),
    createMockExercise({ 
      id: '2', 
      name: 'Dumbbell Press',
      primaryMuscle: 'chest',
      equipment: ['dumbbell'],
      modality: 'strength'
    }),
    createMockExercise({ 
      id: '3', 
      name: 'Squat',
      primaryMuscle: 'quads',
      equipment: ['barbell'],
      modality: 'strength'
    }),
    createMockExercise({ 
      id: '4', 
      name: 'Push-ups',
      primaryMuscle: 'chest',
      equipment: [],
      modality: 'strength'
    }),
    createMockExercise({ 
      id: '5', 
      name: 'Running',
      primaryMuscle: 'quads',
      equipment: [],
      modality: 'conditioning'
    }),
  ];

  beforeEach(() => {
    const mocks = createMockApi();
    mockApi = mocks.mockApi;
    mockApi.exercise.list.useQuery.mockReturnValue({ 
      data: mockExercises, 
      isLoading: false 
    });
  });

  it('should return all exercises when no filters applied', () => {
    const { result } = renderHookWithWrapper(() => 
      useExerciseSelection(mockApi)
    );

    expect(result.current.exercises).toHaveLength(5);
    expect(result.current.totalCount).toBe(5);
    expect(result.current.filteredCount).toBe(5);
  });

  describe('search functionality', () => {
    it('should filter exercises by name', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      act(() => {
        result.current.setSearchQuery('press');
      });

      expect(result.current.exercises).toHaveLength(2);
      expect(result.current.exercises.map(e => e.name)).toContain('Bench Press');
      expect(result.current.exercises.map(e => e.name)).toContain('Dumbbell Press');
    });

    it('should filter exercises by muscle', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      act(() => {
        result.current.setSearchQuery('chest');
      });

      expect(result.current.exercises).toHaveLength(3);
      expect(result.current.exercises.every(e => e.primaryMuscle === 'chest')).toBe(true);
    });

    it('should filter exercises by equipment', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      act(() => {
        result.current.setSearchQuery('barbell');
      });

      expect(result.current.exercises).toHaveLength(2);
      expect(result.current.exercises.map(e => e.name)).toContain('Bench Press');
      expect(result.current.exercises.map(e => e.name)).toContain('Squat');
    });
  });

  describe('filter options', () => {
    it('should filter by equipment array', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi, {
          filterByEquipment: ['barbell']
        })
      );

      expect(result.current.exercises).toHaveLength(2);
      expect(result.current.exercises.every(e => e.equipment?.includes('barbell'))).toBe(true);
    });

    it('should filter by muscle array', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi, {
          filterByMuscle: ['quads']
        })
      );

      expect(result.current.exercises).toHaveLength(2);
      expect(result.current.exercises.map(e => e.name)).toContain('Squat');
      expect(result.current.exercises.map(e => e.name)).toContain('Running');
    });

    it('should filter by modality array', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi, {
          filterByModality: ['conditioning']
        })
      );

      expect(result.current.exercises).toHaveLength(1);
      expect(result.current.exercises[0].name).toBe('Running');
    });

    it('should apply multiple filters', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi, {
          filterByMuscle: ['chest'],
          filterByEquipment: ['barbell']
        })
      );

      expect(result.current.exercises).toHaveLength(1);
      expect(result.current.exercises[0].name).toBe('Bench Press');
    });
  });

  describe('grouping', () => {
    it('should group exercises by muscle', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      expect(result.current.exercisesByMuscle).toBeDefined();
      expect(result.current.exercisesByMuscle['chest']).toHaveLength(3);
      expect(result.current.exercisesByMuscle['quads']).toHaveLength(2);
    });

    it('should group exercises by equipment', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      expect(result.current.exercisesByEquipment).toBeDefined();
      expect(result.current.exercisesByEquipment['barbell']).toHaveLength(2);
      expect(result.current.exercisesByEquipment['dumbbell']).toHaveLength(1);
      // Check if bodyweight key exists (exercises with empty equipment array)
      expect(result.current.exercisesByEquipment['bodyweight']).toBeDefined();
      expect(result.current.exercisesByEquipment['bodyweight']).toHaveLength(2); // Push-ups and Running
    });
  });

  describe('selection', () => {
    it('should select exercise and call onSelect callback', () => {
      const onSelect = vi.fn();
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi, { onSelect })
      );

      const exercise = mockExercises[0];
      act(() => {
        result.current.selectExercise(exercise);
      });

      expect(result.current.selectedExercise).toEqual(exercise);
      expect(onSelect).toHaveBeenCalledWith(exercise);
    });

    it('should clear selection', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      // Select an exercise first
      act(() => {
        result.current.selectExercise(mockExercises[0]);
      });
      expect(result.current.selectedExercise).toBeDefined();

      // Clear selection
      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectedExercise).toBeNull();
    });
  });

  describe('similar exercises', () => {
    it('should find similar exercises by muscle', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      // Select Bench Press
      act(() => {
        result.current.selectExercise(mockExercises[0]);
      });

      // Should find similar exercises (based on muscle, movement pattern, or equipment)
      // The algorithm finds exercises with same muscle, movement pattern, or equipment
      // So it may find more than just the 2 other chest exercises
      const similarNames = result.current.similarExercises.map(e => e.name);
      expect(result.current.similarExercises.length).toBeGreaterThan(0);
      expect(result.current.similarExercises.length).toBeLessThanOrEqual(5); // Limited to 5
      // Should include at least one other chest exercise
      expect(
        similarNames.includes('Dumbbell Press') || 
        similarNames.includes('Push-ups')
      ).toBe(true);
    });

    it('should not include selected exercise in similar list', () => {
      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      const selected = mockExercises[0];
      act(() => {
        result.current.selectExercise(selected);
      });

      expect(result.current.similarExercises.every(e => e.id !== selected.id)).toBe(true);
    });

    it('should limit similar exercises to 5', () => {
      // Create many similar exercises
      const manyExercises = Array.from({ length: 10 }, (_, i) => 
        createMockExercise({ 
          id: `${i}`, 
          name: `Exercise ${i}`,
          primaryMuscle: 'chest'
        })
      );
      
      mockApi.exercise.list.useQuery.mockReturnValue({ 
        data: manyExercises as any, 
        isLoading: false 
      });

      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      act(() => {
        result.current.selectExercise(manyExercises[0]);
      });

      expect(result.current.similarExercises).toHaveLength(5);
    });
  });

  describe('loading state', () => {
    it('should return loading state from query', () => {
      mockApi.exercise.list.useQuery.mockReturnValue({ 
        data: undefined, 
        isLoading: true 
      });

      const { result } = renderHookWithWrapper(() => 
        useExerciseSelection(mockApi)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.exercises).toEqual([]);
    });
  });
});