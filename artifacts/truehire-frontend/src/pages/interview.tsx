/**
 * Interview page — live AI interview with real-time webcam monitoring.
 *
 * Layout:
 *   Left panel  (260px) — Biometric feed + BiometricArc + integrity meter
 *   Centre      (flex-1) — Conversation transcript + answer input
 *   Right panel (268px) — Live agent activity log (monitoring console)
 *
 * On completion: stores event log to sessionStorage and navigates to /report/:sessionId.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  FileText,
  CheckCircle,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import WebcamCapture, { type WebcamCaptureHandle } from "@/components/WebcamCapture";
import FaceMonitor, { type MonitorEvent } from "@/components/FaceMonitor";
import DemoPanel from "@/components/DemoPanel";
import BiometricArc from "@/components/BiometricArc";

interface Question {
  agent_name: string;
  question: string;
}

interface AnswerResponse {
  agent_name: string;
  message: string;
  next_question: string | null;
  suspicion_delta: number;
}

interface LogEntry {
  id: number;
  ts: number;
  agent: string;
  message: string;
  type: "info" | "warning" | "success";
}

interface TranscriptEntry {
  id: number;
  agent: string;
  question: string;
  answer: string | null;
}

type SuspicionBand = "Low" | "Medium" | "High";

function getBand(score: number): SuspicionBand {
  if (score <= 33) return "Low";
  if (score <= 66) return "Medium";
  return "High";
}

let _id = 0;
function nextId() { return ++_id; }

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export default function InterviewPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<"starting" | "active" | "complete">("starting");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [suspicionScore, setSuspicionScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const webcamRef = useRef<WebcamCaptureHandle>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const appendLog = useCallback(
    (agent: string, message: string, type: LogEntry["type"] = "info") => {
      setLog((prev) => [
        ...prev,
        { id: nextId(), ts: Date.now(), agent, message, type },
      ]);
    },
    [],
  );

  const adjustSuspicion = useCallback((delta: number) => {
    setSuspicionScore((prev) => Math.max(0, Math.min(100, prev + delta)));
  }, []);

  const handleMonitorEvent = useCallback(
    (evt: MonitorEvent) => {
      const type: LogEntry["type"] = evt.suspicion_delta > 10 ? "warning" : "info";
      appendLog(evt.agent, evt.message, type);
      adjustSuspicion(evt.suspicion_delta);
    },
    [appendLog, adjustSuspicion],
  );

  const pushQuestion = useCallback((agent_name: string, question: string) => {
    setTranscript((prev) => [
      ...prev,
      { id: nextId(), agent: agent_name, question, answer: null },
    ]);
  }, []);

  const fillAnswer = useCallback((ans: string) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.answer !== null) return prev;
      return [...prev.slice(0, -1), { ...last, answer: ans }];
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    fetch(`/api/interview/${sessionId}/start`, { method: "POST" })
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 409) {
          setPhase("active");
          appendLog("Orchestrator", "Resuming existing session.", "info");
          return;
        }
        if (!r.ok) {
          setError(
            (data as { error?: string }).error ??
              "Failed to start the interview. Please refresh and try again.",
          );
          return;
        }
        const q = data as Question;
        pushQuestion(q.agent_name, q.question);
        setPhase("active");
        appendLog(q.agent_name, "Interview started. First question delivered.", "info");
      })
      .catch(() =>
        setError("Failed to start the interview. The session may have expired."),
      );

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${proto}//${window.location.host}/ws/interview/${sessionId}`,
    );
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as {
          type: string;
          agent: string;
          message: string;
        };
        const isFlag =
          data.message.includes("Flags raised") ||
          data.message.includes("Multiple faces") ||
          data.message.includes("off-screen gaze") ||
          data.message.includes("contradiction");
        appendLog(data.agent, data.message, isFlag ? "warning" : "info");
      } catch { /* ignore malformed frames */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, appendLog, pushQuestion]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  async function submitAnswer() {
    if (!answer.trim() || !sessionId || submitting) return;
    const submitted = answer.trim();
    fillAnswer(submitted);
    setAnswer("");
    setSubmitting(true);
    setThinking(true);
    setError(null);

    try {
      const resp = await fetch(`/api/interview/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: submitted }),
      });
      const data = (await resp.json()) as AnswerResponse;
      adjustSuspicion(data.suspicion_delta);

      if (data.next_question) {
        pushQuestion(data.agent_name, data.next_question);
        appendLog(data.agent_name, data.message, "info");
        setTimeout(() => textareaRef.current?.focus(), 100);
      } else {
        setPhase("complete");
        appendLog("Orchestrator", "All rounds complete — interview finished.", "success");
      }
    } catch {
      setError("Your answer couldn't be submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
      setThinking(false);
    }
  }

  function goToReport() {
    // Persist the event log so the report page can display it
    try {
      sessionStorage.setItem("truehire_log", JSON.stringify(log));
    } catch { /* storage full — non-fatal */ }
    navigate(`/report/${sessionId}`);
  }

  function handleCannedAnswerResponse(data: AnswerResponse) {
    adjustSuspicion(data.suspicion_delta);
    if (data.next_question) {
      pushQuestion(data.agent_name, data.next_question);
    } else {
      setPhase("complete");
    }
  }

  const band = getBand(suspicionScore);

  const bandStyles = {
    Low: { text: "text-primary", bg: "bg-primary/8", border: "border-primary/25", icon: ShieldCheck },
    Medium: { text: "text-amber-400", bg: "bg-amber-400/8", border: "border-amber-400/25", icon: AlertTriangle },
    High: { text: "text-destructive", bg: "bg-destructive/8", border: "border-destructive/25", icon: ShieldAlert },
  };

  const bs = bandStyles[band];
  const BandIcon = bs.icon;
  const isWaitingForAnswer =
    transcript[transcript.length - 1]?.answer === null && phase === "active";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="h-12 border-b border-border/50 px-5 flex items-center justify-between shrink-0 bg-card/40 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
          </div>
          <span className="font-display font-semibold text-sm text-foreground/80">
            TrueHire AI
          </span>
          {sessionId && (
            <span className="hidden sm:block font-mono text-[10px] text-muted-foreground/50 border border-border/40 rounded px-1.5 py-0.5">
              {sessionId.slice(0, 8)}…
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${bs.bg} ${bs.border}`}
          role="status"
          aria-label={`Suspicion level: ${band}, score ${suspicionScore} out of 100`}
        >
          <BandIcon className={`w-3.5 h-3.5 ${bs.text}`} aria-hidden />
          <span className={`font-mono text-xs font-semibold ${bs.text}`}>{band}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {suspicionScore.toFixed(0)}/100
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Biometric panel ── */}
        <aside
          className="w-[260px] shrink-0 border-r border-border/50 flex flex-col bg-card/20"
          aria-label="Biometric monitoring panel"
        >
          <div className="p-3 border-b border-border/40">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Biometric Feed
            </p>
          </div>
          <div className="p-3 space-y-3">
            {/* Webcam + arc */}
            <div className="relative aspect-[4/3] rounded-xl overflow-visible bg-black rounded-xl">
              <div className="absolute inset-0 rounded-xl overflow-hidden">
                <WebcamCapture
                  ref={webcamRef}
                  className="w-full h-full"
                  showOverlay
                  overlayLabel="● REC"
                />
              </div>
              <div className="absolute -inset-[10px] pointer-events-none">
                <BiometricArc score={suspicionScore} />
              </div>
            </div>

            {/* Integrity meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Integrity
                </span>
                <span className={`font-mono text-xs font-semibold ${bs.text}`}>
                  {(100 - suspicionScore).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-card border border-border/40 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    band === "Low"
                      ? "bg-primary"
                      : band === "Medium"
                      ? "bg-amber-400"
                      : "bg-destructive"
                  }`}
                  animate={{ width: `${100 - suspicionScore}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <p className={`text-[10px] font-mono ${bs.text}`}>
                {band === "Low"
                  ? "No flags raised"
                  : band === "Medium"
                  ? "Minor flags detected"
                  : "Significant flags — review required"}
              </p>
            </div>

            <FaceMonitor
              videoRef={
                webcamRef as React.RefObject<{
                  videoElement: HTMLVideoElement | null;
                } | null>
              }
              onEvent={handleMonitorEvent}
              enabled={phase === "active"}
            />
          </div>
        </aside>

        {/* ── Centre: Conversation ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {phase === "starting" && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
                <p className="text-sm">Connecting to your interviewer…</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive/90" role="alert">
                {error}
              </div>
            )}

            <AnimatePresence>
              {transcript.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-3"
                >
                  {/* Question */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
                        <span className="w-2 h-2 rounded-full bg-primary/70" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary/70">
                        {entry.agent}
                      </span>
                    </div>
                    <div className="ml-7 rounded-xl rounded-tl-sm bg-card/60 border border-border/40 px-4 py-3">
                      <p className="text-sm leading-relaxed text-foreground">
                        {entry.question}
                      </p>
                    </div>
                  </div>

                  {/* Answer */}
                  {entry.answer !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.1 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          You
                        </span>
                        <div className="w-5 h-5 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        </div>
                      </div>
                      <div className="mr-7 rounded-xl rounded-tr-sm bg-primary/8 border border-primary/15 px-4 py-3">
                        <p className="text-sm leading-relaxed text-foreground/90">
                          {entry.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Thinking indicator */}
                  {idx === transcript.length - 1 && thinking && entry.answer !== null && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 ml-7"
                      aria-label="AI is thinking"
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/12 border border-primary/25 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-primary/70" />
                      </div>
                      <div className="flex gap-1 px-3 py-2 rounded-lg bg-card/60 border border-border/40">
                        {[0, 0.2, 0.4].map((delay) => (
                          <motion.span
                            key={delay}
                            className="w-1.5 h-1.5 rounded-full bg-primary/60"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Interview complete */}
            {phase === "complete" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-10"
              >
                <div className="w-14 h-14 rounded-full bg-jade/10 border border-jade/30 flex items-center justify-center shadow-[0_0_28px_-4px_rgba(16,217,165,0.35)]">
                  <CheckCircle className="w-7 h-7 text-jade" />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="font-display font-semibold text-xl text-jade">
                    Interview complete
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    All rounds finished. Your evaluation report is ready.
                  </p>
                </div>
                <Button onClick={goToReport} size="lg">
                  <FileText className="w-4 h-4 mr-2" />
                  View evaluation report
                </Button>
              </motion.div>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* Answer input */}
          {isWaitingForAnswer && (
            <div className="border-t border-border/50 p-4 space-y-3 bg-card/20 shrink-0">
              <Textarea
                ref={textareaRef}
                placeholder="Type your answer… (⌘ Enter to submit)"
                className="min-h-[100px] resize-none text-sm bg-card/50 border-border/60 focus:border-primary/50 transition-colors"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submitAnswer();
                }}
                disabled={submitting}
                aria-label="Your interview answer"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">⌘ Enter to submit</p>
                <Button
                  onClick={() => void submitAnswer()}
                  disabled={!answer.trim() || submitting}
                  size="sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Evaluating…
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Submit answer
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Demo panel */}
          {sessionId && (
            <div className="border-t border-border/40 px-4 py-3 shrink-0">
              <DemoPanel
                sessionId={sessionId}
                onEvent={handleMonitorEvent}
                onCannedAnswerResponse={handleCannedAnswerResponse}
              />
            </div>
          )}
        </main>

        {/* ── Right: Agent Activity Log ── */}
        <aside
          className="w-[268px] shrink-0 border-l border-border/50 flex flex-col bg-card/20"
          aria-label="Agent activity log"
        >
          <div className="h-10 border-b border-border/40 px-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary/60" aria-hidden />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Agent Activity
            </p>
            {log.length > 0 && (
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/40">
                {log.length} event{log.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px]">
            {log.length === 0 && (
              <div className="px-2 py-4 text-center text-muted-foreground/40 text-xs">
                Waiting for events…
              </div>
            )}
            {log.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg px-2.5 py-2 border ${
                  entry.type === "warning"
                    ? "bg-amber-400/6 border-amber-400/18 text-amber-300"
                    : entry.type === "success"
                    ? "bg-jade/6 border-jade/18 text-jade/80"
                    : "bg-card/60 border-border/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider truncate ${
                      entry.type === "warning"
                        ? "text-amber-400/80"
                        : entry.type === "success"
                        ? "text-jade/70"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    {entry.agent}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40 shrink-0">
                    {formatTime(entry.ts)}
                  </span>
                </div>
                <p className="leading-snug">{entry.message}</p>
              </motion.div>
            ))}
            <div ref={logEndRef} />
          </div>
        </aside>
      </div>
    </div>
  );
}
