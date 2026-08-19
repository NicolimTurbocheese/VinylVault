import React from "react";
import { Search, Cloud, CloudOff, Palette } from "lucide-react";
import { NAV_TABS, AppTab } from "./navTabs";
import { useIsScrollLocked } from "../hooks/useIsScrollLocked";
import { useCurrency } from "../context/CurrencyContext";
import { SUPPORTED_CURRENCIES } from "../utils/currency";

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
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
            {/* The app mark, same artwork as the installed home-screen icon. */}
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt=""
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-2xl xl:text-3xl font-serif font-bold tracking-tight text-[#2B2B2B] whitespace-nowrap">
                  VinylVault
                </span>
              </div>
              <p className="hidden xl:block text-[11px] font-sans tracking-tight text-[#6B655B]">
                Vinyl Valuation & Archival System
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Theme Switcher — icon-only below lg so the header never forces
              the page wider than the viewport (verified: tablet width at 768px was exactly
              where full labels used to switch on and no longer fit); full labels return once
              there's room. */}
          <nav className="flex items-center gap-0.5 sm:gap-1.5 xl:gap-2 text-xs sm:text-sm font-medium font-sans">
            {/* Primary tabs live in the bottom bar on phones (see MobileTabBar) — five of
                them plus the utility controls could not fit one header row on a 360px
                screen and forced the whole page to scroll sideways. */}
            {NAV_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                title={label}
                aria-current={activeTab === key ? "page" : undefined}
                className={`hidden md:flex items-center justify-center gap-1.5 min-h-10 lg:min-h-0 py-1.5 px-2.5 lg:px-2.5 uppercase tracking-wider transition-all rounded-md relative ${
                  activeTab === key
                    ? "text-[#A94A42] bg-[#A94A42]/10 border border-[#A94A42]/30 font-bold"
                    : "text-[#6B655B] border border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">{label}</span>
                {key === "shelf" && shelfCount > 0 && (
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
            ))}

            <button
              onClick={onOpenSync}
              title={isSyncing ? "Cross-device sync is on" : "Set up cross-device sync"}
              className={`flex items-center justify-center gap-1.5 min-w-11 min-h-11 md:min-w-10 md:min-h-10 py-1.5 px-2 lg:px-2.5 uppercase tracking-wider transition-all rounded-md border ${
                isSyncing
                  ? "text-[#2D4A3E] bg-[#8FA89B]/20 border-[#8FA89B]/50"
                  : "text-[#6B655B] border-transparent hover:text-[#2B2B2B] hover:bg-[#E2DCD0]/30"
              }`}
            >
              {isSyncing ? <Cloud className="w-3.5 h-3.5 shrink-0" /> : <CloudOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="hidden xl:inline whitespace-nowrap">{isSyncing ? "SYNCED" : "SYNC"}</span>
            </button>

            <button
              onClick={onOpenTheme}
              title="Change visual theme"
              className="flex items-center justify-center min-w-11 min-h-11 md:min-w-10 md:min-h-10 p-1.5 sm:p-2 rounded-md text-[#6B655B] border border-transparent hover:text-[#A94A42] hover:bg-[#E2DCD0]/30 transition-all"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
              title="Display currency (values are stored in SGD; this only converts what's shown, at a fixed approximate rate)"
              className="min-h-11 md:min-h-10 p-1.5 sm:px-2 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-sans font-bold text-[#6B655B] border border-transparent hover:text-[#A94A42] hover:bg-[#E2DCD0]/30 bg-transparent transition-all cursor-pointer focus:outline-none"
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
              className="hidden xl:flex items-center gap-1.5 py-1.5 px-2.5 rounded-md border border-[#D8D0C0] text-[#6B655B] hover:text-[#2B2B2B] hover:border-[#A94A42]/40 bg-[#EFEAE0]/60 transition-all"
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


