import { WantlistItem } from "../types";

const WANTLIST_STORAGE_KEY = "vinylvault_wantlist";

export function getStoredWantlist(): WantlistItem[] {
  const raw = localStorage.getItem(WANTLIST_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWantlistToLocal(items: WantlistItem[]) {
  localStorage.setItem(WANTLIST_STORAGE_KEY, JSON.stringify(items));
}

export function generateWantlistId(): string {
  return "want-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
