import React from "react";
import { Search, Library, BarChart3, Disc3, Cloud, CloudOff, Package, Palette } from "lucide-react";

interface HeaderProps {
  activeTab: "scan" | "shelf" | "insights" | "organise";
  setActiveTab: (tab: "scan" | "shelf" | "insights" | "organise") => void;
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
  return (
    <header className="sticky top-0 z-40 bg-[#F5F2EB]/95 backdrop-blur-md border-b border-[#E2DCD0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Title */}
          <div
            onClick={() => setActiveTab("scan")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full border border-[#A94A42]/50 flex items-center justify-center bg-[#A94A42]/10 text-[#A94A42] shrink-0">
              <Disc3 className="w-5 h-5 animate-spin-slow text-[#A94A42]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#2B2B2B]">
                  VinylVault
                </span>
              </div>
              <p className="hidden sm:block text-[11px] font-sans tracking-tight text-[#6B655B]">
                Vinyl Valuation & Archival System
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Theme Switcher */}
          <nav className="flex items-center gap-2 sm:gap-5 text-xs sm:text-sm font-medium font-sans">
            <button
              onClick={() => setActiveTab("scan")}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "scan"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>SCAN / SEARCH</span>
            </button>

            <button
              onClick={() => setActiveTab("shelf")}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 uppercase tracking-wider transition-all rounded-md relative ${
                activeTab === "shelf"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>MY SHELF</span>
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
              className={`flex items-center gap-1.5 py-1.5 px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "insights"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>INSIGHTS</span>
            </button>

            <button
              onClick={() => setActiveTab("organise")}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 uppercase tracking-wider transition-all rounded-md ${
                activeTab === "organise"
                  ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                  : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>ORGANISE</span>
            </button>

            <button
              onClick={onOpenSync}
              title={isSyncing ? "Cross-device sync is on" : "Set up cross-device sync"}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 uppercase tracking-wider transition-all rounded-md border ${
                isSyncing
                  ? "text-[#2D4A3E] bg-[#8FA89B]/20 border-[#8FA89B]/50"
                  : "text-[#6B655B] border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              {isSyncing ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSyncing ? "SYNCED" : "SYNC"}</span>
            </button>

            <button
              onClick={onOpenTheme}
              title="Change visual theme"
              className="p-2 rounded-md text-[#6B655B] border border-transparent hover:text-[#A94A42] hover:bg-[#E2DCD0]/30 transition-all"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onOpenCommandPalette}
              title="Quick search & navigate"
              className="hidden md:flex items-center gap-1.5 py-1.5 px-2.5 rounded-md border border-[#D8D0C0] text-[#6B655B] hover:text-[#2B2B2B] hover:border-[#A94A42]/40 bg-[#EFEAE0]/60 transition-all"
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


