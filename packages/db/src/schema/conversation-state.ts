import { pgTable } from "drizzle-orm/pg-core";

export const conversationState = pgTable("conversation_state", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),

  // User and training session relationship
  userId: t.text().notNull(),
  trainingSessionId: t.uuid().notNull(),
  businessId: t.uuid().notNull(),

  // Conversation type and step
  conversationType: t.text().notNull(), // 'include_exercise', 'swap_exercise', etc.
  currentStep: t.text().notNull().default("awaiting_response"), // 'awaiting_selection', 'completed', etc.

  // Flexible state storage
  state: t.json().notNull().$type<{
    userInput?: string;
    options?: { id: string; name: string }[];
    selections?: string[];
    metadata?: Record<string, unknown>;
  }>(),

  // Timestamps
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().notNull(),
}));
