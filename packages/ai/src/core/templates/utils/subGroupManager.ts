import type { SubGroupPossibility } from "../../../types/groupBlueprint";
import type { GroupScoredExercise } from "../../../types/groupContext";

/**
 * Utilities for managing sub-groups in group workouts
 */

/**
 * Groups clients by their shared exercises to identify natural sub-groups
 */
export function identifyNaturalSubGroups(
  exercises: GroupScoredExercise[]
): Map<string, string[]> {
  const subGroups = new Map<string, string[]>();
  
  // Group by exact client combinations
  for (const exercise of exercises) {
    const key = exercise.clientsSharing.sort().join(',');
    if (!subGroups.has(key)) {
      subGroups.set(key, []);
    }
    subGroups.get(key)!.push(exercise.id);
  }
  
  return subGroups;
}

/**
 * Assigns group labels to sub-groups for easy identification
 */
export function assignGroupLabels(
  subGroups: SubGroupPossibility[]
): Map<string, string> {
  const labels = new Map<string, string>();
  const groupsByClients = new Map<string, string>();
  
  let labelIndex = 0;
  const labelNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  
  for (const subGroup of subGroups) {
    const clientKey = subGroup.clientIds.sort().join(',');
    
    if (!groupsByClients.has(clientKey)) {
      groupsByClients.set(clientKey, `Group ${labelNames[labelIndex] || labelIndex + 1}`);
      labelIndex++;
    }
    
    labels.set(subGroup.exerciseId, groupsByClients.get(clientKey)!);
  }
  
  return labels;
}

/**
 * Calculates equipment needs based on sub-groups
 */
export function calculateEquipmentNeeds(
  subGroups: SubGroupPossibility[],
  exercises: Map<string, GroupScoredExercise>
): Map<string, number> {
  const equipmentNeeds = new Map<string, number>();
  
  // Track max concurrent usage per equipment type
  const concurrentUsage = new Map<string, number>();
  
  for (const subGroup of subGroups) {
    const exercise = exercises.get(subGroup.exerciseId);
    if (!exercise?.equipment) continue;
    
    for (const equipment of exercise.equipment) {
      const current = concurrentUsage.get(equipment) || 0;
      concurrentUsage.set(equipment, Math.max(current, subGroup.groupSize));
    }
  }
  
  return concurrentUsage;
}

/**
 * Suggests optimal pairing for sub-groups to minimize equipment conflicts
 */
export function optimizeSubGroupPairings(
  subGroups: SubGroupPossibility[],
  exercises: Map<string, GroupScoredExercise>
): Array<[SubGroupPossibility, SubGroupPossibility]> {
  const pairings: Array<[SubGroupPossibility, SubGroupPossibility]> = [];
  const used = new Set<string>();
  
  // Sort by group size (larger groups first)
  const sorted = [...subGroups].sort((a, b) => b.groupSize - a.groupSize);
  
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].exerciseId)) continue;
    
    const group1 = sorted[i];
    const exercise1 = exercises.get(group1.exerciseId);
    
    // Find best pairing (non-overlapping clients, different equipment)
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].exerciseId)) continue;
      
      const group2 = sorted[j];
      const exercise2 = exercises.get(group2.exerciseId);
      
      // Check if clients overlap
      const hasOverlap = group1.clientIds.some(id => group2.clientIds.includes(id));
      if (hasOverlap) continue;
      
      // Check equipment compatibility
      const equipment1 = new Set(exercise1?.equipment || []);
      const equipment2 = new Set(exercise2?.equipment || []);
      const hasEquipmentConflict = [...equipment1].some(eq => equipment2.has(eq));
      
      if (!hasEquipmentConflict) {
        pairings.push([group1, group2]);
        used.add(group1.exerciseId);
        used.add(group2.exerciseId);
        break;
      }
    }
  }
  
  return pairings;
}