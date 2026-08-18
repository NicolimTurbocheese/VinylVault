import React from "react";
import { Search, Library, BarChart3, Disc3, Cloud, CloudOff, Package, Palette, Heart } from "lucide-react";
import { useIsScrollLocked } from "../hooks/useIsScrollLocked";
import { useCurrency } from "../context/CurrencyContext";
import { SUPPORTED_CURRENCIES } from "../utils/currency";

interface HeaderProps {
  activeTab: "scan" | "shelf" | "insights" | "organise" | "wantlist";
  setActiveTab: (tab: "scan" | "shelf" | "insights" | "organise" | "wantlist") => void;
  shelfCount: number;
  isSyncing: boolean;
  onOpenSync: () => void;
  onOpenTheme: () => void;
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  shelfCount,
  isSyncing,
  onOpenSync,
  onOpenTheme,
  onOpenCommandPalette,
}) => {
  // Hidden entirely (not just visually dimmed under a backdrop) while any modal has
  // the page scroll-locked — a sticky header sitting above a position:fixed-locked
  // body is a known source of wheel/trackpad scroll events routing to the wrong
  // element instead of the modal's own scrollable content.
  const isScrollLocked = useIsScrollLocked();
  const { currency, setCurrency } = useCurrency();
  if (isScrollLocked) return null;

  return (
    <header className="sticky top-0 z-40 bg-[#F5F2EB]/95 backdrop-blur-md border-b border-[#E2DCD0]">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Title */}
          <div
            onClick={() => setActiveTab("scan")}
            className="flex items-center gap-1.5 sm:gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-[#A94A42]/50 flex items-center justify-center bg-[#A94A42]/10 text-[#A94A42] shrink-0">
              <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin-slow text-[#A94A42]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-3xl font-serif font-bold tracking-tight text-[#2B2B2B]">
                  VinylVault
                </span>
              </div>
              <p className="hidden sm:block text-[11px] font-sans tracking-tight text-[#6B655B]">
                Vinyl Valuation & Archival System
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Theme Switcher — icon-only below lg so the header never forces
              the page wider than the viewport (verified: tablet width at 768px was exactly
              where full labels used to switch on and no longer fit); full labels return once
              there's room. */}
          <nav className="flex items-center gap-0.5 sm:gap-2 lg:gap-5 text-xs sm:text-sm font-medium font-sans">
            <button
              onClick={() => setActiveTab("scan")}
              title="Scan / Search"
              className={`flex items-center gap-1.5 py-1.5 px-1.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "scan"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">SCAN / SEARCH</span>
            </button>

            <button
              onClick={() => setActiveTab("shelf")}
              title="My Shelf"
              className={`flex items-center gap-1.5 py-1.5 px-1.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md relative ${
                activeTab === "shelf"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Library className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">MY SHELF</span>
              {shelfCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 text-[9px] font-bold rounded-sm ${
                    activeTab === "shelf"
                      ? "bg-[#A94A42] text-white"
                      : "bg-[#8FA89B]/20 text-[#2D4A3E] border border-[#8FA89B]/50"
                  }`}
                >
                  {shelfCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("insights")}
              title="Insights"
              className={`flex items-center gap-1.5 py-1.5 px-1.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "insights"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">INSIGHTS</span>
            </button>

            <button
              onClick={() => setActiveTab("organise")}
              title="Organise"
              className={`flex items-center gap-1.5 py-1.5 px-1.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "organise"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">ORGANISE</span>
            </button>

            <button
              onClick={() => setActiveTab("wantlist")}
              title="Wantlist"
              className={`flex items-center gap-1.5 py-1.5 px-1.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "wantlist"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Heart className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">WANTLIST</span>
            </button>

            <button
              onClick={onOpenSync}
              title={isSyncing ? "Cross-device sync is on" : "Set up cross-device sync"}
              className={`flex items-center gap-1.5 py-1.5 px-1.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md border ${
                isSyncing
                  ? "text-[#2D4A3E] bg-[#8FA89B]/20 border-[#8FA89B]/50"
                  : "text-[#6B655B] border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              {isSyncing ? <Cloud className="w-3.5 h-3.5 shrink-0" /> : <CloudOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="hidden lg:inline">{isSyncing ? "SYNCED" : "SYNC"}</span>
            </button>

            <button
              onClick={onOpenTheme}
              title="Change visual theme"
              className="p-1.5 sm:p-2 rounded-md text-[#6B655B] border border-transparent hover:text-[#A94A42] hover:bg-[#E2DCD0]/30 transition-all"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
              title="Display currency (values are stored in SGD; this only converts what's shown, at a fixed approximate rate)"
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-sans font-bold text-[#6B655B] border border-transparent hover:text-[#A94A42] hover:bg-[#E2DCD0]/30 bg-transparent transition-all cursor-pointer focus:outline-none"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              onClick={onOpenCommandPalette}
              title="Quick search & navigate"
              className="hidden lg:flex items-center gap-1.5 py-1.5 px-2.5 rounded-md border border-[#D8D0C0] text-[#6B655B] hover:text-[#2B2B2B] hover:border-[#A94A42]/40 bg-[#EFEAE0]/60 transition-all"
            >
              <Search className="w-3 h-3" />
              <kbd className="text-[10px] font-mono font-bold">⌘K</kbd>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};


