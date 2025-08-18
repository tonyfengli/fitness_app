import { NextResponse } from "next/server";

import {
  clearDebugLogs,
  getDebugLogs,
  getDebugReport,
  setDebugEnabled,
} from "@acme/ai";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format === "report") {
    return NextResponse.json(getDebugReport());
  }

  return NextResponse.json(getDebugLogs());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "clear") {
      return NextResponse.json(clearDebugLogs());
    }

    if (body.action === "enable") {
      return NextResponse.json(setDebugEnabled(true));
    }

    if (body.action === "disable") {
      return NextResponse.json(setDebugEnabled(false));
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'clear', 'enable', or 'disable'" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
