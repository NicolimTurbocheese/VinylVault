import React, { useState } from "react";
import { X, Tag, Plus, Trash2 } from "lucide-react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

interface SubgenreManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subgenres: string[];
  onChange: (subgenres: string[]) => void;
}

export const SubgenreManagerModal: React.FC<SubgenreManagerModalProps> = ({
  isOpen,
  onClose,
  subgenres,
  onChange,
}) => {
  const [newSubgenre, setNewSubgenre] = useState("");

  useEscapeToClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const addSubgenre = () => {
    const trimmed = newSubgenre.trim();
    if (!trimmed) return;
    if (subgenres.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSubgenre("");
      return;
    }
    onChange([...subgenres, trimmed]);
    setNewSubgenre("");
  };

  const removeSubgenre = (s: string) => {
    onChange(subgenres.filter((sg) => sg !== s));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 py-8 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-[#FAF8F3] border border-[#E2DCD0] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2DCD0] bg-[#EFEAE0]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Manage Sub-Genres</h3>
              <p className="text-[10px] font-sans text-[#6B655B]">
                Genre categories are fixed; sub-genres/styles are yours to curate.
              </p>
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

        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a new sub-genre, e.g. Krautrock"
              value={newSubgenre}
              onChange={(e) => setNewSubgenre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubgenre();
                }
              }}
              className="flex-1 min-w-0 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
            />
            <button
              type="button"
              onClick={addSubgenre}
              disabled={!newSubgenre.trim()}
              className="shrink-0 p-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white transition disabled:opacity-40 cursor-pointer"
              title="Add sub-genre"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {subgenres.length === 0 && (
              <p className="text-xs font-sans text-[#6B655B] text-center py-6">No sub-genres yet — add one above.</p>
            )}
            {subgenres.map((s) => (
              <div
                key={s}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-[#EFEAE0] border border-[#D8D0C0] text-xs font-sans text-[#2B2B2B]"
              >
                <span>{s}</span>
                <button
                  type="button"
                  onClick={() => removeSubgenre(s)}
                  className="text-[#6B655B] hover:text-[#A94A42] transition cursor-pointer"
                  title="Delete sub-genre"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
