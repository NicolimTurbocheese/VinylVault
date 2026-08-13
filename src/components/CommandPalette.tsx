import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Disc3, Library, BarChart3, Package, Cloud, Palette, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { ShelfItem } from "../types";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

type Tab = "scan" | "shelf" | "insights" | "organise";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  shelfItems: ShelfItem[];
  setActiveTab: (tab: Tab) => void;
  onEditItem: (item: ShelfItem) => void;
  onOpenSync: () => void;
  onOpenTheme: () => void;
}

interface PaletteAction {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  shelfItems,
  setActiveTab,
  onEditItem,
  onOpenSync,
  onOpenTheme,
}) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEscapeToClose(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const navActions: PaletteAction[] = useMemo(
    () => [
      { id: "nav-scan", label: "Go to Scan / Search", icon: <Search className="w-4 h-4" />, run: () => { setActiveTab("scan"); onClose(); } },
      { id: "nav-shelf", label: "Go to My Shelf", icon: <Library className="w-4 h-4" />, run: () => { setActiveTab("shelf"); onClose(); } },
      { id: "nav-insights", label: "Go to Insights", icon: <BarChart3 className="w-4 h-4" />, run: () => { setActiveTab("insights"); onClose(); } },
      { id: "nav-organise", label: "Go to Organise", icon: <Package className="w-4 h-4" />, run: () => { setActiveTab("organise"); onClose(); } },
      { id: "nav-sync", label: "Open Cross-Device Sync", icon: <Cloud className="w-4 h-4" />, run: () => { onOpenSync(); onClose(); } },
      { id: "nav-theme", label: "Change Visual Theme", icon: <Palette className="w-4 h-4" />, run: () => { onOpenTheme(); onClose(); } },
    ],
    [setActiveTab, onOpenSync, onOpenTheme, onClose]
  );

  const recordActions: PaletteAction[] = useMemo(
    () =>
      shelfItems.map((item) => ({
        id: `item-${item.id}`,
        label: item.albumTitle,
        sublabel: `${item.artist}${item.catalogueNumber ? " · " + item.catalogueNumber : ""}`,
        icon: <Disc3 className="w-4 h-4" />,
        run: () => {
          setActiveTab("shelf");
          onEditItem(item);
          onClose();
        },
      })),
    [shelfItems, setActiveTab, onEditItem, onClose]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...navActions, ...recordActions.slice(0, 6)];
    const matchNav = navActions.filter((a) => a.label.toLowerCase().includes(q));
    const matchRecords = recordActions.filter(
      (a) => a.label.toLowerCase().includes(q) || (a.sublabel || "").toLowerCase().includes(q)
    );
    return [...matchNav, ...matchRecords].slice(0, 12);
  }, [query, navActions, recordActions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#FAF8F3] border border-[#D8D0C0] shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E2DCD0]">
          <Search className="w-4 h-4 text-[#6B655B] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a page, or search your shelf..."
            className="flex-1 bg-transparent text-[#2B2B2B] placeholder-[#8C857B] text-sm focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-[#6B655B] bg-[#EFEAE0] border border-[#D8D0C0] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[#6B655B]">No matches for "{query}"</div>
          ) : (
            filtered.map((action, idx) => (
              <button
                key={action.id}
                onClick={action.run}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                  idx === activeIndex ? "bg-[#A94A42]/10" : ""
                }`}
              >
                <span className={idx === activeIndex ? "text-[#A94A42]" : "text-[#6B655B]"}>{action.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-sans text-[#2B2B2B] truncate">{action.label}</span>
                  {action.sublabel && (
                    <span className="block text-[11px] text-[#6B655B] truncate">{action.sublabel}</span>
                  )}
                </span>
                {idx === activeIndex && <CornerDownLeft className="w-3.5 h-3.5 text-[#A94A42] shrink-0" />}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[#E2DCD0] text-[10px] text-[#6B655B] font-sans">
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> Navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> Select</span>
        </div>
      </div>
    </div>
  );
};
