import React, { useState } from "react";
import { Heart, Plus, Trash2, ArrowRight, DollarSign } from "lucide-react";
import { WantlistItem, WantlistPriority, ShelfItem } from "../types";
import { useCurrency } from "../context/CurrencyContext";

interface WantlistTabProps {
  wantlist: WantlistItem[];
  onAddItem: (item: WantlistItem) => void;
  onDeleteItem: (id: string) => void;
  onMoveToShelf: (item: WantlistItem) => void;
}

const PRIORITY_STYLES: Record<WantlistPriority, string> = {
  high: "bg-red-100 text-red-700 border-red-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  low: "bg-[#EFEAE0] text-[#6B655B] border-[#D8D0C0]",
};

export const WantlistTab: React.FC<WantlistTabProps> = ({ wantlist, onAddItem, onDeleteItem, onMoveToShelf }) => {
  const { format } = useCurrency();
  const [artist, setArtist] = useState("");
  const [albumTitle, setAlbumTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [priority, setPriority] = useState<WantlistPriority>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist.trim() || !albumTitle.trim()) return;
    onAddItem({
      id: "want-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      artist: artist.trim(),
      albumTitle: albumTitle.trim(),
      notes: notes.trim() || undefined,
      targetPriceSGD: targetPrice ? parseFloat(targetPrice) : undefined,
      priority,
      addedAt: new Date().toISOString(),
    });
    setArtist("");
    setAlbumTitle("");
    setNotes("");
    setTargetPrice("");
    setPriority("medium");
  };

  const sorted = [...wantlist].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
          <Heart className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#2B2B2B]">Wantlist</h2>
          <p className="text-xs text-[#6B655B]">Records you're hunting for — separate from what you own</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
          className="bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
        />
        <input
          type="text"
          placeholder="Album Title"
          value={albumTitle}
          onChange={(e) => setAlbumTitle(e.target.value)}
          required
          className="bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
        />
        <input
          type="text"
          placeholder="Notes (e.g. specific pressing, OBI...)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Target price S$"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="flex-1 min-w-0 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WantlistPriority)}
            className="bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-2 py-2 text-xs focus:outline-none focus:border-[#A94A42] transition"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button
          type="submit"
          className="sm:col-span-2 px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add to Wantlist</span>
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="text-xs text-[#6B655B] text-center py-8">Nothing on your wantlist yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-serif font-bold text-sm text-[#2B2B2B] truncate">{item.albumTitle}</h4>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLES[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-xs text-[#A94A42] font-medium truncate">{item.artist}</p>
                {(item.notes || item.targetPriceSGD) && (
                  <p className="text-[11px] text-[#6B655B] mt-0.5 truncate">
                    {item.targetPriceSGD ? `Target: ${format(item.targetPriceSGD)}` : ""}
                    {item.notes && item.targetPriceSGD ? " · " : ""}
                    {item.notes || ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onMoveToShelf(item)}
                  title="Move to shelf (mark as acquired)"
                  className="p-1.5 rounded text-[#6B655B] hover:text-[#2D4A3E] hover:bg-[#EFEAE0] transition cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  title="Remove from wantlist"
                  className="p-1.5 rounded text-[#6B655B] hover:text-[#A94A42] hover:bg-[#EFEAE0] transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
