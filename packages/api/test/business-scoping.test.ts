import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCaller, createAuthenticatedContext } from './test-utils';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    query: {
      exercises: {
        findMany: vi.fn(),
      },
      businessExercise: {
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    },
    businessExercise: {
      findMany: vi.fn(),
    },
    exercise: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the AI module
vi.mock('@acme/ai', () => ({
  filterExercisesFromInput: vi.fn(),
  enhancedFilterExercisesFromInput: vi.fn(),
  saveFilterDebugData: vi.fn(),
}));

describe('Business Scoping Tests', () => {
  let caller: ReturnType<typeof createCaller>;
  
  const businessAExercises = [
    {
      id: 'be1',
      exerciseId: 'ex1',
      businessId: '123e4567-e89b-12d3-a456-426614174000',
      exercise: {
        id: 'ex1',
        name: 'Business A Squat',
        description: 'Custom squat for Business A',
        primaryMuscle: 'quads' as const,
        secondaryMuscles: ['glutes', 'hamstrings'],
        loadedJoints: ['knees', 'hips'],
        movementPattern: 'squat' as const,
        modality: 'strength' as const,
        movementTags: ['bilateral'],
        functionTags: ['primary_strength'],
        fatigueProfile: 'high_local' as const,
        complexityLevel: 'moderate' as const,
        equipment: ['barbell'],
        strengthLevel: 'moderate' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ];

  const businessBExercises = [
    {
      id: 'be2',
      exerciseId: 'ex2',
      businessId: '123e4567-e89b-12d3-a456-426614174001',
      exercise: {
        id: 'ex2',
        name: 'Business B Bench Press',
        description: 'Custom bench for Business B',
        primaryMuscle: 'chest' as const,
        secondaryMuscles: ['triceps', 'shoulders'],
        loadedJoints: ['shoulders', 'elbows'],
        movementPattern: 'horizontal_push' as const,
        modality: 'strength' as const,
        movementTags: ['bilateral'],
        functionTags: ['primary_strength'],
        fatigueProfile: 'moderate_local' as const,
        complexityLevel: 'moderate' as const,
        equipment: ['bench', 'barbell'],
        strengthLevel: 'moderate' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ];

  // Client data for future tests
  // const businessAClients = [
  //   { id: 'client1', username: 'clientA1', businessId: '123e4567-e89b-12d3-a456-426614174000', role: 'client' },
  //   { id: 'client2', username: 'clientA2', businessId: '123e4567-e89b-12d3-a456-426614174000', role: 'client' },
  // ];

  // const businessBClients = [
  //   { id: 'client3', username: 'clientB1', businessId: '123e4567-e89b-12d3-a456-426614174001', role: 'client' },
  //   { id: 'client4', username: 'clientB2', businessId: '123e4567-e89b-12d3-a456-426614174001', role: 'client' },
  // ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Exercise Filtering by Business', () => {
    it('should only return exercises for Business A when user is in Business A', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174000');
      caller = createCaller(ctx);

      // Mock database to return only Business A exercises
      ctx.db.query.exercises.findMany.mockResolvedValue(
        businessAExercises.map(be => be.exercise)
      );

      // Mock AI filter to return the exercises
      const { filterExercisesFromInput } = await import('@acme/ai');
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        userInput: '',
        programmedRoutine: '',
        exercises: businessAExercises.map(be => be.exercise),
        clientContext: {
          name: 'Test Client',
          business_id: '123e4567-e89b-12d3-a456-426614174000',
        } as any,
        filteredExercises: businessAExercises.map(be => ({
          ...be.exercise,
          isSelectedBlockA: false,
          isSelectedBlockB: false,
          isSelectedBlockC: false,
          isSelectedBlockD: false,
          score: 0,
        })),
        workoutTemplate: {} as any,
      });

      const result = await caller.exercise.filter({
        clientName: 'Test Client',
      });

      // Verify only Business A exercises are returned
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Business A Squat');
      
      // Verify businessId was passed to AI filter
      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            business_id: '123e4567-e89b-12d3-a456-426614174000',
          }),
        })
      );
    });

    it('should not return Business A exercises to Business B users', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      caller = createCaller(ctx);

      // Mock database to return only Business B exercises
      ctx.db.query.exercises.findMany.mockResolvedValue(
        businessBExercises.map(be => be.exercise)
      );

      // Mock AI filter
      const { filterExercisesFromInput } = await import('@acme/ai');
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        userInput: '',
        programmedRoutine: '',
        exercises: businessBExercises.map(be => be.exercise),
        clientContext: {
          name: 'Test Client',
          business_id: '123e4567-e89b-12d3-a456-426614174001',
        } as any,
        filteredExercises: businessBExercises.map(be => ({
          ...be.exercise,
          isSelectedBlockA: false,
          isSelectedBlockB: false,
          isSelectedBlockC: false,
          isSelectedBlockD: false,
          score: 0,
        })),
        workoutTemplate: {} as any,
      });

      const result = await caller.exercise.filter({
        clientName: 'Test Client',
      });

      // Verify only Business B exercises are returned
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Business B Bench Press');
      
      // Verify no Business A exercises are included
      expect(result.find(ex => ex.name.includes('Business A'))).toBeUndefined();
      
      // Verify businessId was passed to AI filter
      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            business_id: '123e4567-e89b-12d3-a456-426614174001',
          }),
        })
      );
    });
  });

  describe('Client Data Scoping', () => {
    it('should prevent cross-business data access', async () => {
      // User from Business A trying to access data
      const ctxA = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174000');
      const callerA = createCaller(ctxA);

      // User from Business B trying to access data
      const ctxB = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      const callerB = createCaller(ctxB);

      // Mock database responses for Business A
      ctxA.db.query.exercises.findMany.mockResolvedValue(
        businessAExercises.map(be => be.exercise)
      );
      
      // Mock database responses for Business B
      ctxB.db.query.exercises.findMany.mockResolvedValue(
        businessBExercises.map(be => be.exercise)
      );

      // Mock AI filter - return appropriate exercises for each call
      const { filterExercisesFromInput } = await import('@acme/ai');
      let callCount = 0;
      vi.mocked(filterExercisesFromInput).mockImplementation(async () => {
        callCount++;
        // First call is from Business A, second from Business B
        const exercises = callCount === 1 ? businessAExercises : businessBExercises;
        return {
          userInput: '',
          programmedRoutine: '',
          exercises: exercises.map((be: any) => be.exercise),
          clientContext: {
            name: 'Test Client',
            business_id: callCount === 1 ? 'business-A' : 'business-B',
          } as any,
          filteredExercises: exercises.map((be: any) => ({
            ...be.exercise,
            isSelectedBlockA: false,
            isSelectedBlockB: false,
            isSelectedBlockC: false,
            isSelectedBlockD: false,
            score: 0,
          })),
          workoutTemplate: {} as any,
        };
      });

      // Business A user should only see Business A data
      const resultA = await callerA.exercise.filter({});
      expect(resultA.every(ex => 
        businessAExercises.some(be => be.exercise.id === ex.id)
      )).toBe(true);

      // Business B user should only see Business B data
      const resultB = await callerB.exercise.filter({});
      expect(resultB.every(ex => 
        businessBExercises.some(be => be.exercise.id === ex.id)
      )).toBe(true);

      // Ensure no cross-contamination
      expect(resultA).not.toEqual(resultB);
    });

    it('should verify exercises are properly filtered by business in AI module', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174005');
      caller = createCaller(ctx);

      // Mock database to return all exercises
      ctx.db.query.exercises.findMany.mockResolvedValue([
        ...businessAExercises.map(be => be.exercise),
        ...businessBExercises.map(be => be.exercise),
      ]);

      // Mock AI filter to verify it receives businessId
      const { filterExercisesFromInput } = await import('@acme/ai');
      vi.mocked(filterExercisesFromInput).mockImplementation(async (params) => {
        // Verify businessId is passed
        expect(params.clientContext?.business_id).toBe('123e4567-e89b-12d3-a456-426614174005');
        
        // Return empty for testing
        return {
          userInput: params.userInput || '',
          programmedRoutine: '',
          exercises: [],
          clientContext: params.clientContext || {} as any,
          filteredExercises: [],
          workoutTemplate: params.workoutTemplate || {} as any,
        };
      });

      await caller.exercise.filter({
        clientName: 'Business Specific Client',
        strengthCapacity: 'high',
        includeExercises: ['Squat'],
      });

      // Verify the call was made with correct businessId
      expect(filterExercisesFromInput).toHaveBeenCalledWith(
        expect.objectContaining({
          clientContext: expect.objectContaining({
            name: 'Business Specific Client',
            strength_capacity: 'high',
            business_id: '123e4567-e89b-12d3-a456-426614174005',
            exercise_requests: {
              include: ['Squat'],
              avoid: [],
            },
          }),
        })
      );
    });

  });
});