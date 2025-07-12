import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { Business } from "@acme/db/schema";

export async function GET() {
  try {
    // Check if any businesses exist
    const existingBusinesses = await db.select().from(Business);
    
    if (existingBusinesses.length > 0) {
      return NextResponse.json({
        message: "Businesses already exist",
        businesses: existingBusinesses,
      });
    }

    // Create some test businesses
    const newBusinesses = await db.insert(Business).values([
      { name: "Fitness Studio A" },
      { name: "Gym Central" },
      { name: "Wellness Center" },
      { name: "Athletic Performance Lab" },
    ]).returning();

    return NextResponse.json({
      message: "Test businesses created successfully",
      businesses: newBusinesses,
    });
  } catch (error) {
    console.error("Error seeding businesses:", error);
    return NextResponse.json(
      { error: "Failed to seed businesses", details: String(error) },
      { status: 500 }
    );
  }
}