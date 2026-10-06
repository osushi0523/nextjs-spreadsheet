import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import type { ColumnId, ColumnValidationRule } from "./types";
import { activeSheetIdAtom } from "./ui";

// Record<sheetId, Record<ColumnId, ColumnValidationRule[]>>
export const columnValidationsAtom = atom<
  Record<string, Record<ColumnId, ColumnValidationRule[]>>
>({});

const EMPTY_VALIDATIONS: Record<ColumnId, ColumnValidationRule[]> = {};

// アクティブシートの列バリデーション定義
export const activeColumnValidationsAtom = atom<
  Record<ColumnId, ColumnValidationRule[]>
>((get) => {
  const activeSheetId = get(activeSheetIdAtom);
  if (!activeSheetId) return EMPTY_VALIDATIONS;
  const allValidations = get(columnValidationsAtom);
  return allValidations[activeSheetId] ?? EMPTY_VALIDATIONS;
});

// 列ごとのバリデーションルール取得 Family
export const activeColumnValidationFamily = atomFamily((colId: ColumnId) =>
  atom((get) => {
    const validations = get(activeColumnValidationsAtom);
    return validations[colId] ?? [];
  }),
);
