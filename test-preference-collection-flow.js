// Test script demonstrating the complete preference collection flow
// Phases 1-3: State Machine, Targeted Follow-up, and Disambiguation Clarification

const flowScenarios = [
  {
    name: "Simple Flow - No Disambiguation",
    steps: [
      {
        user: "Feeling good today, let's go hard on legs",
        system: "Perfect! I've got your preferences. What's your training focus today - strength, endurance, or stability? Also, any joints we should be careful with?",
        state: "initial_collected -> followup_sent",
        notes: "Direct to follow-up, no disambiguation needed"
      },
      {
        user: "Let's focus on strength, and my knees are a bit tender",
        system: "Great, thank you for that. If you have anything else to add, let me know.",
        state: "followup_sent -> preferences_active",
        notes: "Preferences complete"
      }
    ]
  },
  
  {
    name: "Disambiguation Flow - Success", 
    steps: [
      {
        user: "I want to do squats today",
        system: "I found a few squat variations. Which would you like?\n1. Back Squat\n2. Front Squat\n3. Goblet Squat\n4. Bulgarian Split Squat\n\nReply with the numbers (e.g., '1' or '1,3')",
        state: "initial_collected -> disambiguation_pending",
        notes: "Multiple exercise matches found"
      },
      {
        user: "1 and 3",
        system: "Perfect! I'll include Back Squat, Goblet Squat. What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?",
        state: "disambiguation_pending -> disambiguation_resolved -> followup_sent",
        notes: "Valid selection, proceed to follow-up"
      }
    ]
  },
  
  {
    name: "Disambiguation Flow - Clarification",
    steps: [
      {
        user: "I'd like to do deadlifts",
        system: "I found a few deadlift variations. Which would you like?\n1. Conventional Deadlift\n2. Sumo Deadlift\n3. Romanian Deadlift\n4. Trap Bar Deadlift\n\nReply with the numbers (e.g., '1' or '1,3')",
        state: "initial_collected -> disambiguation_pending",
        notes: "Multiple exercise matches"
      },
      {
        user: "Yes, I'll take the conventional and romanian ones please",
        system: "I just need the numbers (1-4). For example: \"1\" or \"1,3\"",
        state: "disambiguation_pending -> disambiguation_clarifying", 
        notes: "Mixed content detected, clarification attempt 1"
      },
      {
        user: "Oh sorry, 1 and 3",
        system: "Perfect! I'll include Conventional Deadlift, Romanian Deadlift. What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?",
        state: "disambiguation_clarifying -> disambiguation_resolved -> followup_sent",
        notes: "Successful clarification"
      }
    ]
  },
  
  {
    name: "Disambiguation Flow - Skip After Failed Clarification",
    steps: [
      {
        user: "Let's do some bench press variations", 
        system: "I found a few bench press variations. Which would you like?\n1. Barbell Bench Press\n2. Dumbbell Bench Press\n3. Incline Bench Press\n4. Decline Bench Press\n\nReply with the numbers (e.g., '1' or '1,3')",
        state: "initial_collected -> disambiguation_pending",
        notes: "Multiple matches"
      },
      {
        user: "I want the regular one and the incline",
        system: "I just need the numbers (1-4). For example: \"1\" or \"1,3\"",
        state: "disambiguation_pending -> disambiguation_clarifying",
        notes: "First clarification attempt"
      },
      {
        user: "Just give me the normal bench and incline please",
        system: "I'll note that for your workout. What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?",
        state: "disambiguation_clarifying -> followup_sent",
        notes: "Skip disambiguation after 2nd failure, go to follow-up"
      }
    ]
  },
  
  {
    name: "Minimal Preferences - Multiple Follow-ups",
    steps: [
      {
        user: "Feeling tired",
        system: "Got it! What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?",
        state: "initial_collected -> followup_sent",
        notes: "Low intensity inferred, asking for sessionGoal + muscleTargets"
      },
      {
        user: "Just stability work today",
        system: "Great, thank you for that. If you have anything else to add, let me know.",
        state: "followup_sent -> preferences_active",
        notes: "Got sessionGoal, other fields can remain empty"
      }
    ]
  }
];

console.log("Complete Preference Collection Flow Examples");
console.log("===========================================\n");

flowScenarios.forEach(scenario => {
  console.log(`\n### ${scenario.name} ###\n`);
  
  scenario.steps.forEach((step, index) => {
    console.log(`Step ${index + 1}:`);
    console.log(`User: "${step.user}"`);
    console.log(`System: "${step.system}"`);
    console.log(`State: ${step.state}`);
    console.log(`Notes: ${step.notes}`);
    console.log("");
  });
});

console.log("\n\nKey Features Demonstrated:");
console.log("- Phase 1: State machine tracking (7 states)");
console.log("- Phase 2: Dynamic follow-up questions based on missing fields");
console.log("- Phase 3: Disambiguation clarification with attempt tracking");
console.log("- Graceful fallback when clarification fails twice");
console.log("- Priority on sessionGoal field in follow-ups");
console.log("- Natural, coach-like conversation flow");