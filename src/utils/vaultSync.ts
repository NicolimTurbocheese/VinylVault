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

// Every synced record type (shelf items, boxes, ...) lives in its own subcollection
// under the same vault: /vaults/{vaultCode}/{collectionName}/{docId}.
function collectionRef(vaultCode: string, collectionName: string) {
  const db = getDb();
  if (!db) return null;
  return collection(db, "vaults", vaultCode, collectionName);
}

export function subscribeToVaultCollection<T extends { id: string }>(
  vaultCode: string,
  collectionName: string,
  onItems: (items: T[]) => void,
  onError: (err: unknown) => void
): Unsubscribe | null {
  const col = collectionRef(vaultCode, collectionName);
  if (!col) return null;
  return onSnapshot(
    col,
    (snapshot) => {
      onItems(snapshot.docs.map((d) => d.data() as T));
    },
    onError
  );
}

export async function fetchVaultCollectionOnce<T extends { id: string }>(
  vaultCode: string,
  collectionName: string
): Promise<T[]> {
  const col = collectionRef(vaultCode, collectionName);
  if (!col) return [];
  const snap = await getDocs(col);
  return snap.docs.map((d) => d.data() as T);
}

export async function upsertVaultDoc<T extends { id: string }>(
  vaultCode: string,
  collectionName: string,
  item: T
) {
  const db = getDb();
  if (!db) return;
  await setDoc(doc(db, "vaults", vaultCode, collectionName, item.id), item);
}

export async function deleteVaultDoc(vaultCode: string, collectionName: string, id: string) {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, "vaults", vaultCode, collectionName, id));
}

export async function bulkUpsertVaultDocs<T extends { id: string }>(
  vaultCode: string,
  collectionName: string,
  items: T[]
) {
  const db = getDb();
  if (!db) return;
  await Promise.all(
    items.map((item) => setDoc(doc(db, "vaults", vaultCode, collectionName, item.id), item))
  );
}
