/**
 * Builds the dynamic prompt for group workout LLM generation
 * Based on rounds 1-2 being deterministic and rounds 3-4 using LLM
 */

import type { GroupBlockBlueprint } from "../../../types/groupBlueprint";
import type { ClientContext } from "../../../types/clientContext";
import type { GroupScoredExercise } from "../../../types/groupContext";
import type { ScoredExercise } from "../../../types/scoredExercise";

interface EquipmentInventory {
  barbells: number;
  benches: number;
  cable_machine: number;
  row_machine: number;
  ab_wheel: number;
  bands: number;
  bosu_ball: number;
  kettlebells: number;
  landmine: number;
  swiss_ball: number;
  deadlift_stations: number;
  medicine_balls: number; // assuming available
  dumbbells: string; // "unlimited"
}

interface DeterministicAssignment {
  clientId: string;
  clientName: string;
  exercise: string;
  equipment: string[];
}

interface PromptBuilderInput {
  clients: ClientContext[];
  blocks: GroupBlockBlueprint[];
  round1Assignments: DeterministicAssignment[];
  round2Assignments: DeterministicAssignment[];
  equipment: EquipmentInventory;
}

// Helper to get equipment needs from exercise name
function getEquipmentFromExercise(exerciseName: string): string[] {
  const name = exerciseName.toLowerCase();
  const equipment: string[] = [];
  
  // Barbells
  if (name.includes('barbell') && !name.includes('dumbbell')) {
    equipment.push('barbell');
  }
  
  // Benches
  if (name.includes('bench') || name.includes('incline')) {
    equipment.push('bench');
  }
  
  // Dumbbells
  if (name.includes('dumbbell') || name.includes('db ')) {
    equipment.push('DB');
  }
  
  // Kettlebells
  if (name.includes('kettlebell') || name.includes('goblet')) {
    equipment.push('KB');
  }
  
  // Cable
  if (name.includes('cable') || name.includes('lat pulldown')) {
    equipment.push('cable');
  }
  
  // Bands
  if (name.includes('band')) {
    equipment.push('band');
  }
  
  // Landmine
  if (name.includes('landmine')) {
    equipment.push('landmine');
  }
  
  // Medicine ball
  if (name.includes('medicine ball') || name.includes('med ball')) {
    equipment.push('med ball');
  }
  
  // Row machine
  if (name.includes('row machine')) {
    equipment.push('row machine');
  }
  
  // Floor exercises
  if (name.includes('plank') || name.includes('dead bug') || name.includes('bird dog') || 
      name.includes('bear crawl') || name.includes('push-up')) {
    equipment.push('none');
  }
  
  // Swiss ball
  if (name.includes('swiss ball') || name.includes('stability ball')) {
    equipment.push('swiss ball');
  }
  
  return equipment.length > 0 ? equipment : ['none'];
}

// Format exercise for prompt
function formatExerciseOption(
  exercise: ScoredExercise | GroupScoredExercise,
  includeClients: boolean = false,
  clients?: ClientContext[]
): string {
  const equipment = getEquipmentFromExercise(exercise.name);
  const score = 'groupScore' in exercise ? exercise.groupScore : exercise.score;
  
  let result = `${exercise.name} (${score.toFixed(1)}, ${equipment.join('+')})`;
  
  if (includeClients && 'clientScores' in exercise && clients) {
    const clientInfo = exercise.clientScores
      .map(cs => {
        const client = clients.find((c: ClientContext) => c.user_id === cs.clientId);
        const name = client?.name.split(' ')[0] || cs.clientId;
        return `${name}:${cs.individualScore.toFixed(1)}`;
      })
      .join(', ');
    result += ` - ${clientInfo}`;
  }
  
  return result;
}

// Calculate remaining slots for each client
function calculateRemainingSlots(clients: ClientContext[]): Record<string, number> {
  const slots: Record<string, number> = {};
  
  clients.forEach(client => {
    // Default max exercises based on capacity
    let maxExercises = 6; // moderate/high
    if (client.strength_capacity === 'low' || client.skill_capacity === 'low') {
      maxExercises = 5;
    }
    
    // Subtract 2 for rounds 1-2 already used
    slots[client.user_id] = maxExercises - 2;
  });
  
  return slots;
}

