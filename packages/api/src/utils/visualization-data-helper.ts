/**
 * Helper functions for handling visualization data serialization
 * Ensures deep nested structures are properly saved and retrieved
 */

export function prepareVisualizationDataForSave(data: any): any {
  // Deep clone to avoid mutations
  const cloned = JSON.parse(JSON.stringify(data));
  
  // Ensure all nested structures are properly serialized
  if (cloned.blueprint?.clientExercisePools) {
    // Force re-serialization of deeply nested structures
    Object.keys(cloned.blueprint.clientExercisePools).forEach(clientId => {
      const pool = cloned.blueprint.clientExercisePools[clientId];
      
      // Ensure bucketedSelection is preserved
      if (pool.bucketedSelection) {
        // Re-serialize to ensure it's not lost
        pool.bucketedSelection = JSON.parse(JSON.stringify(pool.bucketedSelection));
      }
    });
  }
  
  return cloned;
}

export function validateVisualizationData(data: any): boolean {
  if (!data?.blueprint) return false;
  
  // Check if it's a standard blueprint with bucketed selections
  if (data.blueprint.clientExercisePools) {
    const pools = Object.values(data.blueprint.clientExercisePools);
    return pools.every((pool: any) => 
      pool.bucketedSelection && 
      Array.isArray(pool.bucketedSelection.exercises) &&
      pool.bucketedSelection.exercises.length > 0
    );
  }
  
  // BMF blueprints don't need bucketed selections
  return true;
}