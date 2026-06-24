import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("../lib/gemini.js", () => ({
  ai: {
    models: {
      generateContent: mockGenerateContent,
    },
  },
}));

import {
  runTechnicalAgent,
  runProjectAgent,
  runHRAgent,
  runAuthenticityAgent,
  runEvaluatorAgent,
} from "../services/agents.js";
import type { InterviewMessage } from "@workspace/db";

const sampleProfile = {
  skills: ["Python", "FastAPI", "SQL", "Machine Learning", "Docker"],
  projects: [
    "ML recommendation system using collaborative filtering and matrix factorization",
    "FastAPI REST service for real-time predictions",
  ],
  education: ["BSc Computer Science, Stanford University, 2021"],
  experience: [
    "ML Engineer at TechCorp (2021-2024): designed and deployed recommendation pipeline serving 1M users",
  ],
  claimed_technologies: [
    "Python",
    "FastAPI",
    "PostgreSQL",
    "scikit-learn",
    "Docker",
    "Redis",
  ],
};

function makeMessage(
  overrides: Partial<InterviewMessage> & { id: number },
): InterviewMessage {
  return {
    sessionId: "test-session",
    role: "agent",
    agentName: "TechnicalAgent",
    content: "Test content",
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TechnicalAgent", () => {
  it("returns a question on first round (no history)", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        question:
          "You listed FastAPI — explain how its dependency injection system works under the hood.",
        evaluation: null,
      }),
    });

    const result = await runTechnicalAgent(sampleProfile, []);
    expect(result.question).toBeTruthy();
    expect(typeof result.question).toBe("string");
    expect(result.evaluation).toBeNull();
  });

  it("returns follow-up question with evaluation after prior answer", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        question:
          "You mentioned Pydantic validation — how does FastAPI use it for request body coercion?",
        evaluation:
          "Candidate showed awareness of FastAPI routing but lacked depth on the dependency injection mechanism.",
      }),
    });

    const messages = [
      makeMessage({
        id: 1,
        role: "agent",
        agentName: "TechnicalAgent",
        content: "Explain FastAPI dependency injection.",
      }),
      makeMessage({
        id: 2,
        role: "candidate",
        agentName: null,
        content: "FastAPI uses Depends() to inject dependencies into route handlers.",
      }),
    ];

    const result = await runTechnicalAgent(sampleProfile, messages);
    expect(result.question).toBeTruthy();
    expect(result.evaluation).not.toBeNull();
  });
});

describe("ProjectDeepDiveAgent", () => {
  it("picks a project and asks implementation question", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        question:
          "In your ML recommendation system — what algorithm did you use for matrix factorization and how did you handle the cold-start problem?",
        evaluation: null,
      }),
    });

    const result = await runProjectAgent(sampleProfile, []);
    expect(result.question).toBeTruthy();
    expect(result.question.toLowerCase()).toMatch(/project|recommend|system|ml/i);
  });
});

describe("HRAgent", () => {
  it("asks a behavioral question tailored to background", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        question:
          "Tell me about a time at TechCorp when you had to explain a complex ML model decision to a non-technical stakeholder.",
        evaluation: null,
      }),
    });

    const result = await runHRAgent(sampleProfile, []);
    expect(result.question).toBeTruthy();
    expect(typeof result.question).toBe("string");
  });
});

