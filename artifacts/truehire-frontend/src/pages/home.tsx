import { useHealthCheck } from "@workspace/api-client-react";
import { ShieldCheck, ArrowRight, Fingerprint, ScanFace, BrainCircuit, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const STEPS = [
  {
    icon: Fingerprint,
    step: "01",
    label: "Identity verification",
    sub: "AI face comparison between your CV photo and a live webcam snapshot. Not just a form field — a face.",
  },
  {
    icon: ScanFace,
    step: "02",
    label: "Liveness detection",
    sub: "Browser-side proof of presence. Confirms you're a live person, not a photo or pre-recorded video.",
  },
  {
    icon: BrainCircuit,
    step: "03",
    label: "Integrity-scored interview",
    sub: "Adaptive AI questions drawn from your actual CV. Every answer scored for authenticity in real time.",
  },
];

export default function Home() {
  const { data, isLoading, isError } = useHealthCheck();
  const [, navigate] = useLocation();

  const backendOk = !isLoading && !isError && data?.status === "ok";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-6 selection:bg-primary/20">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Radial glow behind content */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary)/0.18), transparent 70%)",
        }}
      />

      <div className="w-full max-w-xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-10"
        >
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]">
              <ShieldCheck className="w-4.5 h-4.5 text-primary" strokeWidth={1.75} />
            </div>
            <span className="font-display font-semibold text-base text-foreground/90 tracking-tight">
              TrueHire AI
            </span>
          </div>

          {/* Hero copy */}
          <div className="space-y-4">
            <h1 className="font-display font-semibold text-[2.6rem] leading-[1.1] tracking-tight text-foreground">
              Not just who looks good on paper.
              <br />
              <span className="text-primary">Who can prove it live.</span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-md">
              TrueHire AI verifies who the candidate actually is before the
              interview begins — then scores every answer for integrity as it
              happens. Real-time proof, not a hope-and-trust process.
            </p>
          </div>

          {/* Step cards */}
          <div className="space-y-2">
            {STEPS.map(({ icon: Icon, step, label, sub }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.07, duration: 0.4 }}
                className="group flex items-start gap-4 rounded-xl border border-border/50 bg-card/40 px-4 py-3.5 hover:border-primary/25 hover:bg-card/60 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/12 transition-colors">
                  <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <span className="font-mono text-[9px] text-muted-foreground/40 tracking-widest">
                      {step}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{sub}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-1.5 group-hover:text-primary/40 transition-colors" />
              </motion.div>
            ))}
          </div>

          {/* CTA block */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2.5">
              {isLoading ? (
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
              ) : backendOk ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jade opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-jade" />
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-destructive" />
              )}
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {isLoading
                  ? "Connecting to verification engine…"
                  : backendOk
                  ? "System ready"
                  : "Verification engine offline"}
              </span>
            </div>

            <Button
              size="lg"
              className="w-full font-display font-semibold text-sm tracking-wide shadow-[0_0_28px_-4px_hsl(var(--primary)/0.45)] hover:shadow-[0_0_36px_-4px_hsl(var(--primary)/0.65)] transition-shadow"
              disabled={!backendOk}
              onClick={() => navigate("/verify")}
            >
              Begin verification
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            {!backendOk && !isLoading && (
              <p className="text-xs text-destructive/80 text-center">
                The API server isn't reachable — make sure it's running before
                continuing.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
