import React, { useState } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArchiveX,
  ArrowLeft,
  Library,
} from "lucide-react";
import { ShelfItem, VinylBox, UNCATEGORISED_BOX_ID } from "../types";
import { RecordCoverImage } from "./RecordCoverImage";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

interface OrganiseTabProps {
  boxes: VinylBox[];
  shelfItems: ShelfItem[];
  onCreateBox: (name: string) => void;
  onRenameBox: (id: string, name: string) => void;
  onDeleteBox: (id: string) => void;
  onMoveItem: (itemId: string, boxId: string) => void;
  onGoToShelf: () => void;
}

export const OrganiseTab: React.FC<OrganiseTabProps> = ({
  boxes,
  shelfItems,
  onCreateBox,
  onRenameBox,
  onDeleteBox,
  onMoveItem,
  onGoToShelf,
}) => {
  const [newBoxName, setNewBoxName] = useState("");
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editingBoxName, setEditingBoxName] = useState("");
  const [boxToDelete, setBoxToDelete] = useState<VinylBox | null>(null);

  useEscapeToClose(!!boxToDelete, () => setBoxToDelete(null));

  const itemsForBox = (boxId: string) => {
    if (boxId === UNCATEGORISED_BOX_ID) {
      const validBoxIds = new Set(boxes.map((b) => b.id));
      return shelfItems.filter((item) => !item.boxId || !validBoxIds.has(item.boxId));
    }
    return shelfItems.filter((item) => item.boxId === boxId);
  };

  const uncategorisedBox: VinylBox = {
    id: UNCATEGORISED_BOX_ID,
    name: "Uncategorised",
    createdAt: "",
  };
  const allBoxes = [uncategorisedBox, ...boxes];

  const handleCreateBox = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBoxName.trim();
    if (!trimmed) return;
    onCreateBox(trimmed);
    setNewBoxName("");
  };

  const startRename = (box: VinylBox) => {
    setEditingBoxId(box.id);
    setEditingBoxName(box.name);
  };

  const commitRename = () => {
    const trimmed = editingBoxName.trim();
    if (editingBoxId && trimmed) {
      onRenameBox(editingBoxId, trimmed);
    }
    setEditingBoxId(null);
    setEditingBoxName("");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-[#E2DCD0]">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#2B2B2B]">Organise</h2>
          <p className="text-xs font-sans text-[#6B655B]">
            Group your collection into physical storage Boxes — crates, shelves, cases — and find any record by where it actually lives.
          </p>
        </div>
        <button
          onClick={onGoToShelf}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#A94A42] text-white hover:bg-[#8E3E37] text-xs font-bold font-sans uppercase tracking-wider transition shadow-sm cursor-pointer shrink-0 w-full sm:w-auto"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
          <span>Back to Shelf</span>
        </button>
      </div>

      {/* New Box Form */}
      <form
        onSubmit={handleCreateBox}
        className="p-4 rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm flex flex-col sm:flex-row items-center gap-3"
      >
        <div className="flex items-center gap-1.5 text-xs text-[#6B655B] font-sans uppercase tracking-wider font-bold shrink-0">
          <Package className="w-3.5 h-3.5 text-[#A94A42]" />
          New Box:
        </div>
        <input
          type="text"
          placeholder="e.g. Crate 2, Living Room Shelf A..."
          value={newBoxName}
          onChange={(e) => setNewBoxName(e.target.value)}
          className="flex-1 w-full bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] placeholder-[#8C857B] rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#A94A42] transition"
        />
        <button
          type="submit"
          disabled={!newBoxName.trim()}
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition disabled:opacity-40 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-white" />
          <span>Create Box</span>
        </button>
      </form>

      {/* Boxes */}
      <div className="space-y-6">
        {allBoxes.map((box) => {
          const items = itemsForBox(box.id);
          const isUncategorised = box.id === UNCATEGORISED_BOX_ID;
          const isEditing = editingBoxId === box.id;

          return (
            <div key={box.id} className="rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] shadow-sm overflow-hidden">
              {/* Box Header */}
              <div className="flex items-center justify-between gap-3 p-4 border-b border-[#E2DCD0] bg-[#EFEAE0]">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`p-2 rounded-full border shrink-0 ${
                    isUncategorised
                      ? "bg-[#6B655B]/10 border-[#6B655B]/20 text-[#6B655B]"
                      : "bg-[#A94A42]/10 border-[#A94A42]/20 text-[#A94A42]"
                  }`}>
                    {isUncategorised ? <ArchiveX className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        autoFocus
                        value={editingBoxName}
                        onChange={(e) => setEditingBoxName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditingBoxId(null);
                        }}
                        className="flex-1 min-w-0 bg-[#FAF8F3] border border-[#A94A42] text-[#2B2B2B] rounded-md px-2.5 py-1.5 text-sm font-serif font-bold focus:outline-none"
                      />
                      <button
                        onClick={commitRename}
                        className="p-1.5 rounded text-[#2D4A3E] hover:bg-[#8FA89B]/20 transition cursor-pointer shrink-0"
                        title="Save name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingBoxId(null)}
                        className="p-1.5 rounded text-[#6B655B] hover:bg-[#D8D0C0]/40 transition cursor-pointer shrink-0"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <h3 className="font-serif font-bold text-base text-[#2B2B2B] truncate">{box.name}</h3>
                      <p className="text-[10px] font-sans text-[#6B655B] uppercase tracking-wider font-bold">
                        {items.length} {items.length === 1 ? "record" : "records"}
                      </p>
                    </div>
                  )}
                </div>

                {!isUncategorised && !isEditing && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startRename(box)}
                      className="p-1.5 rounded text-[#6B655B] hover:text-[#A94A42] hover:bg-[#FAF8F3] transition cursor-pointer"
                      title="Rename Box"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setBoxToDelete(box)}
                      className="p-1.5 rounded text-[#6B655B] hover:text-[#A94A42] hover:bg-[#FAF8F3] transition cursor-pointer"
                      title="Delete Box"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Box Contents */}
              {items.length > 0 ? (
                <div className="divide-y divide-[#E2DCD0]">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3.5">
                      <RecordCoverImage
                        src={item.coverArtUrl}
                        artist={item.artist}
                        albumTitle={item.albumTitle}
                        catalogueNumber={item.catalogueNumber}
                        className="w-11 h-11 rounded border border-[#E2DCD0] shadow-xs flex-shrink-0"
                        imgClassName="w-full h-full object-cover rounded"
                        showRefreshOverlay={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-serif font-bold text-[#2B2B2B] truncate">{item.albumTitle}</p>
                        <p className="text-[11px] font-sans text-[#A94A42] truncate">{item.artist}</p>
                      </div>
                      <select
                        value={item.boxId && boxes.some((b) => b.id === item.boxId) ? item.boxId : UNCATEGORISED_BOX_ID}
                        onChange={(e) => onMoveItem(item.id, e.target.value)}
                        className="shrink-0 bg-[#EFEAE0] border border-[#D8D0C0] text-[#2B2B2B] rounded-md px-2 py-1.5 text-[11px] font-sans focus:outline-none focus:border-[#A94A42] transition max-w-[9rem]"
                        title="Move to Box"
                      >
                        {allBoxes.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs font-sans text-[#6B655B]">
                  No records filed in this box yet.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shelfItems.length === 0 && (
        <div className="p-12 text-center rounded-lg bg-[#FAF8F3] border border-[#E2DCD0] max-w-lg mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20 flex items-center justify-center mx-auto">
            <Library className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold font-serif text-[#2B2B2B]">Your Shelf is Empty</h3>
          <p className="text-xs font-sans text-[#6B655B] max-w-xs mx-auto leading-relaxed">
            Add records to your shelf first, then come back here to sort them into Boxes.
          </p>
        </div>
      )}

      {/* Delete Box Confirmation */}
      {boxToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setBoxToDelete(null)}
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
                <h3 className="text-lg font-serif font-bold text-[#2B2B2B]">Delete Box</h3>
                <p className="text-[11px] font-sans text-[#6B655B]">Remove this box</p>
              </div>
            </div>

            <p className="text-xs font-sans text-[#2B2B2B] leading-relaxed bg-[#EFEAE0] p-3 rounded-lg border border-[#D8D0C0]">
              Delete <strong className="text-[#A94A42]">"{boxToDelete.name}"</strong>? Any records currently filed in it
              ({itemsForBox(boxToDelete.id).length}) will move to <strong>Uncategorised</strong> — nothing gets removed from your shelf.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DCD0]">
              <button
                type="button"
                onClick={() => setBoxToDelete(null)}
                className="px-4 py-2 rounded-md border border-[#D8D0C0] text-xs font-sans font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteBox(boxToDelete.id);
                  setBoxToDelete(null);
                }}
                className="px-4 py-2 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-sans font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
              >
                Delete Box
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
