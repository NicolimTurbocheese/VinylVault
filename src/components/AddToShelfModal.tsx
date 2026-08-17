import React, { useState, useEffect, useRef } from "react";
import { X, Save, DollarSign, MapPin, Bookmark, BookmarkPlus, Award, Tag, TrendingUp, TrendingDown, Package, Plus, Calendar, RefreshCw, Settings2, Sparkles, History, ListMusic } from "lucide-react";
import { RecordScanResult, GoldmineGrade, GOLDMINE_GRADES, ShelfItem, ObiCondition, PackageInclusions, VinylBox, UNCATEGORISED_BOX_ID } from "../types";
import { calculateAdjustedValuation, calculateCompleteValuation } from "../utils/valuation";
import { cleanFormatSpec } from "../utils/format";
import { normalizeDiscogsGenre, DISCOGS_MACRO_GENRES } from "../utils/genre";
import { ACQUISITION_COUNTRIES, ACQUISITION_TRANSACTION_TYPES } from "../utils/acquisitionOptions";
import { getStoredSubgenres, saveSubgenresToLocal } from "../utils/subgenres";
import { apiUrl } from "../utils/apiBase";
import { RecordCoverImage } from "./RecordCoverImage";
import { SubgenreManagerModal } from "./SubgenreManagerModal";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

const OBI_OPTIONS: ObiCondition[] = ["N/A", "M", "NM", "VG+", "VG", "G", "F_P"];
const GRADE_OPTIONS: GoldmineGrade[] = ["M", "NM", "VG+", "VG", "G", "F_P"];
const gradeLabel = (g: string) => (g === "F_P" ? "F/P" : g);

const todayIso = () => new Date().toISOString().slice(0, 10);

interface AddToShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordScanResult | null;
  existingItem?: ShelfItem | null;
  boxes: VinylBox[];
  onSave: (item: ShelfItem) => void;
}

