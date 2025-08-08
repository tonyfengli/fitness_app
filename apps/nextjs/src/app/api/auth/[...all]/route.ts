import { auth } from "~/auth/server";
import { NextRequest } from "next/server";

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
    throw error;
  }
};

export const GET = handler;
export const POST = handler;
