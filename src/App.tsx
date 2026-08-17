import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { ScanSearchTab } from "./components/ScanSearchTab";
import { MyShelfTab } from "./components/MyShelfTab";
import { CollectionInsightsTab } from "./components/CollectionInsightsTab";
import { AddToShelfModal } from "./components/AddToShelfModal";
import { OrganiseTab } from "./components/OrganiseTab";
import { ThemeSelectorModal, UITheme } from "./components/ThemeSelectorModal";
import { SyncSettingsModal, SyncStatus } from "./components/SyncSettingsModal";
import { ToastStack, ToastMessage } from "./components/ToastStack";
import { CommandPalette } from "./components/CommandPalette";
import { Confetti } from "./components/Confetti";
import { WantlistTab } from "./components/WantlistTab";
import { RecordScanResult, ShelfItem, VinylBox, WantlistItem, UNCATEGORISED_BOX_ID } from "./types";
import { calculateAdjustedValuation } from "./utils/valuation";
import { cleanFormatSpec } from "./utils/format";
import { normalizeDiscogsGenre } from "./utils/genre";
import { isFirebaseConfigured } from "./utils/firebase";
import { getStoredBoxes, saveBoxesToLocal, generateBoxId } from "./utils/boxes";
import { getStoredWantlist, saveWantlistToLocal } from "./utils/wantlist";
import {
  getStoredVaultCode,
  storeVaultCode,
  clearStoredVaultCode,
  generateVaultCode,
  normalizeVaultCode,
  subscribeToVaultCollection,
  fetchVaultCollectionOnce,
  upsertVaultDoc,
  deleteVaultDoc,
  bulkUpsertVaultDocs,
} from "./utils/vaultSync";
import type { Unsubscribe } from "firebase/firestore";

