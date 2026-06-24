/**
 * useFaceApi — wraps face-api.js loaded as an ES module from npm.
 *
 * Importing from the npm package means all TinyFaceDetectorOptions /
 * SsdMobilenetv1Options instanceof checks use the same class reference —
 * no more "expected options to be instance of…" runtime errors.
 *
 * Models loaded from public/models/ (local, no CDN dependency).
 */
import * as faceapi from "face-api.js";

const MODEL_URL = "/models";

export interface Point {
  x: number;
  y: number;
}

export interface DetectionWithLandmarks {
  detection: { score: number; box: { x: number; y: number; width: number; height: number } };
  landmarks: { positions: Point[] };
}

export interface Detection {
  score: number;
  box: { x: number; y: number; width: number; height: number };
}

let loadPromise: Promise<void> | null = null;

export async function loadFaceApiModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    ]);
  })();
  loadPromise = loadPromise.catch((err: unknown) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

/** Euclidean distance between two 2D points */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Eye Aspect Ratio for a 6-point eye landmark set.
 * Landmarks for left eye: indices 36-41 of the 68-point model.
 * Landmarks for right eye: indices 42-47.
 * EAR < 0.21 → eye is closed (blinking).
 */
export function computeEAR(eye: Point[]): number {
  if (eye.length < 6) return 1;
  const v1 = dist(eye[1]!, eye[5]!);
  const v2 = dist(eye[2]!, eye[4]!);
  const h = dist(eye[0]!, eye[3]!);
  if (h < 1e-6) return 1;
  return (v1 + v2) / (2 * h);
}

/**
 * Simplified yaw from the 68-point landmark set.
 * Compares distances from nose-tip (pt 30) to left cheek (pt 0) vs right cheek (pt 16).
 * Returns a value in [-1, +1]: negative = turned left, positive = turned right.
 */
export function computeYaw(pts: Point[]): number {
  if (pts.length < 17) return 0;
  const nose = pts[30]!;
  const leftCheek = pts[0]!;
  const rightCheek = pts[16]!;
  const ld = dist(nose, leftCheek);
  const rd = dist(nose, rightCheek);
  const total = ld + rd;
  if (total < 1e-6) return 0;
  return (rd - ld) / total;
}

/**
 * Simple smile score: mouth width / face width.
 * > 0.35 is considered a smile.
 */
export function computeSmile(pts: Point[]): number {
  if (pts.length < 55) return 0;
  const mouthLeft = pts[48]!;
  const mouthRight = pts[54]!;
  const faceLeft = pts[0]!;
  const faceRight = pts[16]!;
  const mouthW = dist(mouthLeft, mouthRight);
  const faceW = dist(faceLeft, faceRight);
  if (faceW < 1e-6) return 0;
  return mouthW / faceW;
}

/**
 * Detect all faces + 68-point landmarks in a video element.
 * Returns array of DetectionWithLandmarks (may be empty).
 */
export async function detectFacesWithLandmarks(
  video: HTMLVideoElement,
): Promise<DetectionWithLandmarks[]> {
  try {
    const opts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4, inputSize: 320 });
    const results = await faceapi
      .detectAllFaces(video, opts)
      .withFaceLandmarks(true)
      .run();
    return results as unknown as DetectionWithLandmarks[];
  } catch {
    return [];
  }
}

/**
 * Detect multiple faces using SSD MobileNet v1 (more reliable for multi-face).
 * Used for the faces_detected count during interview monitoring.
 */
export async function detectFaceCount(video: HTMLVideoElement): Promise<number> {
  try {
    const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
    const results = await faceapi.detectAllFaces(video, opts).run();
    return results.length;
  } catch {
    return 0;
  }
}
