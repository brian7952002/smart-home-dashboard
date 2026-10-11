import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { AUTOMATION_ICONS, DEVICE_EVENT_TYPES, DEVICE_TYPES, SCENARIO_ICONS } from "./constants";

export const deviceTypeEnum = pgEnum("device_type", DEVICE_TYPES);
export const deviceEventTypeEnum = pgEnum("device_event_type", DEVICE_EVENT_TYPES);
export const scenarioIconEnum = pgEnum("scenario_icon", SCENARIO_ICONS);
export const automationIconEnum = pgEnum("automation_icon", AUTOMATION_ICONS);

export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 40 }).notNull(),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rooms_name_lower_idx").on(sql`lower(${t.name})`),
    check("rooms_width_range", sql`${t.width} BETWEEN 60 AND 350`),
    check("rooms_height_range", sql`${t.height} BETWEEN 50 AND 310`),
    check("rooms_x_bounds", sql`${t.positionX} >= 0 AND ${t.positionX} + ${t.width} <= 350`),
    check("rooms_y_bounds", sql`${t.positionY} >= 40 AND ${t.positionY} + ${t.height} <= 450`),
  ],
);

export const devices = pgTable(
  "devices",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    type: deviceTypeEnum("type").notNull(),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    isOn: boolean("is_on").notNull().default(false),
    isOnline: boolean("is_online").notNull().default(true),
    hasError: boolean("has_error").notNull().default(false),
    errorMessage: varchar("error_message", { length: 200 }),
    errorFixable: boolean("error_fixable").notNull().default(false),
    brightness: smallint("brightness"),
    targetTempF: smallint("target_temp_f"),
    manufacturer: varchar("manufacturer", { length: 60 }),
    model: varchar("model", { length: 60 }),
    firmwareVersion: varchar("firmware_version", { length: 30 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("devices_room_idx").on(t.roomId),
    check(
      "devices_error_consistency",
      sql`(${t.hasError} AND ${t.errorMessage} IS NOT NULL) OR (NOT ${t.hasError} AND ${t.errorMessage} IS NULL AND NOT ${t.errorFixable})`,
    ),
    check(
      "devices_brightness_light_only",
      sql`${t.brightness} IS NULL OR (${t.type} = 'light' AND ${t.brightness} BETWEEN 0 AND 100)`,
    ),
    check(
      "devices_target_temp_climate_only",
      sql`${t.targetTempF} IS NULL OR (${t.type} = 'climate' AND ${t.targetTempF} BETWEEN 60 AND 90)`,
    ),
  ],
);

export const deviceEvents = pgTable(
  "device_events",
  {
    id: serial("id").primaryKey(),
    deviceId: integer("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    type: deviceEventTypeEnum("type").notNull(),
    detail: varchar("detail", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("device_events_device_created_idx").on(t.deviceId, t.createdAt.desc())],
);

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 40 }).notNull(),
  icon: scenarioIconEnum("icon").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  description: varchar("description", { length: 120 }).notNull(),
  icon: automationIconEnum("icon").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RoomRow = typeof rooms.$inferSelect;
export type DeviceRow = typeof devices.$inferSelect;
export type DeviceEventRow = typeof deviceEvents.$inferSelect;
export type ScenarioRow = typeof scenarios.$inferSelect;
export type AutomationRow = typeof automations.$inferSelect;
