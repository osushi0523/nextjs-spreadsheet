import { atom, type Getter } from "jotai";
import { baseCellValuesAtom } from "./base";
import { activeColumnConfigsAtom, columnConfigsAtom } from "./binding";
import {
  cellFamily,
  columnNamesAtom,
  columnOrderAtom,
  rowOrderAtom,
} from "./derived";
import {
  cellCustomStatusesAtom,
  cellEditsAtom,
  modifiedRowOrdersAtom,
  rowStatusesAtom,
  touchedCellsAtom,
} from "./edit";
import { activeColumnFiltersAtom, visibleRowOrderAtom } from "./filter";
import {
  type CellAddress,
  type CellStatusInfo,
  type ColumnConfig,
  type ColumnId,
  createColumnId,
  createRowId,
  type InsertPosition,
  type LookupColumnDefinition,
  type MoveDirection,
  type PulldownMode,
  type RowId,
  type RowStatus,
} from "./types";
import { activeSheetIdAtom, selectionAtom } from "./ui";
import { asyncValidationErrorsAtom } from "./validation";

export const resetRowStatusesAtom = atom(null, (get, set) => {
  const activeRowIds = get(rowOrderAtom);
  const currentStatuses = { ...get(rowStatusesAtom) };

  // Only reset statuses for rows in the active sheet
  activeRowIds.forEach((id) => {
    delete currentStatuses[id];
  });

  set(rowStatusesAtom, currentStatuses);
});

/**
 * フィルター選択肢と基準行の値から、新規セルに補完する値を決定する純粋関数
 */
const pickPrefillValue = (
  selectedValues: string[],
  sourceValue?: string,
): string | undefined => {
  if (sourceValue && selectedValues.includes(sourceValue)) {
    return sourceValue;
  }
  return selectedValues.find((val) => val !== "") ?? selectedValues[0];
};

/**
 * 列が穴埋め入力の対象かを判定するガード
 */
const isPrefillableColumn = (config?: ColumnConfig): boolean =>
  config?.type !== "lookup" && !config?.readOnly;

/**
 * 新規行に対してアクティブなフィルター条件から穴埋めする編集差分を生成
 */
const resolvePrefillValuesForNewRow = (
  get: Getter,
  newRowId: RowId,
  sourceRowId?: RowId,
): Record<string, string> => {
  const filters = get(activeColumnFiltersAtom);
  const configs = get(activeColumnConfigsAtom);
  const edits = get(cellEditsAtom);
  const baseValues = get(baseCellValuesAtom);

  const prefillEdits: Record<string, string> = {};

  for (const [colId, filter] of Object.entries(filters)) {
    if (!isPrefillableColumn(configs[colId as ColumnId])) continue;
    if (!filter?.selectedValues?.length) continue;

    const sourceKey = sourceRowId ? `${sourceRowId}-${colId}` : undefined;
    const sourceValue = sourceKey
      ? (edits[sourceKey] ?? baseValues[sourceKey])
      : undefined;

    const fillValue = pickPrefillValue(filter.selectedValues, sourceValue);
    if (fillValue) {
      prefillEdits[`${newRowId}-${colId}`] = fillValue;
    }
  }

  return prefillEdits;
};

export const addRowAtom = atom(null, (get, set) => {
  const newId = createRowId();
  const rowOrder = get(rowOrderAtom);
  const prefillEdits = resolvePrefillValuesForNewRow(get, newId);

  set(rowOrderAtom, [...rowOrder, newId]);
  set(cellEditsAtom, {
    ...get(cellEditsAtom),
    ...prefillEdits,
  });
  set(rowStatusesAtom, {
    ...get(rowStatusesAtom),
    [newId]: "added",
  });
});

export const insertRowAtom = atom(
  null,
  (
    get,
    set,
    { rowId, position }: { rowId: RowId; position: InsertPosition },
  ) => {
    const rowOrder = get(rowOrderAtom);
    const rowIndex = rowOrder.indexOf(rowId);
    if (rowIndex === -1) return;

    const newId = createRowId();
    const newRowOrder = [...rowOrder];
    const insertIndex = position === "above" ? rowIndex : rowIndex + 1;
    newRowOrder.splice(insertIndex, 0, newId);

    const prefillEdits = resolvePrefillValuesForNewRow(get, newId, rowId);

    set(rowOrderAtom, newRowOrder);
    set(cellEditsAtom, {
      ...get(cellEditsAtom),
      ...prefillEdits,
    });
    set(rowStatusesAtom, {
      ...get(rowStatusesAtom),
      [newId]: "added",
    });
  },
);

export const deleteRowAtom = atom(null, (get, set, rowId: RowId) => {
  const rowStatuses = get(rowStatusesAtom);
  set(rowStatusesAtom, {
    ...rowStatuses,
    [rowId]: "deleted",
  });
});

