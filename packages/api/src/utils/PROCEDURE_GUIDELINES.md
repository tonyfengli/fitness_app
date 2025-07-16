# TRPC Procedure Size Guidelines

## Overview
To maintain clean, testable, and maintainable code, TRPC procedures should be kept concise by extracting business logic into dedicated service classes.

## Guidelines

### Maximum Procedure Size
- **Target**: 10-20 lines
- **Hard limit**: 30 lines
- **Exceptions**: Only for simple CRUD operations with minimal logic

### What Belongs in Procedures
1. **Input validation** (via Zod schemas)
2. **Authentication/authorization checks**
3. **Service instantiation**
4. **Service method calls**
5. **Simple response formatting**

### What Should Be Extracted
1. **Business logic** → Service classes
2. **Database queries** → Repository/Service methods
3. **Complex transformations** → Utility functions
4. **Reusable validation** → Shared validators
5. **Error handling logic** → Service methods

## Examples

### ❌ Bad: Large Procedure
```typescript
export const workoutRouter = {
  saveWorkout: protectedProcedure
    .input(z.object({...}))
    .mutation(async ({ ctx, input }) => {
      // 100+ lines of business logic
      // Database queries
      // Complex transformations
      // Transaction handling
      // Error handling
      // ...
    })
}
```

### ✅ Good: Extracted to Service
```typescript
export const workoutRouter = {
  saveWorkout: protectedProcedure
    .input(z.object({...}))
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      const businessId = requireBusinessContext(currentUser);
      
      const workoutService = new WorkoutService(ctx.db);
      await workoutService.verifyTrainingSession(input.trainingSessionId, businessId);
      
      const client = await verifyClientInBusiness(ctx.db, input.userId, businessId);
      
      const llmWorkoutService = new LLMWorkoutService(ctx.db);
      return await llmWorkoutService.saveWorkout({
        ...input,
        businessId,
        createdByTrainerId: currentUser.id,
      }, client.name);
    })
}
```

## Service Class Structure

### Basic Service Template
```typescript
export class ExampleService {
  constructor(private db: Database) {}
  
  // Public methods for procedure use
  async performAction(input: ActionInput): Promise<ActionResult> {
    // Validation
    this.validateInput(input);
    
    // Business logic
    const processed = await this.processData(input);
    
    // Database operations
    return await this.saveToDatabase(processed);
  }
  
  // Private helper methods
  private validateInput(input: ActionInput) {
    // Complex validation logic
  }
  
  private async processData(input: ActionInput) {
    // Business logic implementation
  }
  
  private async saveToDatabase(data: ProcessedData) {
    // Database transaction handling
  }
}
```

## Benefits

1. **Testability**: Services can be unit tested independently
2. **Reusability**: Business logic can be shared across procedures
3. **Readability**: Procedures clearly show high-level flow
4. **Maintainability**: Changes isolated to service classes
5. **Type Safety**: Services provide clear interfaces

## Refactoring Checklist

When refactoring a large procedure:
1. ✅ Identify distinct responsibilities
2. ✅ Create service class(es) for business logic
3. ✅ Extract database operations to service methods
4. ✅ Keep authorization checks in procedure
5. ✅ Update imports and dependencies
6. ✅ Run tests to ensure functionality preserved
7. ✅ Document service methods if complex

## Current Examples in Codebase

### Successfully Refactored
- `exercise.filter` → `ExerciseFilterService`
- `exercise.filterForWorkoutGeneration` → `ExerciseFilterService`
- `workout.saveWorkout` → `LLMWorkoutService`
- `workout.create` → `WorkoutService`

### Services Available
- `WorkoutService`: Workout creation and validation
- `ExerciseFilterService`: AI-powered exercise filtering
- `LLMWorkoutService`: LLM workout generation and saving
- `ExerciseService`: Exercise CRUD operations