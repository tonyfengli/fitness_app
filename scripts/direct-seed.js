const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

// You'll need to add your Supabase connection string here
const connectionString = process.env.DATABASE_URL || 'your-supabase-connection-string';

const sql = postgres(connectionString);
const db = drizzle(sql);

// Sample exercise data
const exercises = [
  {
    name: "Barbell Bench Press",
    primary_muscle: "chest",
    secondary_muscles: ["triceps", "shoulders"],
    loaded_joints: ["shoulders"],
    movement_pattern: "horizontal_push",
    modality: "strength",
    movement_tags: ["bilateral", "scapular_control"],
    function_tags: ["foundational"],
    fatigue_profile: "moderate_local",
    complexity_level: "moderate",
    equipment: ["barbell", "bench"],
    strength_level: "moderate"
  }
  // Add more exercises...
];

async function seedDatabase() {
  try {
    console.log('Inserting exercises...');
    // You'll need to adjust this based on your actual schema
    const result = await db.insert(exercises).values(exercises);
    console.log('Success!', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

seedDatabase();