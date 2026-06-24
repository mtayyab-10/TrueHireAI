# TrueHire AI

**AI-powered reverse-interview platform** that verifies candidate identity, detects suspicious behavior in real time, and delivers integrity-scored evaluations — so hiring teams can trust what they see.

![Homepage](screenshots/homepage.jpeg)

---

## 🎯 What It Does

TrueHire AI flips the traditional interview. Instead of trusting a resume at face value, it **verifies the candidate live** through a multi-stage pipeline:

1. **CV Upload & Parsing** — Extracts skills, projects, experience, and claimed technologies from a PDF resume using Gemini AI
2. **Identity Verification** — Compares a reference photo (ID/LinkedIn) against a live webcam snapshot using Gemini Vision with a real match percentage
3. **Liveness Detection** — Browser-based face detection confirms a live human is present (not a photo or recording)
4. **AI-Driven Interview** — Adaptive questions generated from the candidate's actual CV, not generic templates
5. **Real-Time Integrity Scoring** — Five AI agents work simultaneously to evaluate answers, flag contradictions, and detect cheating signals
6. **Evaluation Report** — Produces a structured verdict: Shortlist / Manual Review / Reject — with scores, risk signals, and a full audit trail

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center"><img src="screenshots/uploading_cv.jpeg" width="400"/><br/><b>CV Upload & Parsing</b></td>
    <td align="center"><img src="screenshots/cv_parser.jpeg" width="400"/><br/><b>Extracted CV Profile</b></td>
  </tr>
  <tr>
    <td align="center"><img src="screenshots/verify_identity.jpeg" width="400"/><br/><b>Identity Verification</b></td>
    <td align="center"><img src="screenshots/liveness_check.jpeg" width="400"/><br/><b>Liveness Detection</b></td>
  </tr>
</table>

---

## 🧠 AI Agent Architecture

TrueHire AI runs a **five-agent pipeline** that operates in real time during every interview:

```
┌─────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                         │
│          Manages rounds, routing, follow-ups            │
├─────────────┬─────────────┬─────────────┬──────────────┤
│  Technical  │  Project    │     HR      │ Authenticity │
│   Agent     │  Deep-Dive  │   Agent     │   Agent      │
│             │   Agent     │             │              │
│ Probes      │ Drills into │ Behavioral  │ Compares     │
│ claimed     │ specific    │ & cultural  │ answers to   │
│ tech skills │ projects    │ fit Qs      │ CV claims    │
├─────────────┴─────────────┴─────────────┴──────────────┤
│                  EVALUATOR AGENT                        │
│  Final scoring: technical, communication, integrity     │
│  Recommendation: Shortlist / Manual Review / Reject     │
└─────────────────────────────────────────────────────────┘
```

- **TechnicalAgent** — Asks implementation-level questions about claimed technologies
- **ProjectDeepDiveAgent** — Probes specific projects for architectural decisions and trade-offs
- **HRAgent** — Behavioral and situational questions tailored to the candidate's background
- **AuthenticityAgent** — Runs after every answer to compare it against the CV and flag contradictions, generic responses, or overclaims
- **EvaluatorAgent** — Produces the final structured report with scores and a hire recommendation

The Authenticity Agent uses a **suspicion score** system. If the score crosses a threshold, the Orchestrator injects follow-up questions to probe deeper — mimicking how a real interviewer would push back on inconsistent answers.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| **Backend** | Node.js, Express 5, TypeScript |
| **AI** | Google Gemini 2.5 Flash (text + vision) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Real-Time** | WebSocket (live agent activity feed) |
| **Face Detection** | face-api.js (browser-side, no server round-trip) |
| **API Design** | Contract-first OpenAPI → auto-generated React Query hooks + Zod validators |
| **Monorepo** | pnpm workspaces |

---

## 📁 Project Structure

```
TrueHireAI/
├── artifacts/
│   ├── api-server/          # Express backend — routes, services, AI agents
│   ├── truehire-frontend/   # React + Vite frontend
│   └── mockup-sandbox/      # Design sandbox
├── lib/
│   ├── api-spec/            # OpenAPI spec (single source of truth)
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle ORM schema & migrations
├── scripts/                 # Utility scripts (sample CV generator)
├── docs/                    # Demo script & documentation
└── screenshots/             # Application screenshots
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 24+
- **pnpm** 9+
- **PostgreSQL** 16+

### Installation

```bash
# Clone the repository
git clone https://github.com/mtayyab-10/TrueHire-AI.git
cd TrueHire-AI

# Install dependencies
pnpm install
```

### Environment Variables

Create a `.env` file in the root (or set these as environment variables):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/truehire
SESSION_SECRET=any-random-string-for-dev
GEMINI_API_KEY=your-gemini-api-key
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for session signing |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key ([Get one here](https://aistudio.google.com/apikey)) |

### Run the App

```bash
# Terminal 1 — Start the API server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Start the frontend
pnpm --filter @workspace/truehire-frontend run dev
```

### Other Commands

```bash
# Full typecheck across all packages
pnpm run typecheck

# Build everything
pnpm run build

# Regenerate API hooks after editing the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push
```

---

## 🔑 Key Features

- **Real Match Percentages** — Identity verification returns an actual confidence score, not a binary pass/fail
- **CV-Driven Questions** — Every interview question is generated from the candidate's own resume
- **Live Agent Activity** — WebSocket-powered real-time feed showing every AI decision as it happens
- **BiometricArc Visualization** — SVG ring around the webcam feed that visually breaks apart as suspicion rises
- **Adaptive Follow-Ups** — High suspicion triggers automatic follow-up questions in the same round
- **Structured Verdicts** — Final reports include technical score, communication score, CV authenticity rating, cheating risk, and a clear recommendation
- **Full Audit Trail** — Every flag, agent decision, and timestamp is logged and reproducible
- **Demo Mode** — Built-in triggers for presentations (second face detected, CV contradiction) that flow through the real pipeline

---

## 👤 Author

**Muhammad Tayyab**  
GitHub: [@mtayyab-10](https://github.com/mtayyab-10)