export const duplicateRowAtom = atom(
  null,
  (
    get,
    set,
    { rowId, position }: { rowId: RowId; position: InsertPosition },
  ) => {
    const rowOrder = get(rowOrderAtom);
    const rowIndex = rowOrder.indexOf(rowId);
    if (rowIndex === -1) return;

    const newId = createRowId();
    const newRowOrder = [...rowOrder];
    const insertIndex = position === "above" ? rowIndex : rowIndex + 1;
    newRowOrder.splice(insertIndex, 0, newId);

    const columnOrder = get(columnOrderAtom);
    const configs = get(activeColumnConfigsAtom);
    const copiedEdits: Record<string, string> = {};

    for (const colId of columnOrder) {
      const colConfig = configs[colId];
      if (colConfig && (colConfig.type === "lookup" || colConfig.readOnly)) {
        continue;
      }
      const value = get(cellFamily({ rowId, colId }));
      if (value !== "") {
        copiedEdits[`${newId}-${colId}`] = value;
      }
    }

    set(rowOrderAtom, newRowOrder);
    set(cellEditsAtom, {
      ...get(cellEditsAtom),
      ...copiedEdits,
    });
    set(rowStatusesAtom, {
      ...get(rowStatusesAtom),
      [newId]: "added",
    });
  },
);

export const pasteRowsAtom = atom(null, (get, set, rowsData: string[][]) => {
  const columnOrder = get(columnOrderAtom);
  const activeConfigs = get(activeColumnConfigsAtom);
  const currentRowOrder = get(rowOrderAtom);
  const currentEdits = get(cellEditsAtom);
  const currentRowStatuses = get(rowStatusesAtom);
  const selection = get(selectionAtom);

  const startCol = 0;
  const insertIndex = selection
    ? Math.max(selection.start.row, selection.end.row) + 1
    : currentRowOrder.length;

  const targetColumns = columnOrder.filter(
    (colId) => activeConfigs[colId]?.type !== "lookup",
  );

  const newRowIds: RowId[] = [];
  const newCellEdits: Record<string, string> = {};
  const newRowStatuses: Record<RowId, RowStatus> = { ...currentRowStatuses };

  for (const rowData of rowsData) {
    const rowId = createRowId();
    newRowIds.push(rowId);
    newRowStatuses[rowId] = "added";

    rowData.forEach((value, index) => {
      const colIndex = startCol + index;
      if (colIndex < targetColumns.length) {
        const colId = targetColumns[colIndex];
        newCellEdits[`${rowId}-${colId}`] = value;
      }
    });
  }

  const newRowOrder = [...currentRowOrder];
  newRowOrder.splice(insertIndex, 0, ...newRowIds);

  set(rowOrderAtom, newRowOrder);
  set(cellEditsAtom, {
    ...currentEdits,
    ...newCellEdits,
  });
  set(rowStatusesAtom, newRowStatuses);
});

export type ApplyColumnBindingPayload = {
  targetColId: ColumnId;
  keyColName?: string;
  sourceSheetId: string;
  sourceKeyColId: ColumnId;
  selectedLookupCols: {
    sourceColId: ColumnId;
    headerName: string;
  }[];
  mode: PulldownMode;
};

export const applyColumnBindingAtom = atom(
  null,
  (get, set, payload: ApplyColumnBindingPayload) => {
    const {
      targetColId,
      keyColName,
      sourceSheetId,
      sourceKeyColId,
      selectedLookupCols,
      mode,
    } = payload;

    const activeSheetId = get(activeSheetIdAtom);
    if (!activeSheetId) return;

    const currentOrders = get(columnOrderAtom);
    const colConfigs = { ...(get(columnConfigsAtom)[activeSheetId] ?? {}) };

    // If targetColId already had previous lookup columns, remove them first
    const existingConfig = colConfigs[targetColId];
    let workingOrder = [...currentOrders];
    if (existingConfig && existingConfig.type === "pulldown") {
      const oldLookupColIds = new Set(
        existingConfig.pulldown.lookupColumns.map((l) => l.lookupColId),
      );
      workingOrder = workingOrder.filter((id) => !oldLookupColIds.has(id));
      for (const oldId of oldLookupColIds) {
        delete colConfigs[oldId];
      }
    }

    const targetIndex = workingOrder.indexOf(targetColId);
    if (targetIndex === -1) return;

    // Create new lookup columns
    const newLookupDefinitions: LookupColumnDefinition[] = [];
    const newLookupColIds: ColumnId[] = [];
    const newNames: Record<ColumnId, string> = {};

    if (keyColName) {
      newNames[targetColId] = keyColName;
    }

    for (const item of selectedLookupCols) {
      const newColId = createColumnId();
      newLookupColIds.push(newColId);
      newLookupDefinitions.push({
        lookupColId: newColId,
        sourceColId: item.sourceColId,
        sourceColName: item.headerName,
      });
      newNames[newColId] = item.headerName;

      colConfigs[newColId] = {
        type: "lookup",
        lookup: {
          parentColId: targetColId,
          sourceSheetId,
          sourceColId: item.sourceColId,
        },
      };
    }

    colConfigs[targetColId] = {
      type: "pulldown",
      pulldown: {
        sourceSheetId,
        sourceKeyColId,
        lookupColumns: newLookupDefinitions,
        mode,
      },
    };

    // Insert lookup columns right after targetColId
    workingOrder.splice(targetIndex + 1, 0, ...newLookupColIds);

    set(columnOrderAtom, workingOrder);
    set(columnNamesAtom, (prev) => ({ ...prev, ...newNames }));
    set(columnConfigsAtom, {
      ...get(columnConfigsAtom),
      [activeSheetId]: colConfigs,
    });
  },
);

