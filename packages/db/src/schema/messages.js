"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
var auth_schema_1 = require("../auth-schema");
var schema_1 = require("../schema");
exports.messages = (0, pg_core_1.pgTable)("messages", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    // User/Business relationship
    userId: t.text().notNull().references(function () { return auth_schema_1.user.id; }, { onDelete: "cascade" }),
    businessId: t.uuid().notNull().references(function () { return schema_1.Business.id; }, { onDelete: "cascade" }),
    // Message details
    direction: t.text().notNull(), // 'inbound' | 'outbound'
    channel: t.text().notNull().default('sms'), // 'sms' | 'in_app' (future)
    content: t.text().notNull(),
    phoneNumber: t.text(), // Optional, for SMS
    // Metadata as JSON
    metadata: t.json().$type(),
    // Status tracking
    status: t.text().notNull().default('sent'), // 'sent' | 'delivered' | 'failed' | 'read'
    // Timestamps
    createdAt: t.timestamp().defaultNow().notNull(),
}); });
