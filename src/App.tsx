import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { ScanSearchTab } from "./components/ScanSearchTab";
import { MyShelfTab } from "./components/MyShelfTab";
import { CollectionInsightsTab } from "./components/CollectionInsightsTab";
import { AddToShelfModal } from "./components/AddToShelfModal";
import { ThemeSelectorModal, UITheme } from "./components/ThemeSelectorModal";
import { SyncSettingsModal, SyncStatus } from "./components/SyncSettingsModal";
import { RecordScanResult, ShelfItem } from "./types";
import { calculateAdjustedValuation } from "./utils/valuation";
import { cleanFormatSpec } from "./utils/format";
import { normalizeDiscogsGenre } from "./utils/genre";
import { isFirebaseConfigured } from "./utils/firebase";
import {
  getStoredVaultCode,
  storeVaultCode,
  clearStoredVaultCode,
  generateVaultCode,
  normalizeVaultCode,
  subscribeToVault,
  fetchVaultItemsOnce,
  upsertVaultItem,
  deleteVaultItem,
  bulkUpsertVaultItems,
} from "./utils/vaultSync";
import type { Unsubscribe } from "firebase/firestore";

// Initial seed records if shelf is totally fresh
const INITIAL_SEED_SHELF: ShelfItem[] = [
  {
    id: "seed-1",
    albumTitle: "The Dark Side of the Moon",
    artist: "Pink Floyd",
    releaseYear: "1973",
    label: "Harvest Records",
    country: "UK",
    catalogueNumber: "SHVL 804",
    matrixCode: "SHVL 804 A-2 / B-2",
    format: "LP, Album, Gatefold, Stereo",
    genre: "Rock",
    styles: ["Prog Rock", "Psychedelic Rock"],
    coverArtUrl: "https://images.unsplash.com/photo-1619983081563-430f63602796?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Speak to Me", duration: "1:07" },
      { position: "A2", title: "Breathe (In the Air)", duration: "2:49" },
      { position: "A3", title: "On the Run", duration: "3:45" },
      { position: "A4", title: "Time", duration: "6:53" },
      { position: "A5", title: "The Great Gig in the Sky", duration: "4:44" },
      { position: "B1", title: "Money", duration: "6:23" },
      { position: "B2", title: "Us and Them", duration: "7:49" },
      { position: "B3", title: "Any Colour You Like", duration: "3:26" },
      { position: "B4", title: "Brain Damage", duration: "3:46" },
      { position: "B5", title: "Eclipse", duration: "2:12" }
    ],
    baseMintValue: { low: 180, median: 260, high: 420 },
    mediaGrade: "VG+",
    sleeveGrade: "VG+",
    calculatedValue: { low: 135, median: 195, high: 315 },
    purchasePrice: 45,
    storeLocation: "Rough Trade, London",
    physicalShelfLocation: "Bin 1, Front Row",
    customNotes: "UK 1st pressing with solid blue triangle label & original blue posters.",
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - SHVL 804 UK 1973", uri: "https://www.discogs.com" }
    ],
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
  },
  {
    id: "seed-2",
    albumTitle: "Abbey Road",
    artist: "The Beatles",
    releaseYear: "1969",
    label: "Apple Records",
    country: "UK",
    catalogueNumber: "PCS 7088",
    matrixCode: "YEX 749-2 / YEX 750-1",
    format: "LP, Album, Stereo, Fully Laminated",
    genre: "Rock",
    styles: ["Classic Rock", "Pop Rock"],
    coverArtUrl: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&auto=format&fit=crop&q=80",
    tracklist: [
      { position: "A1", title: "Come Together", duration: "4:20" },
      { position: "A2", title: "Something", duration: "3:03" },
      { position: "B1", title: "Here Comes the Sun", duration: "3:05" }
    ],
    baseMintValue: { low: 120, median: 195, high: 310 },
    mediaGrade: "NM",
    sleeveGrade: "VG+",
    calculatedValue: { low: 90, median: 146, high: 232 },
    purchasePrice: 35,
    storeLocation: "Grimey's, Nashville",
    physicalShelfLocation: "Main Rack A",
    customNotes: "First UK pressing with aligned apple on rear jacket.",
    isAmbiguous: false,
    groundingSources: [
      { title: "Discogs - PCS 7088", uri: "https://www.discogs.com" }
    ],
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString()
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"scan" | "shelf" | "insights">("scan");
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<UITheme>(() => {
    return (localStorage.getItem("vinylvault_theme") as UITheme) || "gold";
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Cross-device sync state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [vaultCode, setVaultCode] = useState<string | null>(() => getStoredVaultCode());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("disabled");
  const [syncError, setSyncError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecordForModal, setSelectedRecordForModal] = useState<RecordScanResult | null>(null);
  const [editingItem, setEditingItem] = useState<ShelfItem | null>(null);

  // Apply theme class to document element and body
  useEffect(() => {
    document.documentElement.classList.remove("theme-gold", "theme-nordic", "theme-swiss", "theme-cyber");
    document.documentElement.classList.add(`theme-${currentTheme}`);
    document.body.classList.remove("theme-gold", "theme-nordic", "theme-swiss", "theme-cyber");
    document.body.classList.add(`theme-${currentTheme}`);
    localStorage.setItem("vinylvault_theme", currentTheme);
  }, [currentTheme]);

  // Load shelf items on mount from localStorage, falling back to the seed collection
  useEffect(() => {
    loadShelf();
    if (vaultCode) {
      connectToVault(vaultCode, { pushLocalOnConnect: false });
    }
    return () => {
      unsubscribeRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sanitizeShelfItem = (item: ShelfItem): ShelfItem => {
    const norm = normalizeDiscogsGenre(item.genre, item.styles);
    return {
      ...item,
      format: cleanFormatSpec(item.format),
      genre: norm.genre,
      styles: norm.styles
    };
  };

  const loadShelf = () => {
    // Gather all local storage records from every legacy storage key and merge/dedupe them
    const localItems: ShelfItem[] = [];
    const keysToCheck = ["vinylvault_shelf", "vinyl_vault_shelf_v1", "vinyl_shelf"];
    for (const key of keysToCheck) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localItems.push(...parsed);
          }
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    }

    const itemMap = new Map<string, ShelfItem>();
    for (const item of localItems) {
      if (!item) continue;
      const sanitized = sanitizeShelfItem(item);
      if (sanitized.id) {
        const existing = itemMap.get(sanitized.id);
        if (existing) {
          itemMap.set(sanitized.id, { ...existing, ...sanitized });
        } else {
          // Check if item exists by title + artist + catalogue number
          const key = `${sanitized.albumTitle}-${sanitized.artist}-${sanitized.catalogueNumber}`.toLowerCase();
          const match = Array.from(itemMap.values()).find(
            (i) => `${i.albumTitle}-${i.artist}-${i.catalogueNumber}`.toLowerCase() === key
          );
          if (match) {
            itemMap.set(match.id, { ...match, ...sanitized });
          } else {
            itemMap.set(sanitized.id, sanitized);
          }
        }
      }
    }

    let mergedList = Array.from(itemMap.values());

    // Fallback to seed if completely empty
    if (mergedList.length === 0) {
      mergedList = INITIAL_SEED_SHELF.map(sanitizeShelfItem);
    }

    setShelfItems(mergedList);
    localStorage.setItem("vinylvault_shelf", JSON.stringify(mergedList));
  };

  const saveShelfToLocal = (items: ShelfItem[]) => {
    const cleanedItems = items.map(sanitizeShelfItem);
    setShelfItems(cleanedItems);
    localStorage.setItem("vinylvault_shelf", JSON.stringify(cleanedItems));
  };

  // Subscribes to a vault's live Firestore collection. When pushLocalOnConnect is true,
  // any items already on this device that the vault doesn't have yet are uploaded first
  // (used when linking a device for the first time), so nothing gets silently dropped.
  const connectToVault = async (code: string, opts: { pushLocalOnConnect: boolean }) => {
    setSyncStatus("connecting");
    setSyncError(null);

    if (opts.pushLocalOnConnect) {
      try {
        const remoteItems = await fetchVaultItemsOnce(code);
        const remoteIds = new Set(remoteItems.map((i) => i.id));
        const localOnly = shelfItems.filter((i) => !remoteIds.has(i.id));
        if (localOnly.length > 0) {
          await bulkUpsertVaultItems(code, localOnly.map(sanitizeShelfItem));
        }
      } catch (err) {
        console.error("Failed to merge local items into vault:", err);
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Failed to reach the vault.");
        return;
      }
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeToVault(
      code,
      (items) => {
        saveShelfToLocal(items);
        setSyncStatus("connected");
        setSyncError(null);
      },
      (err) => {
        console.error("Vault sync error:", err);
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Lost connection to the vault.");
      }
    );
  };

  const enableSyncNewVault = async () => {
    const code = generateVaultCode();
    storeVaultCode(code);
    setVaultCode(code);
    await connectToVault(code, { pushLocalOnConnect: true });
  };

  const joinVault = async (rawCode: string) => {
    const code = normalizeVaultCode(rawCode);
    if (!code) return;
    storeVaultCode(code);
    setVaultCode(code);
    await connectToVault(code, { pushLocalOnConnect: true });
  };

  const disableSync = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    clearStoredVaultCode();
    setVaultCode(null);
    setSyncStatus("disabled");
    setSyncError(null);
  };

  const handleSaveToShelf = (item: ShelfItem) => {
    const existingIndex = shelfItems.findIndex((i) => i.id === item.id);
    let updated: ShelfItem[];

    if (existingIndex >= 0) {
      updated = [...shelfItems];
      updated[existingIndex] = item;
    } else {
      updated = [item, ...shelfItems];
    }

    saveShelfToLocal(updated);

    if (vaultCode && syncStatus === "connected") {
      upsertVaultItem(vaultCode, sanitizeShelfItem(item)).catch((err) => {
        console.error("Failed to sync item to vault:", err);
      });
    }
  };

  const handleDeleteItem = (id: string) => {
    const updated = shelfItems.filter((item) => item.id !== id);
    saveShelfToLocal(updated);

    if (vaultCode && syncStatus === "connected") {
      deleteVaultItem(vaultCode, id).catch((err) => {
        console.error("Failed to sync deletion to vault:", err);
      });
    }
  };

  const handleOpenModalForScan = (record: RecordScanResult) => {
    setSelectedRecordForModal(record);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (item: ShelfItem) => {
    setSelectedRecordForModal(item);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#2B2B2B] flex flex-col font-sans selection:bg-[#A94A42] selection:text-white">
      {/* 1960s Journal Paper Texture subtle overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#d8d0c0_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shelfCount={shelfItems.length}
        isSyncing={syncStatus === "connected"}
        onOpenSync={() => setIsSyncModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div style={{ display: activeTab === "scan" ? "block" : "none" }}>
          <ScanSearchTab
            onSaveToShelf={(record, mediaGrade, sleeveGrade) => {
              const val = calculateAdjustedValuation(record.baseMintValue, mediaGrade, sleeveGrade);
              const shelfItem: ShelfItem = {
                ...record,
                mediaGrade,
                sleeveGrade,
                calculatedValue: val,
                addedAt: new Date().toISOString(),
              };
              handleSaveToShelf(shelfItem);
              setActiveTab("shelf");
            }}
            onOpenAddToShelfModal={handleOpenModalForScan}
          />
        </div>

        <div style={{ display: activeTab === "shelf" ? "block" : "none" }}>
          <MyShelfTab
            shelfItems={shelfItems}
            onEditItem={handleOpenModalForEdit}
            onDeleteItem={handleDeleteItem}
            onGoToScan={() => setActiveTab("scan")}
          />
        </div>

        <div style={{ display: activeTab === "insights" ? "block" : "none" }}>
          <CollectionInsightsTab
            shelfItems={shelfItems}
            onGoToScan={() => setActiveTab("scan")}
          />
        </div>
      </main>

      {/* Footer / Bottom Bar */}
      <footer className="border-t border-[#E2DCD0] bg-[#FAF8F3]/90 py-6 text-center text-xs text-[#6B655B] relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="flex items-center gap-1.5">
            <span className="font-serif font-bold text-[#A94A42]">VinylVault</span>
            <span>— Powered by Gemini 3 Multimodal & Google Search Grounding</span>
          </p>
          <p className="text-[#6B655B] text-[11px]">
            Goldmine Grading Standard (M, NM, VG+, VG, G, F/P) Valuation Engine
          </p>
        </div>
      </footer>

      {/* Add / Edit Shelf Modal */}
      <AddToShelfModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        record={selectedRecordForModal}
        existingItem={editingItem}
        onSave={(item) => {
          handleSaveToShelf(item);
          setIsModalOpen(false);
          setActiveTab("shelf");
        }}
      />

      {/* Cross-Device Sync Modal */}
      <SyncSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isAvailable={isFirebaseConfigured()}
        vaultCode={vaultCode}
        status={syncStatus}
        errorMessage={syncError}
        onCreateVault={enableSyncNewVault}
        onJoinVault={joinVault}
        onDisableSync={disableSync}
      />
    </div>
  );
}
