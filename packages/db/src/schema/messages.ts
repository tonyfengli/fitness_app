import { pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "../auth-schema";
import { Business } from "../schema";

export const messages = pgTable("messages", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  
  // User/Business relationship
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  
  // Message details
  direction: t.text().notNull(), // 'inbound' | 'outbound'
  channel: t.text().notNull().default('sms'), // 'sms' | 'in_app' (future)
  content: t.text().notNull(),
  phoneNumber: t.text(), // Optional, for SMS
  
  // Metadata as JSON
  metadata: t.json().$type<{
    intent?: { type: string; confidence: number };
    twilioMessageSid?: string;
    checkInResult?: { success: boolean; sessionId?: string };
    sentBy?: string; // trainer ID for outbound messages
  }>(),
  
  // Status tracking
  status: t.text().notNull().default('sent'), // 'sent' | 'delivered' | 'failed' | 'read'
  
  // Timestamps
  createdAt: t.timestamp().defaultNow().notNull(),
}));