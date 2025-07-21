// Complete Preference Collection Flow - Phases 1-4
// This demonstrates the full user journey from check-in to active preference updates

const completeUserJourney = {
  name: "Sarah's Workout Session",
  timeline: [
    {
      time: "8:00 AM",
      action: "Check-in",
      user: "Checking in for my session",
      system: "Welcome Sarah! How are you feeling today? Is there anything I should know before building your workout?",
      state: "not_started -> initial_collected",
      phase: "Phase 1: State Machine"
    },
    
    {
      time: "8:01 AM", 
      action: "Initial Preferences",
      user: "Feeling pretty good! Let's work on legs today and include squats",
      system: "I found a few squat variations. Which would you like?\n1. Back Squat\n2. Front Squat\n3. Goblet Squat\n4. Bulgarian Split Squat\n\nReply with the numbers (e.g., '1' or '1,3')",
      state: "initial_collected -> disambiguation_pending",
      phase: "Phase 1: Disambiguation needed"
    },
    
    {
      time: "8:02 AM",
      action: "Disambiguation Attempt",
      user: "I'll take the back squat and goblet squat please",
      system: "I just need the numbers (1-4). For example: \"1\" or \"1,3\"",
      state: "disambiguation_pending -> disambiguation_clarifying",
      phase: "Phase 3: Clarification"
    },
    
    {
      time: "8:02 AM",
      action: "Successful Disambiguation",
      user: "1,3",
      system: "Perfect! I'll include Back Squat, Goblet Squat. What's your training focus today - strength, endurance, or stability? Also, any joints we should be careful with?",
      state: "disambiguation_clarifying -> disambiguation_resolved -> followup_sent",
      phase: "Phase 2: Targeted Follow-up"
    },
    
    {
      time: "8:03 AM",
      action: "Follow-up Response",
      user: "Let's focus on strength, knees are good today",
      system: "Great, thank you for that. If you have anything else to add, let me know.",
      state: "followup_sent -> preferences_active",
      phase: "Phase 2: Preferences complete"
    },
    
    {
      time: "8:15 AM",
      action: "Mid-workout Update 1",
      user: "Actually my right knee is starting to feel tight",
      system: "Noted - I'll be careful with those areas. Let me know if you need other adjustments.",
      state: "preferences_active (remains active)",
      phase: "Phase 4: Active update - joint protection"
    },
    
    {
      time: "8:25 AM",
      action: "Mid-workout Update 2",
      user: "Let's go easier for the rest of the session",
      system: "Got it, I've adjusted the intensity. Let me know if you need anything else changed.",
      state: "preferences_active (remains active)",
      phase: "Phase 4: Active update - intensity"
    },
    
    {
      time: "8:30 AM",
      action: "Exercise Addition",
      user: "Can we add some lunges too?",
      system: "Great, I'll add those to your workout. Anything else you'd like to change?",
      state: "preferences_active (remains active)",
      phase: "Phase 4: Active update - add exercise"
    },
    
    {
      time: "8:35 AM",
      action: "Exercise Removal",
      user: "Skip the goblet squats please",
      system: "No problem, I'll make sure to skip those. Let me know if there's anything else.",
      state: "preferences_active (remains active)", 
      phase: "Phase 4: Active update - remove exercise"
    },
    
    {
      time: "8:45 AM",
      action: "General Comment",
      user: "This is feeling great, thanks!",
      system: "Your current preferences are set. If you need to change anything, just let me know!",
      state: "preferences_active (remains active)",
      phase: "Phase 4: General query (no update)"
    }
  ],
  
  finalPreferences: {
    intensity: "low", // Changed from moderate
    sessionGoal: "strength",
    muscleTargets: ["legs"],
    includeExercises: ["back squat", "lunges"], // Goblet squat removed
    avoidExercises: ["goblet squat"],
    avoidJoints: ["knees"], // Added during session
    needsFollowUp: false
  }
};

console.log("Complete Preference Collection User Journey");
console.log("==========================================\n");

console.log(`User: ${completeUserJourney.name}\n`);

completeUserJourney.timeline.forEach(event => {
  console.log(`[${event.time}] ${event.action}`);
  console.log(`User: "${event.user}"`);
  console.log(`System: "${event.system}"`);
  console.log(`State: ${event.state}`);
  console.log(`Phase: ${event.phase}`);
  console.log("---\n");
});

console.log("\nFinal Workout Preferences:");
console.log(JSON.stringify(completeUserJourney.finalPreferences, null, 2));

console.log("\n\nKey Features Demonstrated:");
console.log("✅ Phase 1: State machine tracking through entire flow");
console.log("✅ Phase 2: Intelligent follow-up questions based on missing data");
console.log("✅ Phase 3: Graceful disambiguation clarification");
console.log("✅ Phase 4: Real-time preference updates during workout");
console.log("✅ Natural conversation flow that adapts to user needs");
console.log("✅ Maintains context throughout the entire session");