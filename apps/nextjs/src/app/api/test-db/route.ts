import { NextResponse } from "next/server";
import { db } from "@acme/db/client";

export async function GET() {
  try {
    // Simple database connectivity test
    const posts = await db.query.Post.findMany({
      limit: 1,
    });
    
    return NextResponse.json({
      success: true,
      message: "Database connection successful!",
      timestamp: new Date().toISOString(),
      postCount: posts.length,
      connectionTest: "✅ Connected to Supabase via Drizzle ORM",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed!",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        connectionTest: "❌ Failed to connect to database",
      },
      { status: 500 }
    );
  }
}