import React, { useState } from "react";
import { X, ClipboardCheck, ChevronRight, Disc3 } from "lucide-react";
import { ShelfItem } from "../types";
import { auditCollection, AUDIT_RULES } from "../utils/dataAudit";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

interface DataAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  shelfItems: ShelfItem[];
  onEditItem: (item: ShelfItem) => void;
}

export const DataAuditModal: React.FC<DataAuditModalProps> = ({
  isOpen,
  onClose,
  shelfItems,
  onEditItem,
}) => {
  useEscapeToClose(isOpen, onClose);
  useBodyScrollLock(isOpen);
  // null = show everything ranked by how much is missing; otherwise filter to one rule.
  const [activeRule, setActiveRule] = useState<string | null>(null);

  if (!isOpen) return null;

  const { audits, countsByRule, overallCompleteness, fullyCompleteCount } = auditCollection(shelfItems);

  const visible = audits
    .filter((a) => (activeRule ? a.missing.some((m) => m.key === activeRule) : a.missing.length > 0))
    .sort((a, b) => b.missingWeight - a.missingWeight);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 py-8 overflow-y-auto overscroll-contain animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-xl bg-[#FAF8F3] border border-[#E2DCD0] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E2DCD0] bg-[#EFEAE0] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Collection Data Audit</h3>
              <p className="text-[11px] font-sans text-[#6B655B] mt-0.5">
                {overallCompleteness}% complete · {fullyCompleteCount} of {shelfItems.length} records have nothing missing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#6B655B] hover:text-[#2B2B2B] hover:bg-[#E2DCD0] transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Completeness bar */}
          <div>
            <div className="h-2 w-full rounded-full bg-[#E2DCD0] overflow-hidden">
              <div
                className="h-full bg-[#A94A42] transition-all"
                style={{ width: `${overallCompleteness}%` }}
              />
            </div>
          </div>

          {/* Rule summary — click to filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveRule(null)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-sans font-bold border transition cursor-pointer ${
                activeRule === null
                  ? "bg-[#A94A42] text-white border-[#A94A42]"
                  : "bg-[#EFEAE0] text-[#2B2B2B] border-[#D8D0C0] hover:bg-white"
              }`}
            >
              All gaps ({audits.filter((a) => a.missing.length > 0).length})
            </button>
            {AUDIT_RULES.map((rule) => {
              const count = countsByRule[rule.key] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={rule.key}
                  onClick={() => setActiveRule(rule.key === activeRule ? null : rule.key)}
                  title={rule.why}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-sans font-bold border transition cursor-pointer ${
                    activeRule === rule.key
                      ? "bg-[#A94A42] text-white border-[#A94A42]"
                      : "bg-[#EFEAE0] text-[#2B2B2B] border-[#D8D0C0] hover:bg-white"
                  }`}
                >
                  {rule.label} ({count})
                </button>
              );
            })}
          </div>

          {activeRule && (
            <p className="text-[11px] font-sans text-[#6B655B] italic border-l-2 border-[#A94A42]/40 pl-3">
              {AUDIT_RULES.find((r) => r.key === activeRule)?.why}
            </p>
          )}

          {/* Ranked list */}
          {visible.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20 flex items-center justify-center mx-auto mb-3">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-serif font-bold text-[#2B2B2B]">Nothing missing here</p>
              <p className="text-[11px] font-sans text-[#6B655B] mt-1">
                Every record has this field filled in.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {visible.map(({ item, missing, completeness }) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onEditItem(item);
                  }}
                  className="w-full text-left p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] hover:bg-white hover:border-[#A94A42]/40 transition cursor-pointer flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded border border-[#D8D0C0] bg-[#FAF8F3] overflow-hidden shrink-0 flex items-center justify-center">
                    {item.coverArtUrl ? (
                      <img src={item.coverArtUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 className="w-5 h-5 text-[#D8D0C0]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif font-bold text-sm text-[#2B2B2B] truncate">
                        {item.albumTitle}
                      </span>
                      <span className="text-[10px] font-sans text-[#6B655B] shrink-0">{completeness}%</span>
                    </div>
                    <p className="text-[11px] font-sans text-[#A94A42] truncate">{item.artist}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {missing.map((m) => (
                        <span
                          key={m.key}
                          className="text-[9px] font-sans px-1.5 py-0.5 rounded-full bg-[#FAF8F3] border border-[#D8D0C0] text-[#6B655B]"
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6B655B] group-hover:text-[#A94A42] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
