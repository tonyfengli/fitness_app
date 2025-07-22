import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'session-test-data', 'group-workouts');

// Helper to ensure directory exists
async function ensureDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create directory:', error);
  }
}

// GET endpoints
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  try {
    await ensureDirectory();
    
    // Status endpoint
    if (pathname.endsWith('/status')) {
      // For now, always enabled in development
      return NextResponse.json({ enabled: true });
    }
    
    // List sessions
    if (pathname.endsWith('/list')) {
      const files = await fs.readdir(DATA_DIR);
      const groupFiles = files.filter(f => f.startsWith('group_') && f.endsWith('.json'));
      
      const sessions = await Promise.all(
        groupFiles.map(async (filename) => {
          const filepath = path.join(DATA_DIR, filename);
          const content = await fs.readFile(filepath, 'utf-8');
          const data = JSON.parse(content);
          
          return {
            sessionId: data.sessionId,
            timestamp: data.timestamp,
            clientCount: data.groupSize,
            templateType: data.summary.templateType,
            cohesionSatisfaction: data.summary.cohesionSatisfaction,
            warningCount: data.summary.warningCount,
            filename
          };
        })
      );
      
      // Sort by timestamp descending
      sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return NextResponse.json(sessions);
    }
    
    // Get latest session
    if (pathname.endsWith('/latest')) {
      const latestPath = path.join(DATA_DIR, 'latest-group-workout.json');
      try {
        const content = await fs.readFile(latestPath, 'utf-8');
        return NextResponse.json(JSON.parse(content));
      } catch (error) {
        return NextResponse.json({ error: 'No sessions found' }, { status: 404 });
      }
    }
    
    // Get specific session
    const sessionMatch = pathname.match(/\/session\/([a-f0-9-]+)$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const files = await fs.readdir(DATA_DIR);
      const sessionFile = files.find(f => f.includes(sessionId));
      
      if (!sessionFile) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      const content = await fs.readFile(path.join(DATA_DIR, sessionFile), 'utf-8');
      return NextResponse.json(JSON.parse(content));
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    
  } catch (error) {
    console.error('Error in group workout debug API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST endpoints
export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Enable/disable endpoints (for future use)
  if (pathname.endsWith('/enable')) {
    return NextResponse.json({ success: true, message: 'Group workout test data enabled' });
  }
  
  if (pathname.endsWith('/disable')) {
    return NextResponse.json({ success: true, message: 'Group workout test data disabled' });
  }
  
  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
}

// DELETE endpoints
export async function DELETE(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  if (pathname.endsWith('/clear')) {
    try {
      await ensureDirectory();
      const files = await fs.readdir(DATA_DIR);
      const groupFiles = files.filter(f => f.startsWith('group_') && f.endsWith('.json'));
      
      await Promise.all(
        groupFiles.map(f => fs.unlink(path.join(DATA_DIR, f)))
      );
      
      // Also remove latest file
      try {
        await fs.unlink(path.join(DATA_DIR, 'latest-group-workout.json'));
      } catch (error) {
        // Ignore if doesn't exist
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Cleared ${groupFiles.length} group workout sessions` 
      });
      
    } catch (error) {
      console.error('Error clearing sessions:', error);
      return NextResponse.json({ error: 'Failed to clear sessions' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
}