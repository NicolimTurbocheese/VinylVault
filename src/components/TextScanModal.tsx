import React, { useRef, useState, useEffect, useCallback } from "react";
import { ScanText, X, RefreshCw, Radio } from "lucide-react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

interface TextScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseText: (text: string, target: "catalogueNumber" | "matrixCode" | "barcode" | "artistAlbum") => void;
}

const SCAN_INTERVAL_MS = 1200;

// Runs OCR entirely in the browser (Tesseract.js, WebAssembly) — no server call, no API cost,
// no Gemini quota involved. Continuously reads whatever text the camera is pointed at (like a
// barcode scanner) instead of requiring a manual "capture" tap — hold the record steady over
// printed text and it fills in on its own.
export const TextScanModal: React.FC<TextScanModalProps> = ({ isOpen, onClose, onUseText }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const isEditingRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string>("");

  const handleClose = () => {
    stopCamera();
    setRecognizedText("");
    isEditingRef.current = false;
    setIsPaused(false);
    onClose();
  };

  useEscapeToClose(isOpen, handleClose);

  const startCamera = async (mode: "environment" | "user") => {
    setErrorMsg(null);
    stopCamera();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setErrorMsg("Unable to access camera. Please check permissions and try again.");
    }
  };

  const stopCamera = () => {
    setStream((prev) => {
      if (prev) prev.getTracks().forEach((track) => track.stop());
      return null;
    });
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const runScanPass = useCallback(async () => {
    if (isProcessingRef.current || isEditingRef.current) return;
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth) return;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    isProcessingRef.current = true;
    setIsScanning(true);
    try {
      const { data } = await workerRef.current.recognize(dataUrl);
      const cleaned = (data.text || "").replace(/\s+/g, " ").trim();
      // Keep the last good read on screen instead of flickering blank on an unreadable frame.
      if (cleaned && !isEditingRef.current) {
        setRecognizedText(cleaned);
      }
    } catch (err) {
      console.error("OCR error:", err);
    } finally {
      isProcessingRef.current = false;
      setIsScanning(false);
    }
  }, []);

  // Camera lifecycle
  useEffect(() => {
    if (isOpen) {
      setRecognizedText("");
      isEditingRef.current = false;
      setIsPaused(false);
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode]);

  // Live-scan loop: create the OCR worker once and re-scan the current frame on an interval
  // for as long as the modal is open, so nothing needs a manual capture tap.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let intervalId: number | null = null;

    (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      if (cancelled) {
        await worker.terminate();
        return;
      }
      workerRef.current = worker;
      intervalId = window.setInterval(runScanPass, SCAN_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isOpen, runScanPass]);

  const handleUse = (target: "catalogueNumber" | "matrixCode" | "barcode" | "artistAlbum") => {
    if (!recognizedText) return;
    onUseText(recognizedText, target);
    handleClose();
  };

  const handleRestartScan = () => {
    setRecognizedText("");
    isEditingRef.current = false;
    setIsPaused(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-lg">
            <ScanText className="w-5 h-5 text-amber-500" />
            <span>Scan Catalogue / Matrix / Barcode Text</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video stream container */}
        <div className="relative aspect-square sm:aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          <button
            onClick={handleClose}
            title="Close (Esc)"
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition"
          >
            <X className="w-5 h-5" />
          </button>

          {errorMsg ? (
            <div className="p-6 text-center text-zinc-400">
              <p className="text-red-400 mb-2">{errorMsg}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {/* Text-alignment viewfinder — a wide rectangle, since printed codes read left-to-right */}
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-amber-500/40 rounded-xl m-6 flex items-center justify-center">
                <div className="w-[85%] h-14 rounded-md border border-amber-500/40 bg-amber-500/5" />
              </div>

              {/* Live scanning indicator */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                <Radio className={`w-3 h-3 text-amber-400 ${isScanning ? "animate-pulse" : ""}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  {isPaused ? "Paused" : "Live Scanning"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Recognized text + field assignment */}
        {recognizedText && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 space-y-3 font-sans">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1 block">
                Recognized Text — updating live, edit if needed
              </label>
              <textarea
                value={recognizedText}
                onChange={(e) => {
                  isEditingRef.current = true;
                  setIsPaused(true);
                  setRecognizedText(e.target.value);
                }}
                onFocus={() => {
                  isEditingRef.current = true;
                  setIsPaused(true);
                }}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUse("catalogueNumber")}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 transition"
              >
                Use as Catalogue Number
              </button>
              <button
                onClick={() => handleUse("matrixCode")}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 transition"
              >
                Use as Matrix Code
              </button>
              <button
                onClick={() => handleUse("barcode")}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 transition"
              >
                Use as Barcode
              </button>
              <button
                onClick={() => handleUse("artistAlbum")}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 transition"
              >
                Use as Artist / Album
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={toggleFacingMode}
            disabled={!!errorMsg}
            className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-amber-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Flip Camera</span>
          </button>

          {recognizedText && (
            <button
              onClick={handleRestartScan}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-amber-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
            >
              Resume Live Scan
            </button>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
