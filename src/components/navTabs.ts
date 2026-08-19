import { Search, Library, BarChart3, Package, Heart } from "lucide-react";

export type AppTab = "scan" | "shelf" | "insights" | "organise" | "wantlist";

// Single source of truth for the app's primary navigation, shared by the desktop header
// nav and the mobile bottom tab bar so the two can never drift apart.
export const NAV_TABS: { key: AppTab; label: string; shortLabel: string; icon: typeof Search }[] = [
  { key: "scan", label: "SCAN / SEARCH", shortLabel: "Scan", icon: Search },
  { key: "shelf", label: "MY SHELF", shortLabel: "Shelf", icon: Library },
  { key: "insights", label: "INSIGHTS", shortLabel: "Insights", icon: BarChart3 },
  { key: "organise", label: "ORGANISE", shortLabel: "Organise", icon: Package },
  { key: "wantlist", label: "WANTLIST", shortLabel: "Wantlist", icon: Heart },
];
