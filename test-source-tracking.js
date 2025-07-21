// Example of how source tracking works for intensity and sessionGoal

// Initial preference collection
const initialMessage = "I'm feeling good, push me hard today! Let's do deadlifts.";
// Parsed: { intensity: 'high', includeExercises: ['deadlifts'] }
// Saved: { 
//   intensity: 'high', 
//   intensitySource: 'explicit',  // User explicitly said "push me hard"
//   sessionGoal: null,
//   sessionGoalSource: 'default'  // Not mentioned, so default
// }

// Follow-up message 1 - mentions session goal but not intensity
const followUp1 = "Let's make this a strength session and focus on back";
// Parsed: { sessionGoal: 'strength', muscleTargets: ['back'] }
// Merged & Saved: {
//   intensity: 'high',           // Preserved from initial
//   intensitySource: 'inherited', // Not mentioned in follow-up, so inherited
//   sessionGoal: 'strength',     // New value from follow-up
//   sessionGoalSource: 'explicit' // Explicitly mentioned in follow-up
// }

// Follow-up message 2 - changes intensity
const followUp2 = "Actually feeling a bit tired, let's take it easy";
// Parsed: { intensity: 'low' }
// Merged & Saved: {
//   intensity: 'low',            // Changed in follow-up
//   intensitySource: 'explicit',  // Explicitly changed
//   sessionGoal: 'strength',     // Preserved from previous
//   sessionGoalSource: 'inherited' // Not mentioned, so inherited
// }

// Frontend display logic
function shouldDisplayField(fieldSource) {
  return fieldSource === 'explicit'; // Only show fields user explicitly set
}

// Example frontend display:
// Initial: Shows "Intensity: High" (explicit)
// After followUp1: Shows "Session Goal: Strength" (explicit), intensity hidden (inherited)
// After followUp2: Shows "Intensity: Low" (explicit), session goal hidden (inherited)

console.log("Source tracking example - see comments in file for explanation");