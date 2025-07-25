"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.account = exports.user = exports.CreateWorkoutExerciseSchema = exports.WorkoutExercise = exports.CreateWorkoutSchema = exports.Workout = exports.CreateWorkoutPreferencesSchema = exports.WorkoutPreferences = exports.CreateUserTrainingSessionSchema = exports.UserTrainingSession = exports.CreateTrainingSessionSchema = exports.TrainingSession = exports.sessionStatusEnum = exports.CreateUserProfileSchema = exports.UserProfile = exports.CreateBusinessExerciseSchema = exports.BusinessExercise = exports.CreateBusinessSchema = exports.Business = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_zod_1 = require("drizzle-zod");
var v4_1 = require("zod/v4");
var auth_schema_1 = require("./auth-schema");
__exportStar(require("./auth-schema"), exports);
__exportStar(require("./exercise"), exports);
__exportStar(require("./schema/messages"), exports);
__exportStar(require("./schema/conversation-state"), exports);
var exercise_1 = require("./exercise");
exports.Business = (0, pg_core_1.pgTable)("business", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 255 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
        .timestamp({ mode: "date", withTimezone: true })
        .$onUpdateFn(function () { return (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["now()"], ["now()"]))); }),
}); });
exports.CreateBusinessSchema = (0, drizzle_zod_1.createInsertSchema)(exports.Business, {
    name: v4_1.z.string().min(1).max(255),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.BusinessExercise = (0, pg_core_1.pgTable)("business_exercise", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t.uuid().notNull().references(function () { return exports.Business.id; }, { onDelete: "cascade" }),
    exerciseId: t.uuid().notNull().references(function () { return exercise_1.exercises.id; }, { onDelete: "cascade" }),
    createdAt: t.timestamp().defaultNow().notNull(),
}); });
exports.CreateBusinessExerciseSchema = (0, drizzle_zod_1.createInsertSchema)(exports.BusinessExercise, {
    businessId: v4_1.z.string().uuid(),
    exerciseId: v4_1.z.string().uuid(),
}).omit({
    id: true,
    createdAt: true,
});
// User Profile table for workout-specific data
exports.UserProfile = (0, pg_core_1.pgTable)("user_profile", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull().references(function () { return auth_schema_1.user.id; }, { onDelete: "cascade" }),
    businessId: t.uuid().notNull().references(function () { return exports.Business.id; }, { onDelete: "cascade" }),
    // Client fitness levels
    strengthLevel: t.text().notNull().default('moderate'), // 'very_low', 'low', 'moderate', 'high'
    skillLevel: t.text().notNull().default('moderate'), // 'very_low', 'low', 'moderate', 'high'
    // Default workout parameters
    defaultSets: t.integer().notNull().default(20), // Default number of sets for this client
    // Additional profile fields can be added here
    notes: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
        .timestamp({ mode: "date", withTimezone: true })
        .$onUpdateFn(function () { return (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["now()"], ["now()"]))); }),
}); });
exports.CreateUserProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.UserProfile, {
    userId: v4_1.z.string(),
    businessId: v4_1.z.string().uuid(),
    strengthLevel: v4_1.z.enum(["very_low", "low", "moderate", "high"]).default("moderate"),
    skillLevel: v4_1.z.enum(["very_low", "low", "moderate", "high"]).default("moderate"),
    defaultSets: v4_1.z.number().int().min(10).max(40).default(20),
    notes: v4_1.z.string().optional(),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Training Sessions (scheduled appointments)
// Session status enum
exports.sessionStatusEnum = (0, pg_core_1.pgEnum)("session_status", [
    "open",
    "in_progress",
    "completed",
    "cancelled"
]);
exports.TrainingSession = (0, pg_core_1.pgTable)("training_session", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    businessId: t.uuid().notNull().references(function () { return exports.Business.id; }, { onDelete: "cascade" }),
    trainerId: t.text().notNull().references(function () { return auth_schema_1.user.id; }),
    name: t.varchar({ length: 255 }).notNull(),
    scheduledAt: t.timestamp().notNull(),
    durationMinutes: t.integer(),
    maxParticipants: t.integer(), // null = unlimited
    status: (0, exports.sessionStatusEnum)("status").notNull().default("open"),
    templateType: t.varchar({ length: 50 }).default("workout"), // workout template type
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
        .timestamp({ mode: "date", withTimezone: true })
        .$onUpdateFn(function () { return (0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["now()"], ["now()"]))); }),
}); });
exports.CreateTrainingSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.TrainingSession, {
    businessId: v4_1.z.string().uuid(),
    trainerId: v4_1.z.string(),
    name: v4_1.z.string().min(1).max(255),
    scheduledAt: v4_1.z.date(),
    durationMinutes: v4_1.z.number().int().positive().optional(),
    maxParticipants: v4_1.z.number().int().positive().optional(),
    status: v4_1.z.enum(["open", "in_progress", "completed", "cancelled"]).optional().default("open"),
    templateType: v4_1.z.string().max(50).optional().default("workout"),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Users registered for training sessions
exports.UserTrainingSession = (0, pg_core_1.pgTable)("user_training_session", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull().references(function () { return auth_schema_1.user.id; }, { onDelete: "cascade" }),
    trainingSessionId: t.uuid().notNull().references(function () { return exports.TrainingSession.id; }, { onDelete: "cascade" }),
    status: t.text().notNull().default("registered"), // "registered", "checked_in", "completed", "no_show"
    checkedInAt: t.timestamp(), // When the user checked in
    preferenceCollectionStep: t.text().notNull().default("not_started"), // 'not_started', 'initial_collected', 'disambiguation_pending', 'disambiguation_clarifying', 'disambiguation_resolved', 'followup_sent', 'preferences_active'
    createdAt: t.timestamp().defaultNow().notNull(),
}); });
exports.CreateUserTrainingSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.UserTrainingSession, {
    userId: v4_1.z.string(),
    trainingSessionId: v4_1.z.string().uuid(),
    status: v4_1.z.enum(["registered", "checked_in", "completed", "no_show"]).default("registered"),
    checkedInAt: v4_1.z.date().optional(),
    preferenceCollectionStep: v4_1.z.enum(["not_started", "initial_collected", "disambiguation_pending", "disambiguation_clarifying", "disambiguation_resolved", "followup_sent", "preferences_active"]).default("not_started"),
}).omit({
    id: true,
    createdAt: true,
});
// Workout preferences collected from users
exports.WorkoutPreferences = (0, pg_core_1.pgTable)("workout_preferences", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull().references(function () { return auth_schema_1.user.id; }, { onDelete: "cascade" }),
    trainingSessionId: t.uuid().notNull().references(function () { return exports.TrainingSession.id; }, { onDelete: "cascade" }),
    businessId: t.uuid().notNull().references(function () { return exports.Business.id; }, { onDelete: "cascade" }),
    // Workout parameters
    intensity: t.text(), // 'low', 'moderate', 'high'
    muscleTargets: t.text().array(), // Array of muscle groups to target
    muscleLessens: t.text().array(), // Array of muscles to avoid
    // Exercise filtering (matches workout engine architecture naming)
    includeExercises: t.text().array(), // Exercises to include (overrides other filters)
    avoidExercises: t.text().array(), // Exercises to exclude (final filter)
    avoidJoints: t.text().array(), // Joints to avoid loading
    // Session goal
    sessionGoal: t.text(), // 'strength', 'stability', etc.
    // Source tracking for fields (to differentiate explicit, default, inherited)
    intensitySource: t.text().default('default'), // 'explicit', 'default', 'inherited'
    sessionGoalSource: t.text().default('default'), // 'explicit', 'default', 'inherited'
    // Collection metadata
    collectedAt: t.timestamp().defaultNow().notNull(),
    collectionMethod: t.text().notNull().default('sms'), // 'sms', 'web', 'manual'
}); }, function (table) { return ({
    // Unique constraint: one preference per user per training session
    userSessionUnique: (0, pg_core_1.unique)().on(table.userId, table.trainingSessionId),
}); });
exports.CreateWorkoutPreferencesSchema = (0, drizzle_zod_1.createInsertSchema)(exports.WorkoutPreferences, {
    userId: v4_1.z.string(),
    trainingSessionId: v4_1.z.string().uuid(),
    businessId: v4_1.z.string().uuid(),
    intensity: v4_1.z.enum(["low", "moderate", "high"]).optional(),
    muscleTargets: v4_1.z.array(v4_1.z.string()).optional(),
    muscleLessens: v4_1.z.array(v4_1.z.string()).optional(),
    includeExercises: v4_1.z.array(v4_1.z.string()).optional(),
    avoidExercises: v4_1.z.array(v4_1.z.string()).optional(),
    avoidJoints: v4_1.z.array(v4_1.z.string()).optional(),
    sessionGoal: v4_1.z.string().optional(),
    intensitySource: v4_1.z.enum(["explicit", "default", "inherited"]).default("default"),
    sessionGoalSource: v4_1.z.enum(["explicit", "default", "inherited"]).default("default"),
    collectionMethod: v4_1.z.enum(["sms", "web", "manual"]).default("sms"),
}).omit({
    id: true,
    collectedAt: true,
});
// Actual workout data for a session
exports.Workout = (0, pg_core_1.pgTable)("workout", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    trainingSessionId: t.uuid().references(function () { return exports.TrainingSession.id; }, { onDelete: "cascade" }), // Now optional
    userId: t.text().notNull().references(function () { return auth_schema_1.user.id; }, { onDelete: "cascade" }),
    completedAt: t.timestamp(), // Nullable - workouts aren't completed when created
    notes: t.text(),
    workoutType: t.text(), // "standard", "circuit", "full_body", etc.
    totalPlannedSets: t.integer(), // Total sets the LLM planned
    llmOutput: t.jsonb(), // Raw LLM response for reference
    templateConfig: t.jsonb(), // Template-specific configuration
    context: t.text().notNull().default("individual"), // "group", "individual", "homework", "assessment"
    businessId: t.uuid().notNull().references(function () { return exports.Business.id; }, { onDelete: "cascade" }), // Direct business reference
    createdByTrainerId: t.text().notNull().references(function () { return auth_schema_1.user.id; }), // Who created this workout
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
        .timestamp({ mode: "date", withTimezone: true })
        .$onUpdateFn(function () { return (0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["now()"], ["now()"]))); }),
}); });
exports.CreateWorkoutSchema = (0, drizzle_zod_1.createInsertSchema)(exports.Workout, {
    trainingSessionId: v4_1.z.string().uuid().optional(), // Now optional
    userId: v4_1.z.string(),
    completedAt: v4_1.z.date(),
    notes: v4_1.z.string().optional(),
    workoutType: v4_1.z.string().optional(),
    totalPlannedSets: v4_1.z.number().int().positive().optional(),
    llmOutput: v4_1.z.any().optional(), // JSON type
    templateConfig: v4_1.z.any().optional(), // JSON type
    context: v4_1.z.enum(["group", "individual", "homework", "assessment"]).default("individual"),
    businessId: v4_1.z.string().uuid(),
    createdByTrainerId: v4_1.z.string(),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Exercises performed in a workout
exports.WorkoutExercise = (0, pg_core_1.pgTable)("workout_exercise", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    workoutId: t.uuid().notNull().references(function () { return exports.Workout.id; }, { onDelete: "cascade" }),
    exerciseId: t.uuid().notNull().references(function () { return exercise_1.exercises.id; }),
    orderIndex: t.integer().notNull(),
    setsCompleted: t.integer().notNull(),
    groupName: t.text(), // "Block A", "Round 1", etc.
    createdAt: t.timestamp().defaultNow().notNull(),
}); });
exports.CreateWorkoutExerciseSchema = (0, drizzle_zod_1.createInsertSchema)(exports.WorkoutExercise, {
    workoutId: v4_1.z.string().uuid(),
    exerciseId: v4_1.z.string().uuid(),
    orderIndex: v4_1.z.number().int().min(1),
    setsCompleted: v4_1.z.number().int().min(1),
    groupName: v4_1.z.string().optional(),
}).omit({
    id: true,
    createdAt: true,
});
// Export all relations from the relations file
__exportStar(require("../drizzle/relations"), exports);
// Re-export auth schema items
var auth_schema_2 = require("./auth-schema");
Object.defineProperty(exports, "user", { enumerable: true, get: function () { return auth_schema_2.user; } });
Object.defineProperty(exports, "account", { enumerable: true, get: function () { return auth_schema_2.account; } });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
