import React, { useRef, useState, useEffect, useCallback } from "react";
import { Camera, X, RefreshCw, CheckCircle, Sparkles, RotateCcw } from "lucide-react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { autoEnhance, canvasToCompressedDataUrl } from "../utils/imageProcessing";

interface CoverScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onFallbackToFile?: () => void;
}

// How different two sampled frames need to be (out of 255 per-pixel) before we
// consider the camera "still moving" rather than "held steady."
const STABILITY_DIFF_THRESHOLD = 10;
const STABLE_SAMPLES_REQUIRED = 5; // ~5 x 150ms = ~0.75s held steady
const SAMPLE_INTERVAL_MS = 150;

export const CoverScanModal: React.FC<CoverScanModalProps> = ({ isOpen, onClose, onCapture, onFallbackToFile }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableStreakRef = useRef(0);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoCapture, setAutoCapture] = useState(true);
  const [holdSteadyProgress, setHoldSteadyProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState(true);

  const stopCamera = useCallback(() => {
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    setStream((prev) => {
      prev?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    onClose();
  };

  useEscapeToClose(isOpen, handleClose);
  useBodyScrollLock(isOpen);

  const captureFrame = useCallback((applyEnhance: boolean) => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (applyEnhance) autoEnhance(canvas);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
  }, []);

  // Motion-stability sampling: continuously diff a small downscaled frame against the
  // previous one. When the camera has been held steady for STABLE_SAMPLES_REQUIRED
  // consecutive samples, auto-capture — this is the "pick the best/sharpest moment"
  // behavior, without needing full computer-vision edge detection.
  const checkStability = useCallback(() => {
    const video = videoRef.current;
    const sampleCanvas = sampleCanvasRef.current;
    if (!video || !sampleCanvas || video.readyState < 2) return;

    const W = 48, H = 48;
    sampleCanvas.width = W;
    sampleCanvas.height = H;
    const ctx = sampleCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, W, H);
    const frame = ctx.getImageData(0, 0, W, H).data;

    const prev = prevFrameRef.current;
    if (prev) {
      let diffSum = 0;
      let samples = 0;
      for (let i = 0; i < frame.length; i += 4 * 4) {
        diffSum += Math.abs(frame[i] - prev[i]);
        samples++;
      }
      const avgDiff = diffSum / Math.max(1, samples);

      if (avgDiff < STABILITY_DIFF_THRESHOLD) {
        stableStreakRef.current += 1;
      } else {
        stableStreakRef.current = 0;
      }
      setHoldSteadyProgress(Math.min(1, stableStreakRef.current / STABLE_SAMPLES_REQUIRED));

      if (autoCapture && stableStreakRef.current >= STABLE_SAMPLES_REQUIRED) {
        stableStreakRef.current = 0;
        captureFrame(true);
      }
    }
    prevFrameRef.current = frame;
  }, [autoCapture, captureFrame]);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    setErrorMsg(null);
    setCapturedImage(null);
    prevFrameRef.current = null;
    stableStreakRef.current = 0;
    setHoldSteadyProgress(0);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1600 }, height: { ideal: 1600 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = setInterval(checkStability, SAMPLE_INTERVAL_MS);
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMsg("Unable to access camera. Please check permissions.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode]);

  const handleRetake = () => {
    setCapturedImage(null);
    prevFrameRef.current = null;
    stableStreakRef.current = 0;
    setHoldSteadyProgress(0);
  };

  const handleUsePhoto = () => {
    const canvas = captureCanvasRef.current;
    if (!canvas) return;
    const finalUrl = canvasToCompressedDataUrl(canvas, 900, 0.85);
    stopCamera();
    onCapture(finalUrl);
    setCapturedImage(null);
    onClose();
  };

  const toggleFacingMode = () => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={handleClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-lg">
            <Camera className="w-5 h-5 text-amber-500" />
            <span>Scan Cover Art</span>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-zinc-400">
              <p className="text-red-400 mb-2">{errorMsg}</p>
              {onFallbackToFile && (
                <button
                  onClick={() => {
                    handleClose();
                    onFallbackToFile();
                  }}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 underline"
                >
                  Choose a photo file instead
                </button>
              )}
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured cover" className="w-full h-full object-cover" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {/* Square viewfinder guide matching a vinyl sleeve's aspect ratio */}
              <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-amber-500/50 rounded-lg" />
              {autoCapture && (
                <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1.5 pointer-events-none">
                  <div className="w-2/3 h-1.5 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-150"
                      style={{ width: `${holdSteadyProgress * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-amber-300 bg-black/50 px-2 py-0.5 rounded-full">
                    {holdSteadyProgress > 0.4 ? "Hold steady..." : "Frame the cover, hold still"}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 space-y-3">
          {capturedImage ? (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleRetake}
                className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-amber-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>
              <button
                onClick={handleUsePhoto}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Use This Photo</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={toggleFacingMode}
                  disabled={!!errorMsg}
                  className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-amber-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Flip Camera</span>
                </button>

                <button
                  onClick={() => captureFrame(true)}
                  disabled={!!errorMsg}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Capture Now</span>
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-400 justify-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => setAutoCapture(e.target.checked)}
                  className="accent-amber-500"
                />
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Auto-capture when held steady
              </label>
            </>
          )}
        </div>

        <canvas ref={captureCanvasRef} className="hidden" />
        <canvas ref={sampleCanvasRef} className="hidden" />
      </div>
    </div>
  );
};