export const removeColumnBindingAtom = atom(
  null,
  (get, set, targetColId: ColumnId) => {
    const activeSheetId = get(activeSheetIdAtom);
    if (!activeSheetId) return;

    const currentConfigs = { ...(get(columnConfigsAtom)[activeSheetId] ?? {}) };
    const config = currentConfigs[targetColId];
    if (!config || config.type !== "pulldown") return;

    const lookupColIds = new Set(
      config.pulldown.lookupColumns.map((l) => l.lookupColId),
    );

    delete currentConfigs[targetColId];
    for (const lookupId of lookupColIds) {
      delete currentConfigs[lookupId];
    }

    const currentOrder = get(columnOrderAtom);
    const newOrder = currentOrder.filter((id) => !lookupColIds.has(id));

    set(columnOrderAtom, newOrder);
    set(columnConfigsAtom, {
      ...get(columnConfigsAtom),
      [activeSheetId]: currentConfigs,
    });
  },
);

type ColumnGroup = {
  id: ColumnId;
  members: ColumnId[];
};

export const reorderColumnsWithFollowersAtom = atom(
  null,
  (
    get,
    set,
    { activeColId, overColId }: { activeColId: ColumnId; overColId: ColumnId },
  ) => {
    if (activeColId === overColId) return;
    const activeSheetId = get(activeSheetIdAtom);
    if (!activeSheetId) return;

    const currentOrder = get(columnOrderAtom);
    const configs = get(columnConfigsAtom)[activeSheetId] ?? {};

    const activeConfig = configs[activeColId];
    // Lookup columns cannot be moved directly
    if (activeConfig?.type === "lookup") return;

    const groups: ColumnGroup[] = [];
    const handledLookupColIds = new Set<ColumnId>();

    for (const colId of currentOrder) {
      if (handledLookupColIds.has(colId)) {
        continue;
      }

      const config = configs[colId];
      if (config?.type === "pulldown") {
        const followers: ColumnId[] = [];
        for (const lookupDef of config.pulldown.lookupColumns) {
          if (currentOrder.includes(lookupDef.lookupColId)) {
            followers.push(lookupDef.lookupColId);
            handledLookupColIds.add(lookupDef.lookupColId);
          }
        }
        groups.push({
          id: colId,
          members: [colId, ...followers],
        });
      } else if (config?.type === "lookup") {
        // Fallback for orphaned lookup columns if parent is missing from currentOrder
        const parentColId = config.lookup.parentColId;
        if (!currentOrder.includes(parentColId)) {
          groups.push({
            id: colId,
            members: [colId],
          });
        }
      } else {
        groups.push({
          id: colId,
          members: [colId],
        });
      }
    }

    const activeGroupIndex = groups.findIndex((g) =>
      g.members.includes(activeColId),
    );
    const overGroupIndex = groups.findIndex((g) =>
      g.members.includes(overColId),
    );

    if (
      activeGroupIndex === -1 ||
      overGroupIndex === -1 ||
      activeGroupIndex === overGroupIndex
    ) {
      return;
    }

    const nextGroups = [...groups];
    const [movedGroup] = nextGroups.splice(activeGroupIndex, 1);
    nextGroups.splice(overGroupIndex, 0, movedGroup);

    const newOrder = nextGroups.flatMap((g) => g.members);
    set(columnOrderAtom, newOrder);
  },
);

export const setCellStatusAtom = atom(
  null,
  (
    get,
    set,
    {
      address,
      statusInfo,
    }: { address: CellAddress; statusInfo: CellStatusInfo },
  ) => {
    const key = `${address.rowId}-${address.colId}`;
    const customStatuses = get(cellCustomStatusesAtom);
    if (statusInfo.status === "none" && !statusInfo.message) {
      const next = { ...customStatuses };
      delete next[key];
      set(cellCustomStatusesAtom, next);
    } else {
      set(cellCustomStatusesAtom, {
        ...customStatuses,
        [key]: statusInfo,
      });
    }
  },
);

