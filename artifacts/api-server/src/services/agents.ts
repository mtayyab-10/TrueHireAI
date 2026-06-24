import { ai } from "../lib/gemini.js";
import {
  HR_AGENT_SYSTEM_PROMPT,
  TECHNICAL_AGENT_SYSTEM_PROMPT,
  PROJECT_AGENT_SYSTEM_PROMPT,
  AUTHENTICITY_AGENT_SYSTEM_PROMPT,
  EVALUATOR_AGENT_SYSTEM_PROMPT,
} from "./prompts.js";
import type { CvProfile } from "./cv-parser.js";
import type { InterviewMessage } from "@workspace/db";

export type AgentName =
  | "TechnicalAgent"
  | "ProjectDeepDiveAgent"
  | "HRAgent"
  | "AuthenticityAgent"
  | "EvaluatorAgent";

export interface AgentQuestion {
  question: string;
  evaluation: string | null;
}

export interface AuthenticityFlag {
  flags: string[];
  suspicion_delta: number;
  reasoning: string;
}

export interface EvaluationResult {
  technical_score: number;
  communication_score: number;
  cv_authenticity: "High" | "Medium" | "Low";
  cheating_risk: "Low" | "Medium" | "High";
  recommendation: "Shortlist" | "Manual review required" | "Reject";
  justification: string;
}

function buildTranscript(messages: InterviewMessage[]): string {
  return messages
    .map((m) => {
      const speaker = m.role === "agent" ? m.agentName ?? "Agent" : "Candidate";
      return `${speaker}: ${m.content}`;
    })
    .join("\n\n");
}

function buildCvSummary(profile: CvProfile): string {
  return [
    `Skills: ${profile.skills.join(", ")}`,
    `Claimed Technologies: ${profile.claimed_technologies.join(", ")}`,
    `Projects: ${profile.projects.join("; ")}`,
    `Experience: ${profile.experience.join("; ")}`,
    `Education: ${profile.education.join("; ")}`,
  ].join("\n");
}

async function callAgentJson<T>(
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const content = response.text;
  if (!content) throw new Error("Agent returned empty response.");

  return JSON.parse(content) as T;
}

export async function runTechnicalAgent(
  profile: CvProfile,
  messages: InterviewMessage[],
): Promise<AgentQuestion> {
  const cvSummary = buildCvSummary(profile);
  const transcript = buildTranscript(messages);

  const userMessage = transcript
    ? `CV Profile:\n${cvSummary}\n\nConversation so far:\n${transcript}\n\nAsk the next technical question.`
    : `CV Profile:\n${cvSummary}\n\nThis is the first question. Ask an opening technical question based on their most prominent claimed technology.`;

  return callAgentJson<AgentQuestion>(TECHNICAL_AGENT_SYSTEM_PROMPT, userMessage);
}

export async function runProjectAgent(
  profile: CvProfile,
  messages: InterviewMessage[],
): Promise<AgentQuestion> {
  const cvSummary = buildCvSummary(profile);
  const transcript = buildTranscript(messages);

  const userMessage = transcript
    ? `CV Profile:\n${cvSummary}\n\nConversation so far:\n${transcript}\n\nAsk the next project deep-dive question.`
    : `CV Profile:\n${cvSummary}\n\nThis is the first project question. Pick the most interesting project and begin the deep dive.`;

  return callAgentJson<AgentQuestion>(PROJECT_AGENT_SYSTEM_PROMPT, userMessage);
}

export async function runHRAgent(
  profile: CvProfile,
  messages: InterviewMessage[],
): Promise<AgentQuestion> {
  const cvSummary = buildCvSummary(profile);
  const transcript = buildTranscript(messages);

  const userMessage = transcript
    ? `CV Profile:\n${cvSummary}\n\nConversation so far:\n${transcript}\n\nAsk the next behavioral question.`
    : `CV Profile:\n${cvSummary}\n\nThis is the first behavioral question. Ask a thoughtful opening behavioral question tailored to their background.`;

  return callAgentJson<AgentQuestion>(HR_AGENT_SYSTEM_PROMPT, userMessage);
}

export async function runAuthenticityAgent(
  profile: CvProfile,
  messages: InterviewMessage[],
): Promise<AuthenticityFlag> {
  const cvSummary = buildCvSummary(profile);
  const transcript = buildTranscript(messages);

  const userMessage = `CV Profile:\n${cvSummary}\n\nFull interview transcript so far:\n${transcript}\n\nEvaluate the authenticity of the candidate's most recent answer.`;

  const result = await callAgentJson<AuthenticityFlag>(
    AUTHENTICITY_AGENT_SYSTEM_PROMPT,
    userMessage,
  );

  const delta = Number(result.suspicion_delta);
  return {
    flags: Array.isArray(result.flags) ? result.flags : [],
    suspicion_delta: isNaN(delta) ? 0 : Math.max(-20, Math.min(40, delta)),
    reasoning: result.reasoning ?? "",
  };
}

export async function runEvaluatorAgent(
  profile: CvProfile,
  messages: InterviewMessage[],
  totalSuspicionScore: number,
): Promise<EvaluationResult> {
  const cvSummary = buildCvSummary(profile);
  const transcript = buildTranscript(messages);

  const userMessage = `CV Profile:\n${cvSummary}\n\nFull interview transcript:\n${transcript}\n\nCumulative suspicion score: ${totalSuspicionScore} (0 = no concerns, 100+ = significant flags)\n\nProduce the final evaluation.`;

  const result = await callAgentJson<EvaluationResult>(
    EVALUATOR_AGENT_SYSTEM_PROMPT,
    userMessage,
  );

  const validAuthenticity = ["High", "Medium", "Low"].includes(result.cv_authenticity)
    ? result.cv_authenticity
    : "Low";
  const validCheatingRisk = ["Low", "Medium", "High"].includes(result.cheating_risk)
    ? result.cheating_risk
    : "Medium";
  const validRecommendation = [
    "Shortlist",
    "Manual review required",
    "Reject",
  ].includes(result.recommendation)
    ? result.recommendation
    : "Manual review required";

  return {
    technical_score: Math.max(0, Math.min(100, Number(result.technical_score) || 0)),
    communication_score: Math.max(0, Math.min(100, Number(result.communication_score) || 0)),
    cv_authenticity: validAuthenticity as EvaluationResult["cv_authenticity"],
    cheating_risk: validCheatingRisk as EvaluationResult["cheating_risk"],
    recommendation: validRecommendation as EvaluationResult["recommendation"],
    justification: result.justification ?? "No justification provided.",
  };
}
