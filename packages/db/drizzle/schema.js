"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userProfile = exports.businessExercise = exports.business = exports.exercises = exports.user = exports.session = exports.account = exports.verification = exports.post = exports.strengthLevel = exports.primaryMuscle = exports.movementPattern = exports.modality = exports.fatigueProfile = exports.complexityLevel = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
exports.complexityLevel = (0, pg_core_1.pgEnum)("complexity_level", ['very_low', 'low', 'moderate', 'high']);
exports.fatigueProfile = (0, pg_core_1.pgEnum)("fatigue_profile", ['low_local', 'moderate_local', 'high_local', 'moderate_systemic', 'high_systemic', 'metabolic']);
exports.modality = (0, pg_core_1.pgEnum)("modality", ['strength', 'stability', 'core', 'power', 'conditioning', 'mobility']);
exports.movementPattern = (0, pg_core_1.pgEnum)("movement_pattern", ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_isolation', 'arm_isolation', 'leg_isolation', 'squat', 'lunge', 'hinge', 'carry', 'core']);
exports.primaryMuscle = (0, pg_core_1.pgEnum)("primary_muscle", ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors', 'core', 'lower_abs', 'upper_abs', 'obliques', 'chest', 'upper_chest', 'lower_chest', 'lats', 'traps', 'biceps', 'triceps', 'shoulders', 'delts', 'upper_back', 'lower_back', 'shins', 'tibialis_anterior']);
exports.strengthLevel = (0, pg_core_1.pgEnum)("strength_level", ['very_low', 'low', 'moderate', 'high']);
exports.post = (0, pg_core_1.pgTable)("post", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    title: (0, pg_core_1.varchar)({ length: 256 }).notNull(),
    content: (0, pg_core_1.text)().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }),
});
exports.verification = (0, pg_core_1.pgTable)("verification", {
    id: (0, pg_core_1.text)().primaryKey().notNull(),
    identifier: (0, pg_core_1.text)().notNull(),
    value: (0, pg_core_1.text)().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { mode: 'string' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }),
});
exports.account = (0, pg_core_1.pgTable)("account", {
    id: (0, pg_core_1.text)().primaryKey().notNull(),
    accountId: (0, pg_core_1.text)("account_id").notNull(),
    providerId: (0, pg_core_1.text)("provider_id").notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    accessToken: (0, pg_core_1.text)("access_token"),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    idToken: (0, pg_core_1.text)("id_token"),
    accessTokenExpiresAt: (0, pg_core_1.timestamp)("access_token_expires_at", { mode: 'string' }),
    refreshTokenExpiresAt: (0, pg_core_1.timestamp)("refresh_token_expires_at", { mode: 'string' }),
    scope: (0, pg_core_1.text)(),
    password: (0, pg_core_1.text)(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).notNull(),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.userId],
        foreignColumns: [exports.user.id],
        name: "account_user_id_user_id_fk"
    }).onDelete("cascade"),
]; });
exports.session = (0, pg_core_1.pgTable)("session", {
    id: (0, pg_core_1.text)().primaryKey().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { mode: 'string' }).notNull(),
    token: (0, pg_core_1.text)().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    userId: (0, pg_core_1.text)("user_id").notNull(),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.userId],
        foreignColumns: [exports.user.id],
        name: "session_user_id_user_id_fk"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("session_token_unique").on(table.token),
]; });
exports.user = (0, pg_core_1.pgTable)("user", {
    id: (0, pg_core_1.text)().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).notNull(),
    businessId: (0, pg_core_1.uuid)("business_id").notNull(),
    password: (0, pg_core_1.text)(),
    phone: (0, pg_core_1.text)(),
    role: (0, pg_core_1.text)().default('client').notNull(),
    email: (0, pg_core_1.text)().notNull(),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.businessId],
        foreignColumns: [exports.business.id],
        name: "user_business_id_business_id_fk"
    }),
    (0, pg_core_1.unique)("user_email_unique").on(table.email),
]; });
exports.exercises = (0, pg_core_1.pgTable)("exercises", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    primaryMuscle: (0, exports.primaryMuscle)("primary_muscle").notNull(),
    secondaryMuscles: (0, pg_core_1.text)("secondary_muscles").array(),
    loadedJoints: (0, pg_core_1.text)("loaded_joints").array(),
    movementPattern: (0, exports.movementPattern)("movement_pattern").notNull(),
    modality: (0, exports.modality)().notNull(),
    movementTags: (0, pg_core_1.text)("movement_tags").array(),
    functionTags: (0, pg_core_1.text)("function_tags").array(),
    fatigueProfile: (0, exports.fatigueProfile)("fatigue_profile").notNull(),
    complexityLevel: (0, exports.complexityLevel)("complexity_level").notNull(),
    equipment: (0, pg_core_1.text)().array(),
    strengthLevel: (0, exports.strengthLevel)("strength_level").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
});
exports.business = (0, pg_core_1.pgTable)("business", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    name: (0, pg_core_1.varchar)({ length: 255 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }),
});
exports.businessExercise = (0, pg_core_1.pgTable)("business_exercise", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    businessId: (0, pg_core_1.uuid)("business_id").notNull(),
    exerciseId: (0, pg_core_1.uuid)("exercise_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.businessId],
        foreignColumns: [exports.business.id],
        name: "business_exercise_business_id_business_id_fk"
    }).onDelete("cascade"),
    (0, pg_core_1.foreignKey)({
        columns: [table.exerciseId],
        foreignColumns: [exports.exercises.id],
        name: "business_exercise_exercise_id_exercises_id_fk"
    }).onDelete("cascade"),
]; });
exports.userProfile = (0, pg_core_1.pgTable)("user_profile", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(),
    businessId: (0, pg_core_1.uuid)("business_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }),
}, function (table) { return [
    (0, pg_core_1.foreignKey)({
        columns: [table.businessId],
        foreignColumns: [exports.business.id],
        name: "client_profile_business_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.foreignKey)({
        columns: [table.userId],
        foreignColumns: [exports.user.id],
        name: "client_profile_user_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("client_profile_user_business_unique").on(table.userId, table.businessId),
]; });
