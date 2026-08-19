import React from "react";
import { X, Award, Tag, DollarSign, MapPin, Package, Calendar, ListMusic, History as HistoryIcon, Disc3 } from "lucide-react";
import { ShelfItem, VinylBox, UNCATEGORISED_BOX_ID } from "../types";
import { cleanFormatSpec } from "../utils/format";
import { normalizeDiscogsGenre } from "../utils/genre";
import { RecordCoverImage } from "./RecordCoverImage";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useCurrency } from "../context/CurrencyContext";
import { latestObservation, estimateVsMarket } from "../utils/marketData";

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShelfItem | null;
  boxes: VinylBox[];
  onEdit: (item: ShelfItem) => void;
}

const gradeLabel = (g?: string) => (g === "F_P" ? "F/P" : g || "N/A");

export const ViewDetailsModal: React.FC<ViewDetailsModalProps> = ({ isOpen, onClose, item, boxes, onEdit }) => {
  useEscapeToClose(isOpen, onClose);
  useBodyScrollLock(isOpen);
  const { format } = useCurrency();

  if (!isOpen || !item) return null;

  const marketLatest = latestObservation(item);
  const vsMarket = estimateVsMarket(item);
  const norm = normalizeDiscogsGenre(item.genre, item.styles);
  const boxName =
    item.boxId && item.boxId !== UNCATEGORISED_BOX_ID
      ? boxes.find((b) => b.id === item.boxId)?.name
      : "Uncategorised";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 py-8 overflow-y-auto overscroll-contain animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-[#FAF8F3] border border-[#E2DCD0] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with large cover */}
        <div className="p-5 sm:p-6 border-b border-[#E2DCD0] bg-[#EFEAE0] flex items-start gap-4">
          <RecordCoverImage
            src={item.coverArtUrl}
            artist={item.artist}
            albumTitle={item.albumTitle}
            catalogueNumber={item.catalogueNumber}
            matrixCode={item.matrixCode}
            showRefreshOverlay={false}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg border border-[#D8D0C0] shadow-md flex-shrink-0"
            imgClassName="w-full h-full object-cover rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-serif font-bold text-xl text-[#2B2B2B] truncate">{item.albumTitle}</h3>
                <p className="text-sm text-[#A94A42] font-medium">{item.artist}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-[#6B655B] hover:text-[#2B2B2B] hover:bg-[#E2DCD0] transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px] font-sans text-[#6B655B]">
              {item.catalogueNumber && <span>Cat#: {item.catalogueNumber}</span>}
              {item.matrixCode && <span>Matrix: {item.matrixCode}</span>}
              {item.barcode && <span>Barcode: {item.barcode}</span>}
              {item.releaseYear && <span>{item.releaseYear}</span>}
              {item.label && <span>{item.label} ({item.country || "US"})</span>}
              {item.format && <span className="text-[#A94A42] font-medium">• {cleanFormatSpec(item.format)}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-2">
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20 text-[#A94A42]">
                {norm.genre}
              </span>
              {norm.styles.map((s, i) => (
                <span key={i} className="text-[9px] font-sans px-2 py-0.5 rounded-full bg-white border border-[#D8D0C0] text-[#2B2B2B]">
                  {s}
                </span>
              ))}
              {item.needsReview && (
                <span
                  className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 text-[9px] font-bold uppercase tracking-wider"
                  title={item.reviewNotes || "Needs review"}
                >
                  Needs Review
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Grading */}
          <div className="grid grid-cols-3 gap-3 font-sans">
            <div className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1 flex items-center justify-center gap-1">
                <Award className="w-3 h-3" /> Media
              </span>
              <span className="text-sm font-bold text-[#2B2B2B]">{gradeLabel(item.mediaGrade)}</span>
            </div>
            <div className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1 flex items-center justify-center gap-1">
                <Award className="w-3 h-3" /> Sleeve
              </span>
              <span className="text-sm font-bold text-[#2B2B2B]">{gradeLabel(item.sleeveGrade)}</span>
            </div>
            <div className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1 flex items-center justify-center gap-1">
                <Tag className="w-3 h-3" /> Obi
              </span>
              <span className="text-sm font-bold text-[#2B2B2B]">{gradeLabel(item.obiCondition)}</span>
            </div>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
            <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Est. Value
              </span>
              <span className="text-lg font-serif font-bold text-[#A94A42]">{format(item.calculatedValue?.median || 0)}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1">Purchase Price</span>
              <span className="text-lg font-serif font-bold text-[#A94A42]">
                {item.purchasePrice != null ? format(item.purchasePrice) : "N/A"}
              </span>
            </div>
            {marketLatest && (
              <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Listed From
                </span>
                <span className="text-lg font-serif font-bold text-[#A94A42]">
                  {format(marketLatest.lowestPriceSGD)}
                </span>
                <span className="block text-[9px] font-sans text-[#6B655B] mt-0.5">
                  {marketLatest.numForSale} for sale · {new Date(marketLatest.date).toLocaleDateString()}
                  {vsMarket && (
                    <>
                      {" · est. "}
                      <span className={vsMarket.diff >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {vsMarket.diff >= 0 ? "+" : "-"}
                        {Math.abs(vsMarket.pct).toFixed(0)}%
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}

            <div className="p-3.5 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A94A42] block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Purchase Date
              </span>
              <span className="text-sm font-bold text-[#2B2B2B]">
                {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>

          {/* Acquisition + Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-sans text-[#2B2B2B]">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#A94A42]" />
              <span>{item.acquisitionCountry || "Acquisition country: N/A"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#A94A42]" />
              <span>{item.acquisitionTransactionType || "Transaction type: N/A"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#A94A42]" />
              <span>Box: {boxName || "Uncategorised"}</span>
            </div>
          </div>

          {/* Tracklist */}
          {item.tracklist && item.tracklist.length > 0 && (
            <div>
              <h4 className="text-[10px] font-sans uppercase tracking-wider text-[#A94A42] font-bold mb-2 flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5" />
                <span>Tracklist ({item.tracklist.length})</span>
              </h4>
              <div className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] space-y-1.5 max-h-56 overflow-y-auto font-sans">
                {item.tracklist.map((track, idx) => (
                  <div key={idx} className="flex items-start justify-between text-xs text-[#2B2B2B] py-1 border-b border-[#D8D0C0]/60 last:border-b-0">
                    <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                      <span className="text-[#A94A42] font-bold w-7 shrink-0">{track.position}</span>
                      <span className="break-words">{track.title}</span>
                    </div>
                    {track.duration && <span className="text-[#6B655B] text-[11px] shrink-0">{track.duration}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.customNotes && (
            <div>
              <h4 className="text-[10px] font-sans uppercase tracking-wider text-[#A94A42] font-bold mb-2">
                Custom Notes / Pressing Particulars
              </h4>
              <p className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] text-xs text-[#2B2B2B] italic leading-relaxed font-sans whitespace-pre-wrap">
                "{item.customNotes}"
              </p>
            </div>
          )}

          {/* History */}
          {item.history && item.history.length > 0 && (
            <div>
              <h4 className="text-[10px] font-sans uppercase tracking-wider text-[#A94A42] font-bold mb-2 flex items-center gap-1.5">
                <HistoryIcon className="w-3.5 h-3.5" />
                <span>History ({item.history.length})</span>
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 font-sans">
                {item.history.map((h, i) => (
                  <div key={i} className="text-[11px] text-[#6B655B] bg-[#EFEAE0] border border-[#D8D0C0] rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span>{new Date(h.date).toLocaleDateString()}</span>
                    <span className="text-[#2B2B2B]">
                      {gradeLabel(h.mediaGrade)} / {gradeLabel(h.sleeveGrade)}
                      {h.obiCondition && h.obiCondition !== "N/A" ? ` / OBI ${gradeLabel(h.obiCondition)}` : ""}
                    </span>
                    <span className="font-bold text-[#A94A42]">{format(h.calculatedValue.median)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DCD0]">
            <button
              onClick={onClose}
              className="px-4 py-2 min-h-11 lg:min-h-0 rounded-md border border-[#D8D0C0] text-xs font-sans font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="px-5 py-2.5 min-h-11 lg:min-h-0 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
            >
              Edit This Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
