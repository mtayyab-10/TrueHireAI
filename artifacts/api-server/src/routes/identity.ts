import { Router, type IRouter } from "express";
import { ai } from "../lib/gemini.js";
import { VerifyIdentityBody, VerifyIdentityResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// IDENTITY VERIFICATION — Gemini Vision
// Uses Gemini 2.5 Flash with inline image data (base64) for face comparison.
// GPT-4o was previously used; Gemini provides equivalent accuracy with inline
// image support and no CDN dependency.
//
// THRESHOLD: 70 (out of 100)
// Minimises false-rejects for legitimate candidates under variable lighting
// while catching clearly different people. Raise to 80 for stricter production.
const MATCH_THRESHOLD = 70;

router.post("/identity/verify", async (req, res): Promise<void> => {
  const parsed = VerifyIdentityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Both reference_image and live_image are required as base64 strings.",
    });
    return;
  }

  const { reference_image, live_image } = parsed.data;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a precise facial biometric verification system. Your job is to determine whether two photos show the SAME individual person.

Compare these specific facial features carefully:
- Face shape and jawline structure
- Eye shape, spacing between eyes, and eyebrow arch
- Nose width, bridge shape, and tip shape
- Mouth width and lip shape
- Cheekbone prominence and overall facial proportions
- Gender, approximate age, and ethnicity (these must all match)

Scoring rules:
- SAME photo (identical pixels): confidence = 100
- Same person, same session, slight angle/lighting change: confidence = 80-95
- Same person, very different lighting or years apart: confidence = 65-80
- Possibly same person but unclear: confidence = 40-60
- Clearly DIFFERENT people (different gender, age group, or distinct facial structure): confidence = 0-25
- Different but somewhat similar looking (same gender/age/ethnicity but different person): confidence = 20-45

Return ONLY valid JSON in this exact format:
{"same_person": true_or_false, "confidence": 0_to_100, "reasoning": "one sentence naming the key feature that drove the decision"}

Be conservative: if features differ, score low. Do NOT give high scores to different people who happen to share age or ethnicity.

Image 1 (reference photo — CV or ID):`,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: reference_image,
              },
            },
            { text: "Image 2 (live webcam snapshot):" },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: live_image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const raw = response.text ?? "{}";
    const result = JSON.parse(raw) as {
      same_person: boolean;
      confidence: number;
      reasoning: string;
    };

    const match_percentage = Math.round(
      Math.max(0, Math.min(100, result.confidence ?? 0)),
    );
    const verified = match_percentage >= MATCH_THRESHOLD;

    res.json(
      VerifyIdentityResponse.parse({
        match_percentage,
        verified,
        status: verified ? "Verified" : "Mismatch",
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Identity verification failed");
    res.status(500).json({ error: "Identity verification failed." });
  }
});

export default router;
