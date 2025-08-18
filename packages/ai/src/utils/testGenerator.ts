import * as fs from "node:fs";
import * as path from "node:path";

import { readFilterDebugData } from "./debugToFile";
import { readEnhancedDebugData } from "./enhancedDebug";

const TEST_QUEUE_FILE =
  "/Users/tonyli/Desktop/fitness_app/test-scenarios-queue.json";
const GENERATED_TEST_FILE =
  "/Users/tonyli/Desktop/fitness_app/packages/ai/test/integration/workout-generation/generated-scenarios.test.ts";

export interface TestScenario {
  id: string;
  timestamp: string;
  issue?: string;
  description?: string;
  debugData: any;
  expectedBehavior?: string;
  actualBehavior?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "converted" | "skipped";
}

/**
 * Capture current debug state as a potential test case
 */
export function captureTestScenario(
  issue: string,
  expectedBehavior?: string,
  actualBehavior?: string,
  priority: "high" | "medium" | "low" = "medium",
): TestScenario | null {
  const debugData = readFilterDebugData();
  const enhancedData = readEnhancedDebugData();

  if (!debugData) {
    console.error("❌ No debug data found. Run a filter first!");
    return null;
  }

  const scenario: TestScenario = {
    id: `scenario_${Date.now()}`,
    timestamp: new Date().toISOString(),
    issue,
    description: `Captured: ${issue}`,
    debugData: {
      basic: debugData,
      enhanced: enhancedData, // Includes exclusion reasons, score breakdowns, etc.
    },
    expectedBehavior,
    actualBehavior,
    priority,
    status: "pending",
  };

  // Add to queue
  const queue = readTestQueue();
  queue.push(scenario);
  saveTestQueue(queue);

  console.log(`✅ Test scenario captured: ${issue}`);
  console.log(
    `📝 ${queue.filter((s) => s.status === "pending").length} scenarios pending conversion`,
  );

  return scenario;
}

/**
 * Read the test scenario queue
 */
