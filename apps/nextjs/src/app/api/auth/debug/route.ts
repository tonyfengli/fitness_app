import { NextResponse } from "next/server";
import { env } from "~/env";

export async function GET() {
  // Get environment info
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    AUTH_SECRET_EXISTS: !!process.env.AUTH_SECRET,
    AUTH_SECRET_LENGTH: process.env.AUTH_SECRET?.length,
    AUTH_SECRET_PREVIEW: process.env.AUTH_SECRET ? 
      `${process.env.AUTH_SECRET.substring(0, 4)}...${process.env.AUTH_SECRET.substring(process.env.AUTH_SECRET.length - 4)}` : 
      'NOT SET',
    POSTGRES_URL_EXISTS: !!process.env.POSTGRES_URL,
    POSTGRES_URL_PREVIEW: process.env.POSTGRES_URL ? 
      process.env.POSTGRES_URL.replace(/:[^:@]+@/, ':****@').substring(0, 50) + '...' : 
      'NOT SET',
  };

  // Test database connection
  let dbStatus = 'NOT TESTED';
  try {
    const { db } = await import("@acme/db/client");
    const result = await db.execute("SELECT 1");
    dbStatus = 'CONNECTED';
  } catch (error) {
    dbStatus = `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  // Get auth configuration
  let authConfig = {};
  try {
    const { auth } = await import("~/auth/server");
    authConfig = {
      baseURL: auth.options?.baseURL || 'NOT SET',
      hasSecret: !!auth.options?.secret,
    };
  } catch (error) {
    authConfig = {
      error: error instanceof Error ? error.message : 'Failed to load auth',
    };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envInfo,
    database: {
      status: dbStatus,
    },
    auth: authConfig,
    headers: {
      host: process.env.VERCEL_URL || 'localhost',
      protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http',
    },
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}