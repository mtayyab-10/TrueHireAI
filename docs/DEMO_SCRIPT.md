# TrueHire AI — Live Demo Script

**Duration:** 3–5 minutes  
**Audience:** Hiring managers, engineering leads, investors  
**Prerequisite:** `VITE_DEMO_MODE=true` set in `.env.development.local`

---

## Before you start

Open two windows side-by-side if possible:
- **Left:** the TrueHire AI app (`/`)
- **Right:** the API server logs (or the Agent Activity panel on the interview screen)

Have a sample PDF CV ready (one with a headshot photo or a LinkedIn profile photo handy as a separate image).

---

## Step 1 — Landing (10 seconds)

> *"This is TrueHire AI. The premise is simple: it's not enough to look good on paper — candidates need to prove it live, in real time."*

Point to the three feature cards:
- Identity verification
- Liveness detection
- Integrity-scored interview

Click **"Begin verification"** to start.

---

## Step 2 — Upload CV (45 seconds)

> *"First, the candidate uploads their CV as a PDF. The system doesn't just store it — it extracts their actual skills, experience and claimed technologies and uses those to drive every question in the interview."*

1. Drag in (or browse to) your sample PDF.
2. Click **"Parse & continue"**.
3. While the scan animation runs: *"You can see it reading the document in real time."*
4. On the CV Review screen, point to the extracted skills and experience chips. *"These are what the AI knows about the candidate before the first question is asked."*
5. Click **"Continue to identity check"**.

---

## Step 3 — Identity Verification (45 seconds)

> *"Next, identity. The candidate uploads any reference photo — LinkedIn headshot, ID photo, CV picture — and then takes a live snapshot via webcam. GPT-4o Vision compares the two."*

1. Upload a reference headshot image.
2. Click **"Capture snapshot"** to take a live webcam frame.
3. Click **"Verify identity"**.
4. Point to the match percentage result. *"A real match score. Not 'identity verified' as a checkbox — an actual percentage comparison with a confidence threshold."*
5. Click **"Continue to liveness check"**.

---

## Step 4 — Liveness Check (30 seconds)

> *"Liveness detection runs entirely in the browser — no server round-trip. It uses face detection to confirm there's a live human present, not a photo held up to the camera or a pre-recorded video."*

Follow the on-screen instruction (e.g., blink or turn head).

> *"Passed. The system is confident this is a live presence."*

The page transitions automatically to the interview.

---

## Step 5 — Interview begins (60 seconds)

> *"Now the interview. Three things are happening simultaneously: the AI interviewer is asking questions drawn from the candidate's actual CV, the biometric arc around the webcam feed is monitoring for integrity signals, and the Agent Activity log on the right is showing you every decision the AI agents are making in real time."*

1. Point to the **BiometricArc** (indigo ring around webcam). *"Complete ring = no flags. It breaks apart and changes colour as suspicion rises."*
2. Point to the **Agent Activity** panel. *"Each event is attributed to a specific agent — HR, Technical, Authenticity, or the overall Evaluator."*
3. Type a genuine answer to the first question and submit it.

---

## Step 6 — Wow moment 1: Second face detected (20 seconds)

> *"Let me show you what happens when something's wrong."*

Click **"Trigger: second face detected"** in the Demo Mode panel.

Watch the Agent Activity panel:
> *"The biometric arc immediately breaks — you can see it shift from the complete indigo ring. The flag is logged with a timestamp and attributed. The suspicion score rises. This is a real event flowing through the same pipeline that live detection uses."*

---

## Step 7 — Wow moment 2: CV contradiction (30 seconds)

> *"Now let's trigger the other scenario — someone overclaiming experience that isn't on their CV."*

Click **"Trigger: CV contradiction"** in the Demo Mode panel.

Watch the Authenticity Agent log entry appear:
> *"The system submitted an answer that contradicts the uploaded CV. The AuthenticityAgent flagged it — you can see the suspicion score jump and the log entry call it out specifically. This is the real pipeline: the answer went to the AI agent, which compared it against the extracted CV profile and raised the flag."*

---

## Step 8 — End the interview and view the report (45 seconds)

Submit one or two more answers until the interview completes (or end it manually).

Click **"View evaluation report"**.

Walk through the report:
1. **Recommendation headline** (Shortlist / Manual review / Reject) — *"This is the first thing a hiring manager sees. Not a table of numbers — a decision."*
2. **Score gauges** — *"Technical and communication scores, each out of 100, scored by the AI across every answer."*
3. **Integrity signals** — CV Authenticity + Cheating Risk. *"Low is calm green. High is attention-getting — a pulsing indicator — because you need to actually look at it."*
4. **Verification checklist** — CV parsed, identity confirmed, liveness passed.
5. **Interview event log** — *"Full audit trail. Every flag, every agent decision, every timestamp. Fully reproducible."*

Click **"Start a new interview"** to reset.

---

## Commands to run from a clean checkout

```bash
# 1. Install dependencies
pnpm install

# 2. Start the API server (in one terminal)
pnpm --filter @workspace/api-server run dev

# 3. Start the frontend (in another terminal)
pnpm --filter @workspace/truehire-frontend run dev

# 4. Enable Demo Mode for presentations
echo "VITE_DEMO_MODE=true" >> artifacts/truehire-frontend/.env.development.local
```

Required secrets (set in Replit Secrets or your `.env`):
- `OPENAI_API_KEY` — required for identity verification (GPT-4o Vision) and AI interview agents
- `SESSION_SECRET` — required for session signing (any random string works in dev)

---

## What's fully working

- CV upload, PDF parsing, and skill extraction (OpenAI GPT-4o)
- Identity verification with face comparison (GPT-4o Vision, real match %)
- Liveness detection (face-api.js, browser-only, no server round-trip)
- AI-driven interview with adaptive questions from CV content
- Five-agent pipeline: HR Agent → Technical Agent → Project Deep-Dive Agent → Authenticity Agent → Evaluator Agent
- Real-time WebSocket agent activity log (attributed, timestamped)
- BiometricArc suspicion visualisation (SVG, updates live)
- Full evaluation report: recommendation, justification, scores, risk signals, audit log
- Demo Mode triggers feeding real pipeline events
- sessionStorage handoff between verify → interview → report

## What's stubbed / simplified

- **Gaze tracking:** FaceMonitor detects faces and frame-exit events; gaze direction (left/right eye tracking) is not implemented — would require a more complete face-api.js integration
- **Multiple-face detection threshold:** the face monitor uses a simple count-based trigger; production would add temporal smoothing to avoid single-frame false positives
- **Database persistence:** sessions live in-memory on the API server; a fresh server restart clears all sessions. The DB schema is ready (`lib/db`) but not yet wired
- **Auth / candidate portal:** no login system; session IDs are shared via URL; a real deployment would scope sessions to authenticated users
- **Report PDF export:** the report renders on screen only; a downloadable PDF export is not implemented
