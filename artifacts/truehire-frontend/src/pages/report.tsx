/**
 * Report page — full evaluation dashboard for a completed interview session.
 *
 * Data sources:
 *   API   : GET /api/interview/:sessionId/report
 *   Storage: sessionStorage keys written by verify.tsx and interview.tsx
 *             truehire_cv       — CvProfile JSON
 *             truehire_identity — { match_percentage, verified, status }
 *             truehire_liveness — "true" | undefined
 *             truehire_log      — LogEntry[] JSON
 */

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileText,
  User,
  ScanFace,
  Cpu,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Types ─────────────────────────────────────────────── */

interface Report {
  technical_score: number;
  communication_score: number;
  cv_authenticity: "High" | "Medium" | "Low";
  cheating_risk: "Low" | "Medium" | "High";
  recommendation: "Shortlist" | "Manual review required" | "Reject";
  justification: string;
}

interface LogEntry {
  id: number;
  ts: number;
  agent: string;
  message: string;
  type: "info" | "warning" | "success";
}

interface CvProfile {
  skills: string[];
  projects: string[];
  education: string[];
  experience: string[];
  claimed_technologies: string[];
}

interface IdentityResult {
  match_percentage: number;
  verified: boolean;
  status: string;
}

/* ─── Sub-components ─────────────────────────────────────── */

function ScoreGauge({
  score,
  label,
  color,
}: {
  score: number;
  label: string;
  color: string;
}) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const arc = (Math.min(100, Math.max(0, score)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle
            cx={44}
            cy={44}
            r={r}
            stroke="hsl(var(--border))"
            strokeWidth={6}
            fill="none"
          />
          <circle
            cx={44}
            cy={44}
            r={r}
            stroke={color}
            strokeWidth={6}
            fill="none"
            strokeDasharray={`${arc} ${circ - arc}`}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color}80)`,
              transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-2xl leading-none text-foreground">
            {score}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-xs font-medium text-foreground/80 text-center">{label}</p>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-muted/30 ${className ?? ""}`} />
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function RiskPill({ level }: { level: "Low" | "Medium" | "High" }) {
  if (level === "Low") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border border-jade/25 bg-jade/8 text-jade/90">
        <span className="w-1.5 h-1.5 rounded-full bg-jade" />
        Low
      </span>
    );
  }
  if (level === "Medium") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/8 text-amber-400">
        <AlertTriangle className="w-3 h-3" />
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border border-destructive/35 bg-destructive/8 text-destructive/90">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
      </span>
      High — review flagged events
    </span>
  );
}

