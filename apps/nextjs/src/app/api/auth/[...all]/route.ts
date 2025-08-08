import { auth } from "~/auth/server";
import { NextRequest, NextResponse } from "next/server";

const handler = async (req: NextRequest, ctx: any) => {
  console.log('[Auth Route] Request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    pathname: req.nextUrl.pathname,
  });

  try {
    const response = await auth.handler(req, ctx);
    console.log('[Auth Route] Response status:', response.status);
    return response;
  } catch (error) {
    console.error('[Auth Route] Error:', error);
    
    // Return a proper error response with details
    return NextResponse.json(
      { 
        error: 'Authentication failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
};

export const GET = handler;
export const POST = handler;
