import { pgTable, uuid, varchar, text, timestamp, foreignKey, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const complexityLevel = pgEnum("complexity_level", ['very_low', 'low', 'moderate', 'high'])
export const fatigueProfile = pgEnum("fatigue_profile", ['low_local', 'moderate_local', 'high_local', 'moderate_systemic', 'high_systemic', 'metabolic'])
export const modality = pgEnum("modality", ['strength', 'stability', 'core', 'power', 'conditioning', 'mobility'])
export const movementPattern = pgEnum("movement_pattern", ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_isolation', 'arm_isolation', 'leg_isolation', 'squat', 'lunge', 'hinge', 'carry', 'core'])
export const primaryMuscle = pgEnum("primary_muscle", ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors', 'core', 'lower_abs', 'upper_abs', 'obliques', 'chest', 'upper_chest', 'lower_chest', 'lats', 'traps', 'biceps', 'triceps', 'shoulders', 'delts', 'upper_back', 'lower_back', 'shins', 'tibialis_anterior'])
export const strengthLevel = pgEnum("strength_level", ['very_low', 'low', 'moderate', 'high'])


export const post = pgTable("post", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 256 }).notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	businessId: uuid("business_id").notNull(),
	password: text(),
	phone: text(),
	role: text().default('client').notNull(),
	email: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "user_business_id_business_id_fk"
		}),
	unique("user_email_unique").on(table.email),
]);

export const exercises = pgTable("exercises", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	primaryMuscle: primaryMuscle("primary_muscle").notNull(),
	secondaryMuscles: text("secondary_muscles").array(),
	loadedJoints: text("loaded_joints").array(),
	movementPattern: movementPattern("movement_pattern").notNull(),
	modality: modality().notNull(),
	movementTags: text("movement_tags").array(),
	functionTags: text("function_tags").array(),
	fatigueProfile: fatigueProfile("fatigue_profile").notNull(),
	complexityLevel: complexityLevel("complexity_level").notNull(),
	equipment: text().array(),
	strengthLevel: strengthLevel("strength_level").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const business = pgTable("business", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const businessExercise = pgTable("business_exercise", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessId: uuid("business_id").notNull(),
	exerciseId: uuid("exercise_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "business_exercise_business_id_business_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.exerciseId],
			foreignColumns: [exercises.id],
			name: "business_exercise_exercise_id_exercises_id_fk"
		}).onDelete("cascade"),
]);

export const userProfile = pgTable("user_profile", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	businessId: uuid("business_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.businessId],
			foreignColumns: [business.id],
			name: "client_profile_business_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "client_profile_user_id_fkey"
		}).onDelete("cascade"),
	unique("client_profile_user_business_unique").on(table.userId, table.businessId),
]);
