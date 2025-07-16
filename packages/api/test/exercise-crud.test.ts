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
  user: {
    id: 'user.id',
    name: 'user.name',
    email: 'user.email',
    businessId: 'user.businessId',
  },
  CreateBusinessSchema: {
    parse: vi.fn((data) => data),
  },
  Business: {},
  BusinessExercise: {},
  Post: {},
  CreatePostSchema: {
    parse: vi.fn((data) => data),
  },
  // Training session schemas
  TrainingSession: {},
  UserTrainingSession: {},
  Workout: {},
  WorkoutExercise: {},
  CreateTrainingSessionSchema: {
    parse: vi.fn((data) => data),
    extend: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
  CreateWorkoutSchema: {
    parse: vi.fn((data) => data),
    extend: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
  AddExercisesToWorkoutSchema: {
    parse: vi.fn((data) => data),
    extend: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
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
      // For unauthenticated users, the code uses the old query pattern
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
      // For unauthenticated users, the code uses the old query pattern
      ctx.db.query.exercises.findMany.mockResolvedValue([]);
      caller = createCaller(ctx);

      await caller.exercise.all();

      expect(ctx.db.query.exercises.findMany).toHaveBeenCalledWith({
        orderBy: { _tag: 'desc', column: 'exercises.createdAt' },
        limit: 20,
        offset: 0,
      });
    });
    
    it('should filter by business for authenticated users', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      // For authenticated users with businessId, use the new select pattern
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([{ exercise: mockExercise }])
      );
      caller = createCaller(ctx);

      const result = await caller.exercise.all({ limit: 10, offset: 0 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Barbell Squat',
        primaryMuscle: 'quads',
      });
      expect(ctx.db.select).toHaveBeenCalled();
      expect(ctx.db.selectMockChain.innerJoin).toHaveBeenCalled();
      expect(ctx.db.selectMockChain.where).toHaveBeenCalled();
    });

  });

  describe('byId', () => {
    it('should return specific exercise by ID', async () => {
      const ctx = createMockContext();
      // byId still uses the old query pattern
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
      // byId still uses the old query pattern
      ctx.db.query.exercises.findFirst.mockResolvedValue(undefined);
      caller = createCaller(ctx);

      const result = await caller.exercise.byId({ id: '123e4567-e89b-12d3-a456-426614174999' });
      expect(result).toBeUndefined();
    });

  });

  describe('search', () => {
    it('should search exercises by name', async () => {
      const ctx = createMockContext();
      // For unauthenticated users, the code uses the old query pattern
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
      // Use the new select pattern for authenticated users
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([{ exercise: mockExercise }])
      );
      
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
      // Use the new select pattern for authenticated users
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );
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

      await expect(caller.exercise.filter()).rejects.toThrow('User must be associated with a business');
    });

    it('should use enhanced filter in debug mode', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174002');
      // Use the new select pattern for authenticated users
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([{ exercise: mockExercise }])
      );
      
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
      // Mock the select chain to throw an error during database query
      ctx.db.selectMockChain.from.mockImplementation(() => {
        throw new Error('Database error');
      });
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

  describe('filterForWorkoutGeneration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const mockClient = {
      id: 'client-123',
      name: 'Test Client',
      email: 'client@test.com',
      businessId: 'business-123',
    };

    const mockFilterInput = {
      clientId: 'client-123',
      sessionGoal: 'strength' as const,
      intensity: 'moderate' as const,
      template: 'standard' as const,
      includeExercises: ['Squat'],
      avoidExercises: ['Deadlift'],
      muscleTarget: ['glutes', 'quads'],
      muscleLessen: ['lower_back'],
      avoidJoints: ['knees'],
    };

    const mockFilteredExercises = [
      {
        ...mockExercise,
        score: 5.0,
        isSelectedBlockA: true,
        isSelectedBlockB: false,
        isSelectedBlockC: false,
        isSelectedBlockD: false,
      },
      {
        id: '234e4567-e89b-12d3-a456-426614174001',
        name: 'Bench Press',
        primaryMuscle: 'chest',
        score: 3.0,
        isSelectedBlockA: false,
        isSelectedBlockB: true,
        isSelectedBlockC: false,
        isSelectedBlockD: false,
      },
    ];

    it('should filter exercises for workout generation with valid inputs', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      // Mock client lookup
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue(mockClient),
      };

      // Mock business exercises - ensure select returns the mock chain
      const businessExercisesData = mockFilteredExercises.map(ex => ({ 
        exercise: ex 
      }));
      // Important: The then method should be called with a callback, not mockResolvedValue
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve(businessExercisesData)
      );

      // Mock AI filter response
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: mockFilteredExercises,
        userInput: '',
        programmedRoutine: '',
        exercises: [],
        clientContext: {} as any,
        workoutTemplate: {} as any,
      });

      caller = createCaller(ctx);
      const result = await caller.exercise.filterForWorkoutGeneration(mockFilterInput);

      expect(result).toBeDefined();
      expect(result.exercises).toHaveLength(2);
      expect(result.blocks).toBeDefined();
      expect(result.blocks.blockA).toHaveLength(1);
      expect(result.blocks.blockB).toHaveLength(1);
      expect(result.blocks.blockC).toHaveLength(0);
      expect(result.blocks.blockD).toHaveLength(0);
      expect(result.timing).toHaveProperty('database');
      expect(result.timing).toHaveProperty('filtering');
      expect(result.timing).toHaveProperty('total');

      // Verify filterExercisesFromInput was called with correct params
      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            user_id: 'client-123',
            name: 'Test Client',
            strength_capacity: 'moderate',
            skill_capacity: 'moderate',
            primary_goal: 'strength',
            muscle_target: ['glutes', 'quads'],
            muscle_lessen: ['lower_back'],
            exercise_requests: {
              include: ['Squat'],
              avoid: ['Deadlift'],
            },
            avoid_joints: ['knees'],
            business_id: 'business-123',
            templateType: 'standard',
          }),
          intensity: 'moderate',
          exercises: expect.any(Array),
          workoutTemplate: expect.objectContaining({
            workout_goal: 'mixed_focus',
            muscle_target: ['glutes', 'quads'],
            isFullBody: false,
          }),
        })
      );
    });

    it('should reject requests without authentication', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(
        caller.exercise.filterForWorkoutGeneration(mockFilterInput)
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if user has no businessId', async () => {
      const ctx = createAuthenticatedContext('trainer', null);
      caller = createCaller(ctx);

      await expect(
        caller.exercise.filterForWorkoutGeneration(mockFilterInput)
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'User must be associated with a business',
      });
    });

    it('should reject if client is not in the same business', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      // Mock client with different business
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue({
          ...mockClient,
          businessId: 'different-business',
        }),
      };

      caller = createCaller(ctx);

      await expect(
        caller.exercise.filterForWorkoutGeneration(mockFilterInput)
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Client not found in your business',
      });
    });

    it('should handle different session goals correctly', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue(mockClient),
      };
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: [],
        userInput: '',
        programmedRoutine: '',
        exercises: [],
        clientContext: {} as any,
        workoutTemplate: {} as any,
      });

      caller = createCaller(ctx);

      // Test strength goal
      await caller.exercise.filterForWorkoutGeneration({
        ...mockFilterInput,
        sessionGoal: 'strength',
      });

      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            primary_goal: 'strength',
          }),
        })
      );

      // Test stability goal
      await caller.exercise.filterForWorkoutGeneration({
        ...mockFilterInput,
        sessionGoal: 'stability',
      });

      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            primary_goal: 'mobility',
          }),
        })
      );
    });

    it('should handle different templates correctly', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue(mockClient),
      };
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: [],
        userInput: '',
        programmedRoutine: '',
        exercises: [],
        clientContext: {} as any,
        workoutTemplate: {} as any,
      });

      caller = createCaller(ctx);

      // Test full_body template
      await caller.exercise.filterForWorkoutGeneration({
        ...mockFilterInput,
        template: 'full_body',
      });

      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            templateType: 'full_body',
          }),
          workoutTemplate: expect.objectContaining({
            isFullBody: true,
          }),
        })
      );

      // Test standard template
      await caller.exercise.filterForWorkoutGeneration({
        ...mockFilterInput,
        template: 'standard',
      });

      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            templateType: 'standard',
          }),
          workoutTemplate: expect.objectContaining({
            isFullBody: false,
          }),
        })
      );
    });

    it('should handle empty filter results gracefully', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue(mockClient),
      };
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );
      
      // Mock empty filter response
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: [],
        userInput: '',
        programmedRoutine: '',
        exercises: [],
        clientContext: {} as any,
        workoutTemplate: {} as any,
      });

      caller = createCaller(ctx);
      const result = await caller.exercise.filterForWorkoutGeneration(mockFilterInput);

      expect(result.exercises).toHaveLength(0);
      expect(result.blocks.blockA).toHaveLength(0);
      expect(result.blocks.blockB).toHaveLength(0);
      expect(result.blocks.blockC).toHaveLength(0);
      expect(result.blocks.blockD).toHaveLength(0);
    });

    it('should handle filter errors gracefully', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue(mockClient),
      };
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );
      
      // Mock filter error
      vi.mocked(filterExercisesFromInput).mockRejectedValue(
        new Error('Filtering failed')
      );

      caller = createCaller(ctx);

      await expect(
        caller.exercise.filterForWorkoutGeneration(mockFilterInput)
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to filter exercises',
      });
    });

    it('should include all exercise preference arrays in the filter call', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue(mockClient),
      };
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: [],
        userInput: '',
        programmedRoutine: '',
        exercises: [],
        clientContext: {} as any,
        workoutTemplate: {} as any,
      });

      caller = createCaller(ctx);

      const detailedInput = {
        ...mockFilterInput,
        includeExercises: ['Squat', 'Bench Press', 'Pull-up'],
        avoidExercises: ['Deadlift', 'Overhead Press'],
        muscleTarget: ['glutes', 'quads', 'chest'],
        muscleLessen: ['lower_back', 'shoulders'],
        avoidJoints: ['knees', 'shoulders', 'wrists'],
      };

      await caller.exercise.filterForWorkoutGeneration(detailedInput);

      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            muscle_target: ['glutes', 'quads', 'chest'],
            muscle_lessen: ['lower_back', 'shoulders'],
            exercise_requests: {
              include: ['Squat', 'Bench Press', 'Pull-up'],
              avoid: ['Deadlift', 'Overhead Press'],
            },
            avoid_joints: ['knees', 'shoulders', 'wrists'],
          }),
        })
      );
    });
  });
});