function AuthPill({ level }: { level: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "border-jade/25 bg-jade/8 text-jade/90",
    Medium: "border-amber-400/30 bg-amber-400/8 text-amber-400",
    Low: "border-destructive/35 bg-destructive/8 text-destructive/90",
  };
  return (
    <span
      className={`inline-flex items-center font-mono text-xs px-2.5 py-1 rounded-full border ${styles[level]}`}
    >
      {level}
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export default function ReportPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [, navigate] = useLocation();

  const [report, setReport] = useState<Report | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [cvProfile, setCvProfile] = useState<CvProfile | null>(null);
  const [identity, setIdentity] = useState<IdentityResult | null>(null);
  const [livenessOk, setLivenessOk] = useState<boolean | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);

  useEffect(() => {
    // Read stored context from sessionStorage
    try {
      const cv = sessionStorage.getItem("truehire_cv");
      if (cv) setCvProfile(JSON.parse(cv) as CvProfile);

      const id = sessionStorage.getItem("truehire_identity");
      if (id) setIdentity(JSON.parse(id) as IdentityResult);

      const lv = sessionStorage.getItem("truehire_liveness");
      if (lv === "true") setLivenessOk(true);

      const lg = sessionStorage.getItem("truehire_log");
      if (lg) setLog(JSON.parse(lg) as LogEntry[]);
    } catch { /* ignore parse errors */ }

    // Fetch report from API
    fetch(`/api/interview/${sessionId}/report`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setFetchError(
            (data as { error?: string }).error ??
              "Failed to load the report. The session may have expired.",
          );
          return;
        }
        setReport(data as Report);
      })
      .catch(() =>
        setFetchError("Couldn't reach the server. Check your connection and try again."),
      )
      .finally(() => setFetching(false));
  }, [sessionId]);

  function startNewInterview() {
    sessionStorage.removeItem("truehire_cv");
    sessionStorage.removeItem("truehire_identity");
    sessionStorage.removeItem("truehire_liveness");
    sessionStorage.removeItem("truehire_log");
    navigate("/");
  }

  const recStyle = report
    ? report.recommendation === "Shortlist"
      ? {
          bg: "from-jade/10 to-transparent",
          border: "border-jade/25",
          badge: "bg-jade/12 border-jade/30 text-jade",
          icon: <CheckCircle className="w-6 h-6 text-jade" />,
        }
      : report.recommendation === "Reject"
      ? {
          bg: "from-destructive/8 to-transparent",
          border: "border-destructive/20",
          badge: "bg-destructive/10 border-destructive/25 text-destructive/90",
          icon: <XCircle className="w-6 h-6 text-destructive/80" />,
        }
      : {
          bg: "from-amber-400/8 to-transparent",
          border: "border-amber-400/20",
          badge: "bg-amber-400/10 border-amber-400/25 text-amber-400",
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
        }
    : null;

  const visibleLog = logExpanded ? log : log.slice(-8);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 h-12 border-b border-border/50 px-6 flex items-center justify-between bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
          </div>
          <span className="font-display font-semibold text-sm text-foreground/80">
            TrueHire AI
          </span>
          <span className="hidden sm:block text-muted-foreground/30 text-xs">·</span>
          <span className="hidden sm:block font-mono text-[10px] text-muted-foreground/50">
            Evaluation Report
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={startNewInterview}
        >
          <RotateCcw className="w-3 h-3" />
          Start new interview
        </Button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 relative z-10">
        <AnimatePresence mode="wait">
          {/* Loading state */}
          {fetching && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ReportSkeleton />
            </motion.div>
          )}

          {/* Error state */}
          {!fetching && fetchError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-20 text-center"
            >
              <XCircle className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground max-w-sm">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={startNewInterview}>
                Return to start
              </Button>
            </motion.div>
          )}

          {/* Report */}
          {!fetching && report && recStyle && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              {/* ── Recommendation headline ── */}
              <div
                className={`rounded-2xl border bg-gradient-to-b ${recStyle.bg} ${recStyle.border} p-6 space-y-3`}
              >
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-display font-semibold ${recStyle.badge}`}>
                  {recStyle.icon}
                  {report.recommendation}
                </div>
                <p className="font-display font-semibold text-3xl sm:text-4xl text-foreground leading-tight">
                  {report.recommendation === "Shortlist"
                    ? "This candidate clears the bar."
                    : report.recommendation === "Reject"
                    ? "This candidate didn't meet the standard."
                    : "This candidate warrants closer review."}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {report.justification}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                    Session
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {sessionId}
                  </span>
                </div>
              </div>

              {/* ── Three columns: Scores | Verification | Risk ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Scores */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-primary/60" />
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Performance
                    </p>
                  </div>
                  <div className="flex items-center justify-around gap-2">
                    <ScoreGauge
                      score={report.technical_score}
                      label="Technical"
                      color="#4F6AF7"
                    />
                    <ScoreGauge
                      score={report.communication_score}
                      label="Communication"
                      color="#10D9A5"
                    />
                  </div>
                </div>

                {/* Verification checklist */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-primary/60" />
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Verification
                    </p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-jade/12 border border-jade/25 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-2.5 h-2.5 text-jade" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">CV parsed</p>
                        {cvProfile && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {cvProfile.skills.slice(0, 3).join(", ")}
                            {cvProfile.skills.length > 3 && ` +${cvProfile.skills.length - 3} more`}
                          </p>
                        )}
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          identity?.verified
                            ? "bg-jade/12 border-jade/25"
                            : identity
                            ? "bg-muted/30 border-border/50"
                            : "bg-muted/20 border-border/40"
                        }`}
                      >
                        <User
                          className={`w-2.5 h-2.5 ${identity?.verified ? "text-jade" : "text-muted-foreground/50"}`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">Identity</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {identity
                            ? `${identity.status} · ${identity.match_percentage}% match`
                            : "Not recorded"}
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          livenessOk === true
                            ? "bg-jade/12 border-jade/25"
                            : "bg-muted/20 border-border/40"
                        }`}
                      >
                        <ScanFace
                          className={`w-2.5 h-2.5 ${livenessOk ? "text-jade" : "text-muted-foreground/50"}`}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">Liveness</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {livenessOk === true
                            ? "Passed — confirmed live presence"
                            : "Not recorded"}
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Risk assessment */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-primary/60" />
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Integrity signals
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-foreground">CV Authenticity</p>
                      <AuthPill level={report.cv_authenticity} />
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        {report.cv_authenticity === "High"
                          ? "Answers aligned well with stated experience."
                          : report.cv_authenticity === "Medium"
                          ? "Some answers were vague relative to claimed experience."
                          : "Significant gaps between CV claims and interview responses."}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-foreground">Cheating Risk</p>
                      <RiskPill level={report.cheating_risk} />
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        {report.cheating_risk === "Low"
                          ? "No meaningful signals of external assistance."
                          : report.cheating_risk === "Medium"
                          ? "Minor flags detected — review the event log."
                          : "Multiple flags raised — manual review strongly recommended."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CV Skills (if available) ── */}
              {cvProfile && cvProfile.skills.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Skills on CV
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...cvProfile.skills, ...cvProfile.claimed_technologies]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono border border-primary/15 bg-primary/6 text-primary/75"
                        >
                          {s}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* ── Interview log ── */}
              {log.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors"
                    onClick={() => setLogExpanded((v) => !v)}
                    aria-expanded={logExpanded}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-primary/60" />
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Interview event log
                      </p>
                      <span className="font-mono text-[9px] text-muted-foreground/40">
                        {log.length} event{log.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {logExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                    )}
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      logExpanded ? "max-h-[600px]" : "max-h-52"
                    } overflow-y-auto`}
                  >
                    <div className="px-3 pb-3 space-y-1 font-mono text-[11px]">
                      {visibleLog.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-lg px-2.5 py-2 border ${
                            entry.type === "warning"
                              ? "bg-amber-400/6 border-amber-400/15 text-amber-300"
                              : entry.type === "success"
                              ? "bg-jade/6 border-jade/15 text-jade/80"
                              : "bg-card/60 border-border/30 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              entry.type === "warning"
                                ? "text-amber-400/80"
                                : entry.type === "success"
                                ? "text-jade/70"
                                : "text-muted-foreground/60"
                            }`}>
                              {entry.agent}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40 shrink-0">
                              {formatTime(entry.ts)}
                            </span>
                          </div>
                          <p className="leading-snug">{entry.message}</p>
                        </div>
                      ))}
                      {!logExpanded && log.length > 8 && (
                        <button
                          className="w-full text-center text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground py-1.5 transition-colors"
                          onClick={() => setLogExpanded(true)}
                        >
                          Show all {log.length} events
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="flex justify-center pt-2 pb-8">
                <Button
                  onClick={startNewInterview}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start a new interview
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
