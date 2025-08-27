/**
 * Example usage of the muscle distribution calculator
 * This shows how it will integrate with targeted workout bucketing
 */

import { calculateMuscleDistribution, formatDistributionOptions } from "./muscleDistributionCalculator";

// Example 1: Standard targeted workout
console.log("=== Example 1: Standard Targeted Workout ===");
const example1 = calculateMuscleDistribution({
  totalExercises: 6,
  preAssignedMuscles: ["biceps", "chest"], // favorite + shared
  targetMuscles: ["biceps", "chest", "shoulders"]
});
console.log("Options:", example1.options);
console.log("Formatted:", formatDistributionOptions(example1.options));
console.log();

// Example 2: Targeted workout with core
console.log("=== Example 2: Targeted Workout with Core ===");
const example2 = calculateMuscleDistribution({
  totalExercises: 6,
  preAssignedMuscles: ["biceps", "chest", "core"], // favorite + shared + core
  targetMuscles: ["biceps", "chest", "core"] // core as muscle target
});
console.log("Options:", example2.options);
console.log("Formatted:", formatDistributionOptions(example2.options));
console.log();

// Example 3: Many muscles, few slots
console.log("=== Example 3: Edge Case - Many Muscles, Few Slots ===");
const example3 = calculateMuscleDistribution({
  totalExercises: 4,
  preAssignedMuscles: ["chest"],
  targetMuscles: ["chest", "back", "shoulders", "biceps", "triceps"]
});
console.log("Options:", example3.options);
console.log("Formatted:", formatDistributionOptions(example3.options));
console.log();

// Example 4: High intensity with 2 targets
console.log("=== Example 4: High Intensity, 2 Targets ===");
const example4 = calculateMuscleDistribution({
  totalExercises: 7,
  preAssignedMuscles: ["glutes", "glutes"], // both pre-assigned hit same muscle
  targetMuscles: ["glutes", "hamstrings"]
});
console.log("Options:", example4.options);
console.log("Formatted:", formatDistributionOptions(example4.options));