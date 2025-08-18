import { NextResponse } from "next/server";

import { getSession } from "~/auth/server";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    user: {
      ...session.user,
      role: session.user.role || "client", // Ensure role is included
    },
    session: session.session,
  });
}
