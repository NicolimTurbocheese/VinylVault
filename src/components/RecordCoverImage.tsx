import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, ImageOff, Check, Camera } from "lucide-react";
import { apiUrl } from "../utils/apiBase";
import { CoverScanModal } from "./CoverScanModal";

// Resizes/compresses a user-picked photo client-side before it's stored as a data URL
// (Firestore documents cap at 1MB, and this keeps localStorage usage sane too).
const MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.75;

function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface RecordCoverImageProps {
  src?: string;
  artist: string;
  albumTitle: string;
  catalogueNumber?: string;
  matrixCode?: string;
  className?: string;
  imgClassName?: string;
  alt?: string;
  onImageChange?: (newUrl: string) => void;
  showRefreshOverlay?: boolean;
}

export const RecordCoverImage: React.FC<RecordCoverImageProps> = ({
  src,
  artist,
  albumTitle,
  catalogueNumber,
  matrixCode,
  className = "w-20 h-20 rounded object-cover border border-[#E2DCD0] shadow-xs flex-shrink-0 relative group/cover",
  imgClassName = "w-full h-full object-cover rounded",
  alt,
  onImageChange,
  showRefreshOverlay = true,
}) => {
  const [currentUrl, setCurrentUrl] = useState<string>(src || "");
  const [hasError, setHasError] = useState<boolean>(!src);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [candidateUrls, setCandidateUrls] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const handleScanCapture = (dataUrl: string) => {
    setCurrentUrl(dataUrl);
    setHasError(false);
    setCandidateUrls([]);
    setCandidateIndex(0);
    if (onImageChange) onImageChange(dataUrl);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsLoading(true);
    setStatusMessage("Processing photo...");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setCurrentUrl(dataUrl);
      setHasError(false);
      setCandidateUrls([]);
      setCandidateIndex(0);
      setStatusMessage("Photo saved!");
      if (onImageChange) onImageChange(dataUrl);
    } catch (err) {
      console.warn("Error processing uploaded cover photo:", err);
      setStatusMessage("Couldn't read that photo");
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMessage(null), 2000);
    }
  };

  useEffect(() => {
    if (src && src !== currentUrl) {
      setCurrentUrl(src);
      setHasError(false);
    }
  }, [src]);

  // Fetch alternative image references from verified server endpoint & iTunes with strict title matching
  const handleFetchAlternativeImage = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsLoading(true);
    setStatusMessage("Finding art...");

    try {
      let pool = [...candidateUrls];

      if (pool.length === 0) {
        // 1. First call server cover-art API
        try {
          const apiRes = await fetch(
            `${apiUrl("coverArt")}?artist=${encodeURIComponent(artist)}&albumTitle=${encodeURIComponent(
              albumTitle
            )}&catalogueNumber=${encodeURIComponent(catalogueNumber || "")}&matrixCode=${encodeURIComponent(matrixCode || "")}`
          );
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.results && apiData.results.length > 0) {
              pool = Array.from(new Set(apiData.results));
            }
          }
        } catch (serverErr) {
          console.warn("Server cover-art API fetch error:", serverErr);
        }

        // 2. Client-side iTunes fallback with strict title matching
        if (pool.length === 0) {
          const cleanTitle = albumTitle.replace(/\s*\([^)]*\)/g, "").trim();
          const mainKeyword = (cleanTitle.length >= 3 ? cleanTitle : albumTitle).toLowerCase();
          const isVarious = !artist || /various|v\/a|soundtrack|ost/i.test(artist);
          const cleanArtist = isVarious ? "" : artist.replace(/\s*\([^)]*\)/g, "").trim();

          const itunesQuery = isVarious ? `${cleanTitle} soundtrack` : `${cleanArtist} ${cleanTitle}`;
          const response = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              itunesQuery.trim()
            )}&entity=album&limit=10`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              const fetchedUrls = data.results
                .filter((item: any) => {
                  if (!item.artworkUrl100) return false;
                  const collName = (item.collectionName || "").toLowerCase();
                  // Strict title match check (e.g. Grease must match Grease)
                  return collName.includes(mainKeyword) || mainKeyword.includes(collName);
                })
                .map((item: any) => item.artworkUrl100.replace("100x100bb", "600x600bb"));

              pool = Array.from(new Set(fetchedUrls));
            }
          }
        }

        setCandidateUrls(pool);
      }

      // No real match found anywhere — show the honest "no cover art" state
      // rather than silently substituting an unrelated stock photo.
      if (pool.length === 0) {
        setHasError(true);
        setStatusMessage("No match found");
        setTimeout(() => setStatusMessage(null), 2000);
        return;
      }

      // Find next candidate URL that is different from currentUrl
      let nextIdx = (candidateIndex + 1) % pool.length;
      let nextUrl = pool[nextIdx];

      if (nextUrl === currentUrl && pool.length > 1) {
        nextIdx = (nextIdx + 1) % pool.length;
        nextUrl = pool[nextIdx];
      }

      setCandidateIndex(nextIdx);
      setCurrentUrl(nextUrl);
      setHasError(false);
      setStatusMessage("New Image!");

      if (onImageChange) {
        onImageChange(nextUrl);
      }

      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err) {
      console.warn("Error fetching alternative album artwork:", err);
      setStatusMessage("Search failed");
      setTimeout(() => setStatusMessage(null), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative overflow-hidden group/cover ${className}`}>
      {/* Primary Image or Fallback */}
      {!hasError ? (
        <img
          src={currentUrl}
          alt={alt || `${albumTitle} by ${artist}`}
          className={`${imgClassName} pointer-events-none select-none`}
          draggable={false}
          onError={() => {
            setHasError(true);
          }}
        />
      ) : (
        <div className="w-full h-full rounded bg-[#EFEAE0] border border-[#D8D0C0] flex flex-col items-center justify-center p-1 text-center font-sans pointer-events-none select-none">
          <ImageOff className="w-5 h-5 text-[#A94A42] mb-1" />
          <span className="text-[9px] text-[#6B655B] font-medium leading-tight">Image error</span>
        </div>
      )}

      {/* Loading indicator overlay when fetching new image */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded flex flex-col items-center justify-center z-10 text-white font-sans">
          <RefreshCw className="w-4 h-4 text-[#D4AF37] animate-spin mb-1" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Fetching...</span>
        </div>
      )}

      {/* Status toast overlay */}
      {statusMessage && !isLoading && (
        <div className="absolute inset-x-0 bottom-0 bg-[#A94A42] text-white text-[9px] font-bold text-center py-0.5 px-1 z-10 flex items-center justify-center gap-1">
          <Check className="w-3 h-3" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Small Refresh Button - ALWAYS AVAILABLE on hover or tap, or prominently if error */}
      {showRefreshOverlay && (
        <div className="absolute bottom-1 right-1 z-10 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoFileChange}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsScanModalOpen(true);
            }}
            disabled={isLoading}
            className="p-1.5 rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center bg-black/75 hover:bg-[#2D4A3E] text-white opacity-80 group-hover/cover:opacity-100 hover:scale-110"
            title="Scan a photo of your own copy instead"
          >
            <Camera className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleFetchAlternativeImage}
            disabled={isLoading}
            className={`p-1.5 rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center ${
              hasError
                ? "bg-[#A94A42] text-white hover:bg-[#8E3E37] ring-2 ring-white scale-100 opacity-100"
                : "bg-black/75 hover:bg-[#A94A42] text-white opacity-80 group-hover/cover:opacity-100 hover:scale-110"
            }`}
            title="Tap to request another image reference / refresh cover art"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      <CoverScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onCapture={handleScanCapture}
        onFallbackToFile={() => fileInputRef.current?.click()}
      />
    </div>
  );
};
