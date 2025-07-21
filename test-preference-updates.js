// Test scenarios for Phase 4: Preferences Active Mode
// Demonstrates various preference update patterns and responses

const updateScenarios = [
  {
    name: "Intensity Update",
    currentPreferences: {
      intensity: "moderate",
      muscleTargets: ["legs"],
      sessionGoal: "strength"
    },
    updates: [
      {
        user: "Actually, make it easier today",
        detected: { intensity: "low" },
        response: "Got it, I've adjusted the intensity. Let me know if you need anything else changed."
      },
      {
        user: "Let's go harder",
        detected: { intensity: "high" },
        response: "Got it, I've adjusted the intensity. Let me know if you need anything else changed."
      }
    ]
  },

  {
    name: "Exercise Additions",
    currentPreferences: {
      intensity: "moderate",
      includeExercises: ["squats"]
    },
    updates: [
      {
        user: "Also add deadlifts please",
        detected: { includeExercises: ["squats", "deadlifts"] },
        response: "Great, I'll add those to your workout. Anything else you'd like to change?"
      },
      {
        user: "Include bench press and rows too",
        detected: { includeExercises: ["squats", "deadlifts", "bench press", "rows"] },
        response: "Great, I'll add those to your workout. Anything else you'd like to change?"
      }
    ]
  },

  {
    name: "Exercise Removals",
    currentPreferences: {
      intensity: "high",
      includeExercises: ["squats", "deadlifts", "bench press"]
    },
    updates: [
      {
        user: "Skip the deadlifts today",
        detected: { avoidExercises: ["deadlifts"] },
        response: "No problem, I'll make sure to skip those. Let me know if there's anything else."
      },
      {
        user: "Actually remove bench press too",
        detected: { avoidExercises: ["deadlifts", "bench press"] },
        response: "No problem, I'll make sure to skip those. Let me know if there's anything else."
      }
    ]
  },

  {
    name: "Joint Protection Updates",
    currentPreferences: {
      intensity: "high",
      muscleTargets: ["legs", "back"]
    },
    updates: [
      {
        user: "My knees are hurting a bit",
        detected: { avoidJoints: ["knees"] },
        response: "Noted - I'll be careful with those areas. Let me know if you need other adjustments."
      },
      {
        user: "Also my shoulder is sore",
        detected: { avoidJoints: ["knees", "shoulder"] },
        response: "Noted - I'll be careful with those areas. Let me know if you need other adjustments."
      }
    ]
  },

  {
    name: "Session Goal Change",
    currentPreferences: {
      intensity: "moderate",
      sessionGoal: "strength"
    },
    updates: [
      {
        user: "Let's switch to stability work instead",
        detected: { sessionGoal: "stability" },
        response: "Perfect, I've updated your training focus. Anything else you'd like to adjust?"
      }
    ]
  },

  {
    name: "Multiple Updates",
    currentPreferences: {
      intensity: "moderate",
      muscleTargets: ["chest"]
    },
    updates: [
      {
        user: "Go easy today and skip any shoulder work",
        detected: { 
          intensity: "low",
          muscleLessens: ["shoulders"]
        },
        response: "Updated your intensity and areas to avoid. Let me know if you need any other changes."
      },
      {
        user: "Add squats and focus on legs too, but avoid jumps",
        detected: {
          includeExercises: ["squats"],
          muscleTargets: ["chest", "legs"],
          avoidExercises: ["jumps"]
        },
        response: "Updated your exercise selections, target areas and exercises to skip. Let me know if you need any other changes."
      }
    ]
  },

  {
    name: "General Queries (No Updates)",
    currentPreferences: {
      intensity: "moderate",
      sessionGoal: "strength"
    },
    updates: [
      {
        user: "Sounds good",
        detected: {},
        response: "Your current preferences are set. If you need to change anything, just let me know!"
      },
      {
        user: "What's my current intensity?",
        detected: {},
        response: "Your current preferences are set. If you need to change anything, just let me know!"
      },
      {
        user: "Perfect, thanks",
        detected: {},
        response: "Your current preferences are set. If you need to change anything, just let me know!"
      }
    ]
  },

  {
    name: "Unclear Update Requests",
    currentPreferences: {
      intensity: "moderate"
    },
    updates: [
      {
        user: "Change my workout",
        detected: {},
        response: "I didn't catch what you'd like to change. You can update things like intensity (easy/hard), exercises to add/skip, or areas to focus on."
      },
      {
        user: "Different please",
        detected: {},
        response: "I didn't catch what you'd like to change. You can update things like intensity (easy/hard), exercises to add/skip, or areas to focus on."
      }
    ]
  }
];

console.log("Preference Update Scenarios - Phase 4");
console.log("====================================\n");

updateScenarios.forEach(scenario => {
  console.log(`\n### ${scenario.name} ###`);
  console.log(`Current Preferences: ${JSON.stringify(scenario.currentPreferences, null, 2)}\n`);
  
  scenario.updates.forEach((update, index) => {
    console.log(`Update ${index + 1}:`);
    console.log(`User: "${update.user}"`);
    console.log(`Detected Changes: ${JSON.stringify(update.detected)}`);
    console.log(`System: "${update.response}"`);
    console.log("");
  });
});

console.log("\n\nKey Features of Preferences Active Mode:");
console.log("- Natural language understanding of update requests");
console.log("- Additive updates (doesn't replace, adds to existing)");
console.log("- Handles intensity, exercises, muscles, joints, and goals");
console.log("- Distinguishes between general queries and update requests");
console.log("- Provides specific confirmations for different update types");
console.log("- Graceful handling of unclear requests");