export function buildGroupWorkoutPrompt(input: PromptBuilderInput): string {
  const { clients, blocks, round1Assignments, round2Assignments, equipment } = input;
  
  // Find Round 3 and Final Round blocks
  const round3Block = blocks.find(b => b.blockId === 'Round3');
  const finalRoundBlock = blocks.find(b => b.blockId === 'FinalRound');
  
  if (!round3Block || !finalRoundBlock) {
    throw new Error('Round3 and FinalRound blocks are required');
  }
  
  const remainingSlots = calculateRemainingSlots(clients);
  
  const sections: string[] = [];
  
  // Header
  sections.push(`You are a group fitness coordinator planning exercises for rounds 3 and 4 of a workout for ${clients.length} clients.`);
  sections.push('');
  
  // Clients section
  sections.push('## Clients:');
  clients.forEach(client => {
    const remaining = remainingSlots[client.user_id];
    const maxTotal = (remaining ?? 4) + 2; // Add back the 2 already used, default to 4 if undefined
    sections.push(`- ${client.name}: ${client.strength_capacity} strength/${client.skill_capacity} skill (max ${maxTotal} total exercises)`);
  });
  sections.push('');
  
  // Already completed section
  sections.push('## Already Completed:');
  sections.push('Round 1: Individual lower body exercises');
  round1Assignments.forEach(assignment => {
    sections.push(`- ${assignment.clientName}: ${assignment.exercise}`);
  });
  sections.push('Round 2: Individual pulling exercises');
  round2Assignments.forEach(assignment => {
    sections.push(`- ${assignment.clientName}: ${assignment.exercise}`);
  });
  sections.push('Each client has used 2 exercise slots.');
  sections.push('');
  
  // Remaining slots
  sections.push('## Remaining Slots:');
  clients.forEach(client => {
    const remaining = remainingSlots[client.user_id];
    sections.push(`- ${client.name}: ${remaining} left (1-2 in R3, 1-2 in R4)`);
  });
  sections.push('');
  
  // Equipment
  sections.push('## Equipment (resets each round):');
  sections.push(`- ${equipment.barbells} barbells, ${equipment.benches} benches, ${equipment.cable_machine} cable machine, ${equipment.landmine} landmine`);
  sections.push(`- ${equipment.bands} bands, ${equipment.kettlebells} kettlebells, medicine balls, dumbbells (unlimited)`);
  sections.push('');
  
  // Round 3 section
  sections.push('## Round 3 - Strength Focus:');
  sections.push('');
  sections.push('### Shared Options (score: client scores):');
  
  // Top 5 shared candidates for Round 3
  const round3Shared = round3Block.sharedCandidates.exercises.slice(0, 5);
  round3Shared.forEach((exercise, idx) => {
    const clientInfo = exercise.clientScores
      .filter(cs => cs.hasExercise)
      .map(cs => {
        const client = clients.find(c => c.user_id === cs.clientId);
        const name = client?.name.split(' ')[0] || cs.clientId;
        return `${name}:${cs.individualScore.toFixed(1)}`;
      })
      .join(', ');
    const equipment = getEquipmentFromExercise(exercise.name);
    const missingClients = clients
      .filter(c => !exercise.clientsSharing.includes(c.user_id))
      .map(c => c.name.split(' ')[0]);
    
    sections.push(`${idx + 1}. ${exercise.name} (${exercise.groupScore.toFixed(1)}: ${clientInfo}) - needs ${equipment.join('+')}`);
    if (missingClients.length > 0) {
      sections.push(`   ${missingClients.join(', ')} can't do`);
    }
  });
  
  sections.push('');
  sections.push('### Individual Options (score, equipment):');
  
  // Individual candidates for Round 3
  clients.forEach(client => {
    sections.push(`**${client.name.split(' ')[0]}:**`);
    const clientData = round3Block.individualCandidates[client.user_id];
    if (clientData?.exercises) {
      clientData.exercises.slice(0, 5).forEach((exercise, idx) => {
        sections.push(`${idx + 1}. ${formatExerciseOption(exercise)}`);
      });
    }
    sections.push('');
  });
  
  // Round 4 section
  sections.push('## Round 4 - Core/Capacity Focus:');
  sections.push('');
  sections.push('### Shared Options:');
  
  // Top 5 shared candidates for Final Round
  const round4Shared = finalRoundBlock.sharedCandidates.exercises.slice(0, 5);
  round4Shared.forEach((exercise, idx) => {
    const clientInfo = exercise.clientScores
      .filter(cs => cs.hasExercise)
      .map(cs => {
        const client = clients.find(c => c.user_id === cs.clientId);
        const name = client?.name.split(' ')[0] || cs.clientId;
        return `${name}:${cs.individualScore.toFixed(1)}`;
      })
      .join(', ');
    const equipment = getEquipmentFromExercise(exercise.name);
    const missingClients = clients
      .filter(c => !exercise.clientsSharing.includes(c.user_id))
      .map(c => c.name.split(' ')[0]);
    
    sections.push(`${idx + 1}. ${exercise.name} (${exercise.groupScore.toFixed(1)}: ${clientInfo}) - needs ${equipment.join('+')}`);
    if (missingClients.length > 0) {
      sections.push(`   ${missingClients.join(', ')} can't do`);
    }
  });
  
  sections.push('');
  sections.push('### Individual Options:');
  
  // Individual candidates for Final Round
  clients.forEach(client => {
    sections.push(`**${client.name.split(' ')[0]}:**`);
    const clientData = finalRoundBlock.individualCandidates[client.user_id];
    if (clientData?.exercises) {
      clientData.exercises.slice(0, 5).forEach((exercise, idx) => {
        sections.push(`${idx + 1}. ${formatExerciseOption(exercise)}`);
      });
    }
    sections.push('');
  });
  
  // Task section
  sections.push('## Task:');
  sections.push('Assign exercises for R3 and R4 considering:');
  sections.push('1. Equipment conflicts (e.g., only 2 benches)');
  sections.push('2. Client remaining slots');
  sections.push('3. Balance shared vs individual exercises');
  sections.push('4. Exercise variety from R1-2');
  sections.push('');
  
  // Output format
  sections.push('Output JSON:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "round3": {');
  sections.push('    "exercises": [');
  sections.push('      {');
  sections.push('        "type": "shared",');
  sections.push('        "name": "exercise name",');
  sections.push('        "clients": ["client names"],');
  sections.push('        "equipment": ["equipment used"]');
  sections.push('      },');
  sections.push('      {');
  sections.push('        "type": "individual",');
  sections.push('        "client": "name",');
  sections.push('        "exercise": "exercise name",');
  sections.push('        "equipment": ["equipment used"]');
  sections.push('      }');
  sections.push('    ],');
  sections.push('    "reasoning": "brief explanation"');
  sections.push('  },');
  sections.push('  "round4": {');
  sections.push('    "exercises": [...],');
  sections.push('    "reasoning": "..."');
  sections.push('  },');
  sections.push('  "finalSlots": {');
  sections.push('    "Hilary": {"used": X, "total": 5},');
  sections.push('    "Curtis": {"used": X, "total": 6},');
  sections.push('    "Tony": {"used": X, "total": 6}');
  sections.push('  }');
  sections.push('}');
  sections.push('```');
  
  return sections.join('\n');
}

// Export equipment inventory for reuse
export const DEFAULT_EQUIPMENT: EquipmentInventory = {
  barbells: 2,
  benches: 2,
  cable_machine: 1,
  row_machine: 1,
  ab_wheel: 1,
  bands: 3,
  bosu_ball: 1,
  kettlebells: 2,
  landmine: 1,
  swiss_ball: 1,
  deadlift_stations: 2,
  medicine_balls: 2, // assumption
  dumbbells: "unlimited"
};