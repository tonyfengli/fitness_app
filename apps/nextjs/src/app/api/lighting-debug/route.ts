import { NextResponse } from 'next/server';

export async function GET() {
  // Check environment variables
  const envCheck = {
    HUE_BRIDGE_IP: process.env.HUE_BRIDGE_IP || 'NOT SET',
    HUE_APP_KEY: process.env.HUE_APP_KEY ? 'SET' : 'NOT SET',
    HUE_GROUP_ID: process.env.HUE_GROUP_ID || 'NOT SET',
    HUE_ENABLED: process.env.HUE_ENABLED || 'NOT SET',
    HUE_REMOTE_ENABLED: process.env.HUE_REMOTE_ENABLED || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
  };

  // Test direct connection to Hue Bridge (only if on same network)
  let bridgeTest = { status: 'not attempted', error: null as any };
  
  if (process.env.HUE_BRIDGE_IP && process.env.HUE_APP_KEY) {
    try {
      const response = await fetch(`http://${process.env.HUE_BRIDGE_IP}/api/${process.env.HUE_APP_KEY}/lights`, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const lights = await response.json();
        bridgeTest = { 
          status: 'success', 
          lightsCount: Object.keys(lights).length,
          error: null 
        };
      } else {
        bridgeTest = { 
          status: 'failed', 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      bridgeTest = { 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envCheck,
    bridgeConnectionTest: bridgeTest,
    serverInfo: {
      platform: process.platform,
      nodeVersion: process.version,
    }
  });
}