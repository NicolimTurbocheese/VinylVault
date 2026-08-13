import React, { useState } from "react";
import {
  Search,
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  Disc3,
  ExternalLink,
  Award,
  PlusCircle,
  CheckCircle2,
  ListMusic,
  Info,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  FileText,
  Tag,
  Check,
  Archive,
  Barcode,
  BookmarkPlus
} from "lucide-react";
import { cleanFormatSpec } from "../utils/format";
import { normalizeDiscogsGenre } from "../utils/genre";
import {
  RecordScanResult,
  GoldmineGrade,
  GOLDMINE_GRADES,
  SearchQueryParams,
  ObiCondition,
  PackageInclusions,
  DetailedValuationBreakdown
} from "../types";
import { calculateAdjustedValuation, calculateCompleteValuation } from "../utils/valuation";
import { CameraModal } from "./CameraModal";
import { BarcodeScannerModal } from "./BarcodeScannerModal";
import { RecordCoverImage } from "./RecordCoverImage";

interface ScanSearchTabProps {
  onSaveToShelf: (result: RecordScanResult, mediaGrade: GoldmineGrade, sleeveGrade: GoldmineGrade) => void;
  onOpenAddToShelfModal: (result: RecordScanResult) => void;
}

export const ScanSearchTab: React.FC<ScanSearchTabProps> = ({
  onSaveToShelf,
  onOpenAddToShelfModal,
}) => {
  // Search form fields
  const [catalogueNumber, setCatalogueNumber] = useState("");
  const [matrixCode, setMatrixCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [recordLabel, setRecordLabel] = useState("");
  const [artistAlbum, setArtistAlbum] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<RecordScanResult | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  // Goldmine Grading & Copy Specifics state
  const [mediaGrade, setMediaGrade] = useState<GoldmineGrade>("VG+");
  const [sleeveGrade, setSleeveGrade] = useState<GoldmineGrade>("VG+");
  const [obiCondition, setObiCondition] = useState<ObiCondition>("N/A");
  const [packageInclusions, setPackageInclusions] = useState<PackageInclusions>({
    printedInnerSleeve: false,
    lyricsInsert: false,
    bookletLinerNotes: false,
    originalPoster: false,
    photosPostcards: false,
  });
  const [freeTextNotes, setFreeTextNotes] = useState<string>("");
  const [isUpdatingValuation, setIsUpdatingValuation] = useState<boolean>(false);
  const [valuationBreakdown, setValuationBreakdown] = useState<DetailedValuationBreakdown | null>(null);

  // Presets for quick trial
  const PRESET_SCRIPTS = [
    {
      title: "Ray Charles (Japan) — P-4580A",
      cat: "P-4580A",
      matrix: "P-4580A 1-A-11",
      barcode: "",
      label: "Atlantic / Warner-Pioneer Japan",
      artist: "Ray Charles - Ray Charles",
    },
    {
      title: "The Beatles — Abbey Road Barcode",
      cat: "PCS 7088",
      matrix: "YEX 749-2 / YEX 750-1",
      barcode: "0602577921124",
      label: "Apple Records",
      artist: "The Beatles - Abbey Road",
    },
    {
      title: "Pink Floyd — Dark Side Barcode",
      cat: "SHVL 804",
      matrix: "SHVL 804 A-2 / B-2",
      barcode: "0190296203664",
      label: "Harvest / Pink Floyd Records",
      artist: "Pink Floyd - Dark Side of the Moon",
    },
    {
      title: "Fleetwood Mac — Rumours Barcode",
      cat: "BSK 3010",
      matrix: "BSK-1-3010 F1",
      barcode: "0093624986958",
      label: "Warner Records",
      artist: "Fleetwood Mac - Rumours",
    },
    {
      title: "Miles Davis — Kind of Blue Barcode",
      cat: "CL 1355",
      matrix: "XLP-47324-1AD",
      barcode: "0886976856410",
      label: "Columbia / Legacy",
      artist: "Miles Davis - Kind of Blue",
    },
    {
      title: "Daft Punk — RAM Barcode",
      cat: "88883716861",
      matrix: "88883716861-A",
      barcode: "0602537286991",
      label: "Columbia Records",
      artist: "Daft Punk - Random Access Memories",
    },
    {
      title: "The Beatles (Japan) — EAS-50034",
      cat: "EAS-50034",
      matrix: "EAS-50034 1-A-1",
      barcode: "",
      label: "Toshiba EMI / Odeon Records",
      artist: "The Beatles - Beatles For Sale",
    },
  ];

  const handleApplyPreset = (preset: typeof PRESET_SCRIPTS[0]) => {
    setCatalogueNumber(preset.cat);
    setMatrixCode(preset.matrix);
    setBarcode(preset.barcode || "");
    setRecordLabel(preset.label);
    setArtistAlbum(preset.artist);
    setImageBase64(null);
  };

  // Helper to ensure format specs include size info (e.g., 12", 7", 10")
  const formatWithRecordSize = (rawFormat?: string) => {
    return cleanFormatSpec(rawFormat);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Final User Adjustment to Estimated Market Value (SGD)
  const [finalUserAdjustment, setFinalUserAdjustment] = useState<number>(0);
  // User Purchase Price Input (S$)
  const [purchasePriceInput, setPurchasePriceInput] = useState<string>("");
  // Acquisition Source Input
  const [acquisitionSourceInput, setAcquisitionSourceInput] = useState<string>("");
  // Verify Exact Pressing Deep Dive Bypass State
  const [matrixPromptBypassed, setMatrixPromptBypassed] = useState<boolean>(false);

  const handleOpenAddToShelfWithPrice = () => {
    if (!scanResult) return;
    const cNotes = scanResult.collectorNotes || scanResult.marketNotes;
    const rationale = valuationBreakdown?.valuationRationale;
    const noteSections: string[] = [];

    if (cNotes) {
      noteSections.push(`Collector Notes:\n${cNotes}`);
    }
    if (freeTextNotes.trim()) {
      noteSections.push(`Copy Characteristics & Free Text Notes:\n${freeTextNotes.trim()}`);
    }
    if (rationale && rationale !== cNotes) {
      noteSections.push(`Valuation Rationale:\n${rationale}`);
    }
    const combinedAutoNotes = noteSections.join("\n\n");

    const modifiedRecord = {
      ...scanResult,
      matrixCode: matrixCode.trim() || scanResult.matrixCode,
      barcode: barcode.trim() || scanResult.barcode,
      mediaGrade,
      sleeveGrade,
      obiCondition,
      initialPurchasePrice: purchasePriceInput ? parseFloat(purchasePriceInput) : undefined,
      initialStoreLocation: acquisitionSourceInput,
      initialAutoNotes: combinedAutoNotes,
      freeTextNotes: freeTextNotes.trim() || scanResult.freeTextNotes,
      initialValuationAdj: finalUserAdjustment,
    };
    onOpenAddToShelfModal(modifiedRecord as any);
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setFinalUserAdjustment(0);
    setPurchasePriceInput("");
    setAcquisitionSourceInput("");
    setMatrixPromptBypassed(false);

    if (!catalogueNumber && !matrixCode && !barcode && !recordLabel && !artistAlbum && !imageBase64) {
      setError("Please enter a Catalogue Number, Matrix Code, Barcode, or upload a vinyl image.");
      return;
    }

    setIsLoading(true);

    try {
      const payload: SearchQueryParams = {
        catalogueNumber: catalogueNumber.trim() || undefined,
        matrixCode: matrixCode.trim() || undefined,
        barcode: barcode.trim() || undefined,
        recordLabel: recordLabel.trim() || undefined,
        artistAlbum: artistAlbum.trim() || undefined,
        imageBase64: imageBase64 || undefined,
      };

      const res = await fetch("/api/identify-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to identify record pressing.");
      }

      const data: RecordScanResult = await res.json();
      setScanResult(data);

      const isJapan = (data.country || "").toLowerCase().includes("japan") ||
        (data.label || "").toLowerCase().includes("toshiba") ||
        (data.label || "").toLowerCase().includes("victor") ||
        (data.label || "").toLowerCase().includes("polydor k.k.");

      const currentObi = obiCondition;

      const initialCompleteVal = calculateCompleteValuation({
        baseMintValue: data.baseMintValue,
        mediaGrade,
        sleeveGrade,
        obiCondition: currentObi,
        packageInclusions,
        freeTextNotes,
      });
      setValuationBreakdown(initialCompleteVal);

      if (freeTextNotes.trim() || Object.values(packageInclusions).some(Boolean) || currentObi !== "N/A") {
        fetch("/api/recalculate-valuation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            albumTitle: data.albumTitle,
            artist: data.artist,
            label: data.label,
            catalogueNumber: data.catalogueNumber,
            baseMintValue: data.baseMintValue,
            mediaGrade,
            sleeveGrade,
            obiCondition: currentObi,
            packageInclusions,
            freeTextNotes,
          }),
        })
          .then((r) => r.json())
          .then((aiVal) => {
            if (aiVal && aiVal.finalValuation) {
              setValuationBreakdown(aiVal);
            }
          })
          .catch((e) => console.error("AI valuation recalculation error:", e));
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      setError(err.message || "An unexpected error occurred while searching marketplaces.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInclusion = (key: keyof PackageInclusions) => {
    const updatedInclusions = {
      ...packageInclusions,
      [key]: !packageInclusions[key],
    };
    setPackageInclusions(updatedInclusions);

    if (scanResult) {
      const updatedVal = calculateCompleteValuation({
        baseMintValue: scanResult.baseMintValue,
        mediaGrade,
        sleeveGrade,
        obiCondition,
        packageInclusions: updatedInclusions,
        freeTextNotes,
      });
      setValuationBreakdown(updatedVal);
    }
  };

  const handleMediaGradeChange = (g: GoldmineGrade) => {
    setMediaGrade(g);
    if (scanResult) {
      const updatedVal = calculateCompleteValuation({
        baseMintValue: scanResult.baseMintValue,
        mediaGrade: g,
        sleeveGrade,
        obiCondition,
        packageInclusions,
        freeTextNotes,
      });
      setValuationBreakdown(updatedVal);
    }
  };

  const handleSleeveGradeChange = (g: GoldmineGrade) => {
    setSleeveGrade(g);
    if (scanResult) {
      const updatedVal = calculateCompleteValuation({
        baseMintValue: scanResult.baseMintValue,
        mediaGrade,
        sleeveGrade: g,
        obiCondition,
        packageInclusions,
        freeTextNotes,
      });
      setValuationBreakdown(updatedVal);
    }
  };

  const handleObiConditionChange = (c: ObiCondition) => {
    setObiCondition(c);
    if (scanResult) {
      const updatedVal = calculateCompleteValuation({
        baseMintValue: scanResult.baseMintValue,
        mediaGrade,
        sleeveGrade,
        obiCondition: c,
        packageInclusions,
        freeTextNotes,
      });
      setValuationBreakdown(updatedVal);
    }
  };

  const handleUpdateValuation = async () => {
    if (!scanResult) return;
    setIsUpdatingValuation(true);
    try {
      const res = await fetch("/api/recalculate-valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumTitle: scanResult.albumTitle,
          artist: scanResult.artist,
          catalogueNumber: scanResult.catalogueNumber,
          country: scanResult.country,
          label: scanResult.label,
          baseMintValue: scanResult.baseMintValue,
          mediaGrade,
          sleeveGrade,
          obiCondition,
          packageInclusions,
          freeTextNotes,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to recalculate valuation.");
      }

      const data: DetailedValuationBreakdown = await res.json();
      setValuationBreakdown(data);
    } catch (err: any) {
      console.error("Valuation update error:", err);
    } finally {
      setIsUpdatingValuation(false);
    }
  };

  const handleReset = () => {
    setCatalogueNumber("");
    setMatrixCode("");
    setBarcode("");
    setRecordLabel("");
    setArtistAlbum("");
    setImageBase64(null);
    setScanResult(null);
    setValuationBreakdown(null);
    setFreeTextNotes("");
    setObiCondition("N/A");
    setPackageInclusions({
      printedInnerSleeve: false,
      lyricsInsert: false,
      bookletLinerNotes: false,
      originalPoster: false,
      photosPostcards: false,
    });
    setFinalUserAdjustment(0);
    setPurchasePriceInput("");
    setAcquisitionSourceInput("");
    setMatrixPromptBypassed(false);
    setError(null);
  };

  // Default baseline valuation before UPDATE is clicked
  const adjustedValuation = scanResult
    ? calculateAdjustedValuation(scanResult.baseMintValue, mediaGrade, sleeveGrade)
    : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Search & Identification Form Section */}
      <div className="relative rounded-lg bg-[#161616] border border-[#D4AF37]/20 p-5 sm:p-8 shadow-2xl overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-serif font-bold text-[#2B2B2B] tracking-wide">Record Scanner & Identifier</h2>
            <p className="text-xs font-sans text-[#6B655B] mt-0.5">
              Identify pressing details & search live market sales (Discogs, eBay, Popsike)
            </p>
          </div>

          {(catalogueNumber || matrixCode || artistAlbum || imageBase64 || scanResult) && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-[#D4AF37] hover:bg-white/5 border border-white/10 rounded flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="space-y-6">
          {/* Main Search Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Catalogue Number - Highlighted Primary Field */}
            <div className="relative col-span-1 md:col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#A94A42] mb-1.5 flex items-center gap-1.5 font-sans">
                <Sparkles className="w-3.5 h-3.5 text-[#A94A42]" />
                Catalogue Number (Primary Priority)
              </label>
              <input
                type="text"
                placeholder="e.g. SHVL 804, PCS 7088, CL 1355, BSK 3010"
                value={catalogueNumber}
                onChange={(e) => setCatalogueNumber(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-4 py-3 text-sm font-sans focus:outline-none focus:border-[#A94A42] transition shadow-xs"
              />
            </div>

            {/* Matrix / Runout Groove Code */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2B2B2B] mb-1.5 font-sans">
                Inner Runout Groove (Matrix Code)
              </label>
              <input
                type="text"
                placeholder="e.g. SHVL 804 A-2, YEX 749-2, ST-A-712285"
                value={matrixCode}
                onChange={(e) => setMatrixCode(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-4 py-2.5 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2B2B2B] mb-1.5 font-sans">
                Barcode
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 0602577921124, 0190296203664"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-4 py-2.5 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
                />
                <button
                  type="button"
                  onClick={() => setIsBarcodeScannerOpen(true)}
                  className="px-3.5 py-2 bg-[#A94A42] text-white hover:bg-[#8E3E37] rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition shrink-0 cursor-pointer shadow-sm"
                  title="Scan physical vinyl barcode with camera"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Record Label */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2B2B2B] mb-1.5 font-sans">
                Record Label
              </label>
              <input
                type="text"
                placeholder="e.g. Harvest, Apple Records, Columbia, Blue Note"
                value={recordLabel}
                onChange={(e) => setRecordLabel(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-4 py-2.5 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
              />
            </div>

            {/* Artist & Album Title */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2B2B2B] mb-1.5 font-sans">
                Artist & Album Title (Optional Keyword)
              </label>
              <input
                type="text"
                placeholder="e.g. Pink Floyd - Dark Side of the Moon, Miles Davis - Kind of Blue"
                value={artistAlbum}
                onChange={(e) => setArtistAlbum(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-4 py-2.5 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
              />
            </div>
          </div>

          {/* Image Capture & File Upload Section */}
          <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {imageBase64 ? (
                <div className="relative group">
                  <img
                    src={imageBase64}
                    alt="Uploaded vinyl runout/label"
                    className="w-16 h-16 rounded-md object-cover border border-[#A94A42] shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setImageBase64(null)}
                    className="absolute -top-2 -right-2 bg-[#A94A42] text-white rounded-full p-1 text-[10px] hover:bg-[#8E3E37] transition shadow"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-md bg-[#EFEAE0] border border-dashed border-[#D8D0C0] flex flex-col items-center justify-center text-[#6B655B]">
                  <ImageIcon className="w-5 h-5 text-[#6B655B]" />
                  <span className="text-[9px] font-sans mt-1">Photo</span>
                </div>
              )}
              <div className="text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2B2B2B] block font-sans">
                  {imageBase64 ? "Image Attached" : "Upload or Snap Photo"}
                </span>
                <span className="text-[11px] font-sans text-[#6B655B]">
                  Scan album cover, center label, or runout groove deadwax
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end font-sans">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider bg-[#A94A42] text-white hover:bg-[#8E3E37] transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
                <span>Live Camera</span>
              </button>

              <label className="flex-1 sm:flex-initial px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider bg-[#A94A42] text-white hover:bg-[#8E3E37] flex items-center justify-center gap-2 cursor-pointer transition shadow-sm">
                <Upload className="w-3.5 h-3.5 text-white" />
                <span>Choose File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Single-Step Flow: Pre-Select Condition Grading & Copy Inclusions */}
          <div className="p-4 sm:p-5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E2DCD0] pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#A94A42] font-sans flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#A94A42]" />
                  <span>Condition Grading & Copy Inclusions</span>
                </h3>
                <p className="text-[11px] font-sans text-[#6B655B] mt-0.5">
                  Pre-select physical condition & package items for instant single-step valuation:
                </p>
              </div>
            </div>

            {/* Media, Sleeve, OBI Grade Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Media Grade */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B655B] mb-1.5 block font-sans">
                  Media Condition
                </label>
                <div className="flex gap-1">
                  {(Object.keys(GOLDMINE_GRADES) as GoldmineGrade[]).map((g) => {
                    const isSelected = mediaGrade === g;
                    return (
                      <button
                        key={`top-m-${g}`}
                        type="button"
                        onClick={() => handleMediaGradeChange(g)}
                        className={`flex-1 py-1.5 rounded-md text-[11px] font-sans font-bold uppercase transition border cursor-pointer ${
                          isSelected
                            ? "border-[#A94A42] text-[#A94A42] bg-[#A94A42]/10 shadow-xs"
                            : "border-[#D8D0C0] text-[#2B2B2B] bg-white hover:border-[#A94A42] shadow-xs"
                        }`}
                      >
                        {g === "F_P" ? "F/P" : g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sleeve Grade */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B655B] mb-1.5 block font-sans">
                  Sleeve Condition
                </label>
                <div className="flex gap-1">
                  {(Object.keys(GOLDMINE_GRADES) as GoldmineGrade[]).map((g) => {
                    const isSelected = sleeveGrade === g;
                    return (
                      <button
                        key={`top-s-${g}`}
                        type="button"
                        onClick={() => handleSleeveGradeChange(g)}
                        className={`flex-1 py-1.5 rounded-md text-[11px] font-sans font-bold uppercase transition border cursor-pointer ${
                          isSelected
                            ? "border-[#A94A42] text-[#A94A42] bg-[#A94A42]/10 shadow-xs"
                            : "border-[#D8D0C0] text-[#2B2B2B] bg-white hover:border-[#A94A42] shadow-xs"
                        }`}
                      >
                        {g === "F_P" ? "F/P" : g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OBI Condition */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B655B] mb-1.5 block font-sans">
                  OBI Strip Condition
                </label>
                <div className="flex gap-1">
                  {(["N/A", "M", "NM", "VG+", "VG", "G", "F_P"] as ObiCondition[]).map((g) => {
                    const isSelected = obiCondition === g;
                    return (
                      <button
                        key={`top-o-${g}`}
                        type="button"
                        onClick={() => handleObiConditionChange(g)}
                        className={`flex-1 py-1.5 px-0.5 rounded-md text-[11px] font-sans font-bold uppercase transition border cursor-pointer ${
                          isSelected
                            ? "border-[#A94A42] text-[#A94A42] bg-[#A94A42]/10 shadow-xs"
                            : "border-[#D8D0C0] text-[#2B2B2B] bg-white hover:border-[#A94A42] shadow-xs"
                        }`}
                      >
                        {g === "F_P" ? "F/P" : g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Physical Package Inclusions Checklist */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B655B] mb-2 block font-sans">
                Physical Package Inclusions Checklist
              </label>
              <div className="flex flex-wrap gap-2 font-sans">
                {[
                  { key: "lyricsInsert", label: "Lyrics Insert / Sheet" },
                  { key: "printedInnerSleeve", label: "Printed Inner Sleeve" },
                  { key: "bookletLinerNotes", label: "Booklet / Liner Notes" },
                  { key: "originalPoster", label: "Original Poster" },
                  { key: "photosPostcards", label: "Photos / Postcards" },
                ].map((item) => {
                  const isChecked = packageInclusions[item.key as keyof PackageInclusions];
                  return (
                    <button
                      key={`top-inc-${item.key}`}
                      type="button"
                      onClick={() => toggleInclusion(item.key as keyof PackageInclusions)}
                      className={`py-1.5 px-3 rounded-md text-xs font-sans font-medium transition border cursor-pointer select-none ${
                        isChecked
                          ? "border-[#A94A42] text-[#A94A42] bg-[#A94A42]/10 font-bold shadow-xs"
                          : "border-[#D8D0C0] text-[#2B2B2B] bg-white hover:border-[#A94A42] shadow-xs"
                      }`}
                    >
                      {isChecked ? `✓ ${item.label}` : item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free Text / Copy Characteristics */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B655B] mb-1.5 block font-sans">
                Copy Characteristics & Specific Notes
              </label>
              <textarea
                rows={2}
                value={freeTextNotes}
                onChange={(e) => setFreeTextNotes(e.target.value)}
                placeholder="e.g., Sample copy / 見本盤, Everclean red wax, autographed by artist on cover, white label promo, minor edge warp on Side A, hairline scratch..."
                className="w-full bg-white border border-[#D8D0C0] text-[#2B2B2B] font-sans rounded-md p-2.5 text-xs focus:outline-none focus:border-[#A94A42] transition resize-none placeholder-[#8C857B] shadow-xs"
              />
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-4 rounded-md bg-[#FDF2F0] border border-[#A94A42]/30 border-l-4 border-l-[#A94A42] text-[#8E3E37] text-xs font-sans font-semibold flex items-center gap-3 shadow-xs animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-[#A94A42] shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded bg-[#D4AF37] hover:bg-[#FFBF00] text-black font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
          >
            {isLoading ? (
              <>
                <Disc3 className="w-4 h-4 animate-spin" />
                <span>Searching Live Marketplaces & Discogs Archives...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Scan & Identify Pressing Valuation</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Verify Exact Pressing Toggle (Deep Dive) Banner if multiple pressing variants found */}
      {scanResult &&
        !matrixPromptBypassed &&
        (scanResult.isAmbiguous || (scanResult.pressingsFoundCount && scanResult.pressingsFoundCount > 1)) &&
        (!matrixCode || matrixCode.trim() === "") && (
          <div className="p-5 rounded-lg bg-[#EFEAE0] border border-[#A94A42]/30 border-l-4 border-l-[#A94A42] text-[#2B2B2B] shadow-md space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-[#A94A42]/10 text-[#A94A42] mt-0.5 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold font-serif text-sm text-[#A94A42] flex items-center gap-2">
                    <span>Verify Exact Pressing (Deep Dive)</span>
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#A94A42]/15 border border-[#A94A42]/30 text-[#A94A42] uppercase font-bold">
                      {scanResult.pressingsFoundCount || 12} Variants
                    </span>
                  </h4>
                  <p className="text-xs font-sans text-[#6B655B] mt-1 max-w-2xl leading-relaxed">
                    We found {scanResult.pressingsFoundCount || 12} pressing variants for this catalog number. Enter the matrix code for better valuation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMatrixPromptBypassed(true)}
                className="px-3.5 py-1.5 rounded-md bg-[#FAF8F3] hover:bg-[#E2DCD0] border border-[#D8D0C0] text-[#6B655B] hover:text-[#2B2B2B] font-sans text-xs flex items-center gap-1.5 transition whitespace-nowrap self-end sm:self-auto cursor-pointer font-medium"
              >
                <span>✕ Bypass & Use Current Value</span>
              </button>
            </div>

            <div className="p-3 rounded-md bg-[#FAF8F3] border border-[#D8D0C0] flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:flex-1">
                <input
                  type="text"
                  placeholder="Enter Matrix / Runout Groove Code (e.g. SHVL 804 A-2)"
                  value={matrixCode}
                  onChange={(e) => setMatrixCode(e.target.value)}
                  className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] font-sans rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42]"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-3 py-2 rounded-md bg-[#EFEAE0] text-[#A94A42] border border-[#A94A42]/40 hover:bg-[#A94A42] hover:text-white font-sans text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snap Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white font-sans text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-white" />
                  <span>Refine Valuation</span>
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Identified Record Result Card */}
      {scanResult && (
        <div className="rounded-lg bg-[#161616] border border-[#D4AF37]/20 p-6 sm:p-8 shadow-2xl space-y-8 animate-fade-in">
          {/* Header & Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Artwork */}
            <div className="md:col-span-4 flex flex-col items-center">
              <div className="relative group w-full max-w-xs aspect-square rounded-lg overflow-hidden bg-[#1A1A1A] border border-[#D4AF37]/30 shadow-2xl">
                <RecordCoverImage
                  src={scanResult.coverArtUrl}
                  artist={scanResult.artist}
                  albumTitle={scanResult.albumTitle}
                  catalogueNumber={scanResult.catalogueNumber}
                  onImageChange={(newUrl) =>
                    setScanResult((prev) => (prev ? { ...prev, coverArtUrl: newUrl } : null))
                  }
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 pointer-events-none" />
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur px-3 py-1 border border-[#D4AF37]/30 text-[10px] tracking-[0.2em] font-mono font-bold uppercase text-[#D4AF37] pointer-events-none">
                  Pressing Confirmed
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="md:col-span-8 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {(() => {
                    const normG = normalizeDiscogsGenre(scanResult.genre, scanResult.styles);
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-[11px] uppercase tracking-wider">
                          {normG.genre}
                        </span>
                        {normG.styles.map((style, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300 font-mono text-[10px]">
                            {style}
                          </span>
                        ))}
                        {scanResult.liveSearchEngine && (
                          <span className="text-[9px] font-mono font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm flex items-center gap-1 ml-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Live Grounded Research ({scanResult.queryDurationMs ? `${(scanResult.queryDurationMs / 1000).toFixed(1)}s` : 'Real-time'})</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
                    {scanResult.albumTitle}
                  </h1>
                  <h2 className="text-xl sm:text-2xl font-serif text-[#D4AF37] font-light mt-1">
                    {scanResult.artist}
                  </h2>
                </div>

                <button
                  onClick={handleOpenAddToShelfWithPrice}
                  className="px-4 py-2.5 rounded bg-[#D4AF37] hover:bg-[#FFBF00] text-black font-bold uppercase text-xs tracking-widest flex items-center gap-2 transition whitespace-nowrap shadow-md cursor-pointer"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>Save to Shelf</span>
                </button>
              </div>

              {/* Pressing Metadata Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1 font-mono">
                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Catalogue #</span>
                  <span className="text-xs font-bold text-[#D4AF37] break-words block leading-relaxed">
                    {scanResult.catalogueNumber || "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Matrix Code</span>
                  <span className="text-xs font-bold text-[#D4AF37] break-words block leading-relaxed">
                    {scanResult.matrixCode || "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Barcode</span>
                  <span className="text-xs font-bold text-amber-200 break-words block leading-relaxed flex items-center gap-1">
                    <Barcode className="w-3 h-3 text-[#D4AF37] shrink-0" />
                    <span>{scanResult.barcode || barcode || "N/A"}</span>
                  </span>
                </div>

                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Label, Country & Year</span>
                  <span className="text-xs text-zinc-300 break-words font-medium block leading-relaxed">
                    {scanResult.label} ({scanResult.country || "US"}, {scanResult.releaseYear || "N/A"})
                  </span>
                </div>

                <div className="p-3 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Format Specs</span>
                  <span className="text-xs text-zinc-200 break-words font-medium block leading-relaxed">
                    {formatWithRecordSize(scanResult.format)}
                  </span>
                </div>
              </div>

              {/* Market Notes */}
              {scanResult.marketNotes && (
                <div className="p-3.5 rounded bg-black/60 border border-white/10 text-xs text-zinc-300 leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#D4AF37] uppercase tracking-wider text-[11px]">Collector Notes: </span>
                    {scanResult.marketNotes}
                  </div>
                </div>
              )}
            </div>
          </div>



          {/* DISPLAYED RESULTS: Baseline Price + Additional Adjustments + Final Value */}
          {(() => {
            const rawFinalLow = valuationBreakdown ? valuationBreakdown.finalValuation.low : (adjustedValuation ? adjustedValuation.low : 0);
            const rawFinalMedian = valuationBreakdown ? valuationBreakdown.finalValuation.median : (adjustedValuation ? adjustedValuation.median : 0);
            const rawFinalHigh = valuationBreakdown ? valuationBreakdown.finalValuation.high : (adjustedValuation ? adjustedValuation.high : 0);

            const computedFinalLow = Math.max(0, rawFinalLow + finalUserAdjustment);
            const computedFinalMedian = Math.max(0, rawFinalMedian + finalUserAdjustment);
            const computedFinalHigh = Math.max(0, rawFinalHigh + finalUserAdjustment);

            return (
              <div className="p-6 rounded-lg bg-[#161616] border border-[#D4AF37]/40 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#FFBF00]" />
                    <h3 className="font-bold text-xs uppercase tracking-widest text-[#FFBF00]">
                      Valuation Results & Adjustment Analysis
                    </h3>
                  </div>
                </div>

                {/* 1. Baseline Price Based on Condition Grading */}
                <div className="p-4 rounded bg-black/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                      1. Baseline Price (Condition Grading: {mediaGrade} Media / {sleeveGrade} Sleeve)
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      S${(valuationBreakdown?.baselineValue || adjustedValuation!).median}.00
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 gap-2">
                    <span>Mint Base Value Range: S${scanResult.baseMintValue.low} - S${scanResult.baseMintValue.high}</span>
                    <span className="text-[#D4AF37] font-bold">Condition Baseline Range: S${(valuationBreakdown?.baselineValue || adjustedValuation!).low} - S${(valuationBreakdown?.baselineValue || adjustedValuation!).high}</span>
                  </div>
                </div>

                {/* 2. Additional Increased / Decreased Value Breakdown (OBI + Package Inclusions + Free Text Notes) */}
                {(valuationBreakdown?.obiAdjustment || (valuationBreakdown?.inclusionsAdjustments && valuationBreakdown.inclusionsAdjustments.length > 0) || (valuationBreakdown?.freeTextAdjustments && valuationBreakdown.freeTextAdjustments.length > 0)) ? (
                  <div className="p-4 rounded bg-black/60 border border-[#D4AF37]/30 space-y-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#FFBF00] block">
                      2. Package Inclusions & Copy Specific Adjustments
                    </span>

                    <div className="space-y-2">
                      {/* OBI Adjustment */}
                      {valuationBreakdown.obiAdjustment && (
                        <div className="flex items-center justify-between p-2.5 rounded bg-[#1C1A14] border border-[#D4AF37]/30 text-xs font-mono">
                          <div>
                            <span className="font-bold text-white block">{valuationBreakdown.obiAdjustment.feature}</span>
                            {valuationBreakdown.obiAdjustment.explanation && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">{valuationBreakdown.obiAdjustment.explanation}</p>
                            )}
                          </div>
                          <div className={`font-bold px-2 py-1 rounded text-xs ${
                            valuationBreakdown.obiAdjustment.impactType === 'increase'
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : valuationBreakdown.obiAdjustment.impactType === 'decrease'
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-zinc-800 text-zinc-300"
                          }`}>
                            {valuationBreakdown.obiAdjustment.amountSGD >= 0 ? `+S$${valuationBreakdown.obiAdjustment.amountSGD}` : `-S$${Math.abs(valuationBreakdown.obiAdjustment.amountSGD)}`}
                            {valuationBreakdown.obiAdjustment.percentage ? ` (${valuationBreakdown.obiAdjustment.percentage >= 0 ? '+' : ''}${valuationBreakdown.obiAdjustment.percentage}%)` : ''}
                          </div>
                        </div>
                      )}

                      {/* Package Inclusions Itemized Adjustments */}
                      {valuationBreakdown.inclusionsAdjustments?.map((adj, idx) => (
                        <div key={`inc-${idx}`} className="flex items-center justify-between p-2.5 rounded bg-[#181818] border border-[#D4AF37]/20 text-xs font-mono">
                          <div>
                            <span className="font-bold text-[#D4AF37] block">{adj.feature}</span>
                            {adj.explanation && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">{adj.explanation}</p>
                            )}
                          </div>
                          <div className="font-bold px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap ml-2">
                            {adj.amountSGD >= 0 ? `+S$${adj.amountSGD}` : `-S$${Math.abs(adj.amountSGD)}`}
                            {adj.percentage ? ` (+${adj.percentage}%)` : ''}
                          </div>
                        </div>
                      ))}

                      {/* Free Text Itemized Adjustments */}
                      {valuationBreakdown.freeTextAdjustments?.map((adj, idx) => (
                        <div key={`ft-${idx}`} className="flex items-center justify-between p-2.5 rounded bg-[#181818] border border-white/10 text-xs font-mono">
                          <div>
                            <span className="font-bold text-white block">{adj.feature}</span>
                            {adj.explanation && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">{adj.explanation}</p>
                            )}
                          </div>
                          <div className={`font-bold px-2 py-1 rounded text-xs whitespace-nowrap ml-2 ${
                            adj.impactType === 'increase'
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : adj.impactType === 'decrease'
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-zinc-800 text-zinc-300"
                          }`}>
                            {adj.amountSGD >= 0 ? `+S$${adj.amountSGD}` : `-S$${Math.abs(adj.amountSGD)}`}
                            {adj.percentage ? ` (${adj.percentage >= 0 ? '+' : ''}${adj.percentage}%)` : ''}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Net Adjustment summary line */}
                    <div className="flex justify-between items-center pt-2 border-t border-white/10 text-xs font-mono">
                      <span className="text-zinc-400 font-bold">Net Additional Copy Adjustment:</span>
                      <span className={`font-bold ${
                        (valuationBreakdown.netAdditionalAdjustmentSGD || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {(valuationBreakdown.netAdditionalAdjustmentSGD || 0) >= 0 ? `+S$${valuationBreakdown.netAdditionalAdjustmentSGD}` : `-S$${Math.abs(valuationBreakdown.netAdditionalAdjustmentSGD)}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded bg-black/40 border border-white/5 text-xs font-mono text-zinc-400 flex items-center justify-between">
                    <span>No additional OBI or copy adjustments applied yet.</span>
                    <span className="text-[#D4AF37] text-[11px] font-bold">Select OBI / enter details and click UPDATE</span>
                  </div>
                )}

                {/* 3. Final Total Estimated Market Valuation & User Adjustment */}
                <div className="p-6 rounded-lg bg-[#FAF8F3] border-2 border-[#A94A42] space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wider text-[#A94A42] font-sans font-bold mb-1">
                        Final Estimated Market Value
                      </span>
                      <span className="text-4xl sm:text-5xl font-serif font-bold text-[#2B2B2B] tracking-tight">
                        S${computedFinalMedian}.00
                      </span>
                    </div>

                    <div className="sm:text-right font-sans">
                      <span className="block text-[10px] uppercase tracking-wider text-[#6B655B] mb-1 font-bold">
                        Market Value Range
                      </span>
                      <span className="text-sm font-bold text-[#2D4A3E] px-3.5 py-1 rounded-full bg-[#8FA89B]/25 border border-[#8FA89B]/50 inline-block">
                        S${computedFinalLow} - S${computedFinalHigh}
                      </span>
                    </div>
                  </div>

                  {/* User Final Adjustment Input */}
                  <div className="pt-3 border-t border-[#E2DCD0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans">
                    <div>
                      <span className="block text-[11px] font-bold text-[#A94A42] uppercase tracking-wider">
                        Final Market Value Adjustment (S$)
                      </span>
                      <span className="text-[10px] text-[#6B655B]">
                        Fine-tune final estimated market valuation (+ / - SGD)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#6B655B] font-bold">± S$</span>
                      <input
                        type="number"
                        step="1"
                        value={finalUserAdjustment === 0 ? "" : finalUserAdjustment}
                        onChange={(e) => setFinalUserAdjustment(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-28 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-bold font-sans rounded-md px-3 py-1.5 text-xs text-right focus:outline-none focus:border-[#A94A42]"
                      />
                    </div>
                  </div>

                  {/* Rationale notes */}
                  {(valuationBreakdown?.valuationRationale || scanResult.marketNotes) && (
                    <div className="pt-2 text-xs font-sans text-[#2B2B2B] border-t border-[#E2DCD0] leading-relaxed">
                      <span className="text-[#A94A42] font-bold">Valuation Rationale: </span>
                      {valuationBreakdown?.valuationRationale || scanResult.marketNotes}
                    </div>
                  )}
                </div>

                {/* 1) Purchase Price (Insert after final estimated market value box) */}
                <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] space-y-2.5 font-sans shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-[#A94A42] font-sans font-bold mb-1">
                        Purchase Price (S$)
                      </span>
                      <span className="text-[10px] text-[#6B655B]">
                        Enter purchase price in SGD to calculate estimated profit/loss
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#A94A42] font-bold">S$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchasePriceInput}
                        onChange={(e) => setPurchasePriceInput(e.target.value)}
                        placeholder="0.00"
                        className="w-32 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-bold font-sans rounded-md px-3 py-1.5 text-xs text-right focus:outline-none focus:border-[#A94A42]"
                      />
                    </div>
                  </div>
                </div>

                {/* 1.5) Acquisition Source (Insert after purchase price) */}
                <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] space-y-2.5 font-sans shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-[#A94A42] font-sans font-bold mb-1">
                        Acquisition Source
                      </span>
                      <span className="text-[10px] text-[#6B655B]">
                        Where/from whom was this record acquired? (e.g. Red Point Record Warehouse, Discogs)
                      </span>
                    </div>
                    <div className="w-full sm:w-auto">
                      <input
                        type="text"
                        value={acquisitionSourceInput}
                        onChange={(e) => setAcquisitionSourceInput(e.target.value)}
                        placeholder="e.g. Store, Dealer, Discogs..."
                        className="w-full sm:w-64 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-[#A94A42]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2) Estimated Loss / Profit Card */}
                {(() => {
                  const pNum = purchasePriceInput !== "" && !isNaN(parseFloat(purchasePriceInput)) ? parseFloat(purchasePriceInput) : null;
                  if (pNum === null) return null;

                  const pLoss = computedFinalMedian - pNum;
                  const pPct = pNum > 0 ? ((pLoss / pNum) * 100).toFixed(1) : null;

                  return (
                    <div className={`p-4 rounded-lg border space-y-3 font-sans shadow-sm ${
                      pLoss > 0
                        ? "bg-[#8FA89B]/15 border-[#8FA89B]/40"
                        : pLoss < 0
                        ? "bg-[#A94A42]/10 border-[#A94A42]/30"
                        : "bg-[#EFEAE0] border-[#E2DCD0]"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#2B2B2B] uppercase tracking-wider flex items-center gap-2">
                          {pLoss >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-[#2D4A3E]" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-[#A94A42]" />
                          )}
                          Estimated Profit / Loss Analysis
                        </span>
                        {pPct !== null && (
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            pLoss > 0
                              ? "bg-[#8FA89B]/30 text-[#2D4A3E] border-[#8FA89B]/50"
                              : pLoss < 0
                              ? "bg-[#A94A42]/20 text-[#A94A42] border-[#A94A42]/30"
                              : "bg-[#EFEAE0] text-[#6B655B] border-[#E2DCD0]"
                          }`}>
                            {pLoss > 0 ? `+${pPct}% ROI` : `${pPct}% ROI`}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-[#E2DCD0] gap-3">
                        <div>
                          <span className="text-[10px] text-[#6B655B] uppercase block mb-0.5">Estimated Net Profit / Loss</span>
                          <div className={`text-2xl sm:text-3xl font-serif font-bold ${
                            pLoss > 0 ? "text-[#2D4A3E]" : pLoss < 0 ? "text-[#A94A42]" : "text-[#2B2B2B]"
                          }`}>
                            {pLoss > 0
                              ? `+S$${pLoss.toFixed(2)} Profit`
                              : pLoss < 0
                              ? `-S$${Math.abs(pLoss).toFixed(2)} Loss`
                              : "S$0.00 Break Even"}
                          </div>
                        </div>

                        <div className="text-left sm:text-right text-[11px] text-[#2B2B2B] space-y-1 font-sans">
                          <div>Purchase Price: <span className="text-[#2B2B2B] font-bold">S${pNum.toFixed(2)}</span></div>
                          <div>Est. Market Value: <span className="text-[#A94A42] font-bold">S${computedFinalMedian}.00</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3) Additional and same "Save to Shelf" button after "Estimated loss/profit" */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E2DCD0]">
                  <span className="text-xs text-[#6B655B] font-sans">
                    Ready to organize this vinyl press into your physical shelf?
                  </span>
                  <button
                    onClick={handleOpenAddToShelfWithPrice}
                    className="w-full sm:w-auto px-6 py-3 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition shadow-sm font-sans cursor-pointer"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Save to Shelf</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Tracklist & Live Marketplace Citations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tracklist */}
            <div className="p-5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#E2DCD0]">
                <ListMusic className="w-4 h-4 text-[#A94A42]" />
                <h4 className="text-[#A94A42] text-xs font-bold uppercase tracking-wider font-sans">Tracklist</h4>
              </div>
              {scanResult.tracklist && scanResult.tracklist.length > 0 ? (
                <div className="space-y-2 font-sans text-xs text-[#2B2B2B]">
                  {scanResult.tracklist.map((track, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between py-1.5 border-b border-[#E2DCD0]/60 hover:text-[#A94A42] transition"
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                        <span className="text-[#A94A42] font-bold w-7 shrink-0">
                          {track.position}
                        </span>
                        <span className="break-words font-medium leading-relaxed">{track.title}</span>
                      </div>
                      {track.duration && (
                        <span className="text-[#6B655B] text-[11px] shrink-0 font-sans pl-2">
                          {track.duration}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B655B] font-sans">Tracklist details unavailable for this scan.</p>
              )}
            </div>

            {/* Live Search Grounding Sources */}
            <div className="p-5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] space-y-3 shadow-sm">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E2DCD0]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#A94A42]" />
                  <h4 className="text-[#A94A42] text-xs font-bold uppercase tracking-wider font-sans">
                    Live Market Citations
                  </h4>
                </div>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20 uppercase font-bold">
                  eBay & Verified Sources
                </span>
              </div>

              <div className="space-y-2.5">
                {scanResult.groundingSources && scanResult.groundingSources.length > 0 ? (
                  scanResult.groundingSources.map((source, idx) => {
                    const isEbay = source.uri?.includes("ebay.com") || source.source?.toLowerCase().includes("ebay");
                    const isDiscogs = source.uri?.includes("discogs.com") || source.source?.toLowerCase().includes("discogs");
                    const isMusicBrainz = source.uri?.includes("musicbrainz.org") || source.source?.toLowerCase().includes("musicbrainz");

                    return (
                      <a
                        key={idx}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-3 rounded-md bg-[#EFEAE0] border border-[#D8D0C0] hover:border-[#A94A42] hover:bg-[#FAF8F3] text-[#2B2B2B] hover:text-[#A94A42] font-sans transition group gap-2 shadow-sm"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isEbay ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#EFEAE0] text-[#2B2B2B] border border-[#D8D0C0] shrink-0 font-sans">
                                eBay Sold Data
                              </span>
                            ) : isMusicBrainz ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#8FA89B]/25 text-[#2D4A3E] border border-[#8FA89B]/50 shrink-0 font-sans">
                                MusicBrainz
                              </span>
                            ) : isDiscogs ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#A94A42]/15 text-[#A94A42] border border-[#A94A42]/30 shrink-0 font-sans">
                                Discogs
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#EFEAE0] text-[#6B655B] border border-[#D8D0C0] shrink-0 font-sans">
                                Archive
                              </span>
                            )}
                            <span className="truncate font-semibold text-[#2B2B2B] group-hover:text-[#A94A42]">
                              {source.title}
                            </span>
                          </div>

                          {(source.price || source.dateSold || source.condition) && (
                            <div className="flex items-center gap-3 text-[10px] text-[#6B655B] flex-wrap pt-0.5 font-sans">
                              {source.price && (
                                <span className="text-[#2D4A3E] font-bold bg-[#8FA89B]/25 px-2 py-0.5 rounded-full border border-[#8FA89B]/50">
                                  {source.price}
                                </span>
                              )}
                              {source.condition && (
                                <span className="text-[#2B2B2B]">
                                  Condition: <strong className="text-[#A94A42]">{source.condition}</strong>
                                </span>
                              )}
                              {source.dateSold && (
                                <span className="text-[#6B655B]">
                                  Date: {source.dateSold}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-[#6B655B] group-hover:text-[#A94A42] self-end sm:self-center" />
                      </a>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#6B655B] font-sans">
                    Live search results synthesized from eBay completed sales, Discogs & MusicBrainz.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => {
          setImageBase64(dataUrl);
          setIsCameraOpen(false);
        }}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onDetected={(scannedBarcode) => {
          setBarcode(scannedBarcode);
          setIsBarcodeScannerOpen(false);
        }}
      />
    </div>
  );
};
