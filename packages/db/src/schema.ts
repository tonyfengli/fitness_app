import { sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export * from "./auth-schema";
export * from "./exercise";
import { exercises } from "./exercise";

export const Business = pgTable("business", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.varchar({ length: 255 }).notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateBusinessSchema = createInsertSchema(Business, {
  name: z.string().min(1).max(255),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const BusinessExercise = pgTable("business_exercise", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  exerciseId: t.uuid().notNull().references(() => exercises.id, { onDelete: "cascade" }),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateBusinessExerciseSchema = createInsertSchema(BusinessExercise, {
  businessId: z.string().uuid(),
  exerciseId: z.string().uuid(),
}).omit({
  id: true,
  createdAt: true,
});
