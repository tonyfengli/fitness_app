// Transforms Phase 2 workout organization data into the format expected by WorkoutLiveScreen

interface Phase2Organization {
  placements: Array<[string, number]>; // [clientId_exerciseName, round]
  roundNames: Record<string, string>;
  fixedAssignments: Array<{
    exerciseId: string;
    clientId: string;
    round: number;
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
  console.log('[workoutDataTransformer] Starting transformation:', {
    placementsCount: organization.placements?.length,
    fixedAssignmentsCount: organization.fixedAssignments?.length,
    workoutsCount: workouts?.length,
    roundNamesCount: Object.keys(organization.roundNames || {}).length,
  });
  
  // Debug: Log the structure of workouts
  console.log('[workoutDataTransformer] First few exercises:', 
    workouts?.slice(0, 3).map(ex => ({
      clientId: ex.clientId,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName
    }))
  );

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
  
  // Add rounds from placements
  organization.placements?.forEach(([_, round]) => roundNumbers.add(round));
  
  // Add rounds from fixed assignments
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
    
    // Process fixed assignments for this round
    organization.fixedAssignments?.forEach(fa => {
      if (fa.round === roundNum) {
        if (!round.exercisesByClient[fa.clientId]) {
          round.exercisesByClient[fa.clientId] = [];
        }
        
        // Find the exercise details from the flat exercises array
        const clientExercises = exercisesByClient.get(fa.clientId);
        const exercise = clientExercises?.get(fa.exerciseId);
        
        round.exercisesByClient[fa.clientId].push({
          exerciseId: fa.exerciseId,
          exerciseName: exercise?.exerciseName || 'Unknown Exercise',
          scheme: undefined // getSelections doesn't include scheme data
        });
      }
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
  
  console.log('[workoutDataTransformer] Transformation complete:', {
    roundsCount: rounds.length,
    rounds: rounds.map(r => ({
      name: r.name,
      clientCount: Object.keys(r.exercisesByClient).length,
      exerciseCount: Object.values(r.exercisesByClient).reduce((sum, exercises) => sum + exercises.length, 0)
    }))
  });
  
  return {
    rounds,
    roundNames: organization.roundNames || {},
    originalData: organization
  };
}