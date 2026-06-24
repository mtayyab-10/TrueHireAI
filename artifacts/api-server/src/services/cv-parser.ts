import { ai } from "../lib/gemini.js";
import { CV_PARSER_SYSTEM_PROMPT } from "./prompts.js";

export interface CvProfile {
  skills: string[];
  projects: string[];
  education: string[];
  experience: string[];
  claimed_technologies: string[];
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (buffer.length === 0) {
    throw new Error("The uploaded file is empty.");
  }

  const pdfParse = (await import("pdf-parse")).default;

  let data: { text: string };
  try {
    data = await pdfParse(buffer);
  } catch {
    throw new Error(
      "Could not read the PDF file — it may be corrupted or password-protected.",
    );
  }

  const text = data.text.trim();
  if (!text || text.length < 50) {
    throw new Error(
      "No extractable text found in the PDF. The file may be a scanned image without OCR — please upload a text-based PDF.",
    );
  }

  return text;
}

export async function parseCvWithAI(rawText: string): Promise<CvProfile> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `${CV_PARSER_SYSTEM_PROMPT}\n\n${rawText}` }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const content = response.text;
  if (!content) {
    throw new Error("AI parser returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI parser returned malformed JSON.");
  }

  const profile = parsed as Record<string, unknown>;
  const requiredArrayFields = [
    "skills",
    "projects",
    "education",
    "experience",
    "claimed_technologies",
  ] as const;

  for (const field of requiredArrayFields) {
    if (!Array.isArray(profile[field])) {
      throw new Error(
        `AI parser returned an invalid profile — missing or malformed field: ${field}`,
      );
    }
  }

  return profile as unknown as CvProfile;
}
