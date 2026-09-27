import { atom } from "jotai";
import type { SheetTemplate } from "../types";
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

// 全シート雛形カタログ
export const sheetTemplatesAtom = atom<Record<string, SheetTemplate>>(
  DEFAULT_SHEET_TEMPLATES,
);

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

// --- シート開閉・切り替えアクション ---

export const openSheetAtom = atom(null, (get, set, sheetId: string) => {
  const currentOpenIds = get(openSheetIdsAtom);
  if (!currentOpenIds.includes(sheetId)) {
    set(openSheetIdsAtom, [...currentOpenIds, sheetId]);
  }
  set(activeSheetIdAtom, sheetId);
});

export const closeSheetAtom = atom(null, (get, set, sheetId: string) => {
  const currentOpenIds = get(openSheetIdsAtom);
  const nextOpenIds = currentOpenIds.filter((id) => id !== sheetId);
  set(openSheetIdsAtom, nextOpenIds);

  const currentActiveId = get(activeSheetIdAtom);
  if (currentActiveId === sheetId) {
    set(activeSheetIdAtom, nextOpenIds[0] ?? null);
  }
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
