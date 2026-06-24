---
name: AI agent architecture
description: TrueHire AI five-agent interview system — key decisions and gotchas for future work.
---

# TrueHire AI Agent Architecture

## Agent roles (in artifacts/api-server/src/services/)
- `prompts.ts` — all system prompts in one file, easy to tune
- `agents.ts` — five agent functions: runTechnicalAgent, runProjectAgent, runHRAgent, runAuthenticityAgent, runEvaluatorAgent
- `orchestrator.ts` — manages round progression, suspicion scoring, follow-up logic
- Model used: `gpt-4o-mini` with `response_format: { type: "json_object" }` for all agents

## Interview round schedule
ROUND_AGENTS = [Technical, Technical, ProjectDeepDive, ProjectDeepDive, HR, HR]
After 6 rounds, status → "complete" and next_question is null.
AuthenticityAgent runs silently on every answer.
If suspicion_delta ≥ 15 on a round, a follow-up is stored in `pending_follow_up` column and served next before advancing.

## WebSocket
Attached to HTTP server (not Express directly) via ws.WebSocketServer with noServer:true.
sessionSockets Map lives in src/lib/ws.ts and is imported by orchestrator.
Path: /ws/interview/:sessionId

## pdf-parse gotcha
pdf-parse has no @types package. Must add `src/types/pdf-parse.d.ts` with `declare module "pdf-parse" { export default function(...): Promise<{text:string,...}>; }`.
Dynamic import used: `(await import("pdf-parse")).default` to avoid startup-time issues with the module's test-file checks.

## OpenAPI / multipart gotcha
`format: binary` in a multipart schema generates `zod.instanceof(File)` which fails TS compilation in Node.js (no global File/Blob).
**Fix**: Remove the requestBody entirely from POST /cv/upload in the OpenAPI spec. Document the multipart contract in the description field instead.

## Why: these are the non-obvious decisions that caused real errors during implementation.
