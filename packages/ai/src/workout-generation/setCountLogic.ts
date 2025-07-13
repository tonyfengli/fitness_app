/**
 * Logic for determining total sets based on client factors
 */

export interface SetCountFactors {
  strengthLevel?: string;
  intensity?: 'low' | 'moderate' | 'high';
}

/**
 * Determines the total number of sets for the session based on client factors
 * Returns a range for LLM flexibility
 */
export function determineTotalSetCount(factors: SetCountFactors): {
  minSets: number;
  maxSets: number;
  reasoning: string;
} {
  // Set range matrix based on strength x intensity
  const setRangeMatrix: Record<string, Record<string, [number, number]>> = {
    // Very low strength
    very_low: {
      low: [14, 16],
      moderate: [16, 18],
      high: [18, 20]
    },
    // Low strength
    low: {
      low: [16, 18],
      moderate: [18, 20],
      high: [20, 22]
    },
    // Moderate strength (default)
    moderate: {
      low: [17, 19],
      moderate: [19, 22],
      high: [22, 25]
    },
    // High strength
    high: {
      low: [18, 20],
      moderate: [22, 25],
      high: [25, 27]  // capped at 27
    }
  };

  // Get ranges from matrix
  const strength = factors.strengthLevel || 'moderate';
  const intensity = factors.intensity || 'moderate';
  const [minSets, maxSets] = setRangeMatrix[strength]?.[intensity] || [19, 22]; // Default to moderate/moderate

  // Generate reasoning
  const reasoning = generateSetCountReasoning(factors, minSets, maxSets);

  return {
    minSets,
    maxSets,
    reasoning
  };
}

/**
 * Generate reasoning for the set count decision
 */
function generateSetCountReasoning(factors: SetCountFactors, minSets: number, maxSets: number): string {
  const parts: string[] = [];
  
  // Strength level reasoning
  if (factors.strengthLevel === 'very_low' || factors.strengthLevel === 'low') {
    parts.push("Lower strength capacity requires conservative volume");
  } else if (factors.strengthLevel === 'high') {
    parts.push("Higher strength capacity allows for increased training volume");
  }
  
  // Intensity reasoning
  if (factors.intensity === 'high') {
    parts.push("Higher intensity increases total work capacity");
  } else if (factors.intensity === 'low') {
    parts.push("Lower intensity with controlled volume");
  }
  
  parts.push(`Total: ${minSets}-${maxSets} sets for optimal training stimulus`);
  
  return parts.join(". ");
}