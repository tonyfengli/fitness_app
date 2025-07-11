import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables from root .env file
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

import { db } from "@acme/db/client";
import { exercises } from "@acme/db/schema";

async function exportAllExercises() {
  try {
    console.log("🔍 Fetching all exercises from database...");
    
    // Fetch all exercises
    const allExercises = await db.select().from(exercises);
    
    console.log(`✅ Found ${allExercises.length} exercises`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), "../../test-data");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save to JSON file
    const outputPath = path.join(outputDir, "all-exercises.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify(allExercises, null, 2)
    );
    
    console.log(`💾 Saved to: ${outputPath}`);
    
    // Also save a summary
    const summary = {
      totalExercises: allExercises.length,
      byStrengthLevel: {} as Record<string, number>,
      bySkillLevel: {} as Record<string, number>,
      byFunctionTag: {} as Record<string, number>,
      byPrimaryMuscle: {} as Record<string, number>,
      byFatigueProfile: {} as Record<string, number>
    };
    
    // Count exercises by various attributes
    allExercises.forEach(ex => {
      // Strength levels
      summary.byStrengthLevel[ex.strengthLevel] = (summary.byStrengthLevel[ex.strengthLevel] ?? 0) + 1;
      
      // Skill levels
      summary.bySkillLevel[ex.complexityLevel] = (summary.bySkillLevel[ex.complexityLevel] ?? 0) + 1;
      
      // Function tags
      if (ex.functionTags) {
        ex.functionTags.forEach(tag => {
          summary.byFunctionTag[tag] = (summary.byFunctionTag[tag] ?? 0) + 1;
        });
      }
      
      // Primary muscle
      summary.byPrimaryMuscle[ex.primaryMuscle] = (summary.byPrimaryMuscle[ex.primaryMuscle] ?? 0) + 1;
      
      // Fatigue profile
      summary.byFatigueProfile[ex.fatigueProfile] = (summary.byFatigueProfile[ex.fatigueProfile] ?? 0) + 1;
    });
    
    // Save summary
    const summaryPath = path.join(outputDir, "exercises-summary.json");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(summary, null, 2)
    );
    
    console.log(`📊 Summary saved to: ${summaryPath}`);
    console.log("\n📋 Summary:");
    console.log(JSON.stringify(summary, null, 2));
    
  } catch (error) {
    console.error("❌ Error exporting exercises:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the export
void exportAllExercises();