import { NextRequest, NextResponse } from 'next/server';
import { broadcastPreferenceUpdate } from '../../sse/preferences/route';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Broadcast the preference update
    broadcastPreferenceUpdate(data.sessionId, {
      userId: data.userId,
      sessionId: data.sessionId,
      preferences: data.preferences,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error broadcasting preference update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}