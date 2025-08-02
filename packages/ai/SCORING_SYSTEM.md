# Exercise Scoring System

## Overview
The exercise scoring system evaluates and ranks exercises based on client preferences and constraints. Each exercise starts with a base score and receives adjustments based on various factors.

## Scoring Rules

### Base Score
- **All exercises start with**: 5.0 points

### Score Adjustments

#### 1. Include Exercise Boost
- **Exercises explicitly requested by client**: +1.0
- Applied in second pass after initial scoring

#### 2. Favorite Exercise Boost
- **Exercises marked as favorites**: +2.0
- Favorites are stored in the `user_exercise_ratings` table

#### 3. Muscle Target Adjustments
- **Primary muscle matches target**: +3.0
- **Secondary muscle matches target**: +1.5

#### 4. Muscle Lessen Penalties
- **Primary muscle matches lessen**: -3.0
- **Secondary muscle matches lessen**: -1.5

#### 5. Intensity Adjustment
- **REMOVED**: Intensity no longer affects exercise scores (all adjustments = 0)
- Previously adjusted based on exercise fatigue profile and client intensity preference

### Final Score Calculation
```
Final Score = Base Score (5.0)
            + Include Boost (0 or 1.0)
            + Favorite Boost (0 or 2.0)
            + Muscle Target Bonus (0, 1.5, or 3.0)
            + Muscle Lessen Penalty (0, -1.5, or -3.0)
```

### Score Ranges
- **Minimum possible**: 0.0 (clamped, prevents negative scores)
- **Typical range**: 2.0 - 11.0
- **Maximum theoretical**: 11.0 (base + include + favorite + primary target)

## Score Breakdown Display

The UI shows score adjustments as colored badges:
- 🟣 Purple: Include boost
- ⭐ Yellow: Favorite boost
- 🟢 Green: Muscle target bonus
- 🔴 Red: Muscle lessen penalty
- ~~🔵 Blue: Intensity adjustment~~ (removed)

## Implementation Details

### Configuration
All scoring weights are defined in `/packages/ai/src/core/scoring/scoringConfig.ts`

### Scoring Process
1. **First Pass**: Calculate base scores with muscle and favorite adjustments
2. **Second Pass**: Apply include exercise boosts
3. **Sort**: Order exercises by final score (highest first)

### Pre-Assignment
For standard templates, the top 2 exercises may be pre-assigned based on:
1. Include exercises (highest priority)
2. Favorite exercises (secondary priority)
3. Constraint satisfaction (e.g., full body workouts require 1 lower + 1 upper body)