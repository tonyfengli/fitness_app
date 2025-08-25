// Transforms Phase 2 workout organization data into the format expected by WorkoutLiveScreen

interface Phase2Organization {
  placements: Array<[string, number]>; // [clientId_exerciseName, round]
  roundNames: Record<string, string>;
  fixedAssignments: Array<{
    exerciseId: string;
    clientId: string;
    round: number;
    exerciseName?: string;
    isShared?: boolean;
    sharedWithClients?: string[];
  }>;
  llmData?: any;
  generatedAt?: string;
}

// This is what getSelections returns - a flat array of exercises
interface SelectionExercise {
  id: string;
  sessionId: string;
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  isShared: boolean;
  sharedWithClients?: string[];
  selectionSource?: string;
}

interface TransformedRound {
  name: string;
  exercisesByClient: Record<string, Array<{
    exerciseId: string;
    exerciseName: string;
    scheme?: any;
    isShared?: boolean;
    sharedWithClients?: string[];
  }>>;
}

interface TransformedOrganization {
  rounds: TransformedRound[];
  roundNames: Record<string, string>;
  originalData: Phase2Organization;
}

export function transformWorkoutDataForLiveView(
  organization: Phase2Organization,
  workouts: SelectionExercise[]  // This is actually a flat array of exercises from getSelections
): TransformedOrganization {

  // Create a map of clientId -> exerciseId -> exercise for quick lookup
  const exercisesByClient = new Map<string, Map<string, SelectionExercise>>();
  workouts.forEach(exercise => {
    if (!exercisesByClient.has(exercise.clientId)) {
      exercisesByClient.set(exercise.clientId, new Map());
    }
    exercisesByClient.get(exercise.clientId)!.set(exercise.exerciseId, exercise);
  });

  // Determine the number of rounds
  const roundNumbers = new Set<number>();
  
  // Add all rounds from roundNames (this ensures we get all rounds even if empty)
  if (organization.roundNames) {
    Object.keys(organization.roundNames).forEach(roundStr => {
      const roundNum = parseInt(roundStr);
      if (!isNaN(roundNum)) {
        roundNumbers.add(roundNum);
      }
    });
  }
  
  // Also add rounds from placements and fixed assignments (in case roundNames is incomplete)
  organization.placements?.forEach(([_, round]) => roundNumbers.add(round));
  organization.fixedAssignments?.forEach(fa => roundNumbers.add(fa.round));
  
  // Create rounds array
  const rounds: TransformedRound[] = [];
  
  // Process each round
  Array.from(roundNumbers).sort().forEach(roundNum => {
    const roundName = organization.roundNames?.[roundNum.toString()] || `Round ${roundNum}`;
    const round: TransformedRound = {
      name: `Round ${roundNum} - ${roundName}`,
      exercisesByClient: {}
    };
    
    // Group fixed assignments by exercise to handle shared exercises
    const exerciseGroups = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      clientIds: string[];
      isShared: boolean;
    }>();
    
    // First pass: group clients by exercise for this round
    organization.fixedAssignments?.forEach(fa => {
      if (fa.round === roundNum) {
        const key = fa.exerciseId;
        
        if (!exerciseGroups.has(key)) {
          // Use enhanced exercise name if available, otherwise fall back to lookup
          let exerciseName = fa.exerciseName;
          if (!exerciseName) {
            const clientExercises = exercisesByClient.get(fa.clientId);
            const exercise = clientExercises?.get(fa.exerciseId);
            exerciseName = exercise?.exerciseName || 'Unknown Exercise';
          }
          
          exerciseGroups.set(key, {
            exerciseId: fa.exerciseId,
            exerciseName: exerciseName,
            clientIds: [],
            isShared: fa.isShared || false
          });
        }
        
        exerciseGroups.get(key)!.clientIds.push(fa.clientId);
      }
    });
    
    // Update isShared flag based on actual grouping
    exerciseGroups.forEach(group => {
      group.isShared = group.clientIds.length > 1;
    });
    
    // Second pass: assign exercises to clients
    exerciseGroups.forEach(group => {
      group.clientIds.forEach(clientId => {
        if (!round.exercisesByClient[clientId]) {
          round.exercisesByClient[clientId] = [];
        }
        
        round.exercisesByClient[clientId].push({
          exerciseId: group.exerciseId,
          exerciseName: group.exerciseName,
          scheme: undefined, // getSelections doesn't include scheme data
          isShared: group.isShared,
          sharedWithClients: group.isShared ? group.clientIds.filter(id => id !== clientId) : []
        });
      });
    });
    
    // Process placements for this round
    organization.placements?.forEach(([placement, placementRound]) => {
      if (placementRound === roundNum) {
        // Extract clientId and exercise name from placement
        const clientId = placement.split('_')[0];
        const exerciseNamePart = placement.replace(clientId + '_', '').replace(/_/g, ' ');
        
        if (!round.exercisesByClient[clientId]) {
          round.exercisesByClient[clientId] = [];
        }
        
        // Find the matching exercise from the client's exercises
        const clientExercises = exercisesByClient.get(clientId);
        let matchingExercise: SelectionExercise | undefined;
        
        if (clientExercises) {
          // Try to find by matching exercise name
          matchingExercise = Array.from(clientExercises.values()).find(e => {
            const normalizedName = e.exerciseName?.toLowerCase().replace(/\s+/g, '_');
            return normalizedName === placement.replace(clientId + '_', '') ||
                   e.exerciseName?.toLowerCase() === exerciseNamePart.toLowerCase();
          });
        }
        
        if (matchingExercise) {
          round.exercisesByClient[clientId].push({
            exerciseId: matchingExercise.exerciseId,
            exerciseName: matchingExercise.exerciseName,
            scheme: undefined // getSelections doesn't include scheme data
          });
        } else {
          console.warn(`[workoutDataTransformer] Could not find matching exercise for placement: ${placement}`);
          // Still add it with the parsed name
          round.exercisesByClient[clientId].push({
            exerciseId: placement, // Use placement as fallback ID
            exerciseName: exerciseNamePart,
            scheme: undefined
          });
        }
      }
    });
    
    // Only add rounds that have exercises
    if (Object.keys(round.exercisesByClient).length > 0) {
      rounds.push(round);
    }
  });
  
  return {
    rounds,
    roundNames: organization.roundNames || {},
    originalData: organization
  };
}