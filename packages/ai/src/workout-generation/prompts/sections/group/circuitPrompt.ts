import type { GroupWorkoutConfig } from "../../types";
import type { ClientContext } from "../../../../types/clientContext";
import type { CircuitConfig } from "@codebase/validators";

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
  return `${index}. ${exercise.name} (${exercise.movementPattern}, ${exercise.primaryMuscle}, ${equipment.join("+")})`;
}

export function generateCircuitGroupPrompt(config: CircuitPromptConfig): string {
  const { clients, equipment: availableEquipment, blueprint, circuitConfig } = config;
  
  // Get circuit configuration from session settings (no flexibility)
  const rounds = circuitConfig?.config?.rounds || circuitConfig?.rounds || 3;
  const exercisesPerRound = circuitConfig?.config?.exercisesPerRound || circuitConfig?.exercisesPerRound || 6;
  const workDuration = circuitConfig?.config?.workDuration || circuitConfig?.workDuration || 45;
  const restDuration = circuitConfig?.config?.restDuration || circuitConfig?.restDuration || 15;
  const restBetweenRounds = circuitConfig?.config?.restBetweenRounds || circuitConfig?.restBetweenRounds || 60;
  const repeatRounds = circuitConfig?.config?.repeatRounds || false;
  
  // Calculate total rounds including repeats
  const totalRounds = repeatRounds ? rounds * 2 : rounds;
  
  // Get the filtered exercise pool from the blueprint
  const exerciseBlock = blueprint.find(b => b.blockId === 'circuit_exercises');
  if (!exerciseBlock) {
    throw new Error("Circuit template requires circuit_exercises block");
  }
  
  // For circuits, we want all clients to do the same exercises
  // So we'll use the shared candidates primarily
  const sharedExercises = exerciseBlock.sharedCandidates?.exercises || [];
  
  // If we need more exercises, we can pull from individual pools
  // But prefer exercises that multiple clients can do
  const allIndividualExercises: CircuitExercise[] = [];
  Object.values(exerciseBlock.individualCandidates).forEach((clientData: any) => {
    if (clientData?.exercises) {
      allIndividualExercises.push(...clientData.exercises);
    }
  });
  
  // Combine and deduplicate exercises
  const exerciseMap = new Map<string, CircuitExercise>();
  
  // Add shared exercises first (higher priority)
  sharedExercises.forEach((ex: any) => {
    exerciseMap.set(ex.name, {
      name: ex.name,
      equipment: getEquipmentFromExercise(ex),
      movementPattern: ex.movementPattern || 'unknown',
      primaryMuscle: ex.primaryMuscle || 'unknown',
      score: ex.groupScore || ex.score || 5.0
    });
  });
  
  // Add individual exercises if we need more
  allIndividualExercises.forEach((ex: any) => {
    if (!exerciseMap.has(ex.name)) {
      exerciseMap.set(ex.name, {
        name: ex.name,
        equipment: getEquipmentFromExercise(ex),
        movementPattern: ex.movementPattern || 'unknown',
        primaryMuscle: ex.primaryMuscle || 'unknown',
        score: ex.score || 5.0
      });
    }
  });
  
  // Convert to array and sort by score - use only Smart Bucketing Selection (top 20-30)
  const availableExercises = Array.from(exerciseMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30); // Smart Bucketing Selection
  
  const sections: string[] = [];
  
  // Header
  sections.push(`You are designing a full-body circuit workout for a group (ages 20-50), coached live.`);
  sections.push(`There is only ONE station: everyone performs the same exercise at the same time, then moves to the next together.`);
  sections.push("");
  
  // Session Parameters (from configuration - no flexibility)
  sections.push("## Session Parameters");
  sections.push(`- Work: ${workDuration}s, Rest: ${restDuration}s`);
  sections.push(`- Total rounds: ${totalRounds}${repeatRounds ? ' (includes repeat rounds)' : ''}`);
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
  sections.push(`Create ${totalRounds} rounds with ${exercisesPerRound} exercises per round.`);
  sections.push("");
  sections.push("You MUST:");
  sections.push(`1. Generate EXACTLY ${totalRounds} complete rounds`);
  sections.push(`2. Each round MUST have EXACTLY ${exercisesPerRound} exercises`);
  sections.push(`3. Total exercises needed: ${totalRounds * exercisesPerRound}`);
  sections.push("4. Ensure no movement pattern repeats within a round");
  sections.push("5. Balance movement patterns across the entire circuit");
  sections.push("6. Consider equipment flow and transitions");
  sections.push("7. Place exercises logically (easier → harder, standing → floor)");
  
  sections.push("");
  
  // Output Format
  sections.push("## Output Format:");
  sections.push("Return ONLY exercise names from the provided list. Do not include movement patterns, muscles, equipment, or notes.");
  sections.push("Use abbreviated keys to minimize tokens. Total JSON must be < 1,500 characters.");
  sections.push("");
  sections.push("```json");
  sections.push("{");
  sections.push('  "rounds": [');
  sections.push('    {"r":1,"ex":["Goblet Squat","Push-Ups","Single-Leg Glute Bridge","Upright Row","Dead Bug","Banded Suitcase Marches"]},');
  sections.push('    {"r":2,"ex":["exercise1","exercise2","exercise3","exercise4","exercise5","exercise6"]},');
  sections.push('    {"r":3,"ex":["exercise1","exercise2","exercise3","exercise4","exercise5","exercise6"]},');
  sections.push('    {"r":4,"ex":["exercise1","exercise2","exercise3","exercise4","exercise5","exercise6"]},');
  sections.push('    {"r":5,"ex":["exercise1","exercise2","exercise3","exercise4","exercise5","exercise6"]},');
  sections.push('    {"r":6,"ex":["exercise1","exercise2","exercise3","exercise4","exercise5","exercise6"]}');
  sections.push('  ]');
  sections.push("}");
  sections.push("```");
  sections.push("");
  sections.push("Optional: Include a single 'notes' field (≤140 chars) for any critical guidance.");
  
  return sections.join("\n");
}