// Test script to verify exercise matching improvements
const testCases = [
  {
    input: "heavy squats",
    expectedMatches: ["Barbell Back Squat", "Barbell Front Squat"],
    shouldNotMatch: ["Goblet Squat", "Jump Squat", "Lunges", "Bulgarian Split Squat"]
  },
  {
    input: "no squats",
    expectedToMatchMany: true,
    shouldMatch: ["Barbell Back Squat", "Goblet Squat", "Jump Squat", "Pistol Squat"],
    shouldNotMatch: ["Lunges", "Deadlifts"]
  },
  {
    input: "avoid bench press",
    shouldMatch: ["Barbell Bench Press", "Dumbbell Bench Press", "Incline Bench Press"],
    shouldNotMatch: ["Barbell Back Squat", "Push-ups"]
  },
  {
    input: "skip burpees",
    shouldMatch: ["Burpees", "Burpee Box Jump"],
    shouldNotMatch: ["Jump Squat", "Mountain Climbers"]
  },
  {
    input: "no lunges",
    shouldMatch: ["Reverse Lunge", "Lateral Lunge", "Curtsy Lunge"],
    shouldNotMatch: ["Squats", "Step-ups"]
  }
];

console.log(`
Exercise Matching Test Cases:
=============================

These test cases verify that the LLM is being specific and conservative with matches.

Expected behavior after the prompt refinement:
`);

testCases.forEach((test, index) => {
  console.log(`
${index + 1}. Input: "${test.input}"
   Expected matches: ${test.expectedMatches?.join(', ') || 'Multiple ' + test.input + ' variations'}
   Should NOT match: ${test.shouldNotMatch.join(', ')}
  `);
});

console.log(`
To test:
1. Send these messages via SMS after checking into a session
2. Check the session lobby to see which exercises are listed
3. Verify that only the appropriate exercises are matched
`);