import React, { useState } from "react";
import {
  Library,
  Download,
  Search,
  SlidersHorizontal,
  Trash2,
  Edit,
  DollarSign,
  MapPin,
  Tag,
  Award,
  Sparkles,
  ArrowUpDown,
  Plus,
  FileSpreadsheet,
  FileJson,
  Calendar,
  Layers,
  ArrowLeft
} from "lucide-react";
import { ShelfItem } from "../types";
import { exportToCSV, exportToJSON } from "../utils/valuation";
import { cleanFormatSpec } from "../utils/format";
import { normalizeDiscogsGenre, DISCOGS_MACRO_GENRES } from "../utils/genre";
import { RecordCoverImage } from "./RecordCoverImage";

interface MyShelfTabProps {
  shelfItems: ShelfItem[];
  onEditItem: (item: ShelfItem) => void;
  onDeleteItem: (id: string) => void;
  onGoToScan: () => void;
}

export const MyShelfTab: React.FC<MyShelfTabProps> = ({
  shelfItems,
  onEditItem,
  onDeleteItem,
  onGoToScan,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"value-desc" | "value-asc" | "title" | "year" | "added">("value-desc");
  const [itemToDelete, setItemToDelete] = useState<ShelfItem | null>(null);

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

    // Genre Filter check
    if (selectedGenreFilter !== "ALL" && norm.genre !== selectedGenreFilter) {
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
      (item.storeLocation || "").toLowerCase().includes(query)
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
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#E2DCD0]">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#2B2B2B]">My Vinyl Shelf</h2>
          <p className="text-xs font-sans text-[#6B655B]">Organize, filter, and track your archived vinyl collection</p>
        </div>
        <button
          onClick={onGoToScan}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#A94A42] text-white hover:bg-[#8E3E37] text-xs font-bold font-sans uppercase tracking-wider transition shadow-sm cursor-pointer shrink-0"
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
            <div className="text-3xl font-serif font-bold text-[#2B2B2B] mt-1">
              {totalAlbums}
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
            <div className="text-3xl font-serif font-bold text-[#2B2B2B] mt-1">
              S${totalValueMedian.toLocaleString()}
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
          {mostValuable ? (
            <img
              src={mostValuable.coverArtUrl || "https://images.unsplash.com/photo-1619983081563-430f63602796?w=200"}
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

          {/* Macro-Genre Dropdown Filter */}
          <div className="flex items-center gap-1.5 text-xs text-[#6B655B] font-sans w-full sm:w-auto">
            <Tag className="w-3.5 h-3.5 text-[#A94A42]" />
            <span className="uppercase text-[10px] tracking-wider shrink-0 font-bold">Genre:</span>
            <select
              value={selectedGenreFilter}
              onChange={(e) => setSelectedGenreFilter(e.target.value)}
              className="w-full sm:w-auto bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#A94A42] transition truncate font-sans"
            >
              <option value="ALL">All Genres ({shelfItems.length})</option>
              {DISCOGS_MACRO_GENRES.map((g) => {
                const count = shelfItems.filter(item => normalizeDiscogsGenre(item.genre, item.styles).genre === g).length;
                return (
                  <option key={g} value={g}>
                    {g} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Sort selector & Export Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end font-sans">
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

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(shelfItems)}
              disabled={shelfItems.length === 0}
              className="px-3 py-1.5 rounded-md bg-[#A94A42] text-white hover:bg-[#8E3E37] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-40 shadow-xs cursor-pointer"
              title="Export Collection to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>CSV</span>
            </button>

            <button
              onClick={() => exportToJSON(shelfItems)}
              disabled={shelfItems.length === 0}
              className="px-3 py-1.5 rounded-md bg-[#EFEAE0] text-[#2B2B2B] border border-[#D8D0C0] hover:bg-[#FAF8F3] text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
              title="Export Collection to JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-[#6B655B]" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Notice Bar if search or genre filter is active */}
      {(selectedGenreFilter !== "ALL" || searchQuery.trim() !== "") && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-md bg-[#EFEAE0] border border-[#D8D0C0] text-xs font-sans text-[#6B655B]">
          <span>
            Showing <strong className="text-[#2B2B2B]">{filteredItems.length}</strong> of <strong className="text-[#2B2B2B]">{totalAlbums}</strong> records
            {selectedGenreFilter !== "ALL" && ` in ${selectedGenreFilter}`}
            {searchQuery.trim() && ` matching "${searchQuery}"`}
          </span>
          <button
            onClick={() => {
              setSelectedGenreFilter("ALL");
              setSearchQuery("");
            }}
            className="text-[10px] font-bold uppercase tracking-wider text-[#A94A42] hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Collection Grid View */}
      {sortedItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] hover:border-[#A94A42]/40 p-5 shadow-sm transition flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Header with artwork */}
                <div className="flex items-start gap-4">
                  <RecordCoverImage
                    src={item.coverArtUrl}
                    artist={item.artist}
                    albumTitle={item.albumTitle}
                    catalogueNumber={item.catalogueNumber}
                    onImageChange={(newUrl) => onEditItem({ ...item, coverArtUrl: newUrl })}
                    className="w-20 h-20 rounded border border-[#E2DCD0] shadow-xs flex-shrink-0"
                    imgClassName="w-full h-full object-cover rounded group-hover:scale-105 transition"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-sans font-medium text-[#6B655B] tracking-wider mb-0.5">
                      {item.catalogueNumber || "Cat# Unlisted"}
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
                  {item.physicalShelfLocation && (
                    <div className="flex items-center gap-1.5 text-[#2B2B2B]">
                      <MapPin className="w-3.5 h-3.5 text-[#A94A42]" />
                      <span>Loc: {item.physicalShelfLocation}</span>
                    </div>
                  )}

                  {item.purchasePrice !== undefined && (
                    <div className="flex items-center gap-1.5 text-[#6B655B]">
                      <span>Cost: S${item.purchasePrice}</span>
                      {item.storeLocation && <span className="opacity-75">({item.storeLocation})</span>}
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

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FAF8F3] border border-[#E2DCD0] rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
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

