import { VinylBox } from "../types";

const BOXES_STORAGE_KEY = "vinylvault_boxes";

export function getStoredBoxes(): VinylBox[] {
  const raw = localStorage.getItem(BOXES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBoxesToLocal(boxes: VinylBox[]) {
  localStorage.setItem(BOXES_STORAGE_KEY, JSON.stringify(boxes));
}

export function generateBoxId(): string {
  return "box-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
