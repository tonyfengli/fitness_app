import * as fs from "node:fs";
import * as path from "node:path";

import { readFilterDebugData } from "./debugToFile";
import { readEnhancedDebugData } from "./enhancedDebug";

const SAVED_SCENARIOS_DIR =
  "/Users/tonyli/Desktop/fitness_app/saved-test-scenarios";

export interface SavedScenario {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  debugData: {
    basic: any;
    enhanced?: any;
  };
  notes?: string;
}

/**
 * Initialize saved scenarios directory
 */
function ensureScenarioDir(): void {
  if (!fs.existsSync(SAVED_SCENARIOS_DIR)) {
    fs.mkdirSync(SAVED_SCENARIOS_DIR, { recursive: true });
  }
}

/**
 * Save current debug state as a named scenario
 * This does NOT automatically create a test - it just saves the state for later
 */
export function saveCurrentAsScenario(
  name: string,
  description: string,
  notes?: string,
): SavedScenario | null {
  const basicDebug = readFilterDebugData();
  const enhancedDebug = readEnhancedDebugData();

  if (!basicDebug) {
    console.error("❌ No debug data found. Run a filter first!");
    return null;
  }

  ensureScenarioDir();

  const scenario: SavedScenario = {
    id: `scenario_${Date.now()}`,
    name: name.replace(/[^a-z0-9_-]/gi, "_"), // Safe filename
    description,
    timestamp: new Date().toISOString(),
    debugData: {
      basic: basicDebug,
      enhanced: enhancedDebug,
    },
    notes,
  };

  // Save to file
  const filename = `${scenario.name}_${scenario.id}.json`;
  const filepath = path.join(SAVED_SCENARIOS_DIR, filename);

  try {
    fs.writeFileSync(filepath, JSON.stringify(scenario, null, 2));
    console.log(`✅ Scenario saved: ${filename}`);
    console.log(`📁 Location: ${filepath}`);
    return scenario;
  } catch (error) {
    console.error("❌ Failed to save scenario:", error);
    return null;
  }
}

/**
 * List all saved scenarios
 */
export function listSavedScenarios(): SavedScenario[] {
  ensureScenarioDir();

  try {
    const files = fs.readdirSync(SAVED_SCENARIOS_DIR);
    const scenarios: SavedScenario[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filepath = path.join(SAVED_SCENARIOS_DIR, file);
        const content = fs.readFileSync(filepath, "utf-8");
        scenarios.push(JSON.parse(content));
      }
    }

    return scenarios.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (error) {
    console.error("Error reading scenarios:", error);
    return [];
  }
}

/**
 * Generate a test from a saved scenario
 * This is what you call when you DECIDE to convert a scenario into a test
 */
export function generateTestFromScenario(scenarioId: string): string | null {
  const scenarios = listSavedScenarios();
  const scenario = scenarios.find(
    (s) => s.id === scenarioId || s.name === scenarioId,
  );

  if (!scenario) {
    console.error(`❌ Scenario not found: ${scenarioId}`);
    return null;
  }

  const { name, description, debugData, notes } = scenario;
  const filters = debugData.basic.filters;
  const results = debugData.basic.results;

  const testCode = `
  it('${description}', async () => {
    // Scenario: ${name}
    // Saved: ${scenario.timestamp}
    ${notes ? `// Notes: ${notes}` : ""}
    
    const debugData = ${JSON.stringify(debugData.basic, null, 6)
      .split("\n")
      .map((line, i) => (i === 0 ? line : "    " + line))
      .join("\n")};
    
    const { clientContext, expectedCounts } = createTestFromDebugData(debugData);
    
    const result = await filterExercisesFromInput({
      clientContext,
      workoutTemplate: { isFullBody: ${filters.isFullBody} }
    });
    
    const blocks = getExercisesByBlock(result.exercises);
    
    // TODO: Add specific assertions based on what you observed
    // For now, just verify the basic structure matches
    expect(blocks.blockA.length).toBe(expectedCounts.blockA);
    expect(blocks.blockB.length).toBe(expectedCounts.blockB);
    expect(blocks.blockC.length).toBe(expectedCounts.blockC);
    expect(blocks.blockD.length).toBe(expectedCounts.blockD);
    
    // Add your specific assertions here based on the issue you found
  });`;

  console.log(`\n✅ Test generated for: ${name}`);
  console.log("📋 Copy the test code above and paste it into your test file");
  console.log(`📝 Don't forget to add specific assertions for the issue!`);

  return testCode;
}

/**
 * Interactive helper to save and potentially convert current state
 */
export function debugToTest(): void {
  console.log(`
🧪 Debug to Test Helper
======================

Current debug state loaded. What would you like to do?

1. Save as scenario:     saveCurrentAsScenario('name', 'description')
2. List saved scenarios: listSavedScenarios()
3. Generate test:        generateTestFromScenario('scenario_id')

Examples:
- saveCurrentAsScenario('joint_override_bug', 'Knee restriction not working with includes')
- generateTestFromScenario('joint_override_bug')
`);
}

// Export convenience functions for console use
export const save = saveCurrentAsScenario;
export const list = () => {
  const scenarios = listSavedScenarios();
  if (scenarios.length === 0) {
    console.log("📭 No saved scenarios");
    return;
  }

  console.log(`\n📁 Saved scenarios (${scenarios.length}):\n`);
  scenarios.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} - ${s.description}`);
    console.log(`   ID: ${s.id}`);
    console.log(`   Saved: ${new Date(s.timestamp).toLocaleString()}`);
    if (s.notes) console.log(`   Notes: ${s.notes}`);
    console.log("");
  });
};
export const generate = generateTestFromScenario;
