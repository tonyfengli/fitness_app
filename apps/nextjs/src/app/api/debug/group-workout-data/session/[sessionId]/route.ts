import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'session-test-data', 'group-workouts');

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    
    // Ensure directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Find the session file
    const files = await fs.readdir(DATA_DIR);
    const sessionFile = files.find(f => f.includes(sessionId) && f.endsWith('.json'));
    
    if (!sessionFile) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const content = await fs.readFile(path.join(DATA_DIR, sessionFile), 'utf-8');
    return NextResponse.json(JSON.parse(content));
    
  } catch (error) {
    console.error('Error fetching group workout session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}