import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewMessagesTable = pgTable("interview_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  agentName: text("agent_name"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertInterviewMessageSchema = createInsertSchema(
  interviewMessagesTable,
).omit({ id: true, createdAt: true });

export type InsertInterviewMessage = z.infer<
  typeof insertInterviewMessageSchema
>;
export type InterviewMessage = typeof interviewMessagesTable.$inferSelect;
