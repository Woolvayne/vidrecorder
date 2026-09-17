import { pgTable, uuid, text, integer, real, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import type { ProjectData } from "@/lib/types";

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 400 }).notNull(),
  prompt: text("prompt").default("").notNull(),
  mode: varchar("mode", { length: 40 }).default("prompt").notNull(),
  status: varchar("status", { length: 40 }).default("draft").notNull(),
  format: varchar("format", { length: 40 }).default("youtube").notNull(),
  language: varchar("language", { length: 8 }).default("en").notNull(),
  aspect: varchar("aspect", { length: 8 }).default("16:9").notNull(),
  durationTargetSec: integer("duration_target_sec").default(300).notNull(),
  data: jsonb("data").$type<ProjectData>().notNull(),
  brandId: uuid("brand_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 300 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  category: varchar("category", { length: 60 }).default("uploads").notNull(),
  url: text("url").notNull(),
  size: integer("size").default(0).notNull(),
  duration: real("duration").default(0).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const exportsTable = pgTable("exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  title: varchar("title", { length: 400 }).notNull(),
  status: varchar("status", { length: 30 }).default("rendering").notNull(),
  format: varchar("format", { length: 10 }).default("webm").notNull(),
  resolution: varchar("resolution", { length: 10 }).default("1080p").notNull(),
  aspect: varchar("aspect", { length: 8 }).default("16:9").notNull(),
  fps: integer("fps").default(30).notNull(),
  size: integer("size").default(0).notNull(),
  error: text("error").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
