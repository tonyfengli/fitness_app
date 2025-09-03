import type { GroupWorkoutConfig } from "../../types";
import type { ClientContext } from "../../../../types/clientContext";
import type { CircuitConfig } from "@acme/validators";

interface CircuitExercise {
  name: string;
  equipment: string[];
  movementPattern: string;
  primaryMuscle: string;
  score: number;
}

interface CircuitPromptConfig extends GroupWorkoutConfig {
  circuitConfig?: CircuitConfig;
}

/**
 * Deterministic bucketing for circuit exercises
 * Ensures balanced selection across movement patterns
 */
function selectCircuitExercises(
  allExercises: CircuitExercise[], 
  rawExercises: any[]
): CircuitExercise[] {
  // Group exercises by movement pattern
  const exercisesByPattern: Record<string, CircuitExercise[]> = {};
  const capacityExercises: CircuitExercise[] = [];
  
  // First, categorize all exercises
  allExercises.forEach(ex => {
    const pattern = ex.movementPattern?.toLowerCase() || 'unknown';
    
    // Check if this is a capacity exercise by looking at the raw exercise data
    const rawExercise = rawExercises.find(raw => raw.name === ex.name);
    const isCapacity = rawExercise?.functionTags?.includes('capacity') || false;
    
    if (isCapacity) {
      capacityExercises.push(ex);
    } else {
      if (!exercisesByPattern[pattern]) {
        exercisesByPattern[pattern] = [];
      }
      exercisesByPattern[pattern].push(ex);
    }
  });
  
  // Shuffle function for randomness within categories
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp!;
    }
    return shuffled;
  };
  
  const selected: CircuitExercise[] = [];
  const usedExerciseNames = new Set<string>();
  
  // Helper to add exercises without duplicates
  const addExercises = (exercises: CircuitExercise[], count: number) => {
    const shuffled = shuffle(exercises.filter(ex => !usedExerciseNames.has(ex.name)));
    const toAdd = shuffled.slice(0, count);
    toAdd.forEach(ex => {
      selected.push(ex);
      usedExerciseNames.add(ex.name);
    });
    return toAdd.length;
  };
  
  // 1. Squat (knee-dominant): 5 exercises
  const squatExercises = exercisesByPattern['squat'] || [];
  const squatsAdded = addExercises(squatExercises, 5);
  
  // 2. Hinge (hip-dominant): 4 exercises
  const hingeExercises = exercisesByPattern['hinge'] || [];
  const hingesAdded = addExercises(hingeExercises, 4);
  
  // 3. Push (horizontal/vertical): 6 total, balanced
  const horizontalPush = exercisesByPattern['horizontal_push'] || [];
  const verticalPush = exercisesByPattern['vertical_push'] || [];
  const horizontalPushAdded = addExercises(horizontalPush, 3);
  const verticalPushAdded = addExercises(verticalPush, 3);
  
  // 4. Pull (horizontal/vertical): 5 total
  const horizontalPull = exercisesByPattern['horizontal_pull'] || [];
  const verticalPull = exercisesByPattern['vertical_pull'] || [];
  // Get 4 horizontal and 1 vertical
  const horizontalPullAdded = addExercises(horizontalPull, 4);
  const verticalPullAdded = addExercises(verticalPull, 1);
  
  // 5. Core: 7 exercises
  const coreExercises = exercisesByPattern['core'] || [];
  const coreAdded = addExercises(coreExercises, 7);
  
  // 6. Locomotion/conditioning (capacity): 2 exercises
  const capacityAdded = addExercises(capacityExercises, 2);
  
  // Log what we've selected so far
  console.log('[Circuit Bucketing] Initial selection:', {
    squat: squatsAdded,
    hinge: hingesAdded,
    horizontalPush: horizontalPushAdded,
    verticalPush: verticalPushAdded,
    horizontalPull: horizontalPullAdded,
    verticalPull: verticalPullAdded,
    core: coreAdded,
    capacity: capacityAdded,
    totalSelected: selected.length
  });
  
  // Fill remaining slots if any category was short
  const targetCount = 32;
  if (selected.length < targetCount) {
    // Priority order for filling: core, squat, hinge, push, pull
    const fillOrder = [
      coreExercises,
      squatExercises,
      hingeExercises,
      [...horizontalPush, ...verticalPush],
      [...horizontalPull, ...verticalPull],
      capacityExercises
    ];
    
    for (const pool of fillOrder) {
      if (selected.length >= targetCount) break;
      const remaining = targetCount - selected.length;
      addExercises(pool, remaining);
    }
  }
  
  console.log('[Circuit Bucketing] Final selection:', {
    total: selected.length,
    patterns: selected.reduce((acc, ex) => {
      acc[ex.movementPattern] = (acc[ex.movementPattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });
  
  return selected;
}

// Helper to extract equipment from exercise
function getEquipmentFromExercise(exercise: any): string[] {
  // Use the exercise's equipment field if available
  if (exercise.equipment) {
    return Array.isArray(exercise.equipment) ? exercise.equipment : [exercise.equipment];
  }
  
  // Fallback to name parsing
  const name = exercise.name.toLowerCase();
  const equipment: string[] = [];

  if (name.includes("barbell") && !name.includes("dumbbell")) equipment.push("barbell");
  if (name.includes("bench") || name.includes("incline")) equipment.push("bench");
  if (name.includes("dumbbell") || name.includes("db ")) equipment.push("dumbbell");
  if (name.includes("kettlebell") || name.includes("kb ")) equipment.push("kettlebell");
  if (name.includes("cable") || name.includes("lat pulldown")) equipment.push("cable");
  if (name.includes("band")) equipment.push("band");
  if (name.includes("trx") || name.includes("suspension")) equipment.push("suspension");
  
  // Bodyweight exercises
  if (!equipment.length && (
    name.includes("push-up") || name.includes("pull-up") || 
    name.includes("plank") || name.includes("squat") && !name.includes("barbell") && !name.includes("dumbbell")
  )) {
    equipment.push("bodyweight");
  }

  return equipment.length > 0 ? equipment : ["none"];
}

// Format exercise for display in prompt
function formatExerciseOption(exercise: CircuitExercise, index: number): string {
  const equipment = getEquipmentFromExercise(exercise);
  const exerciseId = `ex_${index}`;
  return `${exerciseId}: ${exercise.name} (${exercise.movementPattern}, ${exercise.primaryMuscle}, ${equipment.join("+")})`;
}

export function generateCircuitGroupPrompt(config: CircuitPromptConfig): string {
  const { clients, equipment: availableEquipment, blueprint, circuitConfig } = config;
  
  // Get circuit configuration from session settings (no flexibility)
  const rounds = circuitConfig?.config?.rounds || 3;
  const exercisesPerRound = circuitConfig?.config?.exercisesPerRound || 6;
  const workDuration = circuitConfig?.config?.workDuration || 45;
  const restDuration = circuitConfig?.config?.restDuration || 15;
  const restBetweenRounds = circuitConfig?.config?.restBetweenRounds || 60;
  const repeatRounds = circuitConfig?.config?.repeatRounds || false;
  
  // Calculate total rounds including repeats
  const totalRounds = repeatRounds ? rounds * 2 : rounds;
  
  // Get the filtered exercise pool from the blueprint
  const exerciseBlock = blueprint.find(b => b.blockId === 'circuit_exercises');
  if (!exerciseBlock) {
    throw new Error("Circuit template requires circuit_exercises block");
  }
  
  // Circuit MVP: Use individual exercise pools only (shared candidates are skipped)
  // In MVP, we expect only one client, so we use their exercise pool
  const allIndividualExercises: CircuitExercise[] = [];
  const clientExerciseCounts: Record<string, number> = {};
  
  Object.entries(exerciseBlock.individualCandidates).forEach(([clientId, clientData]: [string, any]) => {
    if (clientData?.exercises) {
      clientExerciseCounts[clientId] = clientData.exercises.length;
      allIndividualExercises.push(...clientData.exercises);
    }
  });
  
  console.log('[Circuit Template] Individual exercises by client:', {
    clientCounts: clientExerciseCounts,
    totalIndividualExercises: allIndividualExercises.length
  });
  
  // Convert exercises to circuit format and deduplicate
  const exerciseMap = new Map<string, CircuitExercise>();
  
  // Add all individual exercises (all have score 5.0 in circuit MVP)
  allIndividualExercises.forEach((ex: any) => {
    if (!exerciseMap.has(ex.name)) {
      exerciseMap.set(ex.name, {
        name: ex.name,
        equipment: getEquipmentFromExercise(ex),
        movementPattern: ex.movementPattern || 'unknown',
        primaryMuscle: ex.primaryMuscle || 'unknown',
        score: ex.score || 5.0  // Should be 5.0 from scoring override
      });
    }
  });
  
  // Convert to array - Circuit MVP: All exercises have score 5.0, so order is preserved from filtering
  const allExercises = Array.from(exerciseMap.values());
  
  // Log all exercises before bucketing
  console.log('[Circuit Template] All exercises before bucketing:', {
    totalCount: allExercises.length,
    exercisesByMovementPattern: allExercises.reduce((acc, ex) => {
      const pattern = ex.movementPattern || 'unknown';
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });
  
  // Circuit MVP: Deterministic bucketing for balanced exercise selection
  const availableExercises = selectCircuitExercises(allExercises, allIndividualExercises);
  
  console.log('[Circuit Template] Bucketed exercises for circuit:', {
    count: availableExercises.length,
    exercises: availableExercises.map((ex, idx) => ({
      rank: idx + 1,
      name: ex.name,
      pattern: ex.movementPattern,
      muscle: ex.primaryMuscle
    }))
  });
  
  // Create exercise ID mapping
  const exerciseIdMap = new Map<string, CircuitExercise>();
  availableExercises.forEach((exercise, idx) => {
    const exerciseId = `ex_${idx + 1}`;
    exerciseIdMap.set(exerciseId, exercise);
  });
  
  // IMPORTANT: Store the bucketed exercises back in the blueprint for frontend access
  // This ensures the frontend sees the properly bucketed selection, not all exercises
  for (const [clientId, clientData] of Object.entries(exerciseBlock.individualCandidates)) {
    if (clientData && typeof clientData === 'object') {
      // Store the full list of exercises before bucketing for visualization
      (clientData as any).allFilteredExercises = [...((clientData as any).exercises || [])];
      
      // Store the bucketed selection separately
      // Convert CircuitExercise back to ScoredExercise format
      (clientData as any).bucketedExercises = availableExercises.map(ex => {
        // Find the original exercise to preserve all properties
        const original = allIndividualExercises.find(orig => orig.name === ex.name);
        return original || ex;
      });
      
      // Replace exercises array with bucketed selection for LLM
      (clientData as any).exercises = (clientData as any).bucketedExercises;
      
      // Store the exercise ID mapping for later use
      (clientData as any).exerciseIdMap = Object.fromEntries(exerciseIdMap);
    }
  }
  
  const sections: string[] = [];
  
  // Header
  sections.push(`You are designing a full-body circuit workout for a group (ages 20-50), coached live.`);
  sections.push(`There is only ONE station: everyone performs the same exercise at the same time, then moves to the next together.`);
  sections.push("");
  
  // Session Parameters (from configuration - no flexibility)
  sections.push("## Session Parameters");
  sections.push(`- Work: ${workDuration}s, Rest: ${restDuration}s`);
  if (repeatRounds) {
    sections.push(`- Rounds: ${rounds} (will be repeated twice for ${totalRounds} total rounds)`);
    sections.push(`- Design ${rounds} rounds considering they will be performed back-to-back twice`);
  } else {
    sections.push(`- Total rounds: ${rounds}`);
  }
  sections.push(`- Each round = ${exercisesPerRound} exercises`);
  sections.push("");
  
  // Core Rules
  sections.push("## Core Rules");
  sections.push("1. Each round must be **mixed**: no repeating the same movement pattern within the same round.");
  sections.push("2. Across the entire circuit, cover all **key movement patterns**:");
  sections.push("   - Squat (knee-dominant)");
  sections.push("   - Hinge (hip-dominant)");
  sections.push("   - Push (horizontal/vertical)");
  sections.push("   - Pull (horizontal/vertical)");
  sections.push("   - Core (stability/anti-rotation/carry)");
  sections.push("   - Locomotion/conditioning (low-impact cardio)");
  sections.push("3. Overall circuit must be **balanced**:");
  sections.push("   - Push ≈ Pull");
  sections.push("   - Squat ≈ Hinge");
  sections.push("   - Include at least 1 unilateral/balance drill.");
  sections.push("4. Avoid repetitive high-impact exercises.");
  sections.push("   - Save jumps/burpees for the **final round only** (if included at all).");
  sections.push("5. Favor **joint-friendly** moves:");
  sections.push("   - Squats with support or goblet variations.");
  sections.push("   - Pushes with incline/band options.");
  sections.push("   - Core = stability before flexion.");
  sections.push("6. Maintain **safe intensity**:");
  sections.push("   - Cap effort at RPE 6-7.");
  sections.push("   - Cue \"leave 1-2 reps in the tank.\"");
  sections.push("7. Plan for **logical flow**:");
  sections.push("   - Avoid constant floor ↔ standing transitions.");
  sections.push("   - Start with accessible \"confidence builder\" moves.");
  sections.push("   - Place tougher or higher-impact moves at the end of the circuit.");
  sections.push("8. Provide **variety for engagement**, but not overwhelm:");
  sections.push("   - Rotate specific exercises each session.");
  sections.push("   - Keep categories consistent so participants learn the rhythm.");
  sections.push("");
  
  // Equipment
  sections.push("## Available Equipment:");
  if (availableEquipment && Object.keys(availableEquipment).length > 0) {
    Object.entries(availableEquipment).forEach(([item, count]) => {
      sections.push(`- ${item}: ${count}`);
    });
  } else {
    sections.push("- Full gym equipment available");
  }
  sections.push("");
  
  // Available Exercises (from Smart Bucketing)
  sections.push("## Available Exercises (Smart Bucketing Selection):");
  sections.push("Select exercises ONLY from this pre-filtered list:");
  sections.push("");
  
  availableExercises.forEach((exercise, idx) => {
    sections.push(formatExerciseOption(exercise, idx + 1));
  });
  sections.push("");
  
  // Task
  sections.push("## Task:");
  if (repeatRounds) {
    sections.push(`Create ${rounds} rounds with ${exercisesPerRound} exercises per round.`);
    sections.push(`IMPORTANT: These ${rounds} rounds will be repeated twice in sequence, so design them to work well when performed back-to-back.`);
  } else {
    sections.push(`Create ${rounds} rounds with ${exercisesPerRound} exercises per round.`);
  }
  sections.push("");
  sections.push("You MUST:");
  sections.push(`1. Generate EXACTLY ${rounds} complete rounds`);
  sections.push(`2. Each round MUST have EXACTLY ${exercisesPerRound} exercises`);
  sections.push(`3. Total exercises needed: ${rounds * exercisesPerRound}`);
  sections.push("4. Ensure no movement pattern repeats within a round");
  sections.push("5. Balance movement patterns across the entire circuit");
  sections.push("6. Consider equipment flow and transitions");
  sections.push("7. Place exercises logically (easier → harder, standing → floor)");
  
  sections.push("");
  
  // Output Format
  sections.push("## Output Format:");
  sections.push("Return ONLY exercise IDs (ex_1, ex_2, etc.) from the provided list. Do NOT use exercise names.");
  sections.push("Use abbreviated keys to minimize tokens. Total JSON must be < 1,500 characters.");
  sections.push("");
  sections.push("```json");
  sections.push("{");
  sections.push('  "rounds": [');
  sections.push('    {"r":1,"ex":["ex_1","ex_2","ex_3"]},');
  sections.push('    {"r":2,"ex":["ex_4","ex_5","ex_6"]},');
  sections.push('    {"r":3,"ex":["ex_7","ex_8","ex_9"]},');
  sections.push('    {"r":4,"ex":["ex_10","ex_11","ex_12"]}');
  sections.push('  ]');
  sections.push("}");
  sections.push("```");
  sections.push("");
  sections.push("Optional: Include a single 'notes' field (≤140 chars) for any critical guidance.");
  
  return sections.join("\n");
}