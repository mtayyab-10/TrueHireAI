import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Camera, CameraOff } from "lucide-react";

export interface WebcamCaptureHandle {
  /** Returns a base64 JPEG string (no data: prefix) of the current frame */
  captureSnapshot(): string | null;
  /** The underlying video element, or null if not ready */
  videoElement: HTMLVideoElement | null;
}

interface Props {
  className?: string;
  /** Called when the stream is ready */
  onReady?: () => void;
  /** Called with an error message if camera access fails */
  onError?: (msg: string) => void;
  showOverlay?: boolean;
  overlayLabel?: string;
}

const WebcamCapture = forwardRef<WebcamCaptureHandle, Props>(
  ({ className, onReady, onError, showOverlay, overlayLabel }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
      let mounted = true;
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
        .then((stream) => {
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(() => null);
              onReady?.();
            };
          }
        })
        .catch((err: unknown) => {
          if (!mounted) return;
          const msg =
            err instanceof Error ? err.message : "Camera access denied";
          onError?.(msg);
        });

      return () => {
        mounted = false;
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
    }, [onReady, onError]);

    const captureSnapshot = useCallback((): string | null => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return null;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    }, []);

    useImperativeHandle(ref, () => ({
      captureSnapshot,
      get videoElement() {
        return videoRef.current;
      },
    }));

    return (
      <div className={`relative overflow-hidden rounded-lg bg-black ${className ?? ""}`}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover mirror"
          style={{ transform: "scaleX(-1)" }}
        />
        {showOverlay && overlayLabel && (
          <div className="absolute inset-0 flex items-end justify-start p-2 pointer-events-none">
            <span className="text-xs font-mono bg-black/60 text-white px-2 py-1 rounded">
              {overlayLabel}
            </span>
          </div>
        )}
        {!streamRef.current && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Camera className="w-8 h-8 opacity-40" />
            <span className="text-xs opacity-60">Starting camera…</span>
          </div>
        )}
      </div>
    );
  },
);

WebcamCapture.displayName = "WebcamCapture";
export default WebcamCapture;

export function CameraOffPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-card border border-border/50 p-8 text-muted-foreground">
      <CameraOff className="w-10 h-10 opacity-40" />
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}
