import { NextResponse } from 'next/server';
import { saveCurrentAsScenario } from '@acme/ai/utils/debugToTest';

export async function POST(request: Request) {
  try {
    const { name, description, notes } = await request.json();
    
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }
    
    const scenario = saveCurrentAsScenario(name, description, notes);
    
    if (!scenario) {
      return NextResponse.json(
        { error: 'No debug data found. Run a filter first!' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      id: scenario.id,
      filename: `${scenario.name}_${scenario.id}.json`
    });
  } catch (error) {
    console.error('Error saving scenario:', error);
    return NextResponse.json(
      { error: 'Failed to save scenario' },
      { status: 500 }
    );
  }
}