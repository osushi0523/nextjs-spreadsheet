import { atom, type Getter, type Setter } from "jotai";
import { sheetRecordsQuery } from "../services/sheetRecords/sheetRecords.query";
import { baseCellValuesAtom } from "./base";
import {
  activeColumnConfigsAtom,
  columnConfigsAtom,
  isColumnReadOnly,
} from "./binding";
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
import { sheetTemplatesAtom } from "./templates";
import {
  type CellAddress,
  type CellStatusInfo,
  type ColumnConfig,
  type ColumnId,
  type CopiedCellEntry,
  createColumnId,
  createRowId,
  type InsertPosition,
  isSubtotalRowId,
  type LookupColumnDefinition,
  type MoveDirection,
  type PasteColumnMismatch,
  type PulldownMode,
  parseRowIndex,
  type RowId,
  type RowStatus,
  type Selection,
} from "./types";
import {
  activeSheetIdAtom,
  internalClipboardAtom,
  pendingPasteConfirmationAtom,
  selectionAtom,
} from "./ui";
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
  !isColumnReadOnly(config);

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
  set(internalClipboardAtom, null);
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
    set(internalClipboardAtom, null);
  },
);

export const deleteRowAtom = atom(null, (get, set, rowId: RowId) => {
  const rowStatuses = get(rowStatusesAtom);
  set(rowStatusesAtom, {
    ...rowStatuses,
    [rowId]: "deleted",
  });
  set(internalClipboardAtom, null);
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
      if (isColumnReadOnly(colConfig)) {
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
    set(internalClipboardAtom, null);
  },
);

const getCellBaseValue = (
  get: Getter,
  rowId: RowId,
  colId: ColumnId,
  activeSheetId: string | null,
  baseValues: Record<string, string>,
): string => {
  if (activeSheetId) {
    const rowIndex = parseRowIndex(rowId, activeSheetId);
    if (rowIndex !== null) {
      const records = get(sheetRecordsQuery.sync(activeSheetId));
      return records[rowIndex]?.[colId] ?? "";
    }
  }
  return baseValues[`${rowId}-${colId}`] ?? "";
};

const isCellEditable = (
  colConfig: ColumnConfig | undefined,
  rowId: RowId,
  rowStatuses: Record<RowId, RowStatus>,
): boolean => {
  if (isSubtotalRowId(rowId) || rowStatuses[rowId] === "deleted") {
    return false;
  }
  return !isColumnReadOnly(colConfig);
};

const applyCellEdit = (
  nextEdits: Record<string, string>,
  nextRowStatuses: Record<RowId, RowStatus>,
  rowId: RowId,
  colId: ColumnId,
  baseValue: string,
  newValue: string,
): boolean => {
  const key = `${rowId}-${colId}`;
  const currentValue = key in nextEdits ? nextEdits[key] : baseValue;
  if (currentValue === newValue) return false;

  if (newValue !== baseValue) {
    nextEdits[key] = newValue;
    if ((nextRowStatuses[rowId] ?? "none") === "none") {
      nextRowStatuses[rowId] = "edited";
    }
    return true;
  }

  delete nextEdits[key];
  const hasOtherEditsInRow = Object.keys(nextEdits).some((k) =>
    k.startsWith(`${rowId}-`),
  );
  if (!hasOtherEditsInRow && nextRowStatuses[rowId] === "edited") {
    delete nextRowStatuses[rowId];
  }
  return true;
};

type SelectionBounds = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

const normalizeSelectionBounds = (
  selection: NonNullable<Selection>,
): SelectionBounds => ({
  minRow: Math.min(selection.start.row, selection.end.row),
  maxRow: Math.max(selection.start.row, selection.end.row),
  minCol: Math.min(selection.start.col, selection.end.col),
  maxCol: Math.max(selection.start.col, selection.end.col),
});

const isSingleValueFill = (
  rowsData: readonly (readonly unknown[])[],
  bounds: SelectionBounds,
): boolean =>
  rowsData.length === 1 &&
  rowsData[0].length === 1 &&
  (bounds.minRow !== bounds.maxRow || bounds.minCol !== bounds.maxCol);

const applyPasteValues = (get: Getter, set: Setter, rowsData: string[][]) => {
  const selection = get(selectionAtom);
  if (!selection || rowsData.length === 0) return;

  const visibleRowOrder = get(visibleRowOrderAtom);
  const columnOrder = get(columnOrderAtom);
  const activeConfigs = get(activeColumnConfigsAtom);
  const activeSheetId = get(activeSheetIdAtom);
  const baseValues = get(baseCellValuesAtom);
  const currentEdits = get(cellEditsAtom);
  const currentRowStatuses = get(rowStatusesAtom);

  const bounds = normalizeSelectionBounds(selection);
  const { minRow, maxRow, minCol, maxCol } = bounds;

  const nextEdits = { ...currentEdits };
  const nextRowStatuses: Record<RowId, RowStatus> = { ...currentRowStatuses };

  const tryOverwrite = (
    rowId: RowId,
    colId: ColumnId,
    newValue: string,
  ): boolean => {
    if (!isCellEditable(activeConfigs[colId], rowId, currentRowStatuses)) {
      return false;
    }
    const baseValue = getCellBaseValue(
      get,
      rowId,
      colId,
      activeSheetId,
      baseValues,
    );
    return applyCellEdit(
      nextEdits,
      nextRowStatuses,
      rowId,
      colId,
      baseValue,
      newValue,
    );
  };

  const isSingleValueToRange = isSingleValueFill(rowsData, bounds);

  // lookup 列は上書き対象からスキップして次の列へ割り当てる
  const targetColIndices = columnOrder
    .map((colId, idx) => ({ colId, idx }))
    .filter(
      ({ colId, idx }) =>
        idx >= minCol && activeConfigs[colId]?.type !== "lookup",
    )
    .map(({ idx }) => idx);

  const targetRows = visibleRowOrder.slice(minRow, minRow + rowsData.length);

  const targetCells = isSingleValueToRange
    ? visibleRowOrder
        .slice(minRow, maxRow + 1)
        .flatMap((rowId) =>
          columnOrder
            .slice(minCol, maxCol + 1)
            .map((colId) => ({ rowId, colId, value: rowsData[0][0] })),
        )
    : targetRows.flatMap((rowId, rOffset) =>
        rowsData[rOffset]
          .slice(0, targetColIndices.length)
          .map((value, cOffset) => ({
            rowId,
            colId: columnOrder[targetColIndices[cOffset]],
            value,
          })),
      );

  const hasChanges = targetCells.reduce(
    (changed, cell) =>
      tryOverwrite(cell.rowId, cell.colId, cell.value) || changed,
    false,
  );

  if (
    !isSingleValueToRange &&
    targetRows.length > 0 &&
    columnOrder.length > 0
  ) {
    const maxPastedRow = minRow + targetRows.length - 1;
    const pastedColCount = rowsData.reduce(
      (max, row) =>
        Math.max(max, Math.min(row.length, targetColIndices.length)),
      0,
    );
    const maxPastedCol =
      pastedColCount > 0 ? targetColIndices[pastedColCount - 1] : minCol;

    set(selectionAtom, {
      start: { row: minRow, col: minCol },
      end: {
        row: Math.min(maxPastedRow, visibleRowOrder.length - 1),
        col: Math.min(maxPastedCol, columnOrder.length - 1),
      },
    });
  }

  if (hasChanges) {
    set(cellEditsAtom, nextEdits);
    set(rowStatusesAtom, nextRowStatuses);
  }
};

export const pasteCellsAtom = atom(null, (get, set, rowsData: string[][]) => {
  applyPasteValues(get, set, rowsData);
});

const formatTsvCell = (value: string): string => {
  if (
    value.includes('"') ||
    value.includes("\t") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};

const formatTsvMatrix = (rows: CopiedCellEntry[][]): string =>
  rows
    .map((row) => row.map((cell) => formatTsvCell(cell.value)).join("\t"))
    .join("\n");

export const copySelectionAtom = atom(null, (get, set): string | null => {
  const selection = get(selectionAtom);
  const activeSheetId = get(activeSheetIdAtom);
  if (!selection || !activeSheetId) return null;

  const visibleRowOrder = get(visibleRowOrderAtom);
  const columnOrder = get(columnOrderAtom);
  const activeConfigs = get(activeColumnConfigsAtom);
  const columnNames = get(columnNamesAtom);
  const rowStatuses = get(rowStatusesAtom);

  const { minRow, maxRow, minCol, maxCol } =
    normalizeSelectionBounds(selection);

  const targetRows = visibleRowOrder
    .slice(minRow, maxRow + 1)
    .filter(
      (rowId) => !isSubtotalRowId(rowId) && rowStatuses[rowId] !== "deleted",
    );

  const targetCols = columnOrder
    .slice(minCol, maxCol + 1)
    .filter((colId) => activeConfigs[colId]?.type !== "lookup");

  if (targetRows.length === 0 || targetCols.length === 0) {
    return null;
  }

  const rows: CopiedCellEntry[][] = targetRows.map((rowId) =>
    targetCols.map((colId) => ({
      value: get(cellFamily({ rowId, colId })),
      sourceColId: colId,
      sourceColName: columnNames[colId] ?? String(colId),
    })),
  );

  const tsvText = formatTsvMatrix(rows);

  set(internalClipboardAtom, {
    sourceSheetId: activeSheetId,
    sourceRange: {
      sheetId: activeSheetId,
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol },
    },
    rows,
    tsvText,
  });

  return tsvText;
});

export const clearCopyModeAtom = atom(null, (_get, set) => {
  set(internalClipboardAtom, null);
});

const collectPasteMismatches = ({
  sourceSheetId,
  activeSheetId,
  rows,
  bounds,
  visibleRowOrder,
  columnOrder,
  activeConfigs,
  columnNames,
  rowStatuses,
}: {
  sourceSheetId: string;
  activeSheetId: string;
  rows: CopiedCellEntry[][];
  bounds: SelectionBounds;
  visibleRowOrder: RowId[];
  columnOrder: ColumnId[];
  activeConfigs: Record<ColumnId, ColumnConfig>;
  columnNames: Record<ColumnId, string>;
  rowStatuses: Record<RowId, RowStatus>;
}): PasteColumnMismatch[] => {
  const { minRow, maxRow, minCol, maxCol } = bounds;
  const isSameSheet = sourceSheetId === activeSheetId;
  const isSingleValueToRange = isSingleValueFill(rows, bounds);

  const seen = new Set<string>();
  const mismatches: PasteColumnMismatch[] = [];

  const checkCellPair = (
    rowId: RowId | undefined,
    targetColId: ColumnId | undefined,
    sourceEntry: CopiedCellEntry | undefined,
  ) => {
    if (!rowId || !targetColId || !sourceEntry) return;
    if (!isCellEditable(activeConfigs[targetColId], rowId, rowStatuses)) {
      return;
    }
    if (isSameSheet && sourceEntry.sourceColId === targetColId) {
      return;
    }
    const pairKey = `${sourceEntry.sourceColId}->${targetColId}`;
    if (seen.has(pairKey)) return;
    seen.add(pairKey);
    mismatches.push({
      sourceColId: sourceEntry.sourceColId,
      sourceColName: sourceEntry.sourceColName,
      targetColId,
      targetColName: columnNames[targetColId] ?? String(targetColId),
    });
  };

  if (isSingleValueToRange) {
    const sourceEntry = rows[0][0];
    const targetRows = visibleRowOrder.slice(minRow, maxRow + 1);
    const targetCols = columnOrder.slice(minCol, maxCol + 1);
    for (const rowId of targetRows) {
      for (const targetColId of targetCols) {
        checkCellPair(rowId, targetColId, sourceEntry);
      }
    }
    return mismatches;
  }

  const targetColIds = columnOrder
    .slice(minCol)
    .filter((colId) => activeConfigs[colId]?.type !== "lookup");
  const targetRows = visibleRowOrder.slice(minRow, minRow + rows.length);

  targetRows.forEach((rowId, rOffset) => {
    const sourceRow = rows[rOffset];
    if (!sourceRow) return;
    const colCount = Math.min(sourceRow.length, targetColIds.length);
    for (let cOffset = 0; cOffset < colCount; cOffset++) {
      checkCellPair(rowId, targetColIds[cOffset], sourceRow[cOffset]);
    }
  });

  return mismatches;
};

export const requestInternalPasteAtom = atom(null, (get, set) => {
  const clipboard = get(internalClipboardAtom);
  const selection = get(selectionAtom);
  const activeSheetId = get(activeSheetIdAtom);
  if (!clipboard || !selection || !activeSheetId) return;

  const visibleRowOrder = get(visibleRowOrderAtom);
  const columnOrder = get(columnOrderAtom);
  const activeConfigs = get(activeColumnConfigsAtom);
  const columnNames = get(columnNamesAtom);
  const rowStatuses = get(rowStatusesAtom);
  const templates = get(sheetTemplatesAtom);

  const bounds = normalizeSelectionBounds(selection);

  const mismatches = collectPasteMismatches({
    sourceSheetId: clipboard.sourceSheetId,
    activeSheetId,
    rows: clipboard.rows,
    bounds,
    visibleRowOrder,
    columnOrder,
    activeConfigs,
    columnNames,
    rowStatuses,
  });

  if (mismatches.length > 0) {
    set(pendingPasteConfirmationAtom, {
      rowsData: clipboard.rows,
      mismatches,
      isCrossSheet: clipboard.sourceSheetId !== activeSheetId,
      sourceSheetName:
        templates[clipboard.sourceSheetId]?.name ?? clipboard.sourceSheetId,
      targetSheetName: templates[activeSheetId]?.name ?? activeSheetId,
    });
    return;
  }

  applyPasteValues(
    get,
    set,
    clipboard.rows.map((row) => row.map((cell) => cell.value)),
  );
  set(internalClipboardAtom, null);
});

export const confirmPendingPasteAtom = atom(null, (get, set) => {
  const pending = get(pendingPasteConfirmationAtom);
  if (!pending) return;

  applyPasteValues(
    get,
    set,
    pending.rowsData.map((row) => row.map((cell) => cell.value)),
  );
  set(pendingPasteConfirmationAtom, null);
  set(internalClipboardAtom, null);
});

export const cancelPendingPasteAtom = atom(null, (_get, set) => {
  set(pendingPasteConfirmationAtom, null);
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

    const activeConfigs = get(activeColumnConfigsAtom);
    if (isColumnReadOnly(activeConfigs[targetColId])) {
      return;
    }

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
        readOnly: true,
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
    set(internalClipboardAtom, null);
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
    set(internalClipboardAtom, null);
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
    set(internalClipboardAtom, null);
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

  const { minRow, maxRow, minCol, maxCol } =
    normalizeSelectionBounds(selection);

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
      if (isColumnReadOnly(colConfig)) {
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
