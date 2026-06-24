/**
 * Verify page — three-step wizard:
 *   Step 1: Upload CV PDF → POST /api/cv/upload → session_id + profile
 *   Step 1b: CV review — show extracted profile before proceeding
 *   Step 2: Identity verification → POST /api/identity/verify
 *   Step 3: Liveness challenge (face-api.js, browser-only)
 *   → on success: navigate to /interview/:sessionId
 *
 * Persists results to sessionStorage so the report page can display them:
 *   truehire_cv       — CvProfile
 *   truehire_identity — IdentityResult
 *   truehire_liveness — "true"
 */

import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Camera,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ArrowRight,
  FileText,
  Briefcase,
  GraduationCap,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WebcamCapture, {
  type WebcamCaptureHandle,
} from "@/components/WebcamCapture";
import LivenessChallenge from "@/components/LivenessChallenge";

type Step = "cv" | "cv-review" | "identity" | "liveness" | "done";

const STEP_LABELS = ["Upload CV", "Verify Identity", "Liveness Check"];
const STEP_INDEX: Record<Step, number> = {
  cv: 0,
  "cv-review": 0,
  identity: 1,
  liveness: 2,
  done: 2,
};

interface CvProfile {
  skills: string[];
  projects: string[];
  education: string[];
  experience: string[];
  claimed_technologies: string[];
}

const CV_SCAN_LABELS = [
  "Reading your experience…",
  "Extracting skills…",
  "Identifying projects…",
  "Mapping your background…",
];

function CvScanAnimation({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative w-16 h-20 rounded border-2 border-primary/40 bg-card overflow-hidden">
        <div
          className="absolute inset-x-0 h-0.5 bg-primary/80 animate-scan-line"
          style={{ boxShadow: "0 0 8px 2px hsl(var(--primary)/0.5)" }}
        />
        <div className="absolute inset-x-3 top-3 space-y-1.5">
          {[1, 0.6, 0.8, 0.5, 0.7].map((w, i) => (
            <div
              key={i}
              className="h-1 rounded-full bg-primary/20"
              style={{ width: `${w * 100}%` }}
            />
          ))}
        </div>
        <FileText className="absolute bottom-2 right-2 w-3 h-3 text-primary/30" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">This takes a few seconds</p>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono border border-primary/20 bg-primary/8 text-primary/80">
      {label}
    </span>
  );
}

