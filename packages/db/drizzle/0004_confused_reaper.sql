CREATE TYPE "public"."session_status" AS ENUM('open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('squat', 'lunge', 'bench_press', 'pull_up', 'deadlift', 'row', 'press', 'curl', 'fly', 'plank', 'carry', 'raise', 'extension', 'push_up', 'dip', 'shrug', 'bridge', 'step_up', 'calf_raise', 'crunch', 'leg_raise', 'pulldown', 'pullover', 'kickback', 'thruster', 'clean', 'snatch', 'swing', 'turkish_get_up', 'other');--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"business_id" uuid NOT NULL,
	"strength_level" text DEFAULT 'moderate' NOT NULL,
	"skill_level" text DEFAULT 'moderate' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_training_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"training_session_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"checked_in_at" timestamp,
	"preference_collection_step" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_session_id" uuid,
	"user_id" text NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"workout_type" text,
	"total_planned_sets" integer,
	"llm_output" jsonb,
	"template_config" jsonb,
	"context" text DEFAULT 'individual' NOT NULL,
	"business_id" uuid NOT NULL,
	"created_by_trainer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workout_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"sets_completed" integer NOT NULL,
	"group_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"training_session_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"intensity" text,
	"muscle_targets" text[],
	"muscle_lessens" text[],
	"include_exercises" text[],
	"avoid_exercises" text[],
	"avoid_joints" text[],
	"session_goal" text,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"collection_method" text DEFAULT 'sms' NOT NULL,
	CONSTRAINT "workout_preferences_userId_trainingSessionId_unique" UNIQUE("user_id","training_session_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"business_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"content" text NOT NULL,
	"phone_number" text,
	"metadata" json,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"conversation_type" text NOT NULL,
	"current_step" text DEFAULT 'awaiting_response' NOT NULL,
	"state" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post" RENAME TO "training_session";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "trainer_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "scheduled_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "max_participants" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "status" "session_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "business_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "exercise_type" "exercise_type";--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_training_session" ADD CONSTRAINT "user_training_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_training_session" ADD CONSTRAINT "user_training_session_training_session_id_training_session_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_training_session_id_training_session_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_created_by_trainer_id_user_id_fk" FOREIGN KEY ("created_by_trainer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_preferences" ADD CONSTRAINT "workout_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_preferences" ADD CONSTRAINT "workout_preferences_training_session_id_training_session_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_preferences" ADD CONSTRAINT "workout_preferences_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_trainer_id_user_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_phone_idx" ON "user" USING btree ("phone");--> statement-breakpoint
ALTER TABLE "training_session" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "training_session" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "image";