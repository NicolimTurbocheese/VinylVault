import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShelfItem } from "../types";
import { RecordCoverImage } from "./RecordCoverImage";

interface CoverflowCarouselProps {
  items: ShelfItem[];
  onSelectItem: (item: ShelfItem) => void;
}

// A classic "coverflow" browser: the active cover sits flat and large in the center, with
// neighbouring covers fanned out in 3D perspective on either side. Pure CSS transforms driven
// by one activeIndex — no external carousel library needed.
export const CoverflowCarousel: React.FC<CoverflowCarouselProps> = ({ items, onSelectItem }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; dragging: boolean } | null>(null);

  // Keep the active index valid if the underlying list shrinks (e.g. an item gets deleted).
  useEffect(() => {
    if (activeIndex > items.length - 1) {
      setActiveIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, activeIndex]);

  if (items.length === 0) return null;

  const goTo = (index: number) => {
    setActiveIndex(Math.max(0, Math.min(items.length - 1, index)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragState.current = { startX: e.clientX, dragging: true };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current?.dragging) return;
    const delta = e.clientX - dragState.current.startX;
    // Require a deliberate swipe (not just a click) before treating it as navigation.
    if (Math.abs(delta) > 60) {
      goTo(activeIndex + (delta < 0 ? 1 : -1));
      dragState.current.dragging = false;
    }
  };

  const handlePointerUp = () => {
    if (dragState.current) dragState.current.dragging = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goTo(activeIndex - 1);
    else if (e.key === "ArrowRight") goTo(activeIndex + 1);
    else if (e.key === "Enter") onSelectItem(items[activeIndex]);
  };

  const active = items[activeIndex];

  return (
    <div className="space-y-4">
      <div
        ref={trackRef}
        role="listbox"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative h-56 sm:h-64 select-none outline-none touch-pan-y"
        style={{ perspective: "1200px" }}
      >
        {/* Prev/Next arrows */}
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-[#FAF8F3] border border-[#E2DCD0] text-[#6B655B] hover:text-[#A94A42] shadow-md disabled:opacity-30 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === items.length - 1}
          className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-[#FAF8F3] border border-[#E2DCD0] text-[#6B655B] hover:text-[#A94A42] shadow-md disabled:opacity-30 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {items.map((item, i) => {
          const offset = i - activeIndex;
          const isVisible = Math.abs(offset) <= 4;
          if (!isVisible) return null;

          const isActive = offset === 0;
          const translateX = offset * 78;
          const rotateY = offset === 0 ? 0 : offset < 0 ? 45 : -45;
          const scale = isActive ? 1 : 0.72;
          const zIndex = 10 - Math.abs(offset);
          const opacity = 1 - Math.abs(offset) * 0.18;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (isActive ? onSelectItem(item) : goTo(i))}
              title={isActive ? "Click to open" : item.albumTitle}
              className="absolute top-1/2 left-1/2 w-32 h-32 sm:w-40 sm:h-40 cursor-pointer transition-all duration-300 ease-out"
              style={{
                transform: `translate(-50%, -50%) translateX(${translateX}%) rotateY(${rotateY}deg) scale(${scale})`,
                zIndex,
                opacity: Math.max(0, opacity),
              }}
            >
              <RecordCoverImage
                src={item.coverArtUrl}
                artist={item.artist}
                albumTitle={item.albumTitle}
                className={`w-full h-full rounded-md border ${
                  isActive ? "border-[#A94A42] shadow-2xl" : "border-[#E2DCD0] shadow-md"
                }`}
                imgClassName="w-full h-full object-cover rounded-md"
                showRefreshOverlay={false}
              />
            </button>
          );
        })}
      </div>

      {/* Active record caption */}
      <div className="text-center font-sans">
        <p className="text-sm font-serif font-bold text-[#2B2B2B] truncate">{active.albumTitle}</p>
        <p className="text-xs text-[#A94A42] truncate">{active.artist}</p>
        <p className="text-[10px] text-[#6B655B] mt-0.5">
          {activeIndex + 1} of {items.length} — drag, use arrow keys, or click a side cover to browse
        </p>
      </div>
    </div>
  );
};
