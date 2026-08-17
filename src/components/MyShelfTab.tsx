import React, { useState, useEffect, useRef } from "react";
import {
  Library,
  Download,
  Search,
  SlidersHorizontal,
  Trash2,
  Edit,
  DollarSign,
  Tag,
  Award,
  Sparkles,
  ArrowUpDown,
  Plus,
  FileSpreadsheet,
  FileJson,
  Calendar,
  Layers,
  ArrowLeft,
  Package,
  Grid3x3,
  Disc3,
  Upload,
  RefreshCw,
  MoreVertical,
  FileText,
  X
} from "lucide-react";
import { ShelfItem, VinylBox, UNCATEGORISED_BOX_ID } from "../types";
import { exportToCSV, exportToJSON } from "../utils/valuation";
import { exportValuationReportPdf } from "../utils/pdfReport";
import { cleanFormatSpec } from "../utils/format";
import { normalizeDiscogsGenre, DISCOGS_MACRO_GENRES } from "../utils/genre";
import { apiUrl } from "../utils/apiBase";
import { findDuplicateGroups, DuplicateGroup } from "../utils/duplicateCheck";
import { RecordCoverImage } from "./RecordCoverImage";
import { CoverflowCarousel } from "./CoverflowCarousel";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useCountUp } from "../hooks/useCountUp";

interface MyShelfTabProps {
  shelfItems: ShelfItem[];
  boxes: VinylBox[];
  onEditItem: (item: ShelfItem) => void;
  onDeleteItem: (id: string) => void;
  onGoToScan: () => void;
  onImportItems: (items: ShelfItem[]) => void;
  onQuickUpdateItem: (item: ShelfItem) => void;
  onClearAllItems: () => void;
}