export const setCellValidationErrorsAtom = atom(
  null,
  (get, set, errors: Record<string, string>) => {
    const customStatuses = { ...get(cellCustomStatusesAtom) };
    for (const [key, message] of Object.entries(errors)) {
      if (message) {
        customStatuses[key] = { status: "error", message };
      } else if (customStatuses[key]?.status === "error") {
        delete customStatuses[key];
      }
    }
    set(cellCustomStatusesAtom, customStatuses);
  },
);

export const clearCellCustomStatusesAtom = atom(null, (_get, set) => {
  set(cellCustomStatusesAtom, {});
});

export const commitSheetEditsAtom = atom(null, (get, set) => {
  const activeSheetId = get(activeSheetIdAtom);
  if (!activeSheetId) return;

  const currentRowStatuses = get(rowStatusesAtom);
  const currentRowOrder = get(rowOrderAtom);

  // 1. 削除行を除外した新しい rowOrder を modifiedRowOrders に記録
  const nextRowOrder = currentRowOrder.filter(
    (id) => currentRowStatuses[id] !== "deleted",
  );
  set(modifiedRowOrdersAtom, {
    ...get(modifiedRowOrdersAtom),
    [activeSheetId]: nextRowOrder,
  });

  // 2. 編集差分をクリア
  set(cellEditsAtom, {});
  set(rowStatusesAtom, {});
  set(cellCustomStatusesAtom, {});
  set(asyncValidationErrorsAtom, {});
  set(touchedCellsAtom, new Set());
});

export const moveSelectionAtom = atom(
  null,
  (
    get,
    set,
    {
      deltaRow,
      deltaCol,
      extend = false,
    }: MoveDirection & { extend?: boolean },
  ) => {
    const visibleRowOrder = get(visibleRowOrderAtom);
    const columnOrder = get(columnOrderAtom);
    const rowCount = visibleRowOrder.length;
    const colCount = columnOrder.length;

    if (rowCount === 0 || colCount === 0) return;

    const prev = get(selectionAtom);
    if (!prev) {
      set(selectionAtom, {
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      });
      return;
    }

    if (extend) {
      const nextEndRow = Math.max(
        0,
        Math.min(rowCount - 1, prev.end.row + deltaRow),
      );
      const nextEndCol = Math.max(
        0,
        Math.min(colCount - 1, prev.end.col + deltaCol),
      );
      set(selectionAtom, {
        start: prev.start,
        end: { row: nextEndRow, col: nextEndCol },
      });
    } else {
      const nextRow = Math.max(
        0,
        Math.min(rowCount - 1, prev.start.row + deltaRow),
      );
      const nextCol = Math.max(
        0,
        Math.min(colCount - 1, prev.start.col + deltaCol),
      );
      set(selectionAtom, {
        start: { row: nextRow, col: nextCol },
        end: { row: nextRow, col: nextCol },
      });
    }
  },
);

export const clearSelectedCellsAtom = atom(null, (get, set) => {
  const selection = get(selectionAtom);
  if (!selection) return;

  const visibleRowOrder = get(visibleRowOrderAtom);
  const columnOrder = get(columnOrderAtom);
  const configs = get(activeColumnConfigsAtom);
  const baseValues = get(baseCellValuesAtom);
  const currentEdits = get(cellEditsAtom);
  const currentRowStatuses = get(rowStatusesAtom);

  const minRow = Math.min(selection.start.row, selection.end.row);
  const maxRow = Math.max(selection.start.row, selection.end.row);
  const minCol = Math.min(selection.start.col, selection.end.col);
  const maxCol = Math.max(selection.start.col, selection.end.col);

  let hasChanges = false;
  const nextEdits = { ...currentEdits };
  const nextRowStatuses = { ...currentRowStatuses };

  for (let r = minRow; r <= maxRow; r++) {
    const rowId = visibleRowOrder[r];
    if (!rowId) continue;

    for (let c = minCol; c <= maxCol; c++) {
      const colId = columnOrder[c];
      if (!colId) continue;

      const colConfig = configs[colId];
      if (colConfig && (colConfig.type === "lookup" || colConfig.readOnly)) {
        continue;
      }

      const key = `${rowId}-${colId}`;
      const currentVal =
        key in currentEdits ? currentEdits[key] : (baseValues[key] ?? "");

      if (currentVal !== "") {
        nextEdits[key] = "";
        hasChanges = true;
        if ((nextRowStatuses[rowId] ?? "none") === "none") {
          nextRowStatuses[rowId] = "edited";
        }
      }
    }
  }

  if (hasChanges) {
    set(cellEditsAtom, nextEdits);
    set(rowStatusesAtom, nextRowStatuses);
  }
});
