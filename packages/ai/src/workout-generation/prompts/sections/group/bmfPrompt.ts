import type { GroupBlockBlueprint } from '../../../../types';
import type { DeterministicAssignment, GroupWorkoutConfig } from '../../types';
import { generateClientProfiles } from './clientProfiles';
import { generateEquipmentConstraints } from './equipmentConstraints';

// Helper to get equipment from exercise name
function getEquipmentFromExercise(exerciseName: string): string[] {
  const name = exerciseName.toLowerCase();
  const equipment: string[] = [];
  
  if (name.includes('barbell') && !name.includes('dumbbell')) equipment.push('barbell');
  if (name.includes('bench') || name.includes('incline')) equipment.push('bench');
  if (name.includes('dumbbell') || name.includes('db ')) equipment.push('DB');
  if (name.includes('kettlebell') || name.includes('goblet')) equipment.push('KB');
  if (name.includes('cable') || name.includes('lat pulldown')) equipment.push('cable');
  if (name.includes('band')) equipment.push('band');
  if (name.includes('landmine')) equipment.push('landmine');
  if (name.includes('medicine ball') || name.includes('med ball')) equipment.push('med ball');
  if (name.includes('row machine')) equipment.push('row machine');
  if (name.includes('plank') || name.includes('dead bug') || name.includes('bird dog') || 
      name.includes('bear crawl') || name.includes('push-up')) {
    equipment.push('none');
  }
  if (name.includes('swiss ball') || name.includes('stability ball')) equipment.push('swiss ball');
  
  return equipment.length > 0 ? equipment : ['none'];
}

// Format exercise for display
function formatExerciseOption(exercise: any, clients?: any[]): string {
  const equipment = getEquipmentFromExercise(exercise.name);
  const score = exercise.groupScore || exercise.score;
  
  let result = `${exercise.name} (${score.toFixed(1)}, ${equipment.join('+')})`;
  
  // Mark client includes
  if (exercise.scoreBreakdown?.includeExerciseBoost > 0) {
    result += ' [CLIENT REQUEST]';
  }
  
  return result;
}

