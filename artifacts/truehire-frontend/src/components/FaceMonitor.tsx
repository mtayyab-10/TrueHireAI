/**
 * FaceMonitor — runs continuously during the interview, sampling the webcam every 500ms.
 *
 * SUSPICION SCORE WEIGHTING (camera signals only):
 *   Multiple faces detected  → +20 per occurrence (min 30s cooldown between triggers)
 *   Off-screen gaze (no face or very-closed eyes) → +5 per flagged sample
 *   Off-screen gaze is only flagged when > 60% of samples in a 10-sample rolling window
 *   are "off-screen" (face absent or avg EAR < 0.10).
 *
 * Backend answer suspicion_delta (from AuthenticityAgent) is added separately by the
 * interview page when it receives the HTTP response.
 *
 * Bands:  Low 0–33 | Medium 34–66 | High 67–100
 * Score clamps to [0, 100].
 */

import { useEffect, useRef, useCallback } from "react";
import {
  loadFaceApiModels,
  detectFacesWithLandmarks,
  detectFaceCount,
  computeEAR,
  type DetectionWithLandmarks,
} from "@/lib/useFaceApi";

export interface MonitorEvent {
  ts: number;
  agent: string;
  message: string;
  suspicion_delta: number;
}

interface Props {
  videoRef: React.RefObject<{ videoElement: HTMLVideoElement | null } | null>;
  onEvent: (evt: MonitorEvent) => void;
  enabled: boolean;
}

const POLL_MS = 500;
const GAZE_WINDOW = 10;
const GAZE_FLAG_RATIO = 0.6;
const MULTI_FACE_COOLDOWN_MS = 30_000;
const OFF_GAZE_EAR_THRESHOLD = 0.10;

export default function FaceMonitor({ videoRef, onEvent, enabled }: Props) {
  const gazeWindowRef = useRef<boolean[]>([]);
  const lastMultiFaceRef = useRef<number>(0);
  const modelsReadyRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emit = useCallback(
    (agent: string, message: string, suspicion_delta: number) => {
      onEvent({ ts: Date.now(), agent, message, suspicion_delta });
    },
    [onEvent],
  );

  const sample = useCallback(async () => {
    const video = videoRef.current?.videoElement;
    if (!video || video.readyState < 2) return;

    const faceCount = await detectFaceCount(video);

    if (faceCount > 1) {
      const now = Date.now();
      if (now - lastMultiFaceRef.current > MULTI_FACE_COOLDOWN_MS) {
        lastMultiFaceRef.current = now;
        emit(
          "Authenticity Agent",
          "Multiple faces detected. Possible external assistance.",
          20,
        );
      }
    }

    const detections: DetectionWithLandmarks[] = await detectFacesWithLandmarks(video);
    let offScreen = false;

    if (detections.length === 0) {
      offScreen = true;
    } else {
      const pts = detections[0]!.landmarks.positions;
      const leftEye = pts.slice(36, 42);
      const rightEye = pts.slice(42, 48);
      const avgEAR = (computeEAR(leftEye) + computeEAR(rightEye)) / 2;
      if (avgEAR < OFF_GAZE_EAR_THRESHOLD) offScreen = true;
    }

    gazeWindowRef.current.push(offScreen);
    if (gazeWindowRef.current.length > GAZE_WINDOW) {
      gazeWindowRef.current.shift();
    }

    if (gazeWindowRef.current.length === GAZE_WINDOW) {
      const offCount = gazeWindowRef.current.filter(Boolean).length;
      if (offCount / GAZE_WINDOW >= GAZE_FLAG_RATIO) {
        gazeWindowRef.current = [];
        emit("Authenticity Agent", "High off-screen gaze detected.", 5);
      }
    }
  }, [videoRef, emit]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    loadFaceApiModels().then(() => {
      if (cancelled) return;
      modelsReadyRef.current = true;
      intervalRef.current = setInterval(() => {
        if (modelsReadyRef.current) void sample();
      }, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, sample]);

  return null;
}
