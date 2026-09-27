import { atom } from "jotai";
import {
  baseCellValuesAtom,
  baseColumnNamesAtom,
  baseColumnOrderAtom,
  baseRowOrderAtom,
  sheetDataMapAtom,
  sheetFieldToColIdMapAtom,
} from "../base";
import { columnConfigsAtom, referencedSheetsDataAtom } from "../binding";
import {
  modifiedColumnNamesAtom,
  modifiedColumnOrdersAtom,
  modifiedRowOrdersAtom,
} from "../edit";
import { columnTotalsAtom } from "../summary";
import type { SheetCategory, SheetTemplate } from "../types";
import { activeSheetIdAtom } from "../ui";
import { accountingUnitTemplate } from "./accountingUnit";
import { costDepartmentTemplate } from "./costDepartment";
import { officeTemplate } from "./office";
import { productionVolumeTemplate } from "./productionVolume";

export {
  productionVolumeTemplate,
  accountingUnitTemplate,
  officeTemplate,
  costDepartmentTemplate,
};

export const DEFAULT_SHEET_CATEGORIES: SheetCategory[] = [
  {
    id: "planning",
    name: "計画・実績",
    description: "生産量や各種計画・実績データの管理",
  },
  {
    id: "master",
    name: "マスタ管理",
    description: "会計単位、事業所、原価部門などの各種マスタデータ",
  },
];

export const DEFAULT_SHEET_TEMPLATES: Record<string, SheetTemplate> = {
  [productionVolumeTemplate.id]: productionVolumeTemplate,
  [accountingUnitTemplate.id]: accountingUnitTemplate,
  [officeTemplate.id]: officeTemplate,
  [costDepartmentTemplate.id]: costDepartmentTemplate,
};

export const INITIAL_OPEN_SHEET_IDS: string[] = [
  productionVolumeTemplate.id,
  accountingUnitTemplate.id,
  officeTemplate.id,
  costDepartmentTemplate.id,
];

// --- 雛形管理 Atom 群（Template State Atoms） ---

// 全カテゴリ
export const sheetCategoriesAtom = atom<SheetCategory[]>(
  DEFAULT_SHEET_CATEGORIES,
);

// 全シート雛形カタログ
export const sheetTemplatesAtom = atom<Record<string, SheetTemplate>>(
  DEFAULT_SHEET_TEMPLATES,
);

// 全シート雛形配列
export const allSheetTemplatesAtom = atom((get) => {
  const templates = get(sheetTemplatesAtom);
  return Object.values(templates);
});

// カテゴリ別シート一覧マップ
export const sheetsByCategoryAtom = atom((get) => {
  const templates = get(sheetTemplatesAtom);
  const categories = get(sheetCategoriesAtom);
  const result: { category: SheetCategory; sheets: SheetTemplate[] }[] = [];

  for (const cat of categories) {
    const sheets = Object.values(templates).filter(
      (t) => t.category === cat.id,
    );
    result.push({ category: cat, sheets });
  }

  // カテゴリ未分類のシートがあれば fallback カテゴリに追加
  const knownCatIds = new Set(categories.map((c) => c.id));
  const uncategorizedSheets = Object.values(templates).filter(
    (t) => !knownCatIds.has(t.category),
  );
  if (uncategorizedSheets.length > 0) {
    result.push({
      category: { id: "other", name: "その他" },
      sheets: uncategorizedSheets,
    });
  }

  return result;
});

// 現在開いている（タブに表示されている）シートID配列
export const openSheetIdsAtom = atom<string[]>(INITIAL_OPEN_SHEET_IDS);

// 現在アクティブなシートの雛形
export const activeSheetTemplateAtom = atom<SheetTemplate | null>((get) => {
  const activeSheetId = get(activeSheetIdAtom);
  if (!activeSheetId) return null;
  const templates = get(sheetTemplatesAtom);
  return templates[activeSheetId] ?? null;
});

