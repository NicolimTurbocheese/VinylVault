import React from "react";
import { NAV_TABS, AppTab } from "./navTabs";
import { useIsScrollLocked } from "../hooks/useIsScrollLocked";

interface MobileTabBarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  shelfCount: number;
}

// Phone-only bottom navigation (hidden from md up, where the header nav takes over).
// Phones can't fit five labelled tabs plus the utility controls in a single header row --
// the header nav had a hard minimum width that forced the whole page to scroll sideways on
// a 360px Android screen. A bottom bar is also the native pattern on both platforms and
// puts the tabs within thumb reach.
export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, setActiveTab, shelfCount }) => {
  // Same reasoning as the header: stay out of the way entirely while a modal owns the screen.
  const isScrollLocked = useIsScrollLocked();
  if (isScrollLocked) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#F5F2EB]/95 backdrop-blur-md border-t border-[#E2DCD0]"
      // Keeps the bar clear of the iOS/Android home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch justify-around">
        {NAV_TABS.map(({ key, shortLabel, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-label={shortLabel}
              aria-current={isActive ? "page" : undefined}
              // min-h-[52px] keeps every tab comfortably above the 48dp Material /
              // 44pt Apple minimum touch target.
              className={`relative flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors ${
                isActive ? "text-[#A94A42]" : "text-[#6B655B] active:bg-[#E2DCD0]/40"
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {key === "shelf" && shelfCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#A94A42] text-white text-[9px] font-bold leading-4 text-center">
                    {shelfCount > 99 ? "99+" : shelfCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-sans tracking-tight ${isActive ? "font-bold" : "font-medium"}`}>
                {shortLabel}
              </span>
              {isActive && <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-[#A94A42]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
