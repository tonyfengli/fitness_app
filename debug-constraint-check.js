const fs = require('fs');
const path = require('path');

// Load the enhanced debug data
const debugDataPath = path.join(__dirname, 'enhanced-debug-state.json');
const debugData = JSON.parse(fs.readFileSync(debugDataPath, 'utf8'));

// Load the exercise database to get muscle information
const exerciseDbPath = path.join(__dirname, 'packages/ai/db/exercises.json');
const exerciseDb = JSON.parse(fs.readFileSync(exerciseDbPath, 'utf8'));

// Create a map of exercise names to their details
const exerciseMap = {};
exerciseDb.forEach(ex => {
  exerciseMap[ex.name] = ex;
});

console.log('=== Constraint Analysis Debug ===\n');

// Check muscle targets
const muscleTargets = debugData.filters.muscleTarget || [];
console.log(`Muscle Targets: ${muscleTargets.join(', ') || 'None'}`);

// Check included exercises
const includedExercises = debugData.filters.includeExercises || [];
console.log(`\nIncluded Exercises (${includedExercises.length}):`);

includedExercises.forEach(exerciseName => {
  const exercise = exerciseMap[exerciseName];
  if (exercise) {
    console.log(`  - ${exerciseName}`);
    console.log(`    Primary Muscle: ${exercise.primaryMuscle || 'Not specified'}`);
    console.log(`    Secondary Muscles: ${exercise.secondaryMuscles?.join(', ') || 'None'}`);
    
    // Check if it matches any muscle target
    if (muscleTargets.length > 0) {
      const matchesTarget = muscleTargets.some(target => {
        // Check if primary muscle matches
        if (exercise.primaryMuscle?.toLowerCase() === target.toLowerCase()) {
          return true;
        }
        
        // Check muscle mapping
        if (target.toLowerCase() === 'back' && exercise.primaryMuscle?.toLowerCase() === 'lats') {
          return true;
        }
        
        return false;
      });
      
      console.log(`    Matches Muscle Target: ${matchesTarget ? 'YES' : 'NO'}`);
    }
  } else {
    console.log(`  - ${exerciseName} (NOT FOUND IN DATABASE)`);
  }
});

// Analyze constraint data
console.log('\n=== Constraint Analysis State ===');
if (Object.keys(debugData.constraintAnalysis).length === 0) {
  console.log('❌ Constraint analysis is empty - tracker not populated');
  console.log('\nExpected constraint analysis for muscle_target:');
  console.log(`  Required: ${muscleTargets.length} muscles (${muscleTargets.join(', ')})`);
  console.log(`  Current: Should check included exercises`);
  
  // Manually calculate what should be there
  let muscleTargetCount = 0;
  includedExercises.forEach(exerciseName => {
    const exercise = exerciseMap[exerciseName];
    if (exercise && muscleTargets.length > 0) {
      const matchesTarget = muscleTargets.some(target => {
        if (exercise.primaryMuscle?.toLowerCase() === target.toLowerCase()) {
          return true;
        }
        if (target.toLowerCase() === 'back' && exercise.primaryMuscle?.toLowerCase() === 'lats') {
          return true;
        }
        return false;
      });
      
      if (matchesTarget) {
        muscleTargetCount++;
      }
    }
  });
  
  console.log(`\n  Calculated muscle_target count: ${muscleTargetCount} / ${muscleTargets.length * 2} (expecting 2 per muscle)`);
} else {
  console.log(JSON.stringify(debugData.constraintAnalysis, null, 2));
}