// 現在開いているシート雛形一覧（SheetTabs 用）
export const openSheetsAtom = atom((get) => {
  const openIds = get(openSheetIdsAtom);
  const templates = get(sheetTemplatesAtom);
  return openIds
    .map((id) => templates[id])
    .filter((t): t is SheetTemplate => Boolean(t));
});

// --- シート開閉・切り替えアクション（Jotai GC 対応） ---

export const openSheetAtom = atom(null, (get, set, sheetId: string) => {
  const currentOpenIds = get(openSheetIdsAtom);
  if (!currentOpenIds.includes(sheetId)) {
    set(openSheetIdsAtom, [...currentOpenIds, sheetId]);
  }
  set(activeSheetIdAtom, sheetId);
});

/**
 * シートを閉じ、関連する Jotai Atom から参照を削除して GC を促す
 */
export const closeSheetAtom = atom(null, (get, set, sheetId: string) => {
  // 1. 開いているシートリストから削除
  const currentOpenIds = get(openSheetIdsAtom);
  const nextOpenIds = currentOpenIds.filter((id) => id !== sheetId);
  set(openSheetIdsAtom, nextOpenIds);

  // 2. アクティブシートの切り替え
  const currentActiveId = get(activeSheetIdAtom);
  if (currentActiveId === sheetId) {
    const nextActiveId = nextOpenIds[0] ?? null;
    set(activeSheetIdAtom, nextActiveId);

    if (nextActiveId) {
      const sheetDataMap = get(sheetDataMapAtom);
      const nextData = sheetDataMap[nextActiveId];
      if (nextData) {
        set(baseCellValuesAtom, nextData.values);
        set(baseRowOrderAtom, nextData.rows);
        set(baseColumnOrderAtom, nextData.cols);
        set(baseColumnNamesAtom, nextData.colNames);
      }
    } else {
      set(baseCellValuesAtom, {});
      set(baseRowOrderAtom, []);
      set(baseColumnOrderAtom, []);
      set(baseColumnNamesAtom, {});
    }
  }

  // 3. メモリ解放（GC対象にするため、閉じたシートのAtomキーを削除）
  const sheetDataMap = { ...get(sheetDataMapAtom) };
  delete sheetDataMap[sheetId];
  set(sheetDataMapAtom, sheetDataMap);

  const fieldToColMap = { ...get(sheetFieldToColIdMapAtom) };
  delete fieldToColMap[sheetId];
  set(sheetFieldToColIdMapAtom, fieldToColMap);

  const configs = { ...get(columnConfigsAtom) };
  delete configs[sheetId];
  set(columnConfigsAtom, configs);

  const totals = { ...get(columnTotalsAtom) };
  delete totals[sheetId];
  set(columnTotalsAtom, totals);

  const referencedSheets = { ...get(referencedSheetsDataAtom) };
  delete referencedSheets[sheetId];
  set(referencedSheetsDataAtom, referencedSheets);

  // 4. 編集差分状態のクリーンアップ
  const modRowOrders = { ...get(modifiedRowOrdersAtom) };
  delete modRowOrders[sheetId];
  set(modifiedRowOrdersAtom, modRowOrders);

  const modColOrders = { ...get(modifiedColumnOrdersAtom) };
  delete modColOrders[sheetId];
  set(modifiedColumnOrdersAtom, modColOrders);

  const modColNames = { ...get(modifiedColumnNamesAtom) };
  delete modColNames[sheetId];
  set(modifiedColumnNamesAtom, modColNames);
});

export const toggleSheetAtom = atom(null, (get, set, sheetId: string) => {
  const currentOpenIds = get(openSheetIdsAtom);
  if (currentOpenIds.includes(sheetId)) {
    if (currentOpenIds.length > 1) {
      set(closeSheetAtom, sheetId);
    }
  } else {
    set(openSheetAtom, sheetId);
  }
});
