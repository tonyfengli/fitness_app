# BMF Group Workout Prompt Guidelines

## Overview
This document outlines the guiding principles for the BMF (Bold Movement Fitness) group workout generation system, specifically focusing on how exercises are selected and assigned across rounds 3 and 4.

## Core Principles

### 1. Client Needs First (Absolute Priority)
- **#1 Priority**: Give clients what they want in terms of muscle targeting and fitness goals
- Client muscle targets and goals take priority over movement pattern balance
- If a client targets a specific muscle, they MUST receive at least one exercise targeting that muscle
- This applies even if the exercise doesn't "fit" the round's theme (e.g., bicep curls in Round 4)

### 2. Shared Exercise Strategy
- **Ideal scenario**: Shared exercises that satisfy multiple clients' needs
- If Client A wants biceps and Client B has no preference → prioritize shared bicep exercise
- If no shared exercises satisfy client needs → individual exercises win
- Every client MUST have at least one shared exercise across the entire workout (Rounds 1-4)

### 3. Round-Specific Goals

#### Round 3 - Strength Focus
- **Primary**: Prioritize exercises aligning with client muscle targets and fitness goals
- **Secondary**: Maintain movement pattern balance (include push movements to balance R2 pulls)
- Examples:
  - Client targeting chest → bench press, dips, push-ups
  - Client targeting shoulders → overhead press, lateral raises
  - Client targeting legs → leg press, lunges, step-ups
  - Client lessening shoulders → avoid overhead work

#### Round 4 - Core/Capacity Focus  
- **Primary**: Select exercises targeting client goals while incorporating core/metabolic work
- **Secondary**: End workout strong with burnout-style finishers
- Best opportunity for shared exercises (everyone can do planks, burpees, etc.)
- Examples:
  - Core finishers: plank variations, dead bugs, carries
  - Metabolic finishers: burpees, mountain climbers, battle ropes

## Movement Pattern Structure
- Round 1: Lower Body (squat/hinge/lunge) ✓
- Round 2: Pull (vertical/horizontal pull) ✓ 
- Round 3: Client goal-focused strength work (ideally push for balance)
- Round 4: Client goal-focused finisher (core/metabolic burnout)

## Exercise Selection Rules

### Muscle Target Guarantees
1. Each client must receive at least one exercise for each of their muscle targets
2. Muscle targets take absolute priority over movement patterns

### Shared vs Individual Balance
1. Prioritize shared exercises when they satisfy client needs
2. Individual exercises when no suitable shared option exists
3. Every client must have at least 1 shared exercise across all 4 rounds (no percentage required)
4. Clients with no preferences: prioritize movement pattern balance and shared exercises
5. Worst case: Round 4 becomes fully shared to meet the "one shared exercise" rule

### Equipment Conflicts
1. Limited equipment (2 benches, 1 cable, etc.) requires careful planning
2. Pre-assigned exercises get equipment priority
3. Consider equipment-free alternatives when conflicts arise

### Client Request Handling
1. Exercises marked [CLIENT REQUEST] are pre-assigned and guaranteed
2. These count toward the client's muscle target requirements
3. Cannot be removed or reassigned by the LLM

## Edge Case Handling

### Opposing Needs
- If Client A targets shoulders and Client B lessens shoulders:
  - Give Client A individual shoulder exercise
  - Find shared exercise that doesn't involve shoulders
  - Respect both clients' needs

### No Overlap Scenario
- If all clients have different muscle targets with no overlap:
  - Rounds 1-3: Focus on individual exercises for targets
  - Round 4: Use as shared round with metabolic/core work

### Limited Exercise Slots
- Low capacity clients (5 total exercises) need efficient programming
- Prioritize exercises that hit multiple targets
- May need to skip secondary targets for these clients

## Prompt Structure Elements

### Information Provided to LLM
1. Client profiles with muscle targets, lessens, and goals
2. Already completed exercises (R1 & R2)
3. Pre-assigned client requests
4. Available exercise options (shared and individual)
5. Equipment constraints
6. Remaining slot counts per client

### Task Instructions
1. Priority 1: Match exercises to client muscle targets and goals
2. Priority 2: Maintain workout flow and movement balance
3. Constraints: Equipment, slots, pre-assigned exercises
4. Requirement: At least one shared exercise per client

## Implementation Notes

### Pre-Assignment Phase
- Client-requested exercises are deterministically assigned
- Prevents duplication across rounds
- Guarantees client satisfaction

### Scoring Adjustments
- Muscle target boost should be significant
- Client requests get highest priority
- Shared exercise potential should be factored in

### Future Considerations
- Consider pre-assigning top muscle target exercise per client
- Validate LLM output to ensure muscle targets are met
- Track shared exercise count per client for validation