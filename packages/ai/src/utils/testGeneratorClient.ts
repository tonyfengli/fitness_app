/**
 * Browser-side test capture utilities
 * Add this to your app for easy test scenario capture
 */

interface CaptureOptions {
  issue: string;
  expected?: string;
  actual?: string;
  priority?: "high" | "medium" | "low";
}

/**
 * Capture current state as a test scenario
 * Call this from browser console when you see an issue
 */
export async function captureScenario(
  issue: string,
  options: Partial<CaptureOptions> = {},
): Promise<void> {
  try {
    const response = await fetch("/api/debug/capture-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue,
        expectedBehavior: options.expected,
        actualBehavior: options.actual,
        priority: options.priority || "medium",
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Test scenario captured!");
      console.log(
        `📝 ${(result as any).pendingCount} scenarios pending conversion`,
      );
      console.log("\nNext steps:");
      console.log("1. Run: npm run generate-tests");
      console.log("2. Review the generated test");
      console.log("3. Run: npm test");
    } else {
      console.error("❌ Failed to capture scenario:", await response.text());
    }
  } catch (error) {
    console.error("❌ Error capturing scenario:", error);
  }
}

/**
 * Quick capture with just a description
 */
export async function capture(issue: string): Promise<void> {
  return captureScenario(issue);
}

/**
 * Capture high priority issue
 */
export async function captureHigh(issue: string): Promise<void> {
  return captureScenario(issue, { priority: "high" });
}

/**
 * List pending test scenarios
 */
export async function listPendingScenarios(): Promise<void> {
  try {
    const response = await fetch("/api/debug/pending-scenarios");
    const scenarios = (await response.json()) as any[];

    if (!scenarios || scenarios.length === 0) {
      console.log("📭 No pending test scenarios");
      return;
    }

    console.log(`📝 ${scenarios.length} pending test scenarios:\n`);
    scenarios.forEach((s, i) => {
      console.log(`${i + 1}. [${s.priority.toUpperCase()}] ${s.issue}`);
      console.log(`   Captured: ${new Date(s.timestamp).toLocaleString()}`);
      console.log(`   ID: ${s.id}\n`);
    });
  } catch (error) {
    console.error("❌ Error listing scenarios:", error);
  }
}

// Make functions available globally in browser
declare global {
  interface Window {
    captureScenario: typeof captureScenario;
    capture: typeof capture;
    captureHigh: typeof captureHigh;
    listPendingScenarios: typeof listPendingScenarios;
  }
}

if (typeof window !== "undefined") {
  window.captureScenario = captureScenario;
  window.capture = capture;
  window.captureHigh = captureHigh;
  window.listPendingScenarios = listPendingScenarios;

  console.log(`🧪 Test capture utilities loaded!
  
Available commands:
- capture('description of issue')
- captureHigh('critical issue')
- captureScenario('issue', { expected: '...', actual: '...', priority: 'high' })
- listPendingScenarios()
`);
}