describe("AuthenticityAgent", () => {
  it("returns negative delta for specific, first-person answer", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        flags: [],
        suspicion_delta: -4,
        reasoning:
          "Candidate provided specific implementation details (Redis cache TTL of 24h, ALS algorithm) consistent with their CV claims.",
      }),
    });

    const messages = [
      makeMessage({
        id: 1,
        role: "agent",
        agentName: "ProjectDeepDiveAgent",
        content: "How did you handle the cold-start problem in your recommendation system?",
      }),
      makeMessage({
        id: 2,
        role: "candidate",
        agentName: null,
        content:
          "We used a hybrid approach — popularity-based fallback for new users cached in Redis with 24h TTL, and once we had 5+ interactions we switched to our ALS model.",
      }),
    ];

    const result = await runAuthenticityAgent(sampleProfile, messages);
    expect(result.suspicion_delta).toBeLessThanOrEqual(0);
    expect(result.flags).toHaveLength(0);
  });

  it("flags generic textbook answer with positive delta", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        flags: [
          "Answer appears generic — candidate described collaborative filtering in general without referencing their specific implementation",
        ],
        suspicion_delta: 17,
        reasoning:
          "Candidate described the concept of collaborative filtering textbook-style without any specific detail from their claimed project.",
      }),
    });

    const messages = [
      makeMessage({
        id: 1,
        role: "agent",
        agentName: "TechnicalAgent",
        content: "Walk me through your ML recommendation system — what does the pipeline look like end to end?",
      }),
      makeMessage({
        id: 2,
        role: "candidate",
        agentName: null,
        content:
          "Collaborative filtering works by finding users with similar preferences and recommending items they liked. There are two types: user-based and item-based.",
      }),
    ];

    const result = await runAuthenticityAgent(sampleProfile, messages);
    expect(result.suspicion_delta).toBeGreaterThan(0);
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it("clamps suspicion_delta to valid range", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        flags: ["Significant contradiction with CV claim"],
        suspicion_delta: 999,
        reasoning: "Extreme case.",
      }),
    });

    const result = await runAuthenticityAgent(sampleProfile, []);
    expect(result.suspicion_delta).toBeLessThanOrEqual(40);
  });
});

describe("EvaluatorAgent", () => {
  it("returns a complete, valid evaluation report for a strong candidate", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        technical_score: 82,
        communication_score: 76,
        cv_authenticity: "High",
        cheating_risk: "Low",
        recommendation: "Shortlist",
        justification:
          "Candidate demonstrated strong Python and scikit-learn knowledge with specific details about their ALS recommendation system. CV claims are well-supported. Communication was clear and structured.",
      }),
    });

    const messages = [
      makeMessage({ id: 1, role: "agent", agentName: "TechnicalAgent", content: "Q" }),
      makeMessage({ id: 2, role: "candidate", agentName: null, content: "Detailed answer" }),
      makeMessage({ id: 3, role: "agent", agentName: "HRAgent", content: "Q2" }),
      makeMessage({ id: 4, role: "candidate", agentName: null, content: "Detailed behavioral answer" }),
    ];

    const report = await runEvaluatorAgent(sampleProfile, messages, 3);
    expect(report.technical_score).toBeGreaterThanOrEqual(0);
    expect(report.technical_score).toBeLessThanOrEqual(100);
    expect(report.communication_score).toBeGreaterThanOrEqual(0);
    expect(report.communication_score).toBeLessThanOrEqual(100);
    expect(["High", "Medium", "Low"]).toContain(report.cv_authenticity);
    expect(["Low", "Medium", "High"]).toContain(report.cheating_risk);
    expect(["Shortlist", "Manual review required", "Reject"]).toContain(report.recommendation);
    expect(report.justification.length).toBeGreaterThan(10);
  });

  it("returns valid report for a weak candidate", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        technical_score: 32,
        communication_score: 55,
        cv_authenticity: "Low",
        cheating_risk: "High",
        recommendation: "Reject",
        justification:
          "Multiple generic answers that did not reference specific project details. CV claim about ML system not supported by any implementation knowledge demonstrated.",
      }),
    });

    const report = await runEvaluatorAgent(sampleProfile, [], 85);
    expect(report.recommendation).toBe("Reject");
    expect(report.cheating_risk).toBe("High");
    expect(report.cv_authenticity).toBe("Low");
  });

  it("normalises out-of-range scores to 0-100", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        technical_score: 150,
        communication_score: -10,
        cv_authenticity: "Medium",
        cheating_risk: "Low",
        recommendation: "Manual review required",
        justification: "Edge case.",
      }),
    });

    const report = await runEvaluatorAgent(sampleProfile, [], 0);
    expect(report.technical_score).toBe(100);
    expect(report.communication_score).toBe(0);
  });
});
