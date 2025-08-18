"use client";

import { useEffect } from "react";

export function GroupTestDataInitializer() {
  useEffect(() => {
    // Only load in development
    if (process.env.NODE_ENV !== "development") return;

    // Group workout test data client
    const groupTestData = {
      async enable() {
        const response = await fetch("/api/debug/group-workout-data/enable", {
          method: "POST",
        });
        if (!response.ok)
          throw new Error("Failed to enable group workout test data");
        console.log("✅ Group workout test data logging enabled");
      },

      async disable() {
        const response = await fetch("/api/debug/group-workout-data/disable", {
          method: "POST",
        });
        if (!response.ok)
          throw new Error("Failed to disable group workout test data");
        console.log("❌ Group workout test data logging disabled");
      },

      async isEnabled() {
        const response = await fetch("/api/debug/group-workout-data/status");
        if (!response.ok) throw new Error("Failed to check status");
        const data = await response.json();
        return data.enabled;
      },

      async listSessions() {
        const response = await fetch("/api/debug/group-workout-data/list");
        if (!response.ok) throw new Error("Failed to list sessions");
        const sessions = await response.json();

        console.log(`📁 Found ${sessions.length} group workout sessions`);
        sessions.forEach((s: any, i: number) => {
          const satisfaction = s.cohesionSatisfaction;
          const satisfactionScore =
            satisfaction.fullyMet /
              (satisfaction.fullyMet +
                satisfaction.partiallyMet +
                satisfaction.notMet) || 0;

          console.log(`${i + 1}. ${s.sessionId.substring(0, 8)}...`);
          console.log(
            `   Clients: ${s.clientCount} | Template: ${s.templateType}`,
          );
          console.log(
            `   Cohesion: ${(satisfactionScore * 100).toFixed(0)}% satisfied`,
          );
          console.log(`   Warnings: ${s.warningCount}`);
          console.log(`   Time: ${new Date(s.timestamp).toLocaleString()}`);
        });

        return sessions;
      },

      async getSession(sessionId: string) {
        const response = await fetch(
          `/api/debug/group-workout-data/session/${sessionId}`,
        );
        if (!response.ok) throw new Error("Session not found");
        return response.json();
      },

      async getLatest() {
        const response = await fetch("/api/debug/group-workout-data/latest");
        if (!response.ok) throw new Error("No sessions found");
        const data = await response.json();

        console.log("📊 Latest Group Workout Session");
        console.log(`Session ID: ${data.sessionId}`);
        console.log(`Clients: ${data.groupSize}`);
        console.log(`Template: ${data.summary.templateType}`);
        console.log("\n📈 Performance Metrics:");
        console.log(`Total Time: ${data.summary.totalProcessingTimeMs}ms`);
        console.log(
          `- Phase 1&2: ${data.summary.phaseBreakdown.phase1_2_parallel}ms`,
        );
        console.log(
          `- Phase 2.5: ${data.summary.phaseBreakdown.phase2_5_merge}ms`,
        );
        console.log(
          `- Phase B: ${data.summary.phaseBreakdown.phaseB_blueprint}ms`,
        );

        return data;
      },

      async analyzeCohesion(sessionId: string) {
        const session = await this.getSession(sessionId);

        const analysis: any = {
          sessionId,
          overallCohesionScore: 0,
          blockAnalysis: [],
          clientSatisfaction: [],
          recommendations: [],
        };

        // Analyze each block
        for (const block of session.phaseB.slotAllocationDetails) {
          const targetShared = block.allocation.targetSharedSlots;
          const actualShared = block.allocation.finalSharedSlots;
          const ratio = targetShared > 0 ? actualShared / targetShared : 1;

          // Calculate quality based on client overlap
          const excellentCount =
            block.candidateStats.sharedCandidatesQuality.excellent || 0;
          const goodCount =
            block.candidateStats.sharedCandidatesQuality.good || 0;
          const quality =
            (excellentCount * 2 + goodCount) / Math.max(1, actualShared);

          // Get top shared exercises
          const blockData = session.phase2_5.blockScoringData.find(
            (b: any) => b.blockId === block.blockId,
          );
          const topShared =
            blockData?.cohesionBonuses
              .slice(0, 3)
              .map((e: any) => e.exerciseName) || [];

          analysis.blockAnalysis.push({
            blockId: block.blockId,
            targetSharedRatio:
              block.allocation.targetSharedSlots / block.allocation.totalSlots,
            actualSharedRatio:
              block.allocation.finalSharedSlots / block.allocation.totalSlots,
            sharedExerciseQuality: quality,
            topSharedExercises: topShared,
          });
        }

        // Analyze client satisfaction
        for (const status of session.phaseB.cohesionAnalysis.finalStatus) {
          const client = session.groupContext.clients.find(
            (c: any) => c.user_id === status.clientId,
          );
          analysis.clientSatisfaction.push({
            clientName: client?.name || status.clientId,
            targetRatio: status.targetSharedRatio,
            actualRatio: status.actualSharedRatio,
            satisfactionLevel: status.satisfied
              ? "Satisfied"
              : status.actualSharedRatio / status.targetSharedRatio > 0.7
                ? "Partially Met"
                : "Not Met",
          });
        }

        // Calculate overall score
        const avgSatisfaction =
          analysis.clientSatisfaction.reduce(
            (sum: number, c: any) => sum + c.actualRatio / c.targetRatio,
            0,
          ) / analysis.clientSatisfaction.length;
        analysis.overallCohesionScore = Math.min(1, avgSatisfaction);

        // Generate recommendations
        if (analysis.overallCohesionScore < 0.8) {
          analysis.recommendations.push(
            "Consider adjusting cohesion ratios for better satisfaction",
          );
        }

        const lowQualityBlocks = analysis.blockAnalysis.filter(
          (b: any) => b.sharedExerciseQuality < 1.5,
        );
        if (lowQualityBlocks.length > 0) {
          analysis.recommendations.push(
            `Blocks ${lowQualityBlocks.map((b: any) => b.blockId).join(", ")} have low shared exercise quality`,
          );
        }

        console.log("🎯 Cohesion Analysis");
        console.log(
          `Overall Score: ${(analysis.overallCohesionScore * 100).toFixed(1)}%`,
        );
        console.log("\n📊 Block Analysis:");
        analysis.blockAnalysis.forEach((b: any) => {
          console.log(
            `Block ${b.blockId}: ${(b.actualSharedRatio * 100).toFixed(0)}% shared (target: ${(b.targetSharedRatio * 100).toFixed(0)}%)`,
          );
          console.log(`  Quality: ${b.sharedExerciseQuality.toFixed(1)}/5`);
          console.log(`  Top Shared: ${b.topSharedExercises.join(", ")}`);
        });

        console.log("\n👥 Client Satisfaction:");
        analysis.clientSatisfaction.forEach((c: any) => {
          console.log(
            `${c.clientName}: ${c.satisfactionLevel} (${(c.actualRatio * 100).toFixed(0)}% shared)`,
          );
        });

        if (analysis.recommendations.length > 0) {
          console.log("\n💡 Recommendations:");
          analysis.recommendations.forEach((r: string) =>
            console.log(`- ${r}`),
          );
        }

        return analysis;
      },

      async compareClients(sessionId: string) {
        const session = await this.getSession(sessionId);
        const comparisons: any[] = [];

        // Build exercise overlap data
        const exerciseClientMap = new Map<string, Set<string>>();
        for (const client of session.phaseA.clients) {
          for (const exercise of client.phase2.topExercises) {
            if (!exerciseClientMap.has(exercise.id)) {
              exerciseClientMap.set(exercise.id, new Set());
            }
            exerciseClientMap.get(exercise.id)!.add(client.clientId);
          }
        }

        const totalClients = session.phaseA.clients.length;

        // Analyze each client
        for (const client of session.phaseA.clients) {
          const clientExercises = new Set(
            client.phase2.topExercises.map((e: any) => e.id),
          );

          const sharedWithAll: string[] = [];
          const sharedWithSome: string[] = [];
          const unique: string[] = [];

          for (const exercise of client.phase2.topExercises) {
            const sharingClients =
              exerciseClientMap.get(exercise.id)?.size || 0;

            if (sharingClients === totalClients) {
              sharedWithAll.push(exercise.name);
            } else if (sharingClients > 1) {
              sharedWithSome.push(exercise.name);
            } else {
              unique.push(exercise.name);
            }
          }

          const diversity =
            unique.length / Math.max(1, client.phase2.topExercises.length);

          comparisons.push({
            clientName: client.clientName,
            preferences: {
              intensity: client.preferences.intensity,
              sessionGoal: client.preferences.sessionGoal,
              muscleTargets: client.preferences.muscleTargets,
              avoidJoints: client.preferences.avoidJoints,
            },
            exerciseOverlap: {
              sharedWithAll: sharedWithAll.slice(0, 5),
              sharedWithSome: sharedWithSome.slice(0, 5),
              unique: unique.slice(0, 5),
            },
            workoutDiversity: diversity,
          });
        }

        console.log("👥 Client Comparison");
        comparisons.forEach((c: any) => {
          console.log(`\n${c.clientName}:`);
          console.log(
            `  Preferences: ${c.preferences.intensity} intensity, ${c.preferences.sessionGoal} goal`,
          );
          console.log(
            `  Targets: ${c.preferences.muscleTargets.join(", ") || "none"}`,
          );
          console.log(
            `  Avoid Joints: ${c.preferences.avoidJoints.join(", ") || "none"}`,
          );
          console.log(
            `  Diversity Score: ${(c.workoutDiversity * 100).toFixed(0)}%`,
          );
          console.log(
            `  Shared with all: ${c.exerciseOverlap.sharedWithAll.length} exercises`,
          );
          console.log(`  Unique: ${c.exerciseOverlap.unique.length} exercises`);
        });

        return comparisons;
      },

      async downloadSession(sessionId: string) {
        const session = await this.getSession(sessionId);
        const blob = new Blob([JSON.stringify(session, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `group-workout-${sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`📥 Downloaded session ${sessionId}`);
      },

      async clearSessions() {
        const response = await fetch("/api/debug/group-workout-data/clear", {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to clear sessions");
        console.log("🗑️ Cleared all group workout test data");
      },
    };

    // Make it available globally
    (window as any).groupTestData = groupTestData;
    console.log(
      "🏋️ Group workout test data utilities loaded. Use groupTestData.* to access.",
    );
  }, []);

  return null;
}
