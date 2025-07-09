import { NextRequest, NextResponse } from 'next/server';
import { interpretWorkout, determineTotalSetCount } from '@acme/ai';

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
    });
  } catch (error) {
    console.error('Error in workout interpretation:', error);
    return NextResponse.json(
      { error: 'Failed to interpret workout' },
      { status: 500 }
    );
  }
}