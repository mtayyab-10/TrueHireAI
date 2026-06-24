import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

const mockGenerateContent = vi.fn();

vi.mock("../lib/gemini.js", () => ({
  ai: {
    models: {
      generateContent: mockGenerateContent,
    },
  },
}));

import { extractTextFromPdf, parseCvWithAI } from "../services/cv-parser.js";
import pdfParse from "pdf-parse";

const mockPdfParse = vi.mocked(pdfParse);

const sampleProfile = {
  skills: ["Python", "FastAPI", "SQL", "Machine Learning"],
  projects: ["ML recommendation system using collaborative filtering"],
  education: ["BSc Computer Science, Stanford, 2021"],
  experience: ["ML Engineer at TechCorp (2021-2024): built ML pipeline"],
  claimed_technologies: ["Python", "FastAPI", "PostgreSQL", "scikit-learn"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractTextFromPdf", () => {
  it("throws on empty buffer", async () => {
    await expect(extractTextFromPdf(Buffer.alloc(0))).rejects.toThrow(
      "empty",
    );
  });

  it("extracts text from a valid PDF buffer", async () => {
    mockPdfParse.mockResolvedValue({ text: "Jane Doe, ML Engineer\nSkills: Python, FastAPI, scikit-learn" } as never);
    const result = await extractTextFromPdf(Buffer.from("%PDF-1.4 dummy"));
    expect(result).toContain("Jane Doe");
    expect(result).toContain("Python");
  });

  it("throws when PDF has no extractable text", async () => {
    mockPdfParse.mockResolvedValue({ text: "   " } as never);
    await expect(
      extractTextFromPdf(Buffer.from("%PDF-1.4 dummy")),
    ).rejects.toThrow("No extractable text");
  });

  it("throws descriptive error for corrupted PDF", async () => {
    mockPdfParse.mockRejectedValue(new Error("Invalid PDF structure"));
    await expect(extractTextFromPdf(Buffer.from("not a pdf"))).rejects.toThrow(
      "corrupted",
    );
  });
});

describe("parseCvWithAI", () => {
  it("returns a structured CvProfile", async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(sampleProfile) });

    const result = await parseCvWithAI("Jane Doe, ML Engineer at TechCorp...");
    expect(result.skills).toContain("Python");
    expect(result.claimed_technologies).toContain("FastAPI");
    expect(Array.isArray(result.projects)).toBe(true);
    expect(Array.isArray(result.education)).toBe(true);
    expect(Array.isArray(result.experience)).toBe(true);
  });

  it("throws on malformed JSON from AI", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Here is your profile: {invalid" });
    await expect(parseCvWithAI("some text")).rejects.toThrow("malformed JSON");
  });

  it("throws when profile is missing required array fields", async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ skills: "Python" }) });
    await expect(parseCvWithAI("some text")).rejects.toThrow("invalid profile");
  });

  it("throws when AI returns empty content", async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });
    await expect(parseCvWithAI("some text")).rejects.toThrow("empty response");
  });
});
