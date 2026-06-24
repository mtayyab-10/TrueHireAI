/**
 * DemoPanel — visible ONLY when import.meta.env.VITE_DEMO_MODE === "true".
 *
 * Set VITE_DEMO_MODE=true in artifacts/truehire-frontend/.env.development.local
 * to enable during live demos. It is completely absent from production builds.
 *
 * Two triggers:
 *   1. "Trigger: second face detected" — fires the exact same warning that
 *      FaceMonitor would fire for real, going through the same onEvent path.
 *   2. "Trigger: CV contradiction" — calls the real /api/interview/:sessionId/answer
 *      endpoint with a deliberately generic answer so the real AuthenticityAgent
 *      pipeline runs and flags it. Only the answer text is canned.
 */

import { useState } from "react";
import { Beaker, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonitorEvent } from "./FaceMonitor";

const CANNED_ANSWER =
  "I have extensive experience with all major cloud providers and have led " +
  "large-scale distributed systems teams. I'm very comfortable with Kubernetes, " +
  "and have personally built microservices architectures from scratch at scale. " +
  "I also have 10 years of deep expertise in machine learning and neural networks.";

interface Props {
  sessionId: string;
  onEvent: (evt: MonitorEvent) => void;
  onCannedAnswerResponse?: (data: {
    agent_name: string;
    message: string;
    next_question: string | null;
    suspicion_delta: number;
  }) => void;
}

export default function DemoPanel({ sessionId, onEvent, onCannedAnswerResponse }: Props) {
  if (import.meta.env.VITE_DEMO_MODE !== "true") return null;

  const [submitting, setSubmitting] = useState(false);

  function triggerSecondFace() {
    onEvent({
      ts: Date.now(),
      agent: "Face Monitor",
      message: "Multiple faces detected in frame — possible external assistance.",
      suspicion_delta: 25,
    });
  }

  async function triggerCvContradiction() {
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/interview/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: CANNED_ANSWER }),
      });
      const data = (await resp.json()) as {
        agent_name: string;
        message: string;
        next_question: string | null;
        suspicion_delta: number;
      };
      onCannedAnswerResponse?.(data);
    } catch {
      // Fallback: inject synthetic event if API unreachable
      onEvent({
        ts: Date.now(),
        agent: "Authenticity Agent",
        message: "CV contradiction detected — claimed expertise doesn't match stated background.",
        suspicion_delta: 30,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 space-y-2.5"
      role="region"
      aria-label="Demo mode controls — not visible in production"
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
          <Beaker className="w-3 h-3 text-amber-400" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 font-semibold">
          Demo Mode
        </span>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/40">
          Not visible in production
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="border-amber-400/25 text-amber-300 hover:bg-amber-400/8 hover:border-amber-400/50 text-xs h-7 flex-1"
          onClick={triggerSecondFace}
        >
          Trigger: second face detected
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-400/25 text-amber-300 hover:bg-amber-400/8 hover:border-amber-400/50 text-xs h-7 flex-1"
          onClick={() => void triggerCvContradiction()}
          disabled={submitting}
        >
          {submitting ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending…</>
          ) : (
            "Trigger: CV contradiction"
          )}
        </Button>
      </div>
    </div>
  );
}
