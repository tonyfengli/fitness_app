const fs = require('fs');
const path = require('path');

// Load the enhanced debug data
const debugDataPath = path.join(__dirname, 'enhanced-debug-state.json');
const debugData = JSON.parse(fs.readFileSync(debugDataPath, 'utf8'));

console.log('=== Constraint Analysis Issue Debug ===\n');

// Check filters
console.log('Filters:');
console.log(`  Muscle Targets: ${debugData.filters.muscleTarget.join(', ') || 'None'}`);
console.log(`  Included Exercises: ${debugData.filters.includeExercises.join(', ')}`);

// Check constraint analysis
console.log('\nConstraint Analysis Object:');
console.log(`  Keys: ${Object.keys(debugData.constraintAnalysis).join(', ') || 'EMPTY'}`);

if (Object.keys(debugData.constraintAnalysis).length === 0) {
  console.log('\n❌ ISSUE FOUND: constraintTracker is not being populated!');
  console.log('\nThe constraintTracker needs to be called with:');
  console.log('  - initBlock() to initialize constraint tracking for each block');
  console.log('  - recordAttempt() to record constraint satisfaction attempts');
  
  console.log('\nBased on the code analysis:');
  console.log('  - The constraint analysis happens in fullBodyBucketing.ts');
  console.log('  - It uses analyzeConstraints() from constraintAnalyzer.ts');
  console.log('  - But the enhanced debug constraintTracker is NOT integrated there');
  
  console.log('\nThe UI showing "muscle target: 0 / 4" is likely:');
  console.log('  1. Reading from a different debug visualization tool');
  console.log('  2. Or calculating constraints separately from the enhanced debug data');
}

// Check score breakdowns for included exercises
console.log('\n\nScore Breakdowns for Included Exercises:');
debugData.filters.includeExercises.forEach(exerciseName => {
  const scoreData = Object.values(debugData.scoreBreakdowns).find(ex => ex.name === exerciseName);
  if (scoreData) {
    console.log(`\n  ${exerciseName}:`);
    console.log(`    Final Score: ${scoreData.finalScore}`);
    console.log(`    Base Score: ${scoreData.baseScore}`);
    console.log(`    Bonuses: ${scoreData.bonuses.length}`);
    console.log(`    Penalties: ${scoreData.penalties.length}`);
  } else {
    console.log(`\n  ${exerciseName}: NOT FOUND in score breakdowns`);
  }
});

console.log('\n\nConclusion:');
console.log('The enhanced debug system\'s constraintTracker is not integrated with the actual');
console.log('constraint analysis happening during workout generation. The constraint analysis');
console.log('is calculated in fullBodyBucketing.ts but not tracked in the enhanced debug data.');