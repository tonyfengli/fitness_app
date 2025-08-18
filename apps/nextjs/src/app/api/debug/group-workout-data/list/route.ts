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
    await fs.mkdir(DATA_DIR, { recursive: true });

    const files = await fs.readdir(DATA_DIR);
    const groupFiles = files.filter(
      (f) => f.startsWith("group_") && f.endsWith(".json"),
    );

    const sessions = await Promise.all(
      groupFiles.map(async (filename) => {
        const filepath = path.join(DATA_DIR, filename);
        const content = await fs.readFile(filepath, "utf-8");
        const data = JSON.parse(content);

        return {
          sessionId: data.sessionId,
          timestamp: data.timestamp,
          clientCount: data.groupSize,
          templateType: data.summary.templateType,
          cohesionSatisfaction: data.summary.cohesionSatisfaction,
          warningCount: data.summary.warningCount,
          filename,
        };
      }),
    );

    // Sort by timestamp descending
    sessions.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error listing group workout sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 },
    );
  }
}
