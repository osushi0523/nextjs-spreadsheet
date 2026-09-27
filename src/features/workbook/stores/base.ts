import { atom } from "jotai";
import type { ColumnId, RowId, SheetData } from "./types";

// --- Base State (Populated for the currently active tab) ---
export const baseCellValuesAtom = atom<Record<string, string>>({});
export const baseRowOrderAtom = atom<RowId[]>([]);
export const baseColumnOrderAtom = atom<ColumnId[]>([]);
export const baseColumnNamesAtom = atom<Record<ColumnId, string>>({});

// --- Multi-Sheet Data Store (Managed via Jotai for reactive GC & Lifecycle) ---
export const sheetDataMapAtom = atom<Record<string, SheetData>>({});
export const sheetFieldToColIdMapAtom = atom<
  Record<string, Record<string, ColumnId>>
>({});