// Initial seed records if shelf is totally fresh
const INITIAL_SEED_SHELF: ShelfItem[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<"scan" | "shelf" | "insights" | "organise" | "wantlist">("scan");
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [boxes, setBoxes] = useState<VinylBox[]>([]);
  const [wantlist, setWantlist] = useState<WantlistItem[]>([]);

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const showToast = (message: string, variant: "success" | "error" = "success") => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<UITheme>(() => {
    return (localStorage.getItem("vinylvault_theme") as UITheme) || "gold";
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Cmd+K / Ctrl+K opens the command palette from anywhere in the app
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cross-device sync state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [vaultCode, setVaultCode] = useState<string | null>(() => getStoredVaultCode());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("disabled");
  const [syncError, setSyncError] = useState<string | null>(null);
  const shelfUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const boxesUnsubscribeRef = useRef<Unsubscribe | null>(null);

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

  // Load shelf items & boxes on mount from localStorage, falling back to the seed collection
  useEffect(() => {
    loadShelf();
    setBoxes(getStoredBoxes());
    setWantlist(getStoredWantlist());
    if (vaultCode) {
      connectToVault(vaultCode, { pushLocalOnConnect: false });
    }
    return () => {
      shelfUnsubscribeRef.current?.();
      boxesUnsubscribeRef.current?.();
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

  const saveBoxesToLocalState = (items: VinylBox[]) => {
    setBoxes(items);
    saveBoxesToLocal(items);
  };

  // Subscribes to a vault's two live Firestore collections (shelf items & boxes). When
  // pushLocalOnConnect is true, anything already on this device that the vault doesn't
  // have yet is uploaded first (used when linking a device for the first time), so
  // nothing gets silently dropped. Returns false if the initial merge failed (the live
  // subscription outcome after that point is reflected in syncStatus, not this return
  // value, since it resolves asynchronously after this promise settles).
  const connectToVault = async (code: string, opts: { pushLocalOnConnect: boolean }): Promise<boolean> => {
    setSyncStatus("connecting");
    setSyncError(null);

    if (opts.pushLocalOnConnect) {
      try {
        const remoteItems = await fetchVaultCollectionOnce<ShelfItem>(code, "shelfItems");
        const remoteIds = new Set(remoteItems.map((i) => i.id));
        const localOnlyItems = shelfItems.filter((i) => !remoteIds.has(i.id));
        if (localOnlyItems.length > 0) {
          await bulkUpsertVaultDocs(code, "shelfItems", localOnlyItems.map(sanitizeShelfItem));
        }

        const remoteBoxes = await fetchVaultCollectionOnce<VinylBox>(code, "boxes");
        const remoteBoxIds = new Set(remoteBoxes.map((b) => b.id));
        const localOnlyBoxes = boxes.filter((b) => !remoteBoxIds.has(b.id));
        if (localOnlyBoxes.length > 0) {
          await bulkUpsertVaultDocs(code, "boxes", localOnlyBoxes);
        }
      } catch (err) {
        console.error("Failed to merge local data into vault:", err);
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Failed to reach the vault.");
        return false;
      }
    }

    shelfUnsubscribeRef.current?.();
    shelfUnsubscribeRef.current = subscribeToVaultCollection<ShelfItem>(
      code,
      "shelfItems",
      (items) => {
        saveShelfToLocal(items);
        setSyncStatus("connected");
        setSyncError(null);
      },
      (err) => {
        console.error("Vault sync error (shelf):", err);
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Lost connection to the vault.");
      }
    );

    boxesUnsubscribeRef.current?.();
    boxesUnsubscribeRef.current = subscribeToVaultCollection<VinylBox>(
      code,
      "boxes",
      (items) => {
        saveBoxesToLocalState(items);
        setSyncStatus("connected");
        setSyncError(null);
      },
      (err) => {
        console.error("Vault sync error (boxes):", err);
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Lost connection to the vault.");
      }
    );

    return true;
  };

  const enableSyncNewVault = async () => {
    const code = generateVaultCode();
    storeVaultCode(code);
    setVaultCode(code);
    const ok = await connectToVault(code, { pushLocalOnConnect: true });
    if (ok) showToast("Sync enabled — this device now has a Vault Code.");
  };

  const joinVault = async (rawCode: string) => {
    const code = normalizeVaultCode(rawCode);
    if (!code) return;
    storeVaultCode(code);
    setVaultCode(code);
    const ok = await connectToVault(code, { pushLocalOnConnect: true });
    if (ok) showToast("Joined vault — collections merged.");
  };

  const disableSync = () => {
    shelfUnsubscribeRef.current?.();
    shelfUnsubscribeRef.current = null;
    boxesUnsubscribeRef.current?.();
    boxesUnsubscribeRef.current = null;
    clearStoredVaultCode();
    setVaultCode(null);
    setSyncStatus("disabled");
    setSyncError(null);
    showToast("Sync turned off — this device is now local-only.");
  };

  const handleSaveToShelf = (item: ShelfItem, opts: { showFeedback?: boolean } = {}) => {
    const { showFeedback = true } = opts;
    const existingIndex = shelfItems.findIndex((i) => i.id === item.id);
    let updated: ShelfItem[];
    let itemToStore = item;

    if (existingIndex >= 0) {
      const existing = shelfItems[existingIndex];
      const gradingOrValueChanged =
        existing.mediaGrade !== item.mediaGrade ||
        existing.sleeveGrade !== item.sleeveGrade ||
        existing.obiCondition !== item.obiCondition ||
        existing.calculatedValue?.median !== item.calculatedValue?.median;

      if (gradingOrValueChanged) {
        const entry = {
          date: new Date().toISOString(),
          mediaGrade: existing.mediaGrade,
          sleeveGrade: existing.sleeveGrade,
          obiCondition: existing.obiCondition,
          calculatedValue: existing.calculatedValue,
        };
        itemToStore = { ...item, history: [entry, ...(existing.history || [])] };
      }

      updated = [...shelfItems];
      updated[existingIndex] = itemToStore;
    } else {
      updated = [item, ...shelfItems];
    }

    saveShelfToLocal(updated);
    if (showFeedback) {
      showToast(existingIndex >= 0 ? `Updated "${item.albumTitle}"` : `Saved "${item.albumTitle}" to shelf`);
      if (existingIndex < 0) {
        setConfettiTrigger((n) => n + 1);
      }
    }

    if (vaultCode && syncStatus === "connected") {
      upsertVaultDoc(vaultCode, "shelfItems", sanitizeShelfItem(itemToStore)).catch((err) => {
        console.error("Failed to sync item to vault:", err);
      });
    }
  };

  const handleImportItems = (rawItems: ShelfItem[]) => {
    const existingKeys = new Set(
      shelfItems.map((i) => `${i.albumTitle}-${i.artist}-${i.catalogueNumber}`.toLowerCase())
    );
    const existingIds = new Set(shelfItems.map((i) => i.id));

    const toAdd: ShelfItem[] = [];
    let skippedDuplicates = 0;

    for (const raw of rawItems) {
      if (!raw || !raw.albumTitle || !raw.artist) continue;
      const key = `${raw.albumTitle}-${raw.artist}-${raw.catalogueNumber || ""}`.toLowerCase();
      if (existingKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }
      let id = raw.id;
      if (!id || existingIds.has(id)) {
        id = `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      }
      existingIds.add(id);
      existingKeys.add(key);
      toAdd.push(sanitizeShelfItem({ ...raw, id, addedAt: raw.addedAt || new Date().toISOString() }));
    }

    if (toAdd.length === 0) {
      showToast(
        skippedDuplicates > 0
          ? `Nothing imported — all ${skippedDuplicates} records already exist on your shelf.`
          : "Nothing imported — the file had no valid records.",
        "error"
      );
      return;
    }

    const updated = [...toAdd, ...shelfItems];
    saveShelfToLocal(updated);
    showToast(
      `Imported ${toAdd.length} record${toAdd.length === 1 ? "" : "s"}${
        skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"} skipped)` : ""
      }`
    );
    setConfettiTrigger((n) => n + 1);

    if (vaultCode && syncStatus === "connected") {
      bulkUpsertVaultDocs(vaultCode, "shelfItems", toAdd).catch((err) => {
        console.error("Failed to sync imported items to vault:", err);
      });
    }
  };

  const handleDeleteItem = (id: string) => {
    const item = shelfItems.find((i) => i.id === id);
    const updated = shelfItems.filter((item) => item.id !== id);
    saveShelfToLocal(updated);
    if (item) showToast(`Removed "${item.albumTitle}" from shelf`);

    if (vaultCode && syncStatus === "connected") {
      deleteVaultDoc(vaultCode, "shelfItems", id).catch((err) => {
        console.error("Failed to sync deletion to vault:", err);
      });
    }
  };

  const handleClearAllItems = () => {
    const idsToDelete = shelfItems.map((i) => i.id);
    saveShelfToLocal([]);
    showToast(`Cleared ${idsToDelete.length} record${idsToDelete.length === 1 ? "" : "s"} from shelf`);

    if (vaultCode && syncStatus === "connected") {
      for (const id of idsToDelete) {
        deleteVaultDoc(vaultCode, "shelfItems", id).catch((err) => {
          console.error("Failed to sync deletion to vault:", err);
        });
      }
    }
  };

  const handleAddWantlistItem = (item: WantlistItem) => {
    const updated = [item, ...wantlist];
    setWantlist(updated);
    saveWantlistToLocal(updated);
    showToast(`Added "${item.albumTitle}" to wantlist`);
  };

  const handleDeleteWantlistItem = (id: string) => {
    const updated = wantlist.filter((w) => w.id !== id);
    setWantlist(updated);
    saveWantlistToLocal(updated);
  };

  const handleMoveWantlistToShelf = (item: WantlistItem) => {
    const shelfItem: ShelfItem = {
      id: `shelf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      albumTitle: item.albumTitle,
      artist: item.artist,
      releaseYear: "",
      label: "",
      country: "",
      catalogueNumber: "",
      genre: "Rock",
      styles: [],
      coverArtUrl: "",
      tracklist: [],
      baseMintValue: { low: 0, median: 0, high: 0 },
      isAmbiguous: false,
      groundingSources: [],
      mediaGrade: "VG+",
      sleeveGrade: "VG+",
      calculatedValue: { low: 0, median: 0, high: 0 },
      purchasePrice: item.targetPriceSGD,
      customNotes: item.notes,
      addedAt: new Date().toISOString(),
    };
    handleSaveToShelf(shelfItem, { showFeedback: false });
    handleDeleteWantlistItem(item.id);
    showToast(`Moved "${item.albumTitle}" to your shelf — fill in the details when you get a chance`);
    handleOpenModalForEdit(shelfItem);
  };

  const handleCreateBox = (name: string) => {
    const box: VinylBox = { id: generateBoxId(), name, createdAt: new Date().toISOString() };
    saveBoxesToLocalState([...boxes, box]);
    showToast(`Box "${name}" created`);

    if (vaultCode && syncStatus === "connected") {
      upsertVaultDoc(vaultCode, "boxes", box).catch((err) => {
        console.error("Failed to sync new box to vault:", err);
      });
    }
  };

  const handleRenameBox = (id: string, name: string) => {
    const box = boxes.find((b) => b.id === id);
    if (!box) return;
    const updatedBox = { ...box, name };
    saveBoxesToLocalState(boxes.map((b) => (b.id === id ? updatedBox : b)));
    showToast(`Box renamed to "${name}"`);

    if (vaultCode && syncStatus === "connected") {
      upsertVaultDoc(vaultCode, "boxes", updatedBox).catch((err) => {
        console.error("Failed to sync box rename to vault:", err);
      });
    }
  };

  const handleDeleteBox = (id: string) => {
    const box = boxes.find((b) => b.id === id);
    saveBoxesToLocalState(boxes.filter((b) => b.id !== id));
    if (box) showToast(`Box "${box.name}" deleted — its records moved to Uncategorised`);

    // Records filed in the deleted box fall back to Uncategorised rather than vanishing.
    const affectedItems = shelfItems.filter((item) => item.boxId === id);
    if (affectedItems.length > 0) {
      const updated = shelfItems.map((item) => (item.boxId === id ? { ...item, boxId: undefined } : item));
      saveShelfToLocal(updated);
      if (vaultCode && syncStatus === "connected") {
        for (const item of affectedItems) {
          upsertVaultDoc(vaultCode, "shelfItems", sanitizeShelfItem({ ...item, boxId: undefined })).catch((err) => {
            console.error("Failed to sync box-orphaned item to vault:", err);
          });
        }
      }
    }

    if (vaultCode && syncStatus === "connected") {
      deleteVaultDoc(vaultCode, "boxes", id).catch((err) => {
        console.error("Failed to sync box deletion to vault:", err);
      });
    }
  };

  const handleMoveItemToBox = (itemId: string, boxId: string) => {
    const item = shelfItems.find((i) => i.id === itemId);
    if (!item) return;
    const targetBoxName = boxId === UNCATEGORISED_BOX_ID ? "Uncategorised" : boxes.find((b) => b.id === boxId)?.name || "box";
    handleSaveToShelf({ ...item, boxId: boxId === UNCATEGORISED_BOX_ID ? undefined : boxId }, { showFeedback: false });
    showToast(`Moved "${item.albumTitle}" to ${targetBoxName}`);
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
        onOpenTheme={() => setIsThemeModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
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
            boxes={boxes}
            onEditItem={handleOpenModalForEdit}
            onDeleteItem={handleDeleteItem}
            onGoToScan={() => setActiveTab("scan")}
            onImportItems={handleImportItems}
            onQuickUpdateItem={(item) => handleSaveToShelf(item, { showFeedback: false })}
            onClearAllItems={handleClearAllItems}
          />
        </div>

        <div style={{ display: activeTab === "insights" ? "block" : "none" }}>
          <CollectionInsightsTab
            shelfItems={shelfItems}
            onGoToScan={() => setActiveTab("scan")}
          />
        </div>

        <div style={{ display: activeTab === "organise" ? "block" : "none" }}>
          <OrganiseTab
            boxes={boxes}
            shelfItems={shelfItems}
            onCreateBox={handleCreateBox}
            onRenameBox={handleRenameBox}
            onDeleteBox={handleDeleteBox}
            onMoveItem={handleMoveItemToBox}
            onGoToShelf={() => setActiveTab("shelf")}
          />
        </div>

        <div style={{ display: activeTab === "wantlist" ? "block" : "none" }}>
          <WantlistTab
            wantlist={wantlist}
            onAddItem={handleAddWantlistItem}
            onDeleteItem={handleDeleteWantlistItem}
            onMoveToShelf={handleMoveWantlistToShelf}
          />
        </div>
      </main>

      {/* Footer / Bottom Bar */}
      <footer className="border-t border-[#E2DCD0] bg-[#FAF8F3]/90 py-6 text-center text-xs text-[#6B655B] relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="flex items-center gap-1.5">
            <span className="font-serif font-bold text-[#A94A42]">VinylVault</span>
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
        boxes={boxes}
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

      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={setCurrentTheme}
      />

      {/* Command Palette (Cmd/Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        shelfItems={shelfItems}
        setActiveTab={setActiveTab}
        onEditItem={handleOpenModalForEdit}
        onOpenSync={() => setIsSyncModalOpen(true)}
        onOpenTheme={() => setIsThemeModalOpen(true)}
      />

      {/* Toast Notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Save Celebration */}
      <Confetti trigger={confettiTrigger} />
    </div>
  );
}
