import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  suspicionScore: integer("suspicion_score").notNull().default(0),
  cvRawText: text("cv_raw_text").notNull(),
  cvProfile: jsonb("cv_profile").notNull(),
  currentRound: integer("current_round").notNull().default(0),
  pendingFollowUp: text("pending_follow_up"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertInterviewSessionSchema = createInsertSchema(
  interviewSessionsTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertInterviewSession = z.infer<
  typeof insertInterviewSessionSchema
>;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