function CvSummary({
  profile,
  onContinue,
}: {
  profile: CvProfile;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/50 divide-y divide-border/40 overflow-hidden">
        {profile.experience.length > 0 && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5" /> Experience
            </div>
            <ul className="space-y-1">
              {profile.experience.slice(0, 4).map((e, i) => (
                <li key={i} className="text-sm text-foreground/90 flex gap-2">
                  <span className="text-primary/40 mt-[3px]">›</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {profile.education.length > 0 && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="w-3.5 h-3.5" /> Education
            </div>
            <ul className="space-y-1">
              {profile.education.map((e, i) => (
                <li key={i} className="text-sm text-foreground/90 flex gap-2">
                  <span className="text-primary/40 mt-[3px]">›</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(profile.skills.length > 0 || profile.claimed_technologies.length > 0) && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Cpu className="w-3.5 h-3.5" /> Skills & Technologies
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...profile.skills, ...profile.claimed_technologies]
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 18)
                .map((s, i) => (
                  <Chip key={i} label={s} />
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-jade/25 bg-jade/5 px-4 py-3 flex items-center gap-3">
        <CheckCircle className="w-4 h-4 text-jade shrink-0" />
        <p className="text-sm text-jade/90">
          CV parsed successfully. These details will guide your interview questions.
        </p>
      </div>

      <Button className="w-full" onClick={onContinue}>
        Continue to identity check
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

export default function VerifyPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("cv");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cvProfile, setCvProfile] = useState<CvProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanLabelIdx, setScanLabelIdx] = useState(0);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [refImageB64, setRefImageB64] = useState<string | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
  const [snapshotB64, setSnapshotB64] = useState<string | null>(null);
  const [snapshotPreviewUrl, setSnapshotPreviewUrl] = useState<string | null>(
    null,
  );
  const [verifyResult, setVerifyResult] = useState<{
    match_percentage: number;
    verified: boolean;
    status: string;
  } | null>(null);
  const [webcamReady, setWebcamReady] = useState(false);

  const webcamRef = useRef<WebcamCaptureHandle>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeStep = STEP_INDEX[step];

  function startScanCycle() {
    setScanLabelIdx(0);
    let i = 0;
    scanIntervalRef.current = setInterval(() => {
      i = (i + 1) % CV_SCAN_LABELS.length;
      setScanLabelIdx(i);
    }, 900);
  }

  function stopScanCycle() {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  }

  function handleCvFile(file: File) {
    if (file.type === "application/pdf") setCvFile(file);
  }

  function handleRefPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefPreviewUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setRefImageB64(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.readAsDataURL(file);
  }

  async function uploadCv() {
    if (!cvFile) return;
    setBusy(true);
    setError(null);
    startScanCycle();
    try {
      const form = new FormData();
      form.append("file", cvFile);
      const resp = await fetch("/api/cv/upload", { method: "POST", body: form });
      const data = (await resp.json()) as {
        session_id?: string;
        profile?: CvProfile;
        error?: string;
      };
      if (!resp.ok || !data.session_id) {
        setError(
          data.error ?? "CV upload failed. Please try a different PDF.",
        );
        return;
      }
      setSessionId(data.session_id);
      if (data.profile) {
        setCvProfile(data.profile);
        // Persist for report page
        try {
          sessionStorage.setItem("truehire_cv", JSON.stringify(data.profile));
        } catch { /* non-fatal */ }
      }
      setStep("cv-review");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      stopScanCycle();
      setBusy(false);
    }
  }

  const takeSnapshot = useCallback(() => {
    const b64 = webcamRef.current?.captureSnapshot();
    if (!b64) {
      setError(
        "Couldn't capture a snapshot. Make sure your camera is on and try again.",
      );
      return;
    }
    setSnapshotB64(b64);
    setSnapshotPreviewUrl(`data:image/jpeg;base64,${b64}`);
    setError(null);
  }, []);

  async function verifyIdentity() {
    if (!refImageB64 || !snapshotB64) {
      setError("Please upload a reference photo and take a live snapshot first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/identity/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_image: refImageB64,
          live_image: snapshotB64,
        }),
      });
      const data = (await resp.json()) as {
        match_percentage?: number;
        verified?: boolean;
        status?: string;
        error?: string;
      };
      if (!resp.ok) {
        setError(
          data.error ?? "Verification service unavailable. Try again.",
        );
        return;
      }
      const result = {
        match_percentage: data.match_percentage ?? 0,
        verified: data.verified ?? false,
        status: data.status ?? "Mismatch",
      };
      setVerifyResult(result);
      // Persist for report page
      try {
        sessionStorage.setItem("truehire_identity", JSON.stringify(result));
      } catch { /* non-fatal */ }
    } catch {
      setError("Network error during verification. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleLivenessPassed() {
    try {
      sessionStorage.setItem("truehire_liveness", "true");
    } catch { /* non-fatal */ }
    setStep("done");
    setTimeout(() => {
      if (sessionId) navigate(`/interview/${sessionId}`);
    }, 900);
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-start py-10 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="w-full max-w-2xl space-y-8 relative z-10">
        {/* Header */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
            </div>
            <span className="font-display font-semibold text-sm text-foreground/80">
              TrueHire AI
            </span>
          </div>

          <div>
            <h1 className="font-display font-semibold text-2xl text-foreground">
              Candidate Verification
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete each step before your interview begins.
            </p>
          </div>

          {/* Stepper */}
          <nav aria-label="Verification steps">
            <ol className="flex items-center gap-0">
              {STEP_LABELS.map((label, i) => {
                const isComplete = activeStep > i;
                const isActive = activeStep === i;
                return (
                  <li key={label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono font-semibold transition-all duration-300 ${
                          isComplete
                            ? "bg-jade/15 border-jade/40 text-jade"
                            : isActive
                            ? "bg-primary/15 border-primary/50 text-primary"
                            : "bg-card border-border/50 text-muted-foreground/50"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          isActive
                            ? "text-foreground"
                            : isComplete
                            ? "text-jade/80"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div
                        className={`flex-1 h-px mx-3 transition-colors duration-500 ${
                          isComplete ? "bg-jade/30" : "bg-border/50"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Upload CV ── */}
          {step === "cv" && (
            <motion.div
              key="cv"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border/50 bg-card/60">
                <CardContent className="p-8 space-y-6">
                  <div>
                    <h2 className="font-display font-semibold text-lg">
                      Upload your CV
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF format only. Your skills and experience shape the
                      interview questions.
                    </p>
                  </div>

                  {busy ? (
                    <CvScanAnimation label={CV_SCAN_LABELS[scanLabelIdx]!} />
                  ) : (
                    <label
                      className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all duration-200 ${
                        dragOver
                          ? "border-primary/70 bg-primary/8"
                          : cvFile
                          ? "border-jade/50 bg-jade/5"
                          : "border-border/60 hover:border-primary/40 hover:bg-primary/4"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files[0];
                        if (f) handleCvFile(f);
                      }}
                    >
                      {cvFile ? (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-jade/10 border border-jade/25 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-jade" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                              {cvFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(cvFile.size / 1024).toFixed(0)} KB · PDF
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Click to change file
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-card border border-border/60 flex items-center justify-center">
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                              Drop your CV here
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              or click to browse
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground/60">
                            PDF · max 10 MB
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCvFile(f);
                        }}
                      />
                    </label>
                  )}

                  {error && (
                    <div
                      className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive/90"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => void uploadCv()}
                    disabled={!cvFile || busy}
                  >
                    {busy ? "Parsing CV…" : "Parse & continue"}
                    {!busy && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Step 1b: CV Review ── */}
          {step === "cv-review" && (
            <motion.div
              key="cv-review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border/50 bg-card/60">
                <CardContent className="p-8 space-y-6">
                  <div>
                    <h2 className="font-display font-semibold text-lg">
                      CV parsed
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Review what we extracted — this is what your interviewer
                      knows about you.
                    </p>
                  </div>
                  {cvProfile ? (
                    <CvSummary
                      profile={cvProfile}
                      onContinue={() => setStep("identity")}
                    />
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => setStep("identity")}
                    >
                      Continue to identity check
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Step 2: Identity Verification ── */}
          {step === "identity" && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border/50 bg-card/60">
                <CardContent className="p-8 space-y-6">
                  <div>
                    <h2 className="font-display font-semibold text-lg">
                      Verify your identity
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload a reference photo (LinkedIn, ID, CV headshot) then
                      take a live snapshot. Our AI compares both to confirm
                      it's you.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Reference photo */}
                    <div className="space-y-2">
                      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        Reference Photo
                      </p>
                      {refPreviewUrl ? (
                        <div className="space-y-2">
                          <img
                            src={refPreviewUrl}
                            alt="Reference photo"
                            className="w-full aspect-square object-cover rounded-xl border border-border/50"
                          />
                          <label className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1">
                            <RefreshCw className="w-3 h-3" /> Change photo
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={handleRefPhotoChange}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/60 rounded-xl aspect-square cursor-pointer hover:border-primary/40 transition-colors focus-within:ring-2 focus-within:ring-primary/40">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground text-center px-2">
                            Upload reference photo
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleRefPhotoChange}
                          />
                        </label>
                      )}
                    </div>

                    {/* Live snapshot */}
                    <div className="space-y-2">
                      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        Live Snapshot
                      </p>
                      {snapshotPreviewUrl ? (
                        <div className="space-y-2">
                          <img
                            src={snapshotPreviewUrl}
                            alt="Live snapshot"
                            className="w-full aspect-square object-cover rounded-xl border border-border/50"
                            style={{ transform: "scaleX(-1)" }}
                          />
                          <button
                            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                            onClick={() => {
                              setSnapshotB64(null);
                              setSnapshotPreviewUrl(null);
                              setVerifyResult(null);
                            }}
                          >
                            <RefreshCw className="w-3 h-3" /> Retake
                          </button>
                        </div>
                      ) : (
                        <div className="aspect-square">
                          <WebcamCapture
                            ref={webcamRef}
                            className="w-full h-full rounded-xl"
                            onReady={() => setWebcamReady(true)}
                            onError={(msg) => setError(msg)}
                          />
                        </div>
                      )}
                      {!snapshotPreviewUrl && webcamReady && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={takeSnapshot}
                        >
                          <Camera className="w-3.5 h-3.5 mr-1.5" /> Capture
                          snapshot
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Verification result */}
                  {verifyResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-4 flex items-start gap-3 ${
                        verifyResult.verified
                          ? "border-jade/30 bg-jade/6"
                          : "border-border/50 bg-card/60"
                      }`}
                      role="status"
                    >
                      {verifyResult.verified ? (
                        <CheckCircle className="w-5 h-5 text-jade shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-semibold text-sm ${
                              verifyResult.verified
                                ? "text-jade"
                                : "text-foreground"
                            }`}
                          >
                            {verifyResult.status}
                          </p>
                          <span className="font-mono text-xs text-muted-foreground">
                            {verifyResult.match_percentage}% match
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {verifyResult.verified
                            ? "Identity confirmed. You can proceed to the liveness check."
                            : "The photos don't match closely enough. Try a clearer reference photo taken in good lighting."}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <div
                      className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive/90"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  {!verifyResult ? (
                    <Button
                      className="w-full"
                      onClick={() => void verifyIdentity()}
                      disabled={!refImageB64 || !snapshotB64 || busy}
                    >
                      {busy ? (
                        "Comparing faces…"
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 mr-2" /> Verify
                          identity
                        </>
                      )}
                    </Button>
                  ) : verifyResult.verified ? (
                    <Button
                      className="w-full"
                      onClick={() => setStep("liveness")}
                    >
                      Continue to liveness check
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setVerifyResult(null);
                        setSnapshotB64(null);
                        setSnapshotPreviewUrl(null);
                        setRefImageB64(null);
                        setRefPreviewUrl(null);
                        setError(null);
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Try with different
                      photos
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Step 3: Liveness ── */}
          {step === "liveness" && (
            <motion.div
              key="liveness"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border/50 bg-card/60">
                <CardContent className="p-8 space-y-6">
                  <div>
                    <h2 className="font-display font-semibold text-lg">
                      Liveness check
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      One quick action confirms you're present — not a photo or
                      a pre-recorded video.
                    </p>
                  </div>

                  <WebcamCapture
                    ref={webcamRef}
                    className="w-full aspect-video rounded-xl"
                    showOverlay
                    overlayLabel="● LIVE"
                    onReady={() => setWebcamReady(true)}
                    onError={(msg) => setError(msg)}
                  />

                  <LivenessChallenge
                    videoRef={
                      webcamRef as React.RefObject<{
                        videoElement: HTMLVideoElement | null;
                      } | null>
                    }
                    onPassed={handleLivenessPassed}
                  />

                  {error && (
                    <div
                      className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive/90"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-5 py-16"
            >
              <div className="w-16 h-16 rounded-full bg-jade/12 border border-jade/30 flex items-center justify-center shadow-[0_0_32px_-4px_rgba(16,217,165,0.4)]">
                <CheckCircle className="w-8 h-8 text-jade" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="font-display font-semibold text-xl text-jade">
                  Verification complete
                </h2>
                <p className="text-sm text-muted-foreground">
                  Starting your interview session…
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
