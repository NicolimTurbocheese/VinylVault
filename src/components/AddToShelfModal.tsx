import React, { useState, useEffect } from "react";
import { X, Save, DollarSign, MapPin, Bookmark, BookmarkPlus, Award, Tag, TrendingUp, TrendingDown, Package, Plus } from "lucide-react";
import { RecordScanResult, GoldmineGrade, GOLDMINE_GRADES, ShelfItem, ObiCondition, PackageInclusions, VinylBox, UNCATEGORISED_BOX_ID } from "../types";
import { calculateAdjustedValuation, calculateCompleteValuation } from "../utils/valuation";
import { cleanFormatSpec } from "../utils/format";
import { normalizeDiscogsGenre, DISCOGS_MACRO_GENRES } from "../utils/genre";
import { ACQUISITION_COUNTRIES, ACQUISITION_TRANSACTION_TYPES } from "../utils/acquisitionOptions";
import { RecordCoverImage } from "./RecordCoverImage";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

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
    }
  }, [existingItem, record, isOpen]);

  useEscapeToClose(isOpen, onClose);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const shelfPayload: ShelfItem = {
      ...activeRecord,
      coverArtUrl: coverArtUrl || activeRecord.coverArtUrl,
      genre,
      styles,
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
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
                Sub-Genres / Styles (up to 3)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder={styles.length >= 3 ? "Max 3 styles" : "e.g. Prog Rock"}
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

          {/* Condition Grading Displays */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#A94A42]" />
                Media Grade
              </label>
              <div className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans font-medium rounded-md px-3 py-2 text-xs shadow-xs min-h-[38px] flex items-center">
                {mediaGrade === "F_P" ? "F/P" : mediaGrade || "N/A"}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#A94A42]" />
                Sleeve Grade
              </label>
              <div className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans font-medium rounded-md px-3 py-2 text-xs shadow-xs min-h-[38px] flex items-center">
                {sleeveGrade === "F_P" ? "F/P" : sleeveGrade || "N/A"}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
                Obi Strip
              </label>
              <div className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] font-sans font-medium rounded-md px-2.5 py-2 text-xs shadow-xs min-h-[38px] flex items-center leading-tight">
                {obiCondition === "F_P" ? "F/P" : (!obiCondition || obiCondition === "none" || obiCondition === "N/A" ? "N/A" : obiCondition)}
              </div>
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
                  {/* 1. Final Est. Value */}
                  <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] flex flex-col justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] block mb-1">
                      Final Est. Value
                    </span>
                    <div className="text-lg sm:text-xl font-serif font-bold text-[#A94A42]">
                      S${estVal.toFixed(2)}
                    </div>
                  </div>

                  {/* 2. Purchase Price */}
                  <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] flex flex-col justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#A94A42] block mb-1">
                      Purchase Price
                    </span>
                    <div className="text-lg sm:text-xl font-serif font-bold text-[#A94A42]">
                      {pPriceNum !== null ? `S$${pPriceNum.toFixed(2)}` : "N/A"}
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
    </div>
  );
};

