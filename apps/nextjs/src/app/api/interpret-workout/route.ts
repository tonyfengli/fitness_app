import { NextRequest, NextResponse } from 'next/server';
import { interpretWorkout } from '@acme/ai';

// Simple set count calculation based on strength level and intensity
function determineTotalSetCount(params: { strengthLevel?: string; intensity?: string }) {
  const { strengthLevel = 'intermediate', intensity = 'moderate' } = params;
  
  // Base set counts
  const baseSets = {
    beginner: { low: 20, moderate: 24, high: 28 },
    intermediate: { low: 24, moderate: 28, high: 32 },
    advanced: { low: 28, moderate: 32, high: 36 }
  };
  
  const level = strengthLevel.toLowerCase() as keyof typeof baseSets;
  const int = intensity.toLowerCase() as keyof typeof baseSets.beginner;
  
  const minSets = baseSets[level]?.[int] || 24;
  const maxSets = minSets + 4;
  
  return { min: minSets, max: maxSets };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { exercises, clientContext } = body;

    if (!exercises) {
      return NextResponse.json(
        { error: 'No exercises provided' },
        { status: 400 }
      );
    }

    // Calculate set range
    const setRange = determineTotalSetCount({
      strengthLevel: clientContext?.strengthLevel,
      intensity: clientContext?.intensity
    });

    const result = await interpretWorkout(exercises, clientContext);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      interpretation: result.interpretation,
      structuredOutput: result.structuredOutput,
      setRange, // Include set range in response
      rawResponse: result.interpretation, // Include raw LLM response for debugging
      timing: result.timing, // Include timing breakdown
    });
  } catch (error) {
    console.error('Error in workout interpretation:', error);
    return NextResponse.json(
      { error: 'Failed to interpret workout' },
      { status: 500 }
    );
  }
}