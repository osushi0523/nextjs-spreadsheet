import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  activeColumnConfigsAtom,
  activeColumnFiltersAtom,
  activeSheetIdAtom,
  type ColumnId,
  cellEditsAtom,
  clearColumnFilterAtom,
  columnUniqueValuesFamily,
  referencedSheetsDataAtom,
  setColumnFilterAtom,
  sheetTemplatesAtom,
} from "../stores";
import { filterBarMessages } from "./i18n";
import type {
  FilterChipItem,
  FilterFieldOption,
  SearchFilterBarPresenterProps,
  SearchFilterFieldModel,
} from "./SearchFilterBar.presenter";

export type UseSearchFilterBarResult = SearchFilterBarPresenterProps;

export const useSearchFilterBar = (): UseSearchFilterBarResult => {
  const { t } = useI18n(filterBarMessages);
  const store = useStore();
  const activeSheetId = useAtomValue(activeSheetIdAtom);
  const templates = useAtomValue(sheetTemplatesAtom);
  const template = activeSheetId ? templates[activeSheetId] : undefined;

  const [isOpen, setIsOpen] = useState(true);
  const filters = useAtomValue(activeColumnFiltersAtom);
  const setColumnFilter = useSetAtom(setColumnFilterAtom);
  const clearColumnFilter = useSetAtom(clearColumnFilterAtom);

  const configs = useAtomValue(activeColumnConfigsAtom);
  const referencedSheets = useAtomValue(referencedSheetsDataAtom);
  const cellEdits = useAtomValue(cellEditsAtom);

  const filterDefs = template?.filters;
  const hasFilters = Boolean(filterDefs && filterDefs.length > 0);

  const activeFilterCount = useMemo(() => {
    if (!filterDefs) return 0;
    return filterDefs.filter((def) => {
      const colFilter = filters[def.field as ColumnId];
      return colFilter && colFilter.selectedValues.length > 0;
    }).length;
  }, [filterDefs, filters]);

  const fields: SearchFilterFieldModel[] = useMemo(() => {
    if (!filterDefs || !template) return [];

    return filterDefs.map((def) => {
      const colDef = template.columns.find((c) => c.field === def.field);
      const label = def.label ?? colDef?.headerName ?? def.field;
      const colId = def.field as ColumnId;
      const config = configs[colId];
      const currentSelected = filters[colId]?.selectedValues ?? [];

      let options: FilterFieldOption[] = [];

      if (config?.type === "pulldown") {
        const { sourceSheetId, sourceKeyColId, lookupColumns, relation } =
          config.pulldown;
        const masterSheet = referencedSheets[sourceSheetId];

        if (masterSheet) {
          // リレーション連動のチェック
          let parentValue: string | undefined;
          if (relation?.parentColId) {
            const parentFilter = filters[relation.parentColId];
            if (parentFilter && parentFilter.selectedValues.length > 0) {
              parentValue = parentFilter.selectedValues[0];
            }
          }

          const seen = new Set<string>();
          for (const rId of masterSheet.rows) {
            // 親フィルターが存在する場合、対象レコードが一致するか確認
            if (parentValue !== undefined && relation?.sourceFilterColId) {
              const relKey = `${rId}-${relation.sourceFilterColId}`;
              const relVal =
                relKey in cellEdits
                  ? cellEdits[relKey]
                  : (masterSheet.values[relKey] ?? "");
              if (relVal !== parentValue) {
                continue;
              }
            }

            const key = `${rId}-${sourceKeyColId}`;
            const keyVal =
              key in cellEdits
                ? cellEdits[key]
                : (masterSheet.values[key] ?? "");
            if (!keyVal || seen.has(keyVal)) continue;
            seen.add(keyVal);

            const labels = lookupColumns
              .map((l) => {
                const lKey = `${rId}-${l.sourceColId}`;
                return lKey in cellEdits
                  ? cellEdits[lKey]
                  : (masterSheet.values[lKey] ?? "");
              })
              .filter(Boolean)
              .join(" - ");

            options.push({
              value: keyVal,
              label: labels ? `${keyVal}: ${labels}` : keyVal,
            });
          }
        }
      } else {
        // 通常列はストアの columnUniqueValuesFamily から一貫したユニーク値を取得
        const uniqueValues = store.get(columnUniqueValuesFamily(colId));
        options = uniqueValues.map((v) => ({
          value: v,
          label: v === "" ? t("allOption") : v,
        }));
      }

      return {
        field: def.field,
        label,
        required: Boolean(def.required),
        selectionType: def.selectionType,
        options,
        selectedValues: currentSelected,
      };
    });
  }, [
    filterDefs,
    template,
    configs,
    filters,
    referencedSheets,
    cellEdits,
    store,
    t,
  ]);

  // 必須入力の単一選択項目は、未選択時に先頭の値を自動選択
  useEffect(() => {
    for (const f of fields) {
      if (
        f.required &&
        f.selectionType === "single" &&
        f.selectedValues.length === 0 &&
        f.options.length > 0
      ) {
        setColumnFilter({
          colId: f.field as ColumnId,
          selectedValues: [f.options[0].value],
        });
      }
    }
  }, [fields, setColumnFilter]);

  const chips: FilterChipItem[] = useMemo(() => {
    return fields
      .filter((f) => f.selectedValues.length > 0)
      .map((f) => {
        let valueSummary = "";
        if (f.selectionType === "single") {
          const opt = f.options.find((o) => o.value === f.selectedValues[0]);
          valueSummary = opt ? opt.label : f.selectedValues[0];
        } else {
          if (f.selectedValues.length <= 2) {
            valueSummary = f.selectedValues
              .map((v) => f.options.find((o) => o.value === v)?.label ?? v)
              .join(", ");
          } else {
            valueSummary = t("multiSelectSummary", {
              count: f.selectedValues.length,
            });
          }
        }
        return {
          field: f.field,
          label: f.label,
          valueSummary,
          canRemove: !f.required,
        };
      });
  }, [fields, t]);

  const handleToggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClearAll = useCallback(() => {
    if (!filterDefs) return;
    for (const f of fields) {
      if (f.required && f.selectionType === "single" && f.options.length > 0) {
        // 必須単一選択項目は先頭に戻す
        setColumnFilter({
          colId: f.field as ColumnId,
          selectedValues: [f.options[0].value],
        });
      } else {
        clearColumnFilter(f.field as ColumnId);
      }
    }
  }, [filterDefs, fields, setColumnFilter, clearColumnFilter]);

  const handleRemoveChip = useCallback(
    (field: string) => {
      clearColumnFilter(field as ColumnId);
    },
    [clearColumnFilter],
  );

  const handleChangeSingle = useCallback(
    (field: string, value: string) => {
      if (!value || value === "__all__") {
        clearColumnFilter(field as ColumnId);
      } else {
        setColumnFilter({
          colId: field as ColumnId,
          selectedValues: [value],
        });
      }
    },
    [clearColumnFilter, setColumnFilter],
  );

  const handleChangeMultiple = useCallback(
    (field: string, values: string[]) => {
      if (values.length === 0) {
        clearColumnFilter(field as ColumnId);
      } else {
        setColumnFilter({
          colId: field as ColumnId,
          selectedValues: values,
        });
      }
    },
    [clearColumnFilter, setColumnFilter],
  );

  return {
    hasFilters,
    isOpen,
    activeFilterCount,
    chips,
    fields,
    onToggleOpen: handleToggleOpen,
    onClearAll: handleClearAll,
    onRemoveChip: handleRemoveChip,
    onChangeSingle: handleChangeSingle,
    onChangeMultiple: handleChangeMultiple,
  };
};
