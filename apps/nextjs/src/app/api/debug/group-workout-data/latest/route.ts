import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.join(
  process.cwd(),
  "session-test-data",
  "group-workouts",
);

export async function GET() {
  try {
    const latestPath = path.join(DATA_DIR, "latest-group-workout.json");

    const content = await fs.readFile(latestPath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json({ error: "No sessions found" }, { status: 404 });
  }
}