export function readTestQueue(): TestScenario[] {
  try {
    if (fs.existsSync(TEST_QUEUE_FILE)) {
      const data = fs.readFileSync(TEST_QUEUE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read test queue:", error);
  }
  return [];
}

/**
 * Save the test scenario queue
 */
function saveTestQueue(queue: TestScenario[]): void {
  try {
    fs.writeFileSync(TEST_QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error("Failed to save test queue:", error);
  }
}

/**
 * Generate test code from a scenario
 */
function generateTestCode(scenario: TestScenario): string {
  const { issue, debugData, expectedBehavior, actualBehavior, id } = scenario;
  const filters = debugData.basic.filters;
  const results = debugData.basic.results;

  return `
  it('should handle: ${issue} (${id})', async () => {
    // Captured: ${scenario.timestamp}
    // Expected: ${expectedBehavior || "Not specified"}
    // Actual: ${actualBehavior || "Not specified"}
    
    const debugData = ${JSON.stringify(debugData.basic, null, 6)
      .split("\n")
      .map((line, i) => (i === 0 ? line : "    " + line))
      .join("\n")};
    
    const { clientContext, expectedCounts } = createTestFromDebugData(debugData);
    
    const result = await filterExercisesFromInput({
      clientContext,
      workoutTemplate: { isFullBody: ${filters.isFullBody} }
    });
    
    // Basic count verification
    const blocks = getExercisesByBlock(result.exercises);
    expect(blocks.blockA.length).toBe(expectedCounts.blockA);
    expect(blocks.blockB.length).toBe(expectedCounts.blockB);
    expect(blocks.blockC.length).toBe(expectedCounts.blockC);
    expect(blocks.blockD.length).toBe(expectedCounts.blockD);
    
    // TODO: Add specific assertions for the issue
    ${generateIssueSpecificAssertions(scenario)}
  });`;
}

/**
 * Generate issue-specific assertions based on the scenario
 */
function generateIssueSpecificAssertions(scenario: TestScenario): string {
  const { issue, debugData } = scenario;
  const assertions: string[] = [];

  // Analyze the issue and generate relevant assertions
  if (
    issue &&
    (issue.toLowerCase().includes("joint") ||
      issue.toLowerCase().includes("avoid"))
  ) {
    const avoidJoints = debugData.basic.filters.avoidJoints;
    if (avoidJoints && avoidJoints.length > 0) {
      assertions.push(`
    // Verify joint restrictions are respected
    result.exercises.forEach(exercise => {
      ${avoidJoints
        .map(
          (joint: string) =>
            `expect(exercise.loadedJoints).not.toContain('${joint}');`,
        )
        .join("\n      ")}
    });`);
    }
  }

  if (
    issue &&
    (issue.toLowerCase().includes("score") ||
      issue.toLowerCase().includes("boost"))
  ) {
    assertions.push(`
    // Verify scoring behavior
    // TODO: Add specific score assertions based on the issue`);
  }

  if (
    issue &&
    (issue.toLowerCase().includes("include") ||
      issue.toLowerCase().includes("exclude"))
  ) {
    const includes = debugData.basic.filters.includeExercises;
    const excludes = debugData.basic.filters.avoidExercises;

    if (includes && includes.length > 0) {
      assertions.push(`
    // Verify included exercises are present
    ${includes
      .map(
        (ex: string) =>
          `expect(result.exercises.some(e => e.name === '${ex}')).toBe(true);`,
      )
      .join("\n    ")}`);
    }

    if (excludes && excludes.length > 0) {
      assertions.push(`
    // Verify excluded exercises are not present
    ${excludes
      .map(
        (ex: string) =>
          `expect(result.exercises.some(e => e.name === '${ex}')).toBe(false);`,
      )
      .join("\n    ")}`);
    }
  }

  return (
    assertions.join("\n") || "// TODO: Add specific assertions for this issue"
  );
}

/**
 * Convert all pending scenarios to test code
 */
export function generateTestsFromQueue(): string {
  const queue = readTestQueue();
  const pendingScenarios = queue.filter((s) => s.status === "pending");

  if (pendingScenarios.length === 0) {
    console.log("📭 No pending test scenarios");
    return "";
  }

  console.log(
    `🔄 Generating tests for ${pendingScenarios.length} scenarios...`,
  );

  // Group by priority
  const highPriority = pendingScenarios.filter((s) => s.priority === "high");
  const mediumPriority = pendingScenarios.filter(
    (s) => s.priority === "medium",
  );
  const lowPriority = pendingScenarios.filter((s) => s.priority === "low");

  const testFile = `import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, getExercisesByBlock, createTestFromDebugData } from './setup';

/**
 * AUTO-GENERATED TEST SCENARIOS
 * Generated from captured debug states
 * 
 * To add new scenarios:
 * 1. Run the app and trigger the issue
 * 2. In console: await captureScenario('description of issue')
 * 3. Run: npm run generate-tests
 */
describe('Generated Test Scenarios from Debug Data', () => {
  beforeEach(() => {
    setupMocks();
  });

  ${
    highPriority.length > 0
      ? `describe('High Priority Issues', () => {${highPriority
          .map(generateTestCode)
          .join("\n")}
  });`
      : ""
  }

  ${
    mediumPriority.length > 0
      ? `describe('Medium Priority Issues', () => {${mediumPriority
          .map(generateTestCode)
          .join("\n")}
  });`
      : ""
  }

  ${
    lowPriority.length > 0
      ? `describe('Low Priority Issues', () => {${lowPriority
          .map(generateTestCode)
          .join("\n")}
  });`
      : ""
  }
});`;

  // Mark scenarios as converted
  queue.forEach((scenario) => {
    if (pendingScenarios.includes(scenario)) {
      scenario.status = "converted";
    }
  });
  saveTestQueue(queue);

  // Save the generated test file
  try {
    fs.writeFileSync(GENERATED_TEST_FILE, testFile);
    console.log(
      `✅ Generated ${pendingScenarios.length} tests in: ${GENERATED_TEST_FILE}`,
    );
  } catch (error) {
    console.error("Failed to write test file:", error);
  }

  return testFile;
}

/**
 * CLI-friendly capture function
 */
export async function quickCapture(issue: string): Promise<void> {
  const scenario = captureTestScenario(issue);
  if (scenario) {
    console.log("\n🎯 Next steps:");
    console.log("1. Run: npm run generate-tests");
    console.log("2. Review and edit the generated test");
    console.log("3. Run: npm test");
  }
}
