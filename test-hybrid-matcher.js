// Test script for the hybrid exercise matcher
// Run with: node test-hybrid-matcher.js

const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.join(__dirname, '.env') });

async function testHybridMatcher() {
  console.log('🧪 Testing Hybrid Exercise Matcher\n');

  // Import after env vars are loaded
  const { HybridExerciseMatcherService } = require('./packages/api/dist/services/hybridExerciseMatcherService');
  const { db } = require('./packages/db/dist/client');
  const { exercises, BusinessExercise } = require('./packages/db/dist/schema');
  const { eq } = require('drizzle-orm');

  const matcher = new HybridExerciseMatcherService();

  // Get a sample business ID (you'll need to replace with a real one)
  const businessId = 'YOUR_BUSINESS_ID_HERE'; // Replace this!

  // Get all exercises for testing
  const allExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      exerciseType: exercises.exerciseType,
      primaryMuscle: exercises.primaryMuscle,
      equipment: exercises.equipment,
      movementPattern: exercises.movementPattern,
      complexityLevel: exercises.complexityLevel,
    })
    .from(exercises)
    .limit(130); // Use all exercises for testing

  // Test cases
  const testCases = [
    // Exercise type matching (should be fast)
    { phrase: "squats", intent: "avoid", expected: "exercise_type" },
    { phrase: "bench press", intent: "include", expected: "exercise_type" },
    { phrase: "deadlifts", intent: "avoid", expected: "exercise_type" },
    { phrase: "lunges", intent: "include", expected: "exercise_type" },
    { phrase: "rows", intent: "avoid", expected: "exercise_type" },
    
    // Pattern matching (should be fast)
    { phrase: "heavy squats", intent: "avoid", expected: "pattern" },
    { phrase: "band work", intent: "include", expected: "pattern" },
    { phrase: "bodyweight", intent: "include", expected: "pattern" },
    { phrase: "pushing", intent: "avoid", expected: "pattern" },
    
    // LLM matching (will be slower)
    { phrase: "back squats", intent: "avoid", expected: "llm" },
    { phrase: "farmer walks", intent: "include", expected: "llm" },
    { phrase: "db press", intent: "include", expected: "llm" },
    { phrase: "lat pulls", intent: "avoid", expected: "llm" },
  ];

  console.log(`Testing with ${allExercises.length} exercises\n`);

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: "${testCase.phrase}" (${testCase.intent})`);
    console.log(`Expected method: ${testCase.expected}`);
    
    try {
      const startTime = Date.now();
      const result = await matcher.matchExercises(
        testCase.phrase,
        allExercises,
        testCase.intent
      );
      const duration = Date.now() - startTime;
      
      console.log(`✅ Match method: ${result.matchMethod}`);
      console.log(`⏱️  Time: ${duration}ms`);
      console.log(`📊 Matches: ${result.matchedExercises.length} exercises`);
      
      if (result.matchedExercises.length > 0) {
        console.log(`📝 First 3 matches:`);
        result.matchedExercises.slice(0, 3).forEach(ex => {
          console.log(`   - ${ex.name}`);
        });
      }
      
      if (result.reasoning) {
        console.log(`💭 Reasoning: ${result.reasoning}`);
      }
      
      // Verify expected method
      if (result.matchMethod !== testCase.expected) {
        console.log(`⚠️  WARNING: Expected ${testCase.expected} but got ${result.matchMethod}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n✅ Test complete!');
  process.exit(0);
}

// Run the test
testHybridMatcher().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});