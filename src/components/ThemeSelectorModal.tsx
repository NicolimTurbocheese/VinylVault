import React from "react";
import { Palette, Check, Sparkles, X } from "lucide-react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

export type UITheme = "gold" | "nordic" | "swiss" | "cyber";

interface ThemeOption {
  id: UITheme;
  name: string;
  tagline: string;
  description: string;
  palette: {
    bg: string;
    card: string;
    accent: string;
    text: string;
    border: string;
  };
  highlights: string[];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "nordic",
    name: "Look 1: Tokyo & Nordic Archival Salon",
    tagline: "Warm Oatmeal Paper & Terracotta Vermilion (Lora Serif + Space Grotesk)",
    description: "Inspired by Japanese vinyl listening bars and Nordic museum archives. Warm tactile oatmeal paper background (#F4EFE6), deep charcoal ink, and terracotta vermilion accents.",
    palette: {
      bg: "bg-[#F4EFE6]",
      card: "bg-white",
      accent: "bg-[#C85A32]",
      text: "text-[#1A1816]",
      border: "border-[#C85A32]/40",
    },
    highlights: [
      "Tactile oatmeal canvas (#F4EFE6)",
      "Terracotta sienna accent (#C85A32)",
      "Lora Editorial Serif + Space Grotesk"
    ],
  },
  {
    id: "swiss",
    name: "Look 2: Zurich Modernist Precision Grid",
    tagline: "Ice Slate & Royal Cobalt Blue (Cinzel + Plus Jakarta Sans)",
    description: "Swiss International Typographic precision layout. Cool daylight ice-slate canvas (#EBF0F6), stark high-contrast typography, and electric royal cobalt blue accents.",
    palette: {
      bg: "bg-[#EBF0F6]",
      card: "bg-white",
      accent: "bg-[#1D4ED8]",
      text: "text-[#090D16]",
      border: "border-[#1D4ED8]/40",
    },
    highlights: [
      "Cool daylight slate canvas (#EBF0F6)",
      "Royal Cobalt Blue accent (#1D4ED8)",
      "Cinzel Display + Plus Jakarta Sans"
    ],
  },
  {
    id: "cyber",
    name: "Look 3: Neo-Tokyo Cyber Studio",
    tagline: "Midnight Sapphire & Electric Mint Emerald (Outfit + Space Grotesk)",
    description: "Futuristic audiophile mastering console. Deep midnight sapphire background (#050811), translucent dark cobalt glass cards, and glowing electric mint emerald accents.",
    palette: {
      bg: "bg-[#050811]",
      card: "bg-[#0D1527]",
      accent: "bg-[#10B981]",
      text: "text-[#ECFDF5]",
      border: "border-[#10B981]/40",
    },
    highlights: [
      "Midnight sapphire canvas (#050811)",
      "Electric mint emerald accent (#10B981)",
      "Outfit Display + Cyber Glassmorphism"
    ],
  },
  {
    id: "gold",
    name: "Classic: Gold Standard Audiophile Vault",
    tagline: "Midnight Black & Vintage Gold Foil (Playfair Display + JetBrains Mono)",
    description: "The original signature dark luxury aesthetic featuring deep matte black backgrounds (#0C0C0C) with warm metallic gold foil accents inspired by vintage pressing labels.",
    palette: {
      bg: "bg-[#0c0c0c]",
      card: "bg-[#18181b]",
      accent: "bg-[#D4AF37]",
      text: "text-zinc-100",
      border: "border-[#D4AF37]/30",
    },
    highlights: [
      "Midnight vinyl canvas (#0C0C0C)",
      "Vintage gold foil accent (#D4AF37)",
      "Playfair Display + JetBrains Mono"
    ],
  },
];

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: UITheme;
  onSelectTheme: (theme: UITheme) => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  useEscapeToClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] text-zinc-100 border border-[#D4AF37]/30 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-[#D4AF37]">
              Contemporary & Modern UI Design Looks
            </h2>
            <p className="text-xs font-mono text-zinc-400">
              Select a visual theme look below to transform the application's aesthetic in real-time.
            </p>
          </div>
        </div>

        {/* Theme Cards Grid */}
        <div className="space-y-4">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? "border-[#D4AF37] bg-zinc-900/90 shadow-[0_0_20px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-zinc-100">
                        {theme.name}
                      </h3>
                      {isSelected && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#D4AF37] text-black rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active Look
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-[#D4AF37] mt-0.5">
                      {theme.tagline}
                    </p>
                    <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                      {theme.description}
                    </p>

                    {/* Highlights */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {theme.highlights.map((h, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                        >
                          • {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Visual Palette Preview Chips */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1 p-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
                      <div className={`w-4 h-4 rounded-full ${theme.palette.bg} border border-zinc-600`} title="Canvas" />
                      <div className={`w-4 h-4 rounded-full ${theme.palette.card} border border-zinc-600`} title="Card Surface" />
                      <div className={`w-4 h-4 rounded-full ${theme.palette.accent}`} title="Primary Accent" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            Your theme selection is saved automatically.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:bg-[#FFBF00] transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
