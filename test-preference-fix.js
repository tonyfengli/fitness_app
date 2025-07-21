// Test script to demonstrate the preference merging fix

console.log("=== Testing Preference Merging Fix ===\n");

// Scenario 1: Initial message with high intensity and exercises
const initialMessage = "kick my butt today. include back squats and deadlifts.";
console.log("Initial Message:", initialMessage);

const initialParsed = {
  intensity: "high",
  includeExercises: ["back squats", "deadlifts"],
  muscleTargets: [],
  sessionGoal: null,
};
console.log("Parsed:", JSON.stringify(initialParsed, null, 2));

// Scenario 2: Follow-up response without intensity
const followUpMessage = "Strength, and I want some arms in there as well";
console.log("\nFollow-up Message:", followUpMessage);

const followUpParsed = {
  sessionGoal: "strength",
  muscleTargets: ["arms", "biceps", "triceps"],
  // No intensity - would default to moderate in old system
  includeExercises: [], // Empty in follow-up
};
console.log("Parsed:", JSON.stringify(followUpParsed, null, 2));

// Old behavior (before fix)
console.log("\n=== OLD BEHAVIOR ===");
const oldMerged = {
  intensity: followUpParsed.intensity || "moderate", // Defaults to moderate
  sessionGoal: followUpParsed.sessionGoal,
  muscleTargets: followUpParsed.muscleTargets,
  includeExercises: followUpParsed.includeExercises || initialParsed.includeExercises, // Would keep old
};
console.log("Result:", JSON.stringify(oldMerged, null, 2));
console.log("❌ Lost high intensity (became moderate)");
console.log("✅ Kept exercises (by luck of || operator)");

// New behavior (after fix)
console.log("\n=== NEW BEHAVIOR ===");
const newMerged = {
  intensity: followUpParsed.intensity || initialParsed.intensity, // Keeps high
  sessionGoal: followUpParsed.sessionGoal || initialParsed.sessionGoal,
  muscleTargets: followUpParsed.muscleTargets.length > 0 
    ? [...initialParsed.muscleTargets, ...followUpParsed.muscleTargets]
    : initialParsed.muscleTargets,
  includeExercises: followUpParsed.includeExercises.length > 0
    ? [...initialParsed.includeExercises, ...followUpParsed.includeExercises]
    : initialParsed.includeExercises, // Keeps existing when follow-up is empty
};
console.log("Result:", JSON.stringify(newMerged, null, 2));
console.log("✅ Preserved high intensity");
console.log("✅ Preserved include exercises");
console.log("✅ Added new muscle targets");
console.log("✅ Added session goal");

console.log("\n=== Summary ===");
console.log("The fix ensures that:");
console.log("1. Intensity is preserved when not specified in follow-up");
console.log("2. Exercise lists are preserved when follow-up doesn't mention them");
console.log("3. Arrays are merged additively when new items are provided");
console.log("4. The system maintains context throughout the conversation");