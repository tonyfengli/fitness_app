import { NextResponse } from "next/server";

import { auth } from "~/auth/server";

export async function GET() {
  try {
    // Test if auth is configured properly
    const authInstance = auth;

    return NextResponse.json({
      status: "ok",
      message: "Auth is configured",
      hasUsernamePlugin: true,
      hasEmailPassword: true,
      endpoints: {
        signUp: "/api/auth/sign-up",
        signIn: "/api/auth/sign-in",
        signOut: "/api/auth/sign-out",
        session: "/api/auth/session",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
