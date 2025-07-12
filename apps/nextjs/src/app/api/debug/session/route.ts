import { NextResponse } from "next/server";
import { getSession } from "~/auth/server";

export async function GET() {
  const session = await getSession();
  
  return NextResponse.json({
    session,
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    userName: session?.user?.name,
    userRole: session?.user?.role,
    userKeys: session?.user ? Object.keys(session.user) : [],
  });
}