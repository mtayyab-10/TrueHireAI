import { Router, type IRouter } from "express";
import multer from "multer";
import { db, interviewSessionsTable } from "@workspace/db";
import { extractTextFromPdf, parseCvWithAI } from "../services/cv-parser.js";
import { UploadCvResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted."));
    }
  },
});

router.post(
  "/cv/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a PDF as form-data field 'file'." });
      return;
    }

    let rawText: string;
    try {
      rawText = await extractTextFromPdf(req.file.buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read PDF.";
      res.status(400).json({ error: message });
      return;
    }

    let profile: Awaited<ReturnType<typeof parseCvWithAI>>;
    try {
      profile = await parseCvWithAI(rawText);
    } catch (err) {
      const message = err instanceof Error ? err.message : "CV parsing failed.";
      req.log.error({ err }, "CV AI parsing failed");
      res.status(500).json({ error: message });
      return;
    }

    const sessionId = crypto.randomUUID();

    await db.insert(interviewSessionsTable).values({
      id: sessionId,
      status: "pending",
      suspicionScore: 0,
      cvRawText: rawText,
      cvProfile: profile,
      currentRound: 0,
      pendingFollowUp: null,
    });

    req.log.info({ sessionId }, "Interview session created");

    res.json(UploadCvResponse.parse({ session_id: sessionId, profile }));
  },
);

export default router;
