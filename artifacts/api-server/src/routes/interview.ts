import { Router, type IRouter } from "express";
import {
  StartInterviewResponse,
  SubmitAnswerBody,
  SubmitAnswerResponse,
  GetReportResponse,
} from "@workspace/api-zod";
import {
  startInterview,
  processAnswer,
  generateReport,
} from "../services/orchestrator.js";

const router: IRouter = Router();

function getParam(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

router.post("/interview/:sessionId/start", async (req, res): Promise<void> => {
  const sessionId = getParam(req.params["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId." });
    return;
  }

  try {
    const result = await startInterview(sessionId);
    res.json(StartInterviewResponse.parse({ agent_name: result.agent_name, question: result.question }));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (err instanceof Error && err.message === "ALREADY_STARTED") {
      res.status(409).json({ error: "Interview has already been started." });
      return;
    }
    req.log.error({ err }, "Failed to start interview");
    res.status(500).json({ error: "Failed to start interview." });
  }
});

router.post("/interview/:sessionId/answer", async (req, res): Promise<void> => {
  const sessionId = getParam(req.params["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId." });
    return;
  }

  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await processAnswer(sessionId, parsed.data.answer);
    res.json(SubmitAnswerResponse.parse(result));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    req.log.error({ err }, "Failed to process answer");
    res.status(500).json({ error: "Failed to process answer." });
  }
});

router.get("/interview/:sessionId/report", async (req, res): Promise<void> => {
  const sessionId = getParam(req.params["sessionId"]);
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId." });
    return;
  }

  try {
    const report = await generateReport(sessionId);
    res.json(GetReportResponse.parse(report));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    req.log.error({ err }, "Failed to generate report");
    res.status(500).json({ error: "Failed to generate report." });
  }
});

export default router;
