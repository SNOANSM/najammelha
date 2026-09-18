import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, real, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("najammelha_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  points: integer("points").notNull().default(0),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categoriesTable = pgTable("najammelha_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  icon: text("icon").notNull(),
});

export const reportsTable = pgTable("najammelha_reports", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  image: text("image").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  categoryLabel: text("category_label").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  locationName: text("location_name").notNull(),
  locationExact: boolean("location_exact").notNull().default(false),
  agencyId: text("agency_id"),
  agencyName: text("agency_name"),
  agencyReason: text("agency_reason"),
  agencyConfidence: real("agency_confidence"),
  agencySource: text("agency_source"),
  status: text("status").notNull().default("received"),
  points: integer("points").notNull().default(10),
  supportCount: integer("support_count").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locationsTable = pgTable("najammelha_locations", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  name: text("name").notNull(),
});

export const pointsTable = pgTable("najammelha_points", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  reportId: integer("report_id"),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("najammelha_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("najammelha_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rewardsTable = pgTable("najammelha_rewards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  image: text("image").notNull(),
  partnerName: text("partner_name").notNull(),
  discountLabel: text("discount_label").notNull(),
  costPoints: integer("cost_points").notNull(),
  stock: integer("stock"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redemptionsTable = pgTable("najammelha_redemptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  rewardId: integer("reward_id").notNull(),
  code: text("code").notNull().unique(),
  costPoints: integer("cost_points").notNull(),
  rewardTitle: text("reward_title").notNull(),
  partnerName: text("partner_name").notNull(),
  discountLabel: text("discount_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploadsTable = pgTable("najammelha_uploads", {
  id: text("id").primaryKey(),
  contentType: text("content_type").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable);
export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true });
export const insertPointSchema = createInsertSchema(pointsTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertRewardSchema = createInsertSchema(rewardsTable).omit({ id: true, createdAt: true });
export const insertRedemptionSchema = createInsertSchema(redemptionsTable).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertPoint = z.infer<typeof insertPointSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type InsertRedemption = z.infer<typeof insertRedemptionSchema>;
export type Report = typeof reportsTable.$inferSelect;
export type Reward = typeof rewardsTable.$inferSelect;
export type Redemption = typeof redemptionsTable.$inferSelect;