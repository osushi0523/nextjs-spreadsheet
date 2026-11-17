import { atom } from "jotai";
import type { CellStatusInfo, ColumnId, RowId, RowStatus } from "./types";

// --- Diff State (Global across all tabs because of UUIDs) ---
export const cellEditsAtom = atom<Record<string, string>>({});
export const rowStatusesAtom = atom<Record<RowId, RowStatus>>({});
export const cellCustomStatusesAtom = atom<Record<string, CellStatusInfo>>({});
export const touchedCellsAtom = atom<Set<string>>(new Set<string>());

export const touchCellAtom = atom(null, (get, set, key: string) => {
  const current = get(touchedCellsAtom);
  if (!current.has(key)) {
    const next = new Set(current);
    next.add(key);
    set(touchedCellsAtom, next);
  }
});

export const modifiedRowOrdersAtom = atom<Record<string, RowId[]>>({});
export const modifiedColumnOrdersAtom = atom<Record<string, ColumnId[]>>({});
export const modifiedColumnNamesAtom = atom<
  Record<string, Record<ColumnId, string>>
>({});
