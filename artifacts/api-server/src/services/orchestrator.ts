import { eq, asc } from "drizzle-orm";
import { db, interviewSessionsTable, interviewMessagesTable } from "@workspace/db";
import {
  runTechnicalAgent,
  runProjectAgent,
  runHRAgent,
  runAuthenticityAgent,
  runEvaluatorAgent,
  type AgentName,
  type EvaluationResult,
} from "./agents.js";
import type { CvProfile } from "./cv-parser.js";
import type { InterviewMessage } from "@workspace/db";
import { broadcastToSession } from "../lib/ws.js";

const ROUND_AGENTS: AgentName[] = [
  "TechnicalAgent",
  "TechnicalAgent",
  "ProjectDeepDiveAgent",
  "ProjectDeepDiveAgent",
  "HRAgent",
  "HRAgent",
];

const FOLLOW_UP_SUSPICION_THRESHOLD = 15;

async function getMessages(sessionId: string): Promise<InterviewMessage[]> {
  return db
    .select()
    .from(interviewMessagesTable)
    .where(eq(interviewMessagesTable.sessionId, sessionId))
    .orderBy(asc(interviewMessagesTable.createdAt));
}

async function generateQuestion(
  agentName: AgentName,
  profile: CvProfile,
  messages: InterviewMessage[],
): Promise<string> {
  switch (agentName) {
    case "TechnicalAgent": {
      const result = await runTechnicalAgent(profile, messages);
      return result.question;
    }
    case "ProjectDeepDiveAgent": {
      const result = await runProjectAgent(profile, messages);
      return result.question;
    }
    case "HRAgent": {
      const result = await runHRAgent(profile, messages);
      return result.question;
    }
    default:
      throw new Error(`Cannot generate question for agent: ${agentName}`);
  }
}

export async function startInterview(
  sessionId: string,
): Promise<{ agent_name: string; question: string }> {
  const [session] = await db
    .select()
    .from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.id, sessionId));

  if (!session) throw new Error("NOT_FOUND");
  if (session.status !== "pending") throw new Error("ALREADY_STARTED");

  const profile = session.cvProfile as CvProfile;
  const agentName = ROUND_AGENTS[0] ?? "TechnicalAgent";
  const question = await generateQuestion(agentName, profile, []);

  await db
    .insert(interviewMessagesTable)
    .values({
      sessionId,
      role: "agent",
      agentName,
      content: question,
    });

  await db
    .update(interviewSessionsTable)
    .set({ status: "active", currentRound: 0 })
    .where(eq(interviewSessionsTable.id, sessionId));

  broadcastToSession(sessionId, {
    type: "agent_action",
    agent: agentName,
    message: `Opening question delivered.`,
  });

  return { agent_name: agentName, question };
}

export async function processAnswer(
  sessionId: string,
  answer: string,
): Promise<{
  agent_name: string;
  message: string;
  next_question: string | null;
  suspicion_delta: number;
}> {
  const [session] = await db
    .select()
    .from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.id, sessionId));

  if (!session) throw new Error("NOT_FOUND");

  const profile = session.cvProfile as CvProfile;

  await db.insert(interviewMessagesTable).values({
    sessionId,
    role: "candidate",
    agentName: null,
    content: answer,
  });

  const messages = await getMessages(sessionId);

  const authenticityResult = await runAuthenticityAgent(profile, messages);
  const { suspicion_delta, flags, reasoning } = authenticityResult;

  const newSuspicionScore = Math.max(
    0,
    session.suspicionScore + suspicion_delta,
  );

  broadcastToSession(sessionId, {
    type: "agent_action",
    agent: "AuthenticityAgent",
    message:
      flags.length > 0
        ? `Flags raised: ${flags.join("; ")}`
        : `No authenticity concerns detected. ${reasoning}`,
  });

  let nextQuestion: string | null = null;
  let nextAgentName: AgentName | null = null;

  if (session.pendingFollowUp) {
    const currentAgent = ROUND_AGENTS[session.currentRound] ?? "TechnicalAgent";
    nextAgentName = currentAgent;
    nextQuestion = session.pendingFollowUp;

    await db
      .update(interviewSessionsTable)
      .set({ suspicionScore: newSuspicionScore, pendingFollowUp: null })
      .where(eq(interviewSessionsTable.id, sessionId));
  } else {
    const nextRound = session.currentRound + 1;
    const isComplete = nextRound >= ROUND_AGENTS.length;

    if (!isComplete) {
      nextAgentName = ROUND_AGENTS[nextRound] ?? "TechnicalAgent";

      if (suspicion_delta >= FOLLOW_UP_SUSPICION_THRESHOLD) {
        const followUpAgentName =
          ROUND_AGENTS[session.currentRound] ?? "TechnicalAgent";
        const followUpQuestion = await generateQuestion(
          followUpAgentName,
          profile,
          messages,
        );

        await db
          .update(interviewSessionsTable)
          .set({
            suspicionScore: newSuspicionScore,
            pendingFollowUp: followUpQuestion,
          })
          .where(eq(interviewSessionsTable.id, sessionId));

        nextAgentName = followUpAgentName;
        nextQuestion = followUpQuestion;
      } else {
        nextQuestion = await generateQuestion(nextAgentName, profile, messages);

        await db
          .update(interviewSessionsTable)
          .set({ suspicionScore: newSuspicionScore, currentRound: nextRound })
          .where(eq(interviewSessionsTable.id, sessionId));
      }
    } else {
      await db
        .update(interviewSessionsTable)
        .set({
          suspicionScore: newSuspicionScore,
          currentRound: nextRound,
          status: "complete",
        })
        .where(eq(interviewSessionsTable.id, sessionId));

      broadcastToSession(sessionId, {
        type: "agent_action",
        agent: "Orchestrator",
        message: "All interview rounds complete. Call /report to get the final evaluation.",
      });
    }
  }

  if (nextQuestion && nextAgentName) {
    await db.insert(interviewMessagesTable).values({
      sessionId,
      role: "agent",
      agentName: nextAgentName,
      content: nextQuestion,
    });

    broadcastToSession(sessionId, {
      type: "agent_action",
      agent: nextAgentName,
      message: `Next question delivered.`,
    });
  }

  const currentRoundAgent =
    ROUND_AGENTS[session.currentRound] ?? "TechnicalAgent";
  const message =
    flags.length > 0
      ? `${flags[0]}`
      : suspicion_delta < 0
        ? "Strong, specific answer — authenticity score improved."
        : "Answer recorded.";

  return {
    agent_name: nextAgentName ?? currentRoundAgent,
    message,
    next_question: nextQuestion,
    suspicion_delta,
  };
}

export async function generateReport(
  sessionId: string,
): Promise<EvaluationResult> {
  const [session] = await db
    .select()
    .from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.id, sessionId));

  if (!session) throw new Error("NOT_FOUND");

  const profile = session.cvProfile as CvProfile;
  const messages = await getMessages(sessionId);

  broadcastToSession(sessionId, {
    type: "agent_action",
    agent: "EvaluatorAgent",
    message: "Generating final evaluation report...",
  });

  const report = await runEvaluatorAgent(
    profile,
    messages,
    session.suspicionScore,
  );

  broadcastToSession(sessionId, {
    type: "agent_action",
    agent: "EvaluatorAgent",
    message: `Evaluation complete. Recommendation: ${report.recommendation}. Technical: ${report.technical_score}/100.`,
  });

  return report;
}