export const AddToShelfModal: React.FC<AddToShelfModalProps> = ({
  isOpen,
  onClose,
  record,
  existingItem,
  boxes,
  onSave,
}) => {
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
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [acquisitionCountry, setAcquisitionCountry] = useState<string>("");
  const [acquisitionTransactionType, setAcquisitionTransactionType] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [customValuationAdj, setCustomValuationAdj] = useState<string>("0");
  const [coverArtUrl, setCoverArtUrl] = useState<string>("");
  const [genre, setGenre] = useState<string>(DISCOGS_MACRO_GENRES[0]);
  const [styles, setStyles] = useState<string[]>([]);
  const [styleInput, setStyleInput] = useState<string>("");
  const [boxId, setBoxId] = useState<string>(UNCATEGORISED_BOX_ID);
  const [matrixCode, setMatrixCode] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(todayIso());
  const [subgenreLibrary, setSubgenreLibrary] = useState<string[]>(() => getStoredSubgenres());
  const [isSubgenreManagerOpen, setIsSubgenreManagerOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTracklistOpen, setIsTracklistOpen] = useState(false);
  const [proposedValuation, setProposedValuation] = useState<{
    median: number;
    low: number;
    high: number;
    rationale: string;
  } | null>(null);

  // Snapshot of the fields that should trigger a "re-run research" prompt when they
  // change on an existing shelf record (grading, notes, matrix number).
  const researchSnapshotRef = useRef<{ mediaGrade: GoldmineGrade; sleeveGrade: GoldmineGrade; obiCondition: ObiCondition; customNotes: string; matrixCode: string } | null>(null);

  useEffect(() => {
    if (existingItem) {
      const normG = normalizeDiscogsGenre(existingItem.genre, existingItem.styles);
      setGenre(normG.genre);
      setStyles(normG.styles);
      setBoxId(existingItem.boxId || UNCATEGORISED_BOX_ID);
      setCoverArtUrl(existingItem.coverArtUrl || "");
      setMediaGrade(existingItem.mediaGrade || "VG+");
      setSleeveGrade(existingItem.sleeveGrade || "VG+");
      setObiCondition(existingItem.obiCondition || "N/A");
      setPackageInclusions(existingItem.packageInclusions || {
        printedInnerSleeve: false,
        lyricsInsert: false,
        bookletLinerNotes: false,
        originalPoster: false,
        photosPostcards: false,
      });
      setPurchasePrice(existingItem.purchasePrice ? String(existingItem.purchasePrice) : "");
      setAcquisitionCountry(existingItem.acquisitionCountry || "");
      setAcquisitionTransactionType(existingItem.acquisitionTransactionType || "");
      setCustomNotes(existingItem.customNotes || existingItem.freeTextNotes || "");
      setCustomValuationAdj("0");
      setMatrixCode(existingItem.matrixCode || "");
      setPurchaseDate(existingItem.purchaseDate || (existingItem.addedAt ? existingItem.addedAt.slice(0, 10) : todayIso()));
      setProposedValuation(null);
      researchSnapshotRef.current = {
        mediaGrade: existingItem.mediaGrade || "VG+",
        sleeveGrade: existingItem.sleeveGrade || "VG+",
        obiCondition: existingItem.obiCondition || "N/A",
        customNotes: existingItem.customNotes || existingItem.freeTextNotes || "",
        matrixCode: existingItem.matrixCode || "",
      };
    } else if (record) {
      const normG = normalizeDiscogsGenre(record.genre, record.styles);
      setGenre(normG.genre);
      setStyles(normG.styles);
      setBoxId((record as any).boxId || UNCATEGORISED_BOX_ID);
      setCoverArtUrl(record.coverArtUrl || "");
      setMediaGrade((record as any).mediaGrade || "VG+");
      setSleeveGrade((record as any).sleeveGrade || "VG+");
      const isJapan = (record.country || "").toLowerCase().includes("japan") ||
        (record.label || "").toLowerCase().includes("toshiba") ||
        (record.label || "").toLowerCase().includes("victor");
      setObiCondition((record as any).obiCondition || (isJapan ? "NM" : "N/A"));
      setPackageInclusions((record as any).packageInclusions || {
        printedInnerSleeve: false,
        lyricsInsert: false,
        bookletLinerNotes: false,
        originalPoster: false,
        photosPostcards: false,
      });
      const initPrice = (record as any).initialPurchasePrice ?? (record as any).purchasePrice;
      setPurchasePrice(initPrice !== undefined && initPrice !== null && initPrice !== "" ? String(initPrice) : "");
      const initCountry = (record as any).initialAcquisitionCountry ?? (record as any).acquisitionCountry;
      const initTransactionType = (record as any).initialAcquisitionTransactionType ?? (record as any).acquisitionTransactionType;
      setAcquisitionCountry(initCountry || "");
      setAcquisitionTransactionType(initTransactionType || "");

      const cNotes = (record as any).collectorNotes || record.marketNotes;
      const fNotes = (record as any).freeTextNotes;
      const rationale = (record as any).valuationRationale;

      const noteSections: string[] = [];
      if (cNotes) noteSections.push(`Collector Notes:\n${cNotes}`);
      if (fNotes && fNotes.trim()) noteSections.push(`Copy Characteristics & Free Text Notes:\n${fNotes.trim()}`);
      if (rationale && rationale !== cNotes) noteSections.push(`Valuation Rationale:\n${rationale}`);

      const aggregatedAutoNotes = (record as any).initialAutoNotes || noteSections.join("\n\n");

      setCustomNotes(aggregatedAutoNotes || record.customNotes || "");
      setCustomValuationAdj((record as any).initialValuationAdj !== undefined ? String((record as any).initialValuationAdj) : "0");
      setMatrixCode(record.matrixCode || "");
      setPurchaseDate(todayIso());
      setProposedValuation(null);
      researchSnapshotRef.current = null;
    }
  }, [existingItem, record, isOpen]);

  useEscapeToClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen || (!record && !existingItem)) return null;

  const activeRecord = existingItem || record!;
  const completeVal = calculateCompleteValuation({
    baseMintValue: activeRecord.baseMintValue,
    mediaGrade,
    sleeveGrade,
    obiCondition,
    packageInclusions,
    freeTextNotes: customNotes,
  });
  const currentValuation = completeVal.finalValuation;

  const adjNumber = parseFloat(customValuationAdj) || 0;
  const finalCalculatedValuation = {
    low: Math.max(0, currentValuation.low + adjNumber),
    median: Math.max(0, currentValuation.median + adjNumber),
    high: Math.max(0, currentValuation.high + adjNumber),
  };

  const toggleInclusion = (key: keyof PackageInclusions) => {
    setPackageInclusions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const addStyle = () => {
    const trimmed = styleInput.trim();
    if (!trimmed || styles.length >= 3) return;
    if (styles.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setStyleInput("");
      return;
    }
    setStyles((prev) => [...prev, trimmed]);
    setStyleInput("");
  };

  const removeStyle = (style: string) => {
    setStyles((prev) => prev.filter((s) => s !== style));
  };

  const addStyleFromLibrary = (style: string) => {
    if (!style || styles.length >= 3) return;
    if (styles.some((s) => s.toLowerCase() === style.toLowerCase())) return;
    setStyles((prev) => [...prev, style]);
  };

  // Per the rule: if grading, custom notes, or the matrix number change on an existing
  // shelf record, prompt a fresh valuation research pass rather than silently keeping
  // the old estimate.
  const snapshot = researchSnapshotRef.current;
  const isDirtyForResearch = !!existingItem && !!snapshot && (
    mediaGrade !== snapshot.mediaGrade ||
    sleeveGrade !== snapshot.sleeveGrade ||
    obiCondition !== snapshot.obiCondition ||
    customNotes.trim() !== snapshot.customNotes.trim() ||
    matrixCode.trim() !== snapshot.matrixCode.trim()
  );

  const handleRerunResearch = async () => {
    setIsRecalculating(true);
    setProposedValuation(null);
    try {
      const res = await fetch(apiUrl("recalculateValuation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumTitle: activeRecord.albumTitle,
          artist: activeRecord.artist,
          catalogueNumber: activeRecord.catalogueNumber,
          country: activeRecord.country,
          label: activeRecord.label,
          genre,
          baseMintValue: activeRecord.baseMintValue,
          mediaGrade,
          sleeveGrade,
          obiCondition,
          packageInclusions,
          freeTextNotes: matrixCode.trim() ? `${customNotes}\nMatrix/runout: ${matrixCode.trim()}` : customNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.finalValuation) {
        setProposedValuation({
          median: data.finalValuation.median,
          low: data.finalValuation.low,
          high: data.finalValuation.high,
          rationale: data.valuationRationale || "Updated valuation based on your changes.",
        });
      }
    } catch (err) {
      console.error("Re-run valuation research failed:", err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const applyProposedValuation = () => {
    if (!proposedValuation) return;
    const diff = proposedValuation.median - currentValuation.median;
    setCustomValuationAdj(String(diff));
    setProposedValuation(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Any freeform sub-genre tags the user typed get added to the shared library so
    // they show up in the picker for future records too.
    if (styles.length > 0) {
      saveSubgenresToLocal([...subgenreLibrary, ...styles]);
    }

    const shelfPayload: ShelfItem = {
      ...activeRecord,
      coverArtUrl: coverArtUrl || activeRecord.coverArtUrl,
      genre,
      styles,
      matrixCode: matrixCode.trim() || undefined,
      purchaseDate,
      boxId,
      mediaGrade,
      sleeveGrade,
      obiCondition,
      packageInclusions,
      freeTextNotes: customNotes.trim() || undefined,
      calculatedValue: finalCalculatedValuation,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      acquisitionCountry: acquisitionCountry || undefined,
      acquisitionTransactionType: acquisitionTransactionType || undefined,
      customNotes: customNotes.trim() || undefined,
      addedAt: existingItem ? existingItem.addedAt : new Date().toISOString(),
    };

    onSave(shelfPayload);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 py-8 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-[#FAF8F3] border border-[#E2DCD0] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2DCD0] bg-[#EFEAE0]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">
                {existingItem ? "Edit Shelf Record" : "Save Record to Shelf"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#6B655B] hover:text-[#2B2B2B] hover:bg-[#E2DCD0] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {/* Record Summary Preview */}
          <div className="flex items-center gap-4 p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0]">
            <RecordCoverImage
              src={coverArtUrl || activeRecord.coverArtUrl}
              artist={activeRecord.artist}
              albumTitle={activeRecord.albumTitle}
              catalogueNumber={activeRecord.catalogueNumber}
              matrixCode={matrixCode}
              onImageChange={(newUrl) => setCoverArtUrl(newUrl)}
              className="w-16 h-16 rounded border border-[#D8D0C0] shadow-xs flex-shrink-0"
              imgClassName="w-full h-full object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-serif font-bold text-base text-[#2B2B2B] truncate">{activeRecord.albumTitle}</h4>
              <p className="text-xs font-serif text-[#A94A42] truncate font-medium">{activeRecord.artist}</p>
              
              {/* Cat#, Matrix, Barcode, Year, Publisher - All uniform plain text design */}
              <div className="flex items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] font-sans text-[#6B655B] flex-wrap leading-relaxed">
                {activeRecord.catalogueNumber && (
                  <span>Cat#: {activeRecord.catalogueNumber}</span>
                )}
                {activeRecord.matrixCode && (
                  <span>Matrix: {activeRecord.matrixCode}</span>
                )}
                {activeRecord.barcode && (
                  <span>Barcode: {activeRecord.barcode}</span>
                )}
                {activeRecord.releaseYear && <span>{activeRecord.releaseYear}</span>}
                {activeRecord.label && (
                  <span>{activeRecord.label} ({activeRecord.country || "US"})</span>
                )}
                {activeRecord.format && (
                  <span className="text-[#A94A42] font-medium">• {cleanFormatSpec(activeRecord.format)}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20 text-[#A94A42]">
                  {genre}
                </span>
                {styles.map((style, sIdx) => (
                  <span key={sIdx} className="text-[9px] font-sans px-2 py-0.5 rounded-full bg-[#FAF8F3] border border-[#D8D0C0] text-[#2B2B2B]">
                    {style}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tracklist */}
          {activeRecord.tracklist && activeRecord.tracklist.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIsTracklistOpen((prev) => !prev)}
                className="text-[10px] font-sans uppercase tracking-wider text-[#A94A42] font-bold mb-1 flex items-center gap-1.5 cursor-pointer"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Tracklist ({activeRecord.tracklist.length})</span>
                <span className="text-[#6B655B] normal-case font-normal">{isTracklistOpen ? "▲" : "▼"}</span>
              </button>
              {isTracklistOpen && (
                <div className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] space-y-1.5 max-h-52 overflow-y-auto font-sans">
                  {activeRecord.tracklist.map((track, idx) => (
                    <div key={idx} className="flex items-start justify-between text-xs text-[#2B2B2B] py-1 border-b border-[#D8D0C0]/60 last:border-b-0">
                      <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                        <span className="text-[#A94A42] font-bold w-7 shrink-0">{track.position}</span>
                        <span className="break-words">{track.title}</span>
                      </div>
                      {track.duration && <span className="text-[#6B655B] text-[11px] shrink-0">{track.duration}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Genre & Sub-Genre Categorization (editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
                Genre
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
              >
                {DISCOGS_MACRO_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
                  Sub-Genres / Styles (up to 3)
                </span>
                <button
                  type="button"
                  onClick={() => setIsSubgenreManagerOpen(true)}
                  className="text-[9px] font-bold normal-case text-[#6B655B] hover:text-[#A94A42] flex items-center gap-0.5 cursor-pointer"
                  title="Add or delete sub-genre categories"
                >
                  <Settings2 className="w-3 h-3" /> Manage
                </button>
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value=""
                  disabled={styles.length >= 3}
                  onChange={(e) => addStyleFromLibrary(e.target.value)}
                  className="flex-1 min-w-0 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition disabled:opacity-50"
                >
                  <option value="">{styles.length >= 3 ? "Max 3 styles" : "Select a sub-genre..."}</option>
                  {subgenreLibrary
                    .filter((s) => !styles.some((st) => st.toLowerCase() === s.toLowerCase()))
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="text"
                  placeholder={styles.length >= 3 ? "Max 3 styles" : "Or type a new one..."}
                  value={styleInput}
                  disabled={styles.length >= 3}
                  onChange={(e) => setStyleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addStyle();
                    }
                  }}
                  className="flex-1 min-w-0 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={addStyle}
                  disabled={!styleInput.trim() || styles.length >= 3}
                  className="shrink-0 p-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white transition disabled:opacity-40 cursor-pointer"
                  title="Add Style"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {styles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {styles.map((style) => (
                    <span
                      key={style}
                      className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]"
                    >
                      {style}
                      <button
                        type="button"
                        onClick={() => removeStyle(style)}
                        className="hover:text-[#A94A42] transition cursor-pointer"
                        title="Remove style"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Condition Grading Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#A94A42]" />
                Media Grade
              </label>
              <select
                value={mediaGrade}
                onChange={(e) => setMediaGrade(e.target.value as GoldmineGrade)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans font-medium rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{gradeLabel(g)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#A94A42]" />
                Sleeve Grade
              </label>
              <select
                value={sleeveGrade}
                onChange={(e) => setSleeveGrade(e.target.value as GoldmineGrade)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans font-medium rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{gradeLabel(g)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
                Obi Strip
              </label>
              <select
                value={obiCondition}
                onChange={(e) => setObiCondition(e.target.value as ObiCondition)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans font-medium rounded-md px-2.5 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
              >
                {OBI_OPTIONS.map((o) => (
                  <option key={o} value={o}>{gradeLabel(o)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Re-run Research Prompt: shown when grading/notes/matrix changed on an existing record */}
          {isDirtyForResearch && !proposedValuation && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs font-sans">
              <span className="text-amber-800">
                Grading, notes, or matrix number changed — re-run research to get an updated value estimate?
              </span>
              <button
                type="button"
                onClick={handleRerunResearch}
                disabled={isRecalculating}
                className="shrink-0 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? "Researching..." : "Re-run Research"}
              </button>
            </div>
          )}

          {proposedValuation && (
            <div className="p-3 rounded-lg bg-[#2D4A3E]/5 border border-[#2D4A3E]/30 text-xs font-sans space-y-2">
              <div className="flex items-center gap-1.5 text-[#2D4A3E] font-bold uppercase tracking-wider text-[10px]">
                <Sparkles className="w-3.5 h-3.5" /> Proposed Updated Estimate: S${proposedValuation.median.toFixed(2)}
                <span className="font-normal normal-case text-[#6B655B]">
                  (range S${proposedValuation.low} - S${proposedValuation.high})
                </span>
              </div>
              <p className="text-[#2B2B2B] leading-relaxed">{proposedValuation.rationale}</p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setProposedValuation(null)}
                  className="px-3 py-1.5 rounded-md border border-[#D8D0C0] text-[10px] font-bold uppercase tracking-wider text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
                >
                  Keep Current Value
                </button>
                <button
                  type="button"
                  onClick={applyProposedValuation}
                  className="px-3 py-1.5 rounded-md bg-[#2D4A3E] hover:bg-[#213A2F] text-white text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Use This Value
                </button>
              </div>
            </div>
          )}

          {/* Matrix Code + Purchase Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
                Matrix / Runout Code
              </label>
              <input
                type="text"
                placeholder="e.g. MWZ 8107 A-1"
                value={matrixCode}
                onChange={(e) => setMatrixCode(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#A94A42]" />
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
              />
            </div>
          </div>

          {/* Consolidated Financial Summary: Uniformed Layout & Font */}
          {(() => {
            const estVal = finalCalculatedValuation.median;
            const pPriceNum = purchasePrice !== "" && !isNaN(parseFloat(purchasePrice)) ? parseFloat(purchasePrice) : null;
            const pLoss = pPriceNum !== null ? estVal - pPriceNum : null;
            const roiPct = pPriceNum && pPriceNum > 0 && pLoss !== null ? ((pLoss / pPriceNum) * 100).toFixed(1) : null;

            return (
              <div className="p-3.5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] font-sans space-y-3 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Final Est. Value (editable — overrides the computed value) */}
                  <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] flex flex-col justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center justify-between gap-1">
                      <span>Final Est. Value</span>
                      <button
                        type="button"
                        onClick={handleRerunResearch}
                        disabled={isRecalculating}
                        title="Refresh this record's value using the current valuation engine"
                        className="text-[#A94A42] hover:text-[#8E3E37] disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRecalculating ? "animate-spin" : ""}`} />
                      </button>
                    </span>
                    <div className="flex items-center gap-1 text-[#A94A42]">
                      <span className="text-lg sm:text-xl font-serif font-bold">S$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={estVal.toFixed(2)}
                        onChange={(e) => {
                          const entered = parseFloat(e.target.value);
                          if (isNaN(entered)) return;
                          setCustomValuationAdj(String(entered - currentValuation.median));
                        }}
                        className="w-full min-w-0 bg-transparent text-lg sm:text-xl font-serif font-bold text-[#A94A42] focus:outline-none border-b border-transparent focus:border-[#A94A42] transition"
                      />
                    </div>
                  </div>

                  {/* 2. Purchase Price (editable) */}
                  <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] flex flex-col justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] block mb-1">
                      Purchase Price
                    </span>
                    <div className="flex items-center gap-1 text-[#A94A42]">
                      <span className="text-lg sm:text-xl font-serif font-bold">S$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        className="w-full min-w-0 bg-transparent text-lg sm:text-xl font-serif font-bold text-[#A94A42] placeholder-[#A94A42]/40 focus:outline-none border-b border-transparent focus:border-[#A94A42] transition"
                      />
                    </div>
                  </div>

                  {/* 3. Est. Profit / Loss */}
                  <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] flex flex-col justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] block mb-1">
                      Est. Profit / Loss
                    </span>
                    <div>
                      <div className={`text-lg sm:text-xl font-serif font-bold ${
                        pLoss === null
                          ? "text-[#6B655B] text-sm italic font-sans"
                          : pLoss > 0
                          ? "text-[#2D4A3E]"
                          : pLoss < 0
                          ? "text-[#A94A42]"
                          : "text-[#2B2B2B]"
                      }`}>
                        {pLoss === null
                          ? "N/A"
                          : pLoss > 0
                          ? `+S$${pLoss.toFixed(2)}`
                          : pLoss < 0
                          ? `-S$${Math.abs(pLoss).toFixed(2)}`
                          : "S$0.00"}
                      </div>
                      {roiPct !== null && (
                        <span className="text-[11px] font-sans font-bold text-[#2B2B2B] block mt-0.5">
                          {pLoss! > 0 ? `+${roiPct}% ROI` : `${roiPct}% ROI`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Acquisition Source Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#A94A42]" />
                Acquisition Country
              </label>
              <select
                value={acquisitionCountry}
                onChange={(e) => setAcquisitionCountry(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
              >
                <option value="">Select</option>
                {ACQUISITION_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#A94A42]" />
                Acquisition Transaction
              </label>
              <select
                value={acquisitionTransactionType}
                onChange={(e) => setAcquisitionTransactionType(e.target.value)}
                className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
              >
                <option value="">Select</option>
                {ACQUISITION_TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Organise Box Selector */}
          <div>
            <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-[#A94A42]" />
              Storage Box (Organise)
            </label>
            <select
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
            >
              <option value={UNCATEGORISED_BOX_ID}>Uncategorised</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Aggregated Custom Notes / Pressing Particulars */}
          <div>
            <label className="text-[10px] font-sans uppercase tracking-wider text-[#A94A42] font-bold mb-1 block">
              Custom Notes / Pressing Particulars
            </label>
            <textarea
              rows={6}
              placeholder="Collector Notes, Copy Characteristics & Free Text Notes, and Valuation Rationale..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] font-sans rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition resize-y leading-relaxed"
            />
          </div>

          {/* Condition / Value History */}
          {existingItem?.history && existingItem.history.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen((prev) => !prev)}
                className="text-[10px] font-sans uppercase tracking-wider text-[#A94A42] font-bold mb-1 flex items-center gap-1.5 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({existingItem.history.length})</span>
                <span className="text-[#6B655B] normal-case font-normal">{isHistoryOpen ? "▲" : "▼"}</span>
              </button>
              {isHistoryOpen && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {existingItem.history.map((h, i) => (
                    <div
                      key={i}
                      className="text-[11px] font-sans text-[#6B655B] bg-[#EFEAE0] border border-[#D8D0C0] rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2"
                    >
                      <span>{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[#2B2B2B]">
                        {gradeLabel(h.mediaGrade)} / {gradeLabel(h.sleeveGrade)}
                        {h.obiCondition && h.obiCondition !== "N/A" ? ` / OBI ${gradeLabel(h.obiCondition)}` : ""}
                      </span>
                      <span className="font-bold text-[#A94A42]">S${h.calculatedValue.median.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DCD0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#D8D0C0] text-xs font-sans font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-2 transition shadow-sm cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4 text-white" />
              <span>{existingItem ? "Update Record" : "SAVE TO SHELF"}</span>
            </button>
          </div>
        </form>
      </div>

      <SubgenreManagerModal
        isOpen={isSubgenreManagerOpen}
        onClose={() => setIsSubgenreManagerOpen(false)}
        subgenres={subgenreLibrary}
        onChange={(updated) => {
          setSubgenreLibrary(updated);
          saveSubgenresToLocal(updated);
          setStyles((prev) => prev.filter((s) => updated.some((u) => u.toLowerCase() === s.toLowerCase())));
        }}
      />
    </div>
  );
};

