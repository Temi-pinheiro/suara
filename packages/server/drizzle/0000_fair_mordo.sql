CREATE TABLE "components" (
	"id" text PRIMARY KEY NOT NULL,
	"lang" text NOT NULL,
	"kind" text NOT NULL,
	"surface" text NOT NULL,
	"gloss_en" text NOT NULL,
	"expected_tones" text,
	"prereq_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intro_audio_ref" text,
	"model_audio_refs" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"user_id" text NOT NULL,
	"lang" text NOT NULL,
	"level_estimate" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_id_lang_pk" PRIMARY KEY("user_id","lang")
);
--> statement-breakpoint
CREATE TABLE "error_log" (
	"user_id" text NOT NULL,
	"lang" text NOT NULL,
	"unit" text NOT NULL,
	"expected" text NOT NULL,
	"produced" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"last_ts" bigint NOT NULL,
	CONSTRAINT "error_log_user_id_lang_unit_expected_produced_pk" PRIMARY KEY("user_id","lang","unit","expected","produced")
);
--> statement-breakpoint
CREATE TABLE "mastery" (
	"user_id" text NOT NULL,
	"lang" text NOT NULL,
	"component_id" text NOT NULL,
	"strength" double precision DEFAULT 0 NOT NULL,
	"known" boolean DEFAULT false NOT NULL,
	"last_seen" bigint NOT NULL,
	"due_at" bigint NOT NULL,
	CONSTRAINT "mastery_user_id_component_id_pk" PRIMARY KEY("user_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "pending_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lang" text NOT NULL,
	"decision" jsonb NOT NULL,
	"ctx" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lang" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"turn_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lang" text NOT NULL,
	"component_id" text NOT NULL,
	"prompt_text" text NOT NULL,
	"reference_text" text NOT NULL,
	"transcript" text NOT NULL,
	"overall_score" double precision,
	"error_detail" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision" text NOT NULL,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"l1" text DEFAULT 'eng' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
