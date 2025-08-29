# Circuit Training Architecture Proposal

## Current State

The circuit template currently uses the standard two-phase LLM generation flow:

```typescript
// packages/ai/src/core/templates/config/templates/circuit.ts
export const circuitTemplate: WorkoutTemplate = {
  id: 'circuit',
  name: 'Circuit Training',
  description: 'Time-based circuit workout with configurable work/rest intervals',
  useTwoPhaseGeneration: true, // Uses standard flow
  
  metadata: {
    llmStrategy: "two-phase" as const,
  },
  
  blocks: [
    {
      id: 'Round1',
      name: 'Round 1',
      functionTags: [],
      maxExercises: 8,
      candidateCount: 15,
      selectionStrategy: "randomized" as const,
    }
  ]
}
```

## Proposed Circuit Flow

Based on your requirements, the circuit flow should be:
1. Start with all exercises in circuit template
2. Filter down to 20-30 exercises using deterministic logic
3. Pass those exercises to LLM in a single phase

This aligns perfectly with the BMF single-phase approach!

## Architecture Options

### Option A: Reuse Standard Two-Phase Flow (Current)

**Advantages:**
- Minimal code changes required
- Leverages existing exercise selection and round organization logic
- Already partially implemented

**Disadvantages:**
- Standard flow assumes strength/metabolic split which doesn't fit circuits
- No circuit-specific constraints (work/rest timing, round structure)
- May generate inappropriate exercise sequences for circuits

**Implementation Path:**
1. Keep current circuit template configuration
2. Add circuit-specific constraints in prompt builder
3. Modify round organization to respect circuit structure

### Option B: Create Dedicated Circuit Processing Flow

**Advantages:**
- Purpose-built for circuit requirements
- Can enforce circuit-specific constraints (timing, transitions, equipment)
- Better control over exercise sequencing
- Can optimize for minimal equipment changes between stations

**Disadvantages:**
- Requires new implementation
- More code to maintain
- Duplicates some logic from standard flow

**Implementation Path:**
1. Create `CircuitWorkoutGenerator` class
2. Implement single-phase LLM call that considers all circuit constraints
3. Add circuit-specific prompt templates
4. Handle round/station organization internally

### Option C: Hybrid Approach - Extend Standard Flow

**Advantages:**
- Reuses existing infrastructure where appropriate
- Adds circuit-specific logic only where needed
- Maintains consistency with other template types
- Easier to maintain long-term

**Disadvantages:**
- Requires careful integration with existing code
- May need to refactor some standard flow assumptions

**Implementation Path:**
1. Keep two-phase structure but modify prompts for circuits
2. Add circuit-specific strategy in `ClientExerciseSelectionPromptBuilder`
3. Create `CircuitPromptStrategy` that extends base strategy
4. Modify round organization to respect circuit timing

## Recommended Approach: Use BMF Single-Phase Pattern

Given that your circuit flow matches the BMF pattern exactly (deterministic filtering → single LLM phase), I recommend:

1. **Change circuit template to use single-phase strategy** (like BMF)
2. **Create circuit-specific prompt generation** (like BMF has its own prompt)
3. **Reuse existing single-phase infrastructure**
4. **Keep it simple and consistent with established patterns**

This is actually simpler than the hybrid approach and aligns perfectly with your requirements!

## Implementation Plan (Single-Phase Approach)

### Phase 1: Update Circuit Template Configuration
```typescript
// packages/ai/src/core/templates/config/templates/circuit.ts
export const circuitTemplate: WorkoutTemplate = {
  id: 'circuit',
  name: 'Circuit Training',
  description: 'Time-based circuit workout with configurable work/rest intervals',
  
  metadata: {
    llmStrategy: "single-phase" as const,  // Change from "two-phase"
  },
  
  // Define circuit blocks/rounds based on circuit config
  blocks: [
    // Will be dynamically generated based on circuit config
  ]
}
```

### Phase 2: Create Circuit Prompt Generation
```typescript
// New file: packages/ai/src/workout-generation/prompts/sections/group/circuitPrompt.ts
export function generateCircuitGroupPrompt(config: CircuitWorkoutConfig): string {
  // Similar to BMF prompt but circuit-specific
  // Consider circuit config (rounds, exercisesPerRound, work/rest)
  // Filter exercises deterministically
  // Generate prompt for single LLM call
}
```

### Phase 3: Update Workout Generation Service
```typescript
// Add circuit case to use single-phase generation
if (templateType === 'circuit') {
  // Use single-phase generation like BMF
  // Apply deterministic filtering
  // Make single LLM call
}
```

### Phase 4: Implement Circuit-Specific Filtering
```typescript
// Deterministic filtering logic for circuits:
// - Filter by equipment availability
// - Consider exercise transitions
// - Balance intensity across rounds
// - Ensure variety of movement patterns
```

## Key Considerations

1. **Exercise Selection Criteria for Circuits:**
   - Minimize equipment changes between stations
   - Balance work/rest based on exercise intensity
   - Consider transition time between exercises
   - Ensure exercises can be performed safely under time pressure

2. **Round Structure:**
   - Respect configured rounds and exercises per round
   - Handle repeatRounds (doubling) at generation time
   - Consider rest periods between rounds

3. **Shared Exercises in Circuits:**
   - All clients typically do the same exercises in circuits
   - May want to force 100% sharing for true circuit experience
   - Or allow some variation for different fitness levels

## Next Steps

1. Update circuit template to use `llmStrategy: "single-phase"`
2. Create circuit prompt generation function (similar to BMF)
3. Implement deterministic filtering for circuit exercises
4. Update workout generation service to handle circuit single-phase flow
5. Test with various circuit configurations

## Example Circuit Prompt Structure

```typescript
// Circuit prompt would include:
- Number of rounds (with repeatRounds consideration)
- Exercises per round
- Work/rest intervals
- Equipment constraints
- Client preferences (but simplified for group circuits)
- Filtered exercise list (20-30 exercises)

// Output format:
{
  "rounds": [
    {
      "roundNumber": 1,
      "exercises": [
        {
          "name": "exercise name",
          "equipment": ["equipment"],
          "station": 1
        }
      ]
    }
  ],
  "reasoning": "Brief explanation of circuit design"
}
```

## Future Enhancements

1. **Smart Station Sequencing**: Optimize exercise order for smooth transitions
2. **Equipment Clustering**: Group exercises by equipment to minimize changes
3. **Intensity Wave Patterns**: Alternate high/low intensity within rounds
4. **Circuit-Specific Scoring**: Adjust scoring weights for circuit suitability
5. **Time-Based Modifications**: Suggest rep ranges based on work intervals