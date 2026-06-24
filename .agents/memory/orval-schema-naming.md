---
name: Orval schema naming
description: How Orval names Zod schemas vs TypeScript types — critical for importing the right thing in route handlers.
---

# Orval Schema Naming Convention

## Zod schemas (in lib/api-zod/src/generated/api.ts)
Named after the OPERATION, not the component:
- `HealthCheckResponse` — from operationId `healthCheck`
- `UploadCvResponse` — from operationId `uploadCv`
- `StartInterviewResponse` — from operationId `startInterview`
- `SubmitAnswerBody` — request body for operationId `submitAnswer`
- `SubmitAnswerResponse` — response for `submitAnswer`
- `GetReportResponse` — response for `getReport`

## TypeScript types (in lib/api-zod/src/generated/types/)
Named after the COMPONENT schema:
- `CvProfile`, `CvUploadResult`, `InterviewQuestion`, `AgentResponse`, `EvaluationReport`, etc.
These are TS interfaces/types only — NOT Zod schemas. You cannot call `.parse()` on them.

## Rule for route handlers
Import Zod schemas (e.g. `UploadCvResponse`, `StartInterviewResponse`) for `.parse()` calls in routes.
Import TS types (e.g. `CvProfile`) only for type annotations, never for runtime validation.

**Why**: Confusing component names with operation names causes "is not a function" runtime errors on `.parse()` since the component-named exports are plain TS types, not Zod objects.
