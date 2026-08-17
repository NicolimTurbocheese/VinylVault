import React, { useRef, useState, useEffect } from "react";
import { Camera, X, RefreshCw, CheckCircle } from "lucide-react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  useEscapeToClose(isOpen, handleClose);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

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
      setErrorMsg(
        "Unable to access camera. Please check permissions or upload an image file instead."
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        onCapture(dataUrl);
        stopCamera();
        onClose();
      }
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
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
            <Camera className="w-5 h-5 text-amber-500" />
            <span>Snap Vinyl Record / Runout Groove</span>
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
          {/* Floating close button — always reachable even if the header scrolls out of view on small screens */}
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
              <p className="text-xs">You can use the image upload button on the main screen instead.</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Vinyl scanning viewfinder overlay */}
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-amber-500/40 rounded-xl m-6 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border border-amber-500/30 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 animate-ping" />
                </div>
              </div>
            </>
          )}
        </div>

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

          <button
            onClick={handleCapture}
            disabled={!!errorMsg}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Capture Photo</span>
          </button>
        </div>

        {/* Hidden canvas for capturing frame */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
