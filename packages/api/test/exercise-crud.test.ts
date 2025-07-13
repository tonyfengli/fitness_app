import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from './test-utils';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    query: {
      exercises: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock the DB functions
vi.mock('@acme/db', () => ({
  desc: vi.fn((column) => ({ _tag: 'desc', column })),
  eq: vi.fn((column, value) => ({ _tag: 'eq', column, value })),
  ilike: vi.fn((column, value) => ({ _tag: 'ilike', column, value })),
  and: vi.fn((...conditions) => ({ _tag: 'and', conditions })),
  inArray: vi.fn((column, values) => ({ _tag: 'inArray', column, values })),
}));

// Mock the schema
vi.mock('@acme/db/schema', () => ({
  exercises: {
    id: 'exercises.id',
    name: 'exercises.name',
    createdAt: 'exercises.createdAt',
    primaryMuscle: 'exercises.primaryMuscle',
    movementPattern: 'exercises.movementPattern',
    modality: 'exercises.modality',
  },
  CreateBusinessSchema: {
    parse: vi.fn((data) => data),
  },
  Business: {},
  Post: {},
  CreatePostSchema: {
    parse: vi.fn((data) => data),
  },
}));

// Mock the AI module
vi.mock('@acme/ai', () => ({
  filterExercisesFromInput: vi.fn(),
  enhancedFilterExercisesFromInput: vi.fn(),
  saveFilterDebugData: vi.fn(),
}));

// Using ctx.db from mocks instead of importing
import { filterExercisesFromInput, enhancedFilterExercisesFromInput } from '@acme/ai';

describe('Exercise Router CRUD Tests', () => {
  let caller: ReturnType<typeof createCaller>;

  const mockExercise = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Barbell Squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    loadedJoints: ['knees', 'hips'],
    movementPattern: 'squat',
    modality: 'strength',
    movementTags: ['bilateral', 'foundational'],
    functionTags: ['primary_strength'],
    fatigueProfile: 'high_local',
    complexityLevel: 'moderate',
    equipment: ['barbell'],
    strengthLevel: 'high',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('all', () => {
    it('should return paginated exercises', async () => {
      const ctx = createMockContext();
      // Ensure exercises query is set up
      if (!ctx.db.query.exercises) {
        ctx.db.query.exercises = { findMany: vi.fn(), findFirst: vi.fn() };
      }
      ctx.db.query.exercises.findMany.mockResolvedValue([mockExercise]);
      caller = createCaller(ctx);

      const result = await caller.exercise.all({ limit: 10, offset: 0 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Barbell Squat',
        primaryMuscle: 'quads',
      });
      expect(ctx.db.query.exercises.findMany).toHaveBeenCalledWith({
        orderBy: { _tag: 'desc', column: 'exercises.createdAt' },
        limit: 10,
        offset: 0,
      });
    });

    it('should use default pagination values', async () => {
      const ctx = createMockContext();
      // Ensure exercises query is set up
      if (!ctx.db.query.exercises) {
        ctx.db.query.exercises = { findMany: vi.fn(), findFirst: vi.fn() };
      }
      ctx.db.query.exercises.findMany.mockResolvedValue([]);
      caller = createCaller(ctx);

      await caller.exercise.all();

      expect(ctx.db.query.exercises.findMany).toHaveBeenCalledWith({
        orderBy: { _tag: 'desc', column: 'exercises.createdAt' },
        limit: 20,
        offset: 0,
      });
    });

  });

  describe('byId', () => {
    it('should return specific exercise by ID', async () => {
      const ctx = createMockContext();
      // Ensure exercises query is set up
      if (!ctx.db.query.exercises) {
        ctx.db.query.exercises = { findMany: vi.fn(), findFirst: vi.fn() };
      }
      ctx.db.query.exercises.findFirst.mockResolvedValue(mockExercise);
      caller = createCaller(ctx);

      const result = await caller.exercise.byId({ id: '123e4567-e89b-12d3-a456-426614174000' });

      expect(result).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Barbell Squat',
      });
    });

    it('should return undefined for non-existent exercise', async () => {
      const ctx = createMockContext();
      // Ensure exercises query is set up
      if (!ctx.db.query.exercises) {
        ctx.db.query.exercises = { findMany: vi.fn(), findFirst: vi.fn() };
      }
      ctx.db.query.exercises.findFirst.mockResolvedValue(undefined);
      caller = createCaller(ctx);

      const result = await caller.exercise.byId({ id: '123e4567-e89b-12d3-a456-426614174999' });
      expect(result).toBeUndefined();
    });

  });

  describe('search', () => {
    it('should search exercises by name', async () => {
      const ctx = createMockContext();
      // Ensure exercises query is set up
      if (!ctx.db.query.exercises) {
        ctx.db.query.exercises = { findMany: vi.fn(), findFirst: vi.fn() };
      }
      ctx.db.query.exercises.findMany.mockResolvedValue([mockExercise]);
      caller = createCaller(ctx);

      const result = await caller.exercise.search({ query: 'squat' });

      expect(result).toHaveLength(1);
      expect(ctx.db.query.exercises.findMany).toHaveBeenCalledWith({
        where: { _tag: 'and', conditions: [{ _tag: 'ilike', column: 'exercises.name', value: '%squat%' }] },
        orderBy: { _tag: 'desc', column: 'exercises.createdAt' },
        limit: 20,
      });
    });

    it('should filter by primary muscle', async () => {
      const ctx = createMockContext();
      ctx.db.query.exercises.findMany.mockResolvedValue([mockExercise]);
      caller = createCaller(ctx);

      const result = await caller.exercise.search({ primaryMuscle: 'quads' });

      expect(result).toHaveLength(1);
      expect(result[0].primaryMuscle).toBe('quads');
    });

    it('should combine multiple filters', async () => {
      const ctx = createMockContext();
      ctx.db.query.exercises.findMany.mockResolvedValue([mockExercise]);
      caller = createCaller(ctx);

      const result = await caller.exercise.search({
        query: 'squat',
        primaryMuscle: 'quads',
        movementPattern: 'squat',
        modality: 'strength',
      });

      expect(result).toHaveLength(1);
    });

  });

  describe('filter', () => {
    it('should filter exercises based on client profile', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174002');
      ctx.db.query.exercises.findMany.mockResolvedValue([mockExercise]);
      
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        userInput: '',
        programmedRoutine: '',
        exercises: [mockExercise],
        clientContext: {
          name: 'Test Client',
          strength_capacity: 'moderate',
          skill_capacity: 'moderate',
          business_id: '123e4567-e89b-12d3-a456-426614174002',
        } as any,
        filteredExercises: [{
          ...mockExercise,
          isSelectedBlockA: true,
          isSelectedBlockB: false,
          isSelectedBlockC: false,
          isSelectedBlockD: false,
          score: 85,
        }],
        workoutTemplate: {
          isFullBody: false,
        } as any,
      });
      
      caller = createCaller(ctx);

      const result = await caller.exercise.filter({
        clientName: 'Test Client',
        strengthCapacity: 'moderate',
        skillCapacity: 'moderate',
      });

      expect(result).toHaveLength(1);
      expect(filterExercisesFromInput).toHaveBeenCalledWith({
        clientContext: expect.objectContaining({
          name: 'Test Client',
          strength_capacity: 'moderate',
          skill_capacity: 'moderate',
          business_id: '123e4567-e89b-12d3-a456-426614174002',
        }),
        exercises: [mockExercise],
        intensity: undefined,
        enableDebug: false,
        workoutTemplate: expect.any(Object),
      });
    });

    it('should use businessId from session', async () => {
      const ctx = createAuthenticatedContext('client', '123e4567-e89b-12d3-a456-426614174007');
      ctx.db.query.exercises.findMany.mockResolvedValue([]);
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        userInput: '',
        programmedRoutine: '',
        exercises: [],
        clientContext: {
          business_id: '123e4567-e89b-12d3-a456-426614174007',
        } as any,
        filteredExercises: [],
        workoutTemplate: {} as any,
      });
      caller = createCaller(ctx);

      await caller.exercise.filter();

      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            business_id: '123e4567-e89b-12d3-a456-426614174007',
          }),
        })
      );
    });

    it('should throw error if user has no businessId', async () => {
      const ctx = createAuthenticatedContext('trainer', null);
      caller = createCaller(ctx);

      await expect(caller.exercise.filter()).rejects.toThrow('Failed to filter exercises');
    });

    it('should use enhanced filter in debug mode', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174002');
      ctx.db.query.exercises.findMany.mockResolvedValue([mockExercise]);
      
      vi.mocked(enhancedFilterExercisesFromInput).mockResolvedValue({
        userInput: '',
        programmedRoutine: '',
        exercises: [mockExercise],
        clientContext: {
          business_id: '123e4567-e89b-12d3-a456-426614174002',
        } as any,
        filteredExercises: [{
          ...mockExercise,
          isSelectedBlockA: true,
          isSelectedBlockB: false,
          isSelectedBlockC: false,
          isSelectedBlockD: false,
          score: 90,
        }],
        workoutTemplate: {} as any,
      });
      
      caller = createCaller(ctx);

      await caller.exercise.filter({ debug: true });

      expect(enhancedFilterExercisesFromInput).toHaveBeenCalled();
      expect(filterExercisesFromInput).not.toHaveBeenCalled();
    });

    it('should handle filter errors gracefully', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174002');
      ctx.db.query.exercises.findMany.mockRejectedValue(new Error('Database error'));
      caller = createCaller(ctx);

      await expect(caller.exercise.filter()).rejects.toThrow('Failed to filter exercises');
    });
  });

  describe('create', () => {
    it('should create new exercise', async () => {
      const ctx = createAuthenticatedContext('trainer');
      const newExercise = {
        name: 'Deadlift',
        primaryMuscle: 'hamstrings' as const,
        movementPattern: 'hinge' as const,
        modality: 'strength' as const,
        fatigueProfile: 'high_systemic' as const,
        complexityLevel: 'high' as const,
        strengthLevel: 'high' as const,
      };

      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-id', ...newExercise }]),
        }),
      });
      caller = createCaller(ctx);

      const result = await caller.exercise.create(newExercise);

      expect(result).toEqual([{
        id: 'new-id',
        ...newExercise,
      }]);
    });

    it('should require authentication', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(caller.exercise.create({
        name: 'Unauthorized Exercise',
        primaryMuscle: 'chest' as const,
        movementPattern: 'horizontal_push' as const,
        modality: 'strength' as const,
        fatigueProfile: 'moderate_local' as const,
        complexityLevel: 'low' as const,
        strengthLevel: 'moderate' as const,
      })).rejects.toThrow(TRPCError);
    });

    it('should validate required fields', async () => {
      const ctx = createAuthenticatedContext('trainer');
      caller = createCaller(ctx);

      await expect(caller.exercise.create({
        // Missing required fields
        name: 'Incomplete Exercise',
      } as any)).rejects.toThrow();
    });

  });

  describe('update', () => {
    it('should update existing exercise', async () => {
      const ctx = createAuthenticatedContext('trainer');
      const updates = { name: 'Updated Squat' };

      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockExercise, ...updates }]),
          }),
        }),
      });
      caller = createCaller(ctx);

      const result = await caller.exercise.update({
        id: '123e4567-e89b-12d3-a456-426614174000',
        data: updates,
      });

      expect(result).toEqual([{
        ...mockExercise,
        name: 'Updated Squat',
      }]);
    });

    it('should allow partial updates', async () => {
      const ctx = createAuthenticatedContext('trainer');
      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockExercise]),
          }),
        }),
      });
      caller = createCaller(ctx);

      const result = await caller.exercise.update({
        id: '123e4567-e89b-12d3-a456-426614174000',
        data: { primaryMuscle: 'glutes' as const },
      });

      expect(result).toBeDefined();
    });


    it('should require authentication', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(caller.exercise.update({
        id: '123e4567-e89b-12d3-a456-426614174000',
        data: { name: 'Unauthorized Update' },
      })).rejects.toThrow(TRPCError);
    });
  });

  describe('delete', () => {
    it('should delete exercise by ID', async () => {
      const ctx = createAuthenticatedContext('trainer');
      ctx.db.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      caller = createCaller(ctx);

      await expect(caller.exercise.delete('123e4567-e89b-12d3-a456-426614174000')).resolves.toBeUndefined();
      expect(ctx.db.delete).toHaveBeenCalled();
    });


    it('should require authentication', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(
        caller.exercise.delete('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow(TRPCError);
    });

  });
});