export function generateBMFGroupPrompt(config: GroupWorkoutConfig): string {
  const { clients, equipment, blueprint, deterministicAssignments } = config;
  
  // Find specific blocks
  const round3Block = blueprint.find(b => b.blockId === 'Round3');
  const finalRoundBlock = blueprint.find(b => b.blockId === 'FinalRound');
  
  if (!round3Block || !finalRoundBlock) {
    throw new Error('BMF template requires Round3 and FinalRound blocks');
  }
  
  const sections: string[] = [];
  
  // Header
  sections.push(`You are a group fitness coordinator planning exercises for rounds 3 and 4 of a workout for ${clients.length} clients.`);
  sections.push('');
  
  // Movement Pattern Overview
  sections.push('## Workout Structure:');
  sections.push('- Round 1: Lower Body (squat/hinge/lunge) ✓');
  sections.push('- Round 2: Pull (vertical/horizontal pull) ✓');
  sections.push('- Round 3: Client goal-focused strength work (ideally including push for balance)');
  sections.push('- Round 4: Client goal-focused finisher (core/metabolic burnout)');
  sections.push('');
  sections.push('**Remember: Client muscle targets and goals take priority over movement pattern balance**');
  sections.push('');
  
  // Clients
  sections.push(generateClientProfiles(clients));
  sections.push('');
  
  // Already completed
  sections.push('## Already Completed:');
  if (deterministicAssignments?.Round1) {
    sections.push('Round 1: Lower body (squat/hinge/lunge patterns)');
    deterministicAssignments.Round1.forEach(assignment => {
      sections.push(`- ${assignment.clientName}: ${assignment.exercise}`);
    });
  }
  if (deterministicAssignments?.Round2) {
    sections.push('Round 2: Pulling (vertical/horizontal pull patterns)');
    deterministicAssignments.Round2.forEach(assignment => {
      sections.push(`- ${assignment.clientName}: ${assignment.exercise}`);
    });
  }
  
  // Count already used slots including pre-assigned client requests
  const slotsUsedPerClient = new Map<string, number>();
  clients.forEach(client => {
    let used = 2; // Round 1 and 2
    
    // Add any pre-assigned client requests
    if (deterministicAssignments?.Round3) {
      used += deterministicAssignments.Round3.filter(a => a.clientId === client.user_id).length;
    }
    if (deterministicAssignments?.FinalRound) {
      used += deterministicAssignments.FinalRound.filter(a => a.clientId === client.user_id).length;
    }
    
    slotsUsedPerClient.set(client.user_id, used);
  });
  
  sections.push('');
  
  // Show pre-assigned exercises
  if (deterministicAssignments?.Round3 || deterministicAssignments?.FinalRound) {
    sections.push('## Pre-Assigned Exercises:');
    if (deterministicAssignments?.Round3 && deterministicAssignments.Round3.length > 0) {
      sections.push('Round 3:');
      deterministicAssignments.Round3.forEach(assignment => {
        const reason = assignment.reason === 'client_request' ? 'CLIENT REQUEST' : 'MUSCLE TARGET';
        sections.push(`- ${assignment.clientName}: ${assignment.exercise} (${reason} - ALREADY ASSIGNED)`);
      });
    }
    if (deterministicAssignments?.FinalRound && deterministicAssignments.FinalRound.length > 0) {
      sections.push('Final Round:');
      deterministicAssignments.FinalRound.forEach(assignment => {
        const reason = assignment.reason === 'client_request' ? 'CLIENT REQUEST' : 'MUSCLE TARGET';
        sections.push(`- ${assignment.clientName}: ${assignment.exercise} (${reason} - ALREADY ASSIGNED)`);
      });
    }
    sections.push('');
  }
  
  // Track muscle target coverage
  sections.push('## Muscle Target Coverage:');
  clients.forEach(client => {
    if (!client.muscle_target || client.muscle_target.length === 0) {
      sections.push(`- ${client.name}: No specific targets`);
      return;
    }
    
    const targets = client.muscle_target.join(', ');
    const covered: string[] = [];
    
    // Check all rounds for coverage
    if (deterministicAssignments) {
      ['Round1', 'Round2', 'Round3', 'FinalRound'].forEach(round => {
        const assignments = deterministicAssignments[round];
        if (assignments) {
          const clientAssignment = assignments.find(a => a.clientId === client.user_id);
          if (clientAssignment && clientAssignment.reason === 'muscle_target') {
            covered.push(round);
          }
        }
      });
    }
    
    sections.push(`- ${client.name}: Targets ${targets} ${covered.length > 0 ? '(covered in: ' + covered.join(', ') + ')' : '❌ MUST ASSIGN'}`);
  });
  sections.push('');
  
  // Track shared exercise count
  sections.push('## Shared Exercise Status:');
  // This would need to be calculated from the blueprint data
  sections.push('**REQUIREMENT: Each client must have at least 1 shared exercise across all rounds**');
  sections.push('(Shared exercises in R1-R2 count toward this requirement)');
  sections.push('');
  
  // Client set targets
  sections.push('## Client Set Targets:');
  clients.forEach(client => {
    const totalSets = client.default_sets || 20; // Fallback to 20 if not specified
    sections.push(`- ${client.name}: ${totalSets} total sets target`);
  });
  sections.push('');
  
  // Remaining slots
  sections.push('## Remaining Slots:');
  clients.forEach(client => {
    const capacity = client.strength_capacity === 'low' || client.skill_capacity === 'low' ? 5 : 6;
    const used = slotsUsedPerClient.get(client.user_id) || 2;
    const remaining = capacity - used;
    
    // Calculate how many are already assigned to each round
    const r3Assigned = deterministicAssignments?.Round3?.filter(a => a.clientId === client.user_id).length || 0;
    const r4Assigned = deterministicAssignments?.FinalRound?.filter(a => a.clientId === client.user_id).length || 0;
    
    sections.push(`- ${client.name}: ${remaining} left (${1-r3Assigned} in R3, ${1-r4Assigned} in R4)`);
  });
  sections.push('');
  
  // Equipment
  sections.push(generateEquipmentConstraints(equipment));
  sections.push('');
  
  // Round 3
  sections.push('## Round 3 - Strength Focus:');
  sections.push('**Primary Goal: Prioritize exercises that align with each client\'s muscle targets and fitness goals**');
  sections.push('**Secondary Goal: Maintain movement pattern balance (include pushing movements to balance the pulling from Round 2)**');
  sections.push('Examples:');
  sections.push('- Client targeting chest → bench press, dips, push-ups');
  sections.push('- Client targeting shoulders → overhead press, lateral raises'); 
  sections.push('- Client targeting legs → leg press, lunges, step-ups');
  sections.push('- Client lessening shoulders → avoid overhead work, choose bench/horizontal movements');
  sections.push('');
  sections.push('### Shared Options:');
  
  const round3Shared = round3Block.sharedCandidates.exercises.slice(0, 5);
  round3Shared.forEach((exercise, idx) => {
    const clientNames = clients
      .filter(c => exercise.clientsSharing.includes(c.user_id))
      .map(c => c.name.split(' ')[0]);
    const missingClients = clients
      .filter(c => !exercise.clientsSharing.includes(c.user_id))
      .map(c => c.name.split(' ')[0]);
    
    sections.push(`${idx + 1}. ${formatExerciseOption(exercise)}`);
    if (clientNames.length > 0) {
      sections.push(`   Can do: ${clientNames.join(', ')}`);
    }
    if (missingClients.length > 0) {
      sections.push(`   Can't do: ${missingClients.join(', ')}`);
    }
  });
  
  sections.push('');
  sections.push('### Individual Options (score, equipment):');
  
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
  
  // Round 4
  sections.push('## Round 4 - Core/Capacity Focus:');
  sections.push('**Primary Goal: Select exercises that target client goals while incorporating core/metabolic work**');
  sections.push('**Secondary Goal: End the workout strong with burnout-style finishers (high reps, metabolic conditioning)**');
  sections.push('Examples:');
  sections.push('- Core-focused finishers: plank variations, dead bugs, carries');
  sections.push('- Metabolic finishers: burpees, mountain climbers, battle ropes');
  sections.push('- Client targeting abs → prioritize direct core work');
  sections.push('- Client needing conditioning → prioritize metabolic/cardio finishers');
  sections.push('');
  sections.push('### Shared Options:');
  
  const round4Shared = finalRoundBlock.sharedCandidates.exercises.slice(0, 5);
  round4Shared.forEach((exercise, idx) => {
    const clientNames = clients
      .filter(c => exercise.clientsSharing.includes(c.user_id))
      .map(c => c.name.split(' ')[0]);
    const missingClients = clients
      .filter(c => !exercise.clientsSharing.includes(c.user_id))
      .map(c => c.name.split(' ')[0]);
    
    sections.push(`${idx + 1}. ${formatExerciseOption(exercise)}`);
    if (clientNames.length > 0) {
      sections.push(`   Can do: ${clientNames.join(', ')}`);
    }
    if (missingClients.length > 0) {
      sections.push(`   Can't do: ${missingClients.join(', ')}`);
    }
  });
  
  sections.push('');
  sections.push('### Individual Options:');
  
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
  
  // Task
  sections.push('## Task:');
  sections.push('Assign exercises for R3 and R4 following these MANDATORY requirements:');
  sections.push('');
  sections.push('**MANDATORY (Must be satisfied):**');
  sections.push('1. Each client with muscle targets MUST receive exercises for those targets');
  sections.push('2. Each client MUST have at least 1 shared exercise (across R1-R4)');
  sections.push('3. Respect all "lessen" requests (never assign exercises for those muscles)');
  sections.push('4. DO NOT re-assign any exercises marked as "ALREADY ASSIGNED"');
  sections.push('');
  sections.push('**PRIORITIES (After mandatory requirements):**');
  sections.push('1. For clients with no preferences: prioritize movement balance and shared exercises');
  sections.push('2. R3: Focus on strength work, ideally including push movements');
  sections.push('3. R4: Create a strong finish with core/metabolic work');
  sections.push('4. Use shared exercises when multiple clients have similar needs');
  sections.push('');
  sections.push('**CONSTRAINTS:**');
  sections.push('1. Equipment limits (2 benches, 1 cable, etc.)');
  sections.push('2. Client remaining slots');
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
  
  // Dynamic client slots
  clients.forEach(client => {
    const capacity = client.strength_capacity === 'low' || client.skill_capacity === 'low' ? 5 : 6;
    sections.push(`    "${client.name}": {"used": X, "total": ${capacity}},`);
  });
  
  sections.push('  }');
  sections.push('}');
  sections.push('```');
  
  return sections.join('\n');
}