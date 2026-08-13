import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { ShelfItem } from "../types";

const VAULT_CODE_KEY = "vinylvault_vault_code";

export function getStoredVaultCode(): string | null {
  return localStorage.getItem(VAULT_CODE_KEY);
}

export function storeVaultCode(code: string) {
  localStorage.setItem(VAULT_CODE_KEY, code);
}

export function clearStoredVaultCode() {
  localStorage.removeItem(VAULT_CODE_KEY);
}

// 20-char URL-safe random code. Long enough that brute-forcing/guessing another
// vault's code is infeasible — this is the entire access control mechanism
// (see firestore.rules), so don't shorten it.
export function generateVaultCode(): string {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "A")
    .replace(/\//g, "B")
    .replace(/=/g, "")
    .slice(0, 20);
}

export function normalizeVaultCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function itemsCollectionRef(vaultCode: string) {
  const db = getDb();
  if (!db) return null;
  return collection(db, "vaults", vaultCode, "shelfItems");
}

export function subscribeToVault(
  vaultCode: string,
  onItems: (items: ShelfItem[]) => void,
  onError: (err: unknown) => void
): Unsubscribe | null {
  const col = itemsCollectionRef(vaultCode);
  if (!col) return null;
  return onSnapshot(
    col,
    (snapshot) => {
      onItems(snapshot.docs.map((d) => d.data() as ShelfItem));
    },
    onError
  );
}

export async function fetchVaultItemsOnce(vaultCode: string): Promise<ShelfItem[]> {
  const col = itemsCollectionRef(vaultCode);
  if (!col) return [];
  const snap = await getDocs(col);
  return snap.docs.map((d) => d.data() as ShelfItem);
}

export async function upsertVaultItem(vaultCode: string, item: ShelfItem) {
  const db = getDb();
  if (!db) return;
  await setDoc(doc(db, "vaults", vaultCode, "shelfItems", item.id), item);
}

export async function deleteVaultItem(vaultCode: string, id: string) {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, "vaults", vaultCode, "shelfItems", id));
}

export async function bulkUpsertVaultItems(vaultCode: string, items: ShelfItem[]) {
  const db = getDb();
  if (!db) return;
  await Promise.all(
    items.map((item) => setDoc(doc(db, "vaults", vaultCode, "shelfItems", item.id), item))
  );
}
