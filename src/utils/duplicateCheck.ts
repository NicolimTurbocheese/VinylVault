import { ShelfItem } from "../types";

export interface DuplicateGroup {
  key: string;
  artist: string;
  albumTitle: string;
  items: ShelfItem[];
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Flags records that share the exact same artist + album title. Doesn't assume they're
// true duplicates (two different physical pressings of the same title is legitimate) —
// just surfaces the group so the owner can confirm, same discipline used for the
// original spreadsheet import.
export function findDuplicateGroups(items: ShelfItem[]): DuplicateGroup[] {
  const groups = new Map<string, ShelfItem[]>();
  for (const item of items) {
    const key = `${normalize(item.artist)}|||${normalize(item.albumTitle)}`;
    if (!key.trim().replace(/\|/g, "")) continue;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const result: DuplicateGroup[] = [];
  for (const [key, groupItems] of groups.entries()) {
    if (groupItems.length < 2) continue;
    result.push({ key, artist: groupItems[0].artist, albumTitle: groupItems[0].albumTitle, items: groupItems });
  }
  return result.sort((a, b) => a.artist.localeCompare(b.artist));
}
