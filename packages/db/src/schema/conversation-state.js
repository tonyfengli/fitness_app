"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationState = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
exports.conversationState = (0, pg_core_1.pgTable)("conversation_state", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    // User and training session relationship
    userId: t.text().notNull(),
    trainingSessionId: t.uuid().notNull(),
    businessId: t.uuid().notNull(),
    // Conversation type and step
    conversationType: t.text().notNull(), // 'include_exercise', 'swap_exercise', etc.
    currentStep: t.text().notNull().default('awaiting_response'), // 'awaiting_selection', 'completed', etc.
    // Flexible state storage
    state: t.json().notNull().$type(),
    // Timestamps
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp().defaultNow().notNull(),
}); });
