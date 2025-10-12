import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";

import * as schema from "./schema";
import * as workoutRelations from "../drizzle/workout-relations";

// Combine schema with workout relations
const fullSchema = {
  ...schema,
  ...workoutRelations,
};

export const db = drizzle({
  client: sql,
  schema: fullSchema,
  casing: "snake_case",
});

export type Database = typeof db;
