/**
 * LivenessChallenge — issues one random challenge and uses face-api.js to verify it.
 *
 * Challenges:
 *   blink   — EAR dips below 0.21 twice within the window
 *   turn    — yaw crosses ±0.15 (head turned left)
 *   smile   — mouth-width / face-width ratio > 0.35 sustained for 500ms
 *   sentence — timer-based: user reads the sentence, clicks Done after 5s
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadFaceApiModels,
  detectFacesWithLandmarks,
  computeEAR,
  computeYaw,
  computeSmile,
  type DetectionWithLandmarks,
} from "@/lib/useFaceApi";

const CHALLENGES = ["blink", "turn", "smile", "sentence"] as const;
type Challenge = (typeof CHALLENGES)[number];

const CHALLENGE_LABELS: Record<Challenge, string> = {
  blink: "Blink twice",
  turn: "Turn your head left",
  smile: "Smile naturally",
  sentence: 'Read aloud: "My name is [your name] and I am ready for the interview."',
};

interface Props {
  videoRef: React.RefObject<{ videoElement: HTMLVideoElement | null } | null>;
  onPassed: () => void;
  onFailed?: () => void;
}

const POLL_MS = 120;
const BLINK_EAR_THRESHOLD = 0.21;
const YAW_LEFT_THRESHOLD = -0.15;
const SMILE_THRESHOLD = 0.35;
const SENTENCE_DURATION_MS = 5000;

export default function LivenessChallenge({ videoRef, onPassed, onFailed }: Props) {
  const [challenge, setChallenge] = useState<Challenge>(() => {
    return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]!;
  });
  const [status, setStatus] = useState<"loading" | "running" | "passed" | "failed">(
    "loading",
  );
  const [loadError, setLoadError] = useState(false);
  const [progress, setProgress] = useState("");
  const [modelsReady, setModelsReady] = useState(false);
  const [sentenceTimer, setSentenceTimer] = useState(SENTENCE_DURATION_MS / 1000);

  const blinkCountRef = useRef(0);
  const eyeWasClosedRef = useRef(false);
  const smileStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  }, []);

  const pass = useCallback(() => {
    stopPolling();
    setStatus("passed");
    setTimeout(onPassed, 900);
  }, [stopPolling, onPassed]);

  const retry = useCallback(() => {
    stopPolling();
    blinkCountRef.current = 0;
    eyeWasClosedRef.current = false;
    smileStartRef.current = null;
    setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]!);
    setStatus("loading");
    setProgress("");
    setSentenceTimer(SENTENCE_DURATION_MS / 1000);
  }, [stopPolling]);

  useEffect(() => {
    let cancelled = false;
    loadFaceApiModels()
      .then(() => {
        if (!cancelled) {
          setModelsReady(true);
          setStatus("running");
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback: use the sentence challenge which needs no face detection
          setLoadError(true);
          setChallenge("sentence");
          setModelsReady(false);
          setStatus("running");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "running" || !modelsReady) return;

    if (challenge === "sentence") {
      let remaining = SENTENCE_DURATION_MS / 1000;
      setSentenceTimer(remaining);
      timerIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setSentenceTimer(remaining);
        if (remaining <= 0) {
          clearInterval(timerIntervalRef.current!);
        }
      }, 1000);
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      const video = videoRef.current?.videoElement;
      if (!video) return;

      const detections: DetectionWithLandmarks[] = await detectFacesWithLandmarks(video);
      if (detections.length === 0) {
        setProgress("No face detected — centre your face in the camera.");
        return;
      }

      const pts = detections[0]!.landmarks.positions;
      const leftEye = pts.slice(36, 42);
      const rightEye = pts.slice(42, 48);
      const avgEAR = (computeEAR(leftEye) + computeEAR(rightEye)) / 2;
      const yaw = computeYaw(pts);
      const smile = computeSmile(pts);

      if (challenge === "blink") {
        if (avgEAR < BLINK_EAR_THRESHOLD && !eyeWasClosedRef.current) {
          eyeWasClosedRef.current = true;
        } else if (avgEAR >= BLINK_EAR_THRESHOLD && eyeWasClosedRef.current) {
          eyeWasClosedRef.current = false;
          blinkCountRef.current += 1;
          setProgress(`Blink ${blinkCountRef.current}/2 detected`);
          if (blinkCountRef.current >= 2) pass();
        }
      }

      if (challenge === "turn") {
        if (yaw < YAW_LEFT_THRESHOLD) {
          setProgress("Head turn detected!");
          pass();
        } else {
          setProgress(`Yaw: ${yaw.toFixed(2)} — turn your head further left`);
        }
      }

      if (challenge === "smile") {
        if (smile > SMILE_THRESHOLD) {
          if (!smileStartRef.current) smileStartRef.current = Date.now();
          const held = Date.now() - smileStartRef.current;
          setProgress(`Hold that smile… ${Math.round(held / 100) * 100}ms`);
          if (held >= 500) pass();
        } else {
          smileStartRef.current = null;
          setProgress(`Smile score: ${smile.toFixed(2)} (need > 0.35)`);
        }
      }
    }, POLL_MS);

    return stopPolling;
  }, [challenge, status, modelsReady, videoRef, pass, stopPolling]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-6 space-y-4 text-center">
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Liveness Challenge
      </p>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading face detection models…</p>
        </div>
      )}

      {status === "running" && (
        <>
          <p className="text-base font-medium text-foreground">
            {CHALLENGE_LABELS[challenge]}
          </p>

          {challenge === "sentence" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {sentenceTimer > 0
                  ? `Reading window closes in ${sentenceTimer}s…`
                  : "Reading window complete"}
              </p>
              <Button
                onClick={pass}
                disabled={sentenceTimer > 0}
                className="w-full"
              >
                {sentenceTimer > 0 ? `Wait ${sentenceTimer}s…` : "I've read the sentence"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground min-h-[1.5rem]">
              {progress || "Watching…"}
            </p>
          )}
        </>
      )}

      {status === "passed" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle className="w-10 h-10 text-primary" />
          <p className="font-semibold text-primary">Liveness: Passed</p>
        </div>
      )}

      {status === "failed" && (
        <div className="space-y-3">
          <p className="text-sm text-destructive">Challenge not completed in time.</p>
          <Button variant="outline" onClick={retry}>
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
        </div>
      )}

      {status === "running" && challenge !== "sentence" && (
        <Button variant="ghost" size="sm" onClick={retry} className="text-muted-foreground">
          <RefreshCw className="w-3 h-3 mr-1" /> Different challenge
        </Button>
      )}
    </div>
  );
}
