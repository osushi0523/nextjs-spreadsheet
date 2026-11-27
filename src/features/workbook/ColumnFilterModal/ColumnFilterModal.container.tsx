import { useAtomValue, useSetAtom } from "jotai";
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  activeColumnConfigFamily,
  activeColumnFilterFamily,
  activeSheetIdAtom,
  type ColumnId,
  cellEditsAtom,
  clearColumnFilterAtom,
  columnNamesAtom,
  columnUniqueValuesFamily,
  referencedSheetsDataAtom,
  setColumnFilterAtom,
  sheetTemplatesAtom,
} from "../stores";
import type {
  ColumnFilterModalPresenterProps,
  FilterOption,
} from "./ColumnFilterModal.presenter";
import { filterModalMessages } from "./i18n";

export type ColumnFilterModalContainerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetColId: ColumnId;
  children: (props: ColumnFilterModalPresenterProps) => ReactNode;
};

export const ColumnFilterModalContainer: FC<
  ColumnFilterModalContainerProps
> = ({ open, onOpenChange, targetColId, children }) => {
  const { t } = useI18n(filterModalMessages);
  const columnNames = useAtomValue(columnNamesAtom);
  const columnName = columnNames[targetColId] ?? "";

  const uniqueValues = useAtomValue(
    useMemo(() => columnUniqueValuesFamily(targetColId), [targetColId]),
  );

  const existingFilter = useAtomValue(
    useMemo(() => activeColumnFilterFamily(targetColId), [targetColId]),
  );

  const config = useAtomValue(
    useMemo(() => activeColumnConfigFamily(targetColId), [targetColId]),
  );
  const referencedSheets = useAtomValue(referencedSheetsDataAtom);
  const cellEdits = useAtomValue(cellEditsAtom);

  const isFilterActive = existingFilter !== undefined;

  const activeSheetId = useAtomValue(activeSheetIdAtom);
  const templates = useAtomValue(sheetTemplatesAtom);
  const template = activeSheetId ? templates[activeSheetId] : undefined;
  const filterDef = template?.filters?.find((f) => f.field === targetColId);
  const isSingleSelect = filterDef?.selectionType === "single";
  const isRequired = Boolean(filterDef?.required);

  const options: FilterOption[] = useMemo(() => {
    if (config?.type === "pulldown") {
      const { sourceSheetId, sourceKeyColId, lookupColumns } = config.pulldown;
      const masterSheet = referencedSheets[sourceSheetId];
      const labelMap = new Map<string, string>();

      if (masterSheet) {
        for (const rId of masterSheet.rows) {
          const key = `${rId}-${sourceKeyColId}`;
          const keyVal =
            key in cellEdits ? cellEdits[key] : (masterSheet.values[key] ?? "");
          const labels = lookupColumns
            .map((l) => {
              const lKey = `${rId}-${l.sourceColId}`;
              return lKey in cellEdits
                ? cellEdits[lKey]
                : (masterSheet.values[lKey] ?? "");
            })
            .filter(Boolean)
            .join(" - ");

          if (keyVal && labels) {
            labelMap.set(keyVal, labels);
          }
        }
      }

      return uniqueValues.map((val) => {
        const lookup = labelMap.get(val);
        return {
          value: val,
          label:
            val === "" ? t("blankValue") : lookup ? `${val} (${lookup})` : val,
          detail: lookup,
        };
      });
    }

    return uniqueValues.map((val) => ({
      value: val,
      label: val === "" ? t("blankValue") : val,
    }));
  }, [config, referencedSheets, cellEdits, uniqueValues, t]);

  // Local selection state inside the modal
  const [selectedValues, setSelectedValues] = useState<string[]>(() => {
    if (existingFilter) {
      return existingFilter.selectedValues;
    }
    if (isSingleSelect && isRequired) {
      return uniqueValues.length > 0 ? [uniqueValues[0]] : [];
    }
    return isSingleSelect ? [] : uniqueValues;
  });

  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reset local state when modal opens or uniqueValues changes
  useEffect(() => {
    if (open) {
      if (existingFilter) {
        setSelectedValues(existingFilter.selectedValues);
      } else if (isSingleSelect && isRequired) {
        setSelectedValues(uniqueValues.length > 0 ? [uniqueValues[0]] : []);
      } else {
        setSelectedValues(isSingleSelect ? [] : uniqueValues);
      }
      setSearchQuery("");
    }
  }, [open, existingFilter, uniqueValues, isSingleSelect, isRequired]);

  const setColumnFilter = useSetAtom(setColumnFilterAtom);
  const clearColumnFilter = useSetAtom(clearColumnFilterAtom);

  const handleToggleValue = useCallback(
    (value: string) => {
      setSelectedValues((prev) => {
        if (isSingleSelect) {
          if (isRequired) {
            return [value];
          }
          return prev.includes(value) ? [] : [value];
        }
        if (prev.includes(value)) {
          return prev.filter((v) => v !== value);
        }
        return [...prev, value];
      });
    },
    [isSingleSelect, isRequired],
  );

  const handleSelectAll = useCallback(() => {
    if (!isSingleSelect) {
      setSelectedValues(uniqueValues);
    }
  }, [isSingleSelect, uniqueValues]);

  const handleDeselectAll = useCallback(() => {
    setSelectedValues([]);
  }, []);

  const handleApply = useCallback(() => {
    if (isSingleSelect) {
      if (selectedValues.length === 0) {
        clearColumnFilter(targetColId);
      } else {
        setColumnFilter({
          colId: targetColId,
          selectedValues,
        });
      }
    } else {
      // If all unique values are selected, it is equivalent to no filter
      if (selectedValues.length === uniqueValues.length) {
        clearColumnFilter(targetColId);
      } else {
        setColumnFilter({
          colId: targetColId,
          selectedValues,
        });
      }
    }
    onOpenChange(false);
  }, [
    isSingleSelect,
    selectedValues,
    uniqueValues,
    clearColumnFilter,
    setColumnFilter,
    targetColId,
    onOpenChange,
  ]);

  const handleClearFilter = useCallback(() => {
    clearColumnFilter(targetColId);
    onOpenChange(false);
  }, [clearColumnFilter, targetColId, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      {children({
        open,
        onOpenChange,
        columnName,
        options,
        selectedValues,
        searchQuery,
        onChangeSearchQuery: setSearchQuery,
        onToggleValue: handleToggleValue,
        onSelectAll: handleSelectAll,
        onDeselectAll: handleDeselectAll,
        onApply: handleApply,
        onClearFilter: handleClearFilter,
        onCancel: handleCancel,
        isFilterActive,
        isSingleSelect,
        isRequired,
      })}
    </>
  );
};
