CREATE TYPE "public"."automation_icon" AS ENUM('clock', 'home', 'calendar', 'location');--> statement-breakpoint
CREATE TYPE "public"."device_event_type" AS ENUM('created', 'updated', 'power_on', 'power_off', 'setting_changed', 'error_set', 'error_cleared', 'reconnected', 'went_offline');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('light', 'climate', 'security', 'media');--> statement-breakpoint
CREATE TYPE "public"."scenario_icon" AS ENUM('moon', 'sun', 'film');--> statement-breakpoint
CREATE TABLE "automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" varchar(120) NOT NULL,
	"icon" "automation_icon" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"type" "device_event_type" NOT NULL,
	"detail" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(60) NOT NULL,
	"type" "device_type" NOT NULL,
	"room_id" integer NOT NULL,
	"is_on" boolean DEFAULT false NOT NULL,
	"is_online" boolean DEFAULT true NOT NULL,
	"has_error" boolean DEFAULT false NOT NULL,
	"error_message" varchar(200),
	"error_fixable" boolean DEFAULT false NOT NULL,
	"brightness" smallint,
	"target_temp_f" smallint,
	"manufacturer" varchar(60),
	"model" varchar(60),
	"firmware_version" varchar(30),
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_error_consistency" CHECK (("devices"."has_error" AND "devices"."error_message" IS NOT NULL) OR (NOT "devices"."has_error" AND "devices"."error_message" IS NULL AND NOT "devices"."error_fixable")),
	CONSTRAINT "devices_brightness_light_only" CHECK ("devices"."brightness" IS NULL OR ("devices"."type" = 'light' AND "devices"."brightness" BETWEEN 0 AND 100)),
	CONSTRAINT "devices_target_temp_climate_only" CHECK ("devices"."target_temp_f" IS NULL OR ("devices"."type" = 'climate' AND "devices"."target_temp_f" BETWEEN 60 AND 90))
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(40) NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_width_range" CHECK ("rooms"."width" BETWEEN 60 AND 350),
	CONSTRAINT "rooms_height_range" CHECK ("rooms"."height" BETWEEN 50 AND 310),
	CONSTRAINT "rooms_x_bounds" CHECK ("rooms"."position_x" >= 0 AND "rooms"."position_x" + "rooms"."width" <= 350),
	CONSTRAINT "rooms_y_bounds" CHECK ("rooms"."position_y" >= 40 AND "rooms"."position_y" + "rooms"."height" <= 450)
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(40) NOT NULL,
	"icon" "scenario_icon" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_events_device_created_idx" ON "device_events" USING btree ("device_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "devices_room_idx" ON "devices" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_name_lower_idx" ON "rooms" USING btree (lower("name"));