export const MyShelfTab: React.FC<MyShelfTabProps> = ({
  shelfItems,
  boxes,
  onEditItem,
  onDeleteItem,
  onGoToScan,
  onImportItems,
  onQuickUpdateItem,
  onClearAllItems,
}) => {
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const importFileInputRef = React.useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [coverFetchProgress, setCoverFetchProgress] = useState<{ done: number; total: number; found: number } | null>(null);
  const [recalcProgress, setRecalcProgress] = useState<{ done: number; total: number; changed: number } | null>(null);
  const [isRecalcConfirmOpen, setIsRecalcConfirmOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMoreMenuOpen]);

  const missingCoverItems = shelfItems.filter((i) => !i.coverArtUrl);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null);

  const handleFlagDuplicateGroup = (group: DuplicateGroup) => {
    const note = `Possible duplicate: ${group.items.length} records share the exact same artist + album title. Could be two different pressings you legitimately own, or a duplicate entry — please confirm.`;
    for (const item of group.items) {
      onQuickUpdateItem({
        ...item,
        needsReview: true,
        reviewNotes: item.reviewNotes ? `${item.reviewNotes} | ${note}` : note,
      });
    }
    setDuplicateGroups((prev) => (prev ? prev.filter((g) => g.key !== group.key) : prev));
  };

  const handleBulkRecalculate = async () => {
    const targets = shelfItems;
    if (targets.length === 0) return;
    setIsRecalcConfirmOpen(false);
    setRecalcProgress({ done: 0, total: targets.length, changed: 0 });
    let changed = 0;
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      try {
        const res = await fetch(apiUrl("recalculateValuation"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            albumTitle: item.albumTitle,
            artist: item.artist,
            catalogueNumber: item.catalogueNumber,
            country: item.country,
            label: item.label,
            genre: item.genre,
            // Omit baseMintValue on purpose so this always runs through the current
            // (fixed) heuristic formula from scratch, rather than reusing whatever
            // baseline the record already had (e.g. a carried-over spreadsheet value).
            mediaGrade: item.mediaGrade,
            sleeveGrade: item.sleeveGrade,
            obiCondition: item.obiCondition,
            packageInclusions: item.packageInclusions,
            freeTextNotes: item.customNotes || item.freeTextNotes || "",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.finalValuation) {
            onQuickUpdateItem({ ...item, calculatedValue: data.finalValuation });
            changed++;
          }
        }
      } catch (err) {
        console.warn("Bulk recalculate failed for", item.albumTitle, err);
      }
      setRecalcProgress({ done: i + 1, total: targets.length, changed });
    }
    setTimeout(() => setRecalcProgress(null), 4000);
  };

  const handleBulkFetchCovers = async () => {
    const targets = missingCoverItems;
    if (targets.length === 0) return;
    setCoverFetchProgress({ done: 0, total: targets.length, found: 0 });
    let found = 0;
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      try {
        const res = await fetch(
          `${apiUrl("coverArt")}?artist=${encodeURIComponent(item.artist)}&albumTitle=${encodeURIComponent(
            item.albumTitle
          )}&catalogueNumber=${encodeURIComponent(item.catalogueNumber || "")}&matrixCode=${encodeURIComponent(item.matrixCode || "")}`
        );
        if (res.ok) {
          const data = await res.json();
          const url = data.results?.[0];
          if (url) {
            onQuickUpdateItem({ ...item, coverArtUrl: url });
            found++;
          }
        }
      } catch (err) {
        console.warn("Bulk cover fetch failed for", item.albumTitle, err);
      }
      setCoverFetchProgress({ done: i + 1, total: targets.length, found });
    }
    setTimeout(() => setCoverFetchProgress(null), 4000);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const arr = Array.isArray(parsed) ? parsed : null;
        if (!arr) throw new Error("File must contain a JSON array of records.");
        const invalidIndex = arr.findIndex((it) => !it || typeof it.albumTitle !== "string" || typeof it.artist !== "string");
        if (invalidIndex !== -1) {
          throw new Error(`Record at position ${invalidIndex + 1} is missing an albumTitle/artist.`);
        }
        onImportItems(arr as ShelfItem[]);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Could not read that file as a valid VinylVault JSON export.");
      }
    };
    reader.readAsText(file);
  };
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const needsReviewCount = shelfItems.filter((i) => i.needsReview).length;
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"value-desc" | "value-asc" | "title" | "year" | "added">("value-desc");
  const [viewMode, setViewMode] = useState<"grid" | "coverflow">("grid");
  const [itemToDelete, setItemToDelete] = useState<ShelfItem | null>(null);

  const anyModalOpen = !!itemToDelete || isClearAllConfirmOpen || isRecalcConfirmOpen || !!duplicateGroups;
  useEscapeToClose(anyModalOpen, () => {
    setItemToDelete(null);
    setIsClearAllConfirmOpen(false);
    setIsRecalcConfirmOpen(false);
    setDuplicateGroups(null);
  });
  useBodyScrollLock(anyModalOpen);

  const recentlyAdded = [...shelfItems]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, 10);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  // Items after genre filtering only (used to compute relevant style counts/options)
  const genreFilteredItems = shelfItems.filter((item) => {
    if (selectedGenres.length === 0) return true;
    const norm = normalizeDiscogsGenre(item.genre, item.styles);
    return selectedGenres.includes(norm.genre);
  });

  // All distinct styles available within the genre-filtered set, with counts
  const availableStyles = (() => {
    const counts = new Map<string, number>();
    for (const item of genreFilteredItems) {
      const norm = normalizeDiscogsGenre(item.genre, item.styles);
      for (const style of norm.styles) {
        counts.set(style, (counts.get(style) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  })();

  // Summary Metrics
  const totalAlbums = shelfItems.length;
  const totalValueMedian = shelfItems.reduce(
    (acc, item) => acc + (item.calculatedValue?.median || 0),
    0
  );
  const totalValueLow = shelfItems.reduce(
    (acc, item) => acc + (item.calculatedValue?.low || 0),
    0
  );

  const animatedAlbums = Math.round(useCountUp(totalAlbums));
  const animatedValueMedian = Math.round(useCountUp(totalValueMedian));
  const totalValueHigh = shelfItems.reduce(
    (acc, item) => acc + (item.calculatedValue?.high || 0),
    0
  );

  // Most Valuable Pressing
  const mostValuable = shelfItems.length > 0
    ? [...shelfItems].sort((a, b) => (b.calculatedValue?.median || 0) - (a.calculatedValue?.median || 0))[0]
    : null;

  // Search & Filter items
  const filteredItems = shelfItems.filter((item) => {
    const norm = normalizeDiscogsGenre(item.genre, item.styles);

    if (needsReviewOnly && !item.needsReview) {
      return false;
    }

    // Genre Filter check (multi-select, OR within genres)
    if (selectedGenres.length > 0 && !selectedGenres.includes(norm.genre)) {
      return false;
    }

    // Style Filter check (multi-select, OR within styles — item matches if it has ANY selected style)
    if (selectedStyles.length > 0 && !norm.styles.some((s) => selectedStyles.includes(s))) {
      return false;
    }

    const query = searchQuery.toLowerCase();
    if (!query) return true;

    return (
      (item.albumTitle || "").toLowerCase().includes(query) ||
      (item.artist || "").toLowerCase().includes(query) ||
      (item.catalogueNumber || "").toLowerCase().includes(query) ||
      norm.genre.toLowerCase().includes(query) ||
      norm.styles.some(s => s.toLowerCase().includes(query)) ||
      (item.customNotes || "").toLowerCase().includes(query) ||
      (item.acquisitionCountry || "").toLowerCase().includes(query) ||
      (item.acquisitionTransactionType || "").toLowerCase().includes(query)
    );
  });

  // Sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "value-desc") {
      return (b.calculatedValue?.median || 0) - (a.calculatedValue?.median || 0);
    }
    if (sortBy === "value-asc") {
      return (a.calculatedValue?.median || 0) - (b.calculatedValue?.median || 0);
    }
    if (sortBy === "title") {
      return (a.albumTitle || "").localeCompare(b.albumTitle || "");
    }
    if (sortBy === "year") {
      return (parseInt(b.releaseYear) || 0) - (parseInt(a.releaseYear) || 0);
    }
    if (sortBy === "added") {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
    return 0;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-[#E2DCD0]">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#2B2B2B]">My Vinyl Shelf</h2>
          <p className="text-xs font-sans text-[#6B655B]">Organize, filter, and track your archived vinyl collection</p>
        </div>
        <button
          onClick={onGoToScan}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#A94A42] text-white hover:bg-[#8E3E37] text-xs font-bold font-sans uppercase tracking-wider transition shadow-sm cursor-pointer shrink-0 w-full sm:w-auto"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
          <span>Back to Scanner & Search</span>
        </button>
      </div>
      {/* Top Insights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Total Albums Owned */}
        <div className="p-5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#6B655B] block">
              Total Collection
            </span>
            <div className="text-3xl font-serif font-bold text-[#2B2B2B] mt-1 tabular-nums">
              {animatedAlbums}
            </div>
            <span className="text-[10px] font-sans text-[#6B655B]">
              Albums Scanned & Archived
            </span>
          </div>
          <div className="p-3 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
            <Library className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Total Estimated Collection Value */}
        <div className="p-5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#6B655B] block">
              Total Collection Value
            </span>
            <div className="text-3xl font-serif font-bold text-[#2B2B2B] mt-1 tabular-nums">
              S${animatedValueMedian.toLocaleString()}
            </div>
            <span className="text-[10px] font-sans text-[#6B655B]">
              Est. Range: S${totalValueLow.toLocaleString()} - S${totalValueHigh.toLocaleString()}
            </span>
          </div>
          <div className="p-3 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Most Valuable Pressing */}
        <div className="p-5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm relative overflow-hidden flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#6B655B] block flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#A94A42]" />
              Most Valuable
            </span>
            {mostValuable ? (
              <div className="mt-1">
                <div className="text-sm font-serif font-bold text-[#2B2B2B] truncate">
                  {mostValuable.albumTitle}
                </div>
                <div className="text-xs font-sans text-[#A94A42] font-bold mt-0.5">
                  S${mostValuable.calculatedValue.median} ({mostValuable.mediaGrade} / {mostValuable.sleeveGrade})
                </div>
              </div>
            ) : (
              <div className="text-xs font-sans text-[#6B655B] mt-2">No records added yet</div>
            )}
          </div>
          {mostValuable && mostValuable.coverArtUrl ? (
            <img
              src={mostValuable.coverArtUrl}
              alt={mostValuable.albumTitle}
              className="w-12 h-12 rounded object-cover border border-[#E2DCD0] shadow-xs"
            />
          ) : (
            <div className="p-3 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
              <Award className="w-6 h-6" />
            </div>
          )}
        </div>
      </div>

      {/* Recently Added Ticker */}
      {shelfItems.length > 1 && (
        <div className="rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm overflow-hidden py-3">
          <span className="block px-4 pb-2 text-[10px] font-sans font-bold uppercase tracking-wider text-[#6B655B]">
            Recently Added
          </span>
          <div className="overflow-hidden">
            <div className="marquee-track flex items-center gap-3 w-max">
              {[...recentlyAdded, ...recentlyAdded].map((item, i) => (
                <button
                  key={`${item.id}-${i}`}
                  type="button"
                  onClick={() => onEditItem(item)}
                  title={`${item.albumTitle} — ${item.artist}`}
                  className="shrink-0 w-14 h-14 rounded-md overflow-hidden border border-[#E2DCD0] hover:border-[#A94A42]/50 shadow-xs transition cursor-pointer"
                >
                  {item.coverArtUrl ? (
                    <img src={item.coverArtUrl} alt={item.albumTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#EFEAE0] flex items-center justify-center">
                      <Disc3 className="w-5 h-5 text-[#A94A42]/50" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Control Bar & Export Actions */}
      <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#6B655B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search artist, title, cat#, style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md pl-9 pr-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
            />
          </div>

          {/* Genre + Style Multi-Select Filter Toggle */}
          <button
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 text-xs font-sans px-2.5 py-1.5 rounded-md border transition w-full sm:w-auto justify-center ${
              selectedGenres.length > 0 || selectedStyles.length > 0
                ? "text-[#A94A42] bg-[#A94A42]/10 border-[#A94A42]/30 font-bold"
                : "text-[#6B655B] bg-[#EFEAE0] border-[#D8D0C0] hover:bg-[#E2DCD0]/40"
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
            <span className="uppercase text-[10px] tracking-wider font-bold">
              Genre / Style{selectedGenres.length + selectedStyles.length > 0 ? ` (${selectedGenres.length + selectedStyles.length})` : ""}
            </span>
          </button>

          {needsReviewCount > 0 && (
            <button
              onClick={() => setNeedsReviewOnly((prev) => !prev)}
              className={`flex items-center gap-1.5 text-xs font-sans px-2.5 py-1.5 rounded-md border transition w-full sm:w-auto justify-center ${
                needsReviewOnly
                  ? "text-amber-700 bg-amber-100 border-amber-400 font-bold"
                  : "text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100"
              }`}
              title="Records where a grade or detail was defaulted rather than confirmed — worth checking against the physical record"
            >
              <span className="uppercase text-[10px] tracking-wider font-bold">
                Needs Review ({needsReviewCount})
              </span>
            </button>
          )}
        </div>

        {/* Sort selector & Export Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end font-sans">
          {/* Grid / Coverflow View Toggle */}
          <div className="flex items-center rounded-md border border-[#D8D0C0] overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                viewMode === "grid" ? "bg-[#A94A42] text-white" : "bg-[#EFEAE0] text-[#6B655B] hover:bg-[#E2DCD0]/40"
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode("coverflow")}
              title="Coverflow view"
              className={`px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                viewMode === "coverflow" ? "bg-[#A94A42] text-white" : "bg-[#EFEAE0] text-[#6B655B] hover:bg-[#E2DCD0]/40"
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" />
              <span>Coverflow</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#6B655B]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#A94A42]" />
            <span className="uppercase text-[10px] tracking-wider font-bold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#A94A42] transition font-sans"
            >
              <option value="value-desc">Value (High to Low)</option>
              <option value="value-asc">Value (Low to High)</option>
              <option value="title">Album Title (A-Z)</option>
              <option value="year">Release Year</option>
              <option value="added">Recently Added</option>
            </select>
          </div>

          {/* More Actions Menu — Import/Export/Clear/Fetch Covers/Recalculate */}
          <div className="relative" ref={moreMenuRef}>
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded-md bg-[#EFEAE0] text-[#2B2B2B] border border-[#D8D0C0] hover:bg-[#FAF8F3] text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
              title="More actions"
            >
              <MoreVertical className="w-3.5 h-3.5 text-[#6B655B]" />
              <span>Actions</span>
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-72 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-xl z-30 py-1.5 font-sans">
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    importFileInputRef.current?.click();
                  }}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left"
                >
                  <Upload className="w-3.5 h-3.5 text-[#6B655B]" />
                  <span>Import from JSON</span>
                </button>

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    exportToCSV(shelfItems);
                  }}
                  disabled={shelfItems.length === 0}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#6B655B]" />
                  <span>Export to CSV</span>
                </button>

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    exportToJSON(shelfItems);
                  }}
                  disabled={shelfItems.length === 0}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileJson className="w-3.5 h-3.5 text-[#6B655B]" />
                  <span>Export to JSON</span>
                </button>

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    exportValuationReportPdf(shelfItems);
                  }}
                  disabled={shelfItems.length === 0}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6B655B]" />
                  <span>Valuation Report (PDF)</span>
                </button>

                <div className="my-1.5 border-t border-[#E2DCD0]" />

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    handleBulkFetchCovers();
                  }}
                  disabled={missingCoverItems.length === 0 || !!coverFetchProgress}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#6B655B] ${coverFetchProgress ? "animate-spin" : ""}`} />
                  <span>
                    {coverFetchProgress
                      ? `Fetching Covers ${coverFetchProgress.done}/${coverFetchProgress.total}`
                      : missingCoverItems.length > 0
                      ? `Fetch ${missingCoverItems.length} Missing Cover${missingCoverItems.length === 1 ? "" : "s"}`
                      : "Fetch Missing Covers"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setIsRecalcConfirmOpen(true);
                  }}
                  disabled={shelfItems.length === 0 || !!recalcProgress}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <DollarSign className={`w-3.5 h-3.5 text-[#6B655B] ${recalcProgress ? "animate-pulse" : ""}`} />
                  <span>
                    {recalcProgress
                      ? `Recalculating ${recalcProgress.done}/${recalcProgress.total}`
                      : "Recalculate All Values"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setDuplicateGroups(findDuplicateGroups(shelfItems));
                  }}
                  disabled={shelfItems.length === 0}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Layers className="w-3.5 h-3.5 text-[#6B655B]" />
                  <span>Check for Duplicates</span>
                </button>

                <div className="my-1.5 border-t border-[#E2DCD0]" />

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setClearAllConfirmText("");
                    setIsClearAllConfirmOpen(true);
                  }}
                  disabled={shelfItems.length === 0}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 text-xs text-[#A94A42] hover:bg-red-50 transition cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#A94A42]" />
                  <span>Clear All Records</span>
                </button>
              </div>
            )}
          </div>
        </div>
        {importError && (
          <div className="text-xs font-sans text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Import failed: {importError}
          </div>
        )}
        {coverFetchProgress && coverFetchProgress.done === coverFetchProgress.total && (
          <div className="text-xs font-sans text-[#6B655B] bg-[#EFEAE0] border border-[#D8D0C0] rounded-md px-3 py-2">
            Found real cover art for {coverFetchProgress.found} of {coverFetchProgress.total} records. The rest genuinely
            couldn't be matched (obscure/regional pressings) — those will show a "no cover art" placeholder instead of a
            random unrelated photo.
          </div>
        )}
        {recalcProgress && recalcProgress.done === recalcProgress.total && (
          <div className="text-xs font-sans text-[#6B655B] bg-[#EFEAE0] border border-[#D8D0C0] rounded-md px-3 py-2">
            Recalculated {recalcProgress.changed} of {recalcProgress.total} records' Est. Value using the current valuation engine.
          </div>
        )}
      </div>

      {/* Genre + Style Multi-Select Filter Panel */}
      {isFilterPanelOpen && (
        <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm space-y-4 font-sans">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B655B] block mb-2">
              Genre <span className="opacity-60">(select multiple — records matching ANY selected genre)</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DISCOGS_MACRO_GENRES.map((g) => {
                const count = shelfItems.filter((item) => normalizeDiscogsGenre(item.genre, item.styles).genre === g).length;
                if (count === 0) return null;
                const isActive = selectedGenres.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition ${
                      isActive
                        ? "bg-[#A94A42] border-[#A94A42] text-white font-bold"
                        : "bg-[#EFEAE0] border-[#D8D0C0] text-[#2B2B2B] hover:border-[#A94A42]/50"
                    }`}
                  >
                    {g} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {availableStyles.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B655B] block mb-2">
                Style <span className="opacity-60">(select multiple — records matching ANY selected style)</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableStyles.map(([style, count]) => {
                  const isActive = selectedStyles.includes(style);
                  return (
                    <button
                      key={style}
                      onClick={() => toggleStyle(style)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition ${
                        isActive
                          ? "bg-[#A94A42] border-[#A94A42] text-white font-bold"
                          : "bg-[#EFEAE0] border-[#D8D0C0] text-[#2B2B2B] hover:border-[#A94A42]/50"
                      }`}
                    >
                      {style} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(selectedGenres.length > 0 || selectedStyles.length > 0) && (
            <button
              onClick={() => {
                setSelectedGenres([]);
                setSelectedStyles([]);
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#A94A42] hover:underline cursor-pointer"
            >
              Clear Genre/Style Selection
            </button>
          )}
        </div>
      )}

      {/* Active Filter Notice Bar if search or genre/style filter is active */}
      {(selectedGenres.length > 0 || selectedStyles.length > 0 || searchQuery.trim() !== "") && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-md bg-[#EFEAE0] border border-[#D8D0C0] text-xs font-sans text-[#6B655B]">
          <span>
            Showing <strong className="text-[#2B2B2B]">{filteredItems.length}</strong> of <strong className="text-[#2B2B2B]">{totalAlbums}</strong> records
            {selectedGenres.length > 0 && ` in ${selectedGenres.join(", ")}`}
            {selectedStyles.length > 0 && ` styled ${selectedStyles.join(", ")}`}
            {searchQuery.trim() && ` matching "${searchQuery}"`}
          </span>
          <button
            onClick={() => {
              setSelectedGenres([]);
              setSelectedStyles([]);
              setSearchQuery("");
            }}
            className="text-[10px] font-bold uppercase tracking-wider text-[#A94A42] hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Coverflow Browser */}
      {viewMode === "coverflow" && sortedItems.length > 0 && (
        <div className="p-4 sm:p-6 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm">
          <CoverflowCarousel items={sortedItems} onSelectItem={onEditItem} />
        </div>
      )}

      {/* Collection Grid View */}
      {sortedItems.length > 0 ? (
        viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="spotlight-card rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] hover:border-[#A94A42]/40 p-5 shadow-sm hover:shadow-lg transition flex flex-col justify-between group [transform-style:preserve-3d] will-change-transform"
              onMouseMove={(e) => {
                if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
                const card = e.currentTarget;
                const rect = card.getBoundingClientRect();
                const px = (e.clientX - rect.left) / rect.width - 0.5;
                const py = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-3px)`;
                card.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
                card.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
              }}
            >
              <div className="space-y-4">
                {/* Header with artwork */}
                <div className="flex items-start gap-4">
                  <RecordCoverImage
                    src={item.coverArtUrl}
                    artist={item.artist}
                    albumTitle={item.albumTitle}
                    catalogueNumber={item.catalogueNumber}
                    matrixCode={item.matrixCode}
                    onImageChange={(newUrl) => onQuickUpdateItem({ ...item, coverArtUrl: newUrl })}
                    className="w-20 h-20 rounded border border-[#E2DCD0] shadow-xs flex-shrink-0"
                    imgClassName="w-full h-full object-cover rounded group-hover:scale-105 transition"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-sans font-medium text-[#6B655B] tracking-wider mb-0.5 flex items-center gap-1.5">
                      <span>{item.catalogueNumber || "Cat# Unlisted"}</span>
                      {item.needsReview && (
                        <span
                          className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 text-[9px] font-bold uppercase tracking-wider"
                          title={item.reviewNotes || "Needs review"}
                        >
                          Needs Review
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-base text-[#2B2B2B] truncate">
                      {item.albumTitle}
                    </h3>
                    <p className="text-xs font-serif text-[#A94A42] truncate font-medium">{item.artist}</p>
                    <p className="text-[10px] font-sans text-[#6B655B] mt-1 break-words">
                      {item.label} ({item.country || "US"}, {item.releaseYear}) {item.format ? `• ${cleanFormatSpec(item.format)}` : ""}
                    </p>

                    {/* Two-Tiered Genre & Styles Tags */}
                    {(() => {
                      const normG = normalizeDiscogsGenre(item.genre, item.styles);
                      return (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20 text-[#A94A42]">
                            {normG.genre}
                          </span>
                          {normG.styles.map((style, sIdx) => (
                            <span key={sIdx} className="text-[9px] font-sans px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]">
                              {style}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Condition & Calculated Value */}
                <div className="p-3 rounded-md bg-[#EFEAE0] border border-[#D8D0C0] flex items-center justify-between font-sans">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.obiCondition && item.obiCondition !== "N/A" && item.obiCondition !== "none" && (
                      <div className="text-center px-2 py-0.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20 text-[#A94A42] font-bold text-[10px]">
                        OBI: {item.obiCondition}
                      </div>
                    )}
                  </div>

                  <div className="text-right ml-auto">
                    <span className="text-[9px] text-[#6B655B] block uppercase tracking-wider font-bold">Est. Value</span>
                    <span className="text-base font-serif font-bold text-[#A94A42]">
                      S${item.calculatedValue?.median || 0}
                    </span>
                  </div>
                </div>

                {/* Physical Package Inclusions Badges */}
                {item.packageInclusions && Object.values(item.packageInclusions).some(Boolean) && (
                  <div className="flex flex-wrap gap-1 font-sans">
                    {item.packageInclusions.lyricsInsert && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]">
                        Lyrics Insert
                      </span>
                    )}
                    {item.packageInclusions.printedInnerSleeve && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]">
                        Printed Inner
                      </span>
                    )}
                    {item.packageInclusions.bookletLinerNotes && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]">
                        Booklet
                      </span>
                    )}
                    {item.packageInclusions.originalPoster && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]">
                        Poster
                      </span>
                    )}
                    {item.packageInclusions.photosPostcards && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B]">
                        Photos
                      </span>
                    )}
                  </div>
                )}

                {/* Custom Notes & Shelf Details */}
                <div className="space-y-1.5 text-xs text-[#6B655B] pt-1 font-sans">
                  {item.boxId && item.boxId !== UNCATEGORISED_BOX_ID && boxes.some((b) => b.id === item.boxId) && (
                    <div className="flex items-center gap-1.5 text-[#2B2B2B]">
                      <Package className="w-3.5 h-3.5 text-[#A94A42]" />
                      <span>Box: {boxes.find((b) => b.id === item.boxId)?.name}</span>
                    </div>
                  )}

                  {item.purchasePrice !== undefined && (
                    <div className="flex items-center gap-1.5 text-[#6B655B]">
                      <span>Cost: S${item.purchasePrice}</span>
                      {(item.acquisitionTransactionType || item.acquisitionCountry) && (
                        <span className="opacity-75">
                          ({[item.acquisitionTransactionType, item.acquisitionCountry].filter(Boolean).join(", ")})
                        </span>
                      )}
                    </div>
                  )}

                  {item.customNotes && (
                    <p className="p-2.5 rounded-md bg-[#EFEAE0] border border-[#D8D0C0] text-[11px] text-[#2B2B2B] italic line-clamp-2 mt-1 font-sans">
                      "{item.customNotes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E2DCD0] mt-4">
                <span className="text-[10px] font-sans text-[#6B655B] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#A94A42]" />
                  Added {new Date(item.addedAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditItem(item)}
                    className="p-1.5 rounded text-[#6B655B] hover:text-[#A94A42] hover:bg-[#EFEAE0] transition cursor-pointer"
                    title="Edit Record Details"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setItemToDelete(item)}
                    className="p-1.5 rounded text-[#6B655B] hover:text-[#A94A42] hover:bg-[#EFEAE0] transition cursor-pointer"
                    title="Remove from Shelf"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )
      ) : (
        /* Empty State */
        <div className="p-12 text-center rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] max-w-lg mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20 flex items-center justify-center mx-auto">
            <Library className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold font-serif text-[#2B2B2B]">
            {searchQuery ? "No matching records found" : "Your Shelf is Empty"}
          </h3>
          <p className="text-xs font-sans text-[#6B655B] max-w-xs mx-auto leading-relaxed">
            {searchQuery
              ? "Try adjusting your search query or clear filters to view all shelf albums."
              : "Scan or search a vinyl record pressing using Catalogue Numbers, Matrix Groove codes, or cover photos to start building your collection."}
          </p>
          {!searchQuery && (
            <button
              onClick={onGoToScan}
              className="px-6 py-2.5 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white font-bold uppercase text-xs font-sans tracking-wider flex items-center gap-2 mx-auto shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Scan First Vinyl Record</span>
            </button>
          )}
        </div>
      )}

      {/* Duplicate Check Results Modal */}
      {duplicateGroups && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setDuplicateGroups(null)}
        >
          <div
            className="bg-[#FAF8F3] border border-[#E2DCD0] rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[#A94A42]">
                <div className="p-2.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20">
                  <Layers className="w-5 h-5 text-[#A94A42]" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Duplicate Check</h3>
                  <p className="text-[11px] font-sans text-[#6B655B]">
                    {duplicateGroups.length === 0 ? "No matches found" : `${duplicateGroups.length} possible group${duplicateGroups.length === 1 ? "" : "s"} found`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateGroups(null)}
                className="p-1.5 rounded-md text-[#6B655B] hover:text-[#2B2B2B] hover:bg-[#EFEAE0] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {duplicateGroups.length === 0 ? (
              <p className="text-xs font-sans text-[#6B655B] bg-[#EFEAE0] border border-[#D8D0C0] rounded-md p-3">
                No two records share the exact same artist and album title. This doesn't rule out near-duplicates with
                slightly different titles — just exact-title matches.
              </p>
            ) : (
              <div className="space-y-3 font-sans">
                {duplicateGroups.map((group) => (
                  <div key={group.key} className="p-3 rounded-lg bg-[#EFEAE0] border border-[#D8D0C0] space-y-2">
                    <div>
                      <h4 className="text-sm font-serif font-bold text-[#2B2B2B]">{group.albumTitle}</h4>
                      <p className="text-xs text-[#A94A42] font-medium">{group.artist}</p>
                    </div>
                    <div className="space-y-1">
                      {group.items.map((it) => (
                        <div key={it.id} className="text-[11px] text-[#6B655B]">
                          Cat#: {it.catalogueNumber || "(none)"} · {it.releaseYear || "?"} · {it.label || "?"} · S${it.calculatedValue?.median?.toFixed(0) ?? "0"}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleFlagDuplicateGroup(group)}
                      className="text-[10px] font-bold uppercase tracking-wider text-[#A94A42] hover:underline cursor-pointer"
                    >
                      Flag for Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recalculate All Confirmation Modal */}
      {isRecalcConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsRecalcConfirmOpen(false)}
        >
          <div
            className="bg-[#FAF8F3] border border-[#E2DCD0] rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-[#A94A42]">
              <div className="p-2.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20">
                <DollarSign className="w-5 h-5 text-[#A94A42]" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Recalculate All Values?</h3>
                <p className="text-[11px] font-sans text-[#6B655B]">Replaces every record's Est. Value</p>
              </div>
            </div>

            <p className="text-xs font-sans text-[#2B2B2B] leading-relaxed bg-[#EFEAE0] p-3 rounded-lg border border-[#D8D0C0]">
              This runs all <strong className="text-[#A94A42]">{shelfItems.length}</strong> records through the app's valuation
              engine (using each record's genre, grading, and country) and replaces their current Est. Value with the result.
              For your imported records, this <strong>overwrites your own spreadsheet estimates</strong> — export a CSV/JSON
              backup first if you want to keep those numbers on hand.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DCD0]">
              <button
                type="button"
                onClick={() => setIsRecalcConfirmOpen(false)}
                className="px-4 py-2 rounded-md border border-[#D8D0C0] text-xs font-sans font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkRecalculate}
                className="px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
              >
                Recalculate All {shelfItems.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isClearAllConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsClearAllConfirmOpen(false)}
        >
          <div
            className="bg-[#FAF8F3] border border-[#E2DCD0] rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-[#A94A42]">
              <div className="p-2.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20">
                <Trash2 className="w-5 h-5 text-[#A94A42]" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Clear Entire Shelf?</h3>
                <p className="text-[11px] font-sans text-[#6B655B]">This cannot be undone</p>
              </div>
            </div>

            <p className="text-xs font-sans text-[#2B2B2B] leading-relaxed bg-[#EFEAE0] p-3 rounded-lg border border-[#D8D0C0]">
              This deletes all <strong className="text-[#A94A42]">{shelfItems.length}</strong> records currently on your shelf
              (and syncs the deletion if you have sync turned on). Do this before re-importing a JSON file so records don't
              stack on top of what's already here. Type <strong>DELETE</strong> below to confirm.
            </p>

            <input
              type="text"
              value={clearAllConfirmText}
              onChange={(e) => setClearAllConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DCD0]">
              <button
                type="button"
                onClick={() => setIsClearAllConfirmOpen(false)}
                className="px-4 py-2 rounded-md border border-[#D8D0C0] text-xs font-sans font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearAllConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={() => {
                  onClearAllItems();
                  setIsClearAllConfirmOpen(false);
                }}
                className="px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider transition shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete All {shelfItems.length} Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setItemToDelete(null)}
        >
          <div
            className="bg-[#FAF8F3] border border-[#E2DCD0] rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-[#A94A42]">
              <div className="p-2.5 rounded-full bg-[#A94A42]/10 border border-[#A94A42]/20">
                <Trash2 className="w-5 h-5 text-[#A94A42]" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Confirm Deletion</h3>
                <p className="text-[11px] font-sans text-[#6B655B]">Remove album from shelf</p>
              </div>
            </div>

            <p className="text-xs font-sans text-[#2B2B2B] leading-relaxed bg-[#EFEAE0] p-3 rounded-lg border border-[#D8D0C0]">
              Are you sure you want to delete <strong className="text-[#A94A42]">"{itemToDelete.albumTitle}"</strong> by <strong className="text-[#2B2B2B]">{itemToDelete.artist}</strong> ({itemToDelete.catalogueNumber || "No Cat#"})?
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DCD0]">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-md border border-[#D8D0C0] text-xs font-sans font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

