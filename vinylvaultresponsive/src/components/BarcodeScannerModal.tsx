import React, { useEffect, useRef, useState } from "react";
import { Barcode, X, AlertCircle } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  useEscapeToClose(isOpen, handleClose);

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    setScannerError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("barcode-reader-div");
      }

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
      ];

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          formatsToSupport,
        },
        (decodedText) => {
          if (decodedText) {
            onDetected(decodedText);
            stopScanner();
            onClose();
          }
        },
        () => {
          // Ignore frame decode failures
        }
      );
    } catch (err: any) {
      console.warn("Barcode scanner error:", err);
      setScannerError("Camera barcode scanner unavailable. You can enter or paste the barcode number manually below.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        // Ignore stop error
      }
      scannerRef.current = null;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onDetected(manualCode.trim());
      onClose();
    }
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
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-base">
            <Barcode className="w-5 h-5 text-[#D4AF37]" />
            <span>Scan Vinyl Barcode (EAN / UPC / MusicBrainz)</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video stream container */}
        <div className="p-4 bg-black flex flex-col items-center justify-center min-h-[260px]">
          <div id="barcode-reader-div" className="w-full max-w-sm rounded-xl overflow-hidden border border-zinc-800" />

          {scannerError && (
            <div className="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{scannerError}</span>
            </div>
          )}
        </div>

        {/* Manual Barcode input fallback */}
        <form onSubmit={handleManualSubmit} className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-3">
          <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Manual Barcode Entry (EAN-13 / UPC)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 0602577921124 or 0190296203664"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-mono text-sm focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8972e] text-black font-bold text-xs rounded-lg transition disabled:opacity-50"
            >
              Use Barcode
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
