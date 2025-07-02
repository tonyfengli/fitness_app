CREATE TYPE "public"."complexity_level" AS ENUM('very_low', 'low', 'moderate', 'high');--> statement-breakpoint
CREATE TYPE "public"."fatigue_profile" AS ENUM('low_local', 'moderate_local', 'high_local', 'moderate_systemic', 'high_systemic', 'metabolic');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('strength', 'stability', 'core', 'power', 'conditioning', 'mobility');--> statement-breakpoint
CREATE TYPE "public"."movement_pattern" AS ENUM('horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_isolation', 'arm_isolation', 'leg_isolation', 'squat', 'lunge', 'hinge', 'carry', 'core');--> statement-breakpoint
CREATE TYPE "public"."primary_muscle" AS ENUM('glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors', 'core', 'lower_abs', 'upper_abs', 'obliques', 'chest', 'upper_chest', 'lower_chest', 'lats', 'traps', 'biceps', 'triceps', 'shoulders', 'delts', 'upper_back', 'lower_back', 'shins', 'tibialis_anterior');--> statement-breakpoint
CREATE TYPE "public"."strength_level" AS ENUM('very_low', 'low', 'moderate', 'high');--> statement-breakpoint
CREATE TABLE "business" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "business_businessId_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"primary_muscle" "primary_muscle" NOT NULL,
	"secondary_muscles" text[],
	"loaded_joints" text[],
	"movement_pattern" "movement_pattern" NOT NULL,
	"modality" "modality" NOT NULL,
	"movement_tags" text[],
	"function_tags" text[],
	"fatigue_profile" "fatigue_profile" NOT NULL,
	"complexity_level" "complexity_level" NOT NULL,
	"equipment" text[],
	"strength_level" "strength_level" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
