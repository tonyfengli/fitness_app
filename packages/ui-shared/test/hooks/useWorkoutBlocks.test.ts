import { describe, it, expect } from 'vitest';
import { useWorkoutBlocks } from '../../src/hooks/useWorkoutBlocks';
import { createMockWorkout, createMockWorkoutExercise, renderHookWithWrapper } from '../test-utils';

describe('useWorkoutBlocks', () => {
  it('should return empty array for undefined workout', () => {
    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(undefined));
    
    expect(result.current.blocks).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.hasMultipleBlocks).toBe(false);
  });

  it('should return empty array for workout with no exercises', () => {
    const workout = createMockWorkout({ exercises: [] });
    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
    
    expect(result.current.blocks).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });

  it('should group exercises by block name', () => {
    const workout = createMockWorkout({
      exercises: [
        createMockWorkoutExercise({ id: 'we-1', groupName: 'Block A', orderIndex: 1 }),
        createMockWorkoutExercise({ id: 'we-2', groupName: 'Block B', orderIndex: 2 }),
        createMockWorkoutExercise({ id: 'we-3', groupName: 'Block A', orderIndex: 3 }),
      ],
    });

    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
    
    expect(result.current.blocks).toHaveLength(2);
    expect(result.current.blocks[0].name).toBe('Block A');
    expect(result.current.blocks[0].exercises).toHaveLength(2);
    expect(result.current.blocks[1].name).toBe('Block B');
    expect(result.current.blocks[1].exercises).toHaveLength(1);
  });

  it('should sort exercises within blocks by orderIndex', () => {
    const workout = createMockWorkout({
      exercises: [
        createMockWorkoutExercise({ id: 'we-1', groupName: 'Block A', orderIndex: 3 }),
        createMockWorkoutExercise({ id: 'we-2', groupName: 'Block A', orderIndex: 1 }),
        createMockWorkoutExercise({ id: 'we-3', groupName: 'Block A', orderIndex: 2 }),
      ],
    });

    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
    
    const blockA = result.current.blocks[0];
    expect(blockA.exercises[0].orderIndex).toBe(1);
    expect(blockA.exercises[1].orderIndex).toBe(2);
    expect(blockA.exercises[2].orderIndex).toBe(3);
  });

  it('should calculate total sets per block', () => {
    const workout = createMockWorkout({
      exercises: [
        createMockWorkoutExercise({ groupName: 'Block A', setsCompleted: 3 }),
        createMockWorkoutExercise({ groupName: 'Block A', setsCompleted: 4 }),
        createMockWorkoutExercise({ groupName: 'Block B', setsCompleted: 5 }),
      ],
    });

    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
    
    expect(result.current.blocks[0].totalSets).toBe(7); // Block A: 3 + 4
    expect(result.current.blocks[1].totalSets).toBe(5); // Block B: 5
  });

  it('should set canDelete false for single block', () => {
    const workout = createMockWorkout({
      exercises: [
        createMockWorkoutExercise({ groupName: 'Block A' }),
        createMockWorkoutExercise({ groupName: 'Block A' }),
      ],
    });

    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
    
    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.blocks[0].canDelete).toBe(false);
    expect(result.current.hasMultipleBlocks).toBe(false);
  });

  it('should set canDelete true for multiple blocks', () => {
    const workout = createMockWorkout(); // Default has Block A and Block B
    const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
    
    expect(result.current.hasMultipleBlocks).toBe(true);
    expect(result.current.blocks[0].canDelete).toBe(true);
    expect(result.current.blocks[1].canDelete).toBe(true);
  });

  describe('availableBlockNames', () => {
    it('should include existing blocks and next available', () => {
      const workout = createMockWorkout({
        exercises: [
          createMockWorkoutExercise({ groupName: 'Block A' }),
          createMockWorkoutExercise({ groupName: 'Block B' }),
        ],
      });

      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      expect(result.current.availableBlockNames).toEqual(['Block A', 'Block B', 'Block C']);
    });

    it('should handle non-sequential blocks', () => {
      const workout = createMockWorkout({
        exercises: [
          createMockWorkoutExercise({ groupName: 'Block A' }),
          createMockWorkoutExercise({ groupName: 'Block C' }),
        ],
      });

      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      // Should include existing blocks and the next available one (Block B)
      expect(result.current.availableBlockNames).toEqual(['Block A', 'Block C', 'Block B']);
    });
  });

  describe('nextBlockName', () => {
    it('should return Block A for empty workout', () => {
      const workout = createMockWorkout({ exercises: [] });
      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      expect(result.current.nextBlockName).toBe('Block A');
    });

    it('should return next available block', () => {
      const workout = createMockWorkout({
        exercises: [
          createMockWorkoutExercise({ groupName: 'Block A' }),
          createMockWorkoutExercise({ groupName: 'Block B' }),
        ],
      });

      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      expect(result.current.nextBlockName).toBe('Block C');
    });

    it('should generate new block name when standard names exhausted', () => {
      const workout = createMockWorkout({
        exercises: [
          createMockWorkoutExercise({ groupName: 'Block A' }),
          createMockWorkoutExercise({ groupName: 'Block B' }),
          createMockWorkoutExercise({ groupName: 'Block C' }),
          createMockWorkoutExercise({ groupName: 'Block D' }),
          createMockWorkoutExercise({ groupName: 'Block E' }),
        ],
      });

      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      expect(result.current.nextBlockName).toBe('Block F');
    });
  });

  describe('workoutStats', () => {
    it('should calculate workout statistics', () => {
      const workout = createMockWorkout({
        exercises: [
          createMockWorkoutExercise({ 
            setsCompleted: 3,
            exercise: {
              id: '1',
              name: 'Bench Press',
              primaryMuscle: 'chest',
              secondaryMuscles: ['triceps'],
              equipment: ['barbell'],
              movementPattern: 'horizontal_push',
              modality: 'strength',
            },
          }),
          createMockWorkoutExercise({ 
            setsCompleted: 4,
            exercise: {
              id: '2',
              name: 'Squat',
              primaryMuscle: 'quads',
              secondaryMuscles: ['glutes'],
              equipment: ['barbell'],
              movementPattern: 'squat',
              modality: 'strength',
            },
          }),
          createMockWorkoutExercise({ 
            setsCompleted: 3,
            groupName: 'Block B',
            exercise: {
              id: '3',
              name: 'Pull-up',
              primaryMuscle: 'lats',
              equipment: ['pull-up bar'],
              movementPattern: 'vertical_pull',
              modality: 'strength',
            },
          }),
        ],
      });

      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      expect(result.current.workoutStats.totalExercises).toBe(3);
      expect(result.current.workoutStats.totalSets).toBe(10);
      expect(result.current.workoutStats.totalBlocks).toBe(2);
      expect(result.current.workoutStats.muscleGroups).toContain('chest');
      expect(result.current.workoutStats.muscleGroups).toContain('triceps');
      expect(result.current.workoutStats.muscleGroups).toContain('quads');
      expect(result.current.workoutStats.equipment).toContain('barbell');
      expect(result.current.workoutStats.equipment).toContain('pull-up bar');
    });
  });

  describe('canReorderExercise', () => {
    it('should allow reordering within block boundaries', () => {
      const workout = createMockWorkout({
        exercises: [
          createMockWorkoutExercise({ id: 'we-1', groupName: 'Block A', orderIndex: 1 }),
          createMockWorkoutExercise({ id: 'we-2', groupName: 'Block A', orderIndex: 2 }),
          createMockWorkoutExercise({ id: 'we-3', groupName: 'Block A', orderIndex: 3 }),
        ],
      });

      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      // First exercise can't move up
      expect(result.current.canReorderExercise('we-1', 'up')).toBe(false);
      expect(result.current.canReorderExercise('we-1', 'down')).toBe(true);
      
      // Middle exercise can move both ways
      expect(result.current.canReorderExercise('we-2', 'up')).toBe(true);
      expect(result.current.canReorderExercise('we-2', 'down')).toBe(true);
      
      // Last exercise can't move down
      expect(result.current.canReorderExercise('we-3', 'up')).toBe(true);
      expect(result.current.canReorderExercise('we-3', 'down')).toBe(false);
    });

    it('should return false for non-existent exercise', () => {
      const workout = createMockWorkout();
      const { result } = renderHookWithWrapper(() => useWorkoutBlocks(workout));
      
      expect(result.current.canReorderExercise('non-existent', 'up')).toBe(false);
      expect(result.current.canReorderExercise('non-existent', 'down')).toBe(false);
    });
  });
});