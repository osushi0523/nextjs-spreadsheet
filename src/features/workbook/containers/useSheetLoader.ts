import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { fetchMockSheetRecords } from "../mock";
import {
  activeSheetIdAtom,
  baseCellValuesAtom,
  baseColumnNamesAtom,
  baseColumnOrderAtom,
  baseRowOrderAtom,
  type ColumnConfig,
  type ColumnId,
  closeSheetAtom,
  columnConfigsAtom,
  columnTotalsAtom,
  createColumnId,
  createRowId,
  DEFAULT_SHEET_TEMPLATES,
  INITIAL_OPEN_SHEET_IDS,
  openSheetAtom,
  openSheetIdsAtom,
  openSheetsAtom,
  referencedSheetsDataAtom,
  type SheetData,
  sheetDataMapAtom,
  sheetFieldToColIdMapAtom,
  sheetsByCategoryAtom,
} from "../stores";

/**
 * 雛形（Template）と生データ（Raw Records）からスプレッドシート用データを生成する純粋ヘルパー関数
 */
export const buildSheetData = (
  sheetId: string,
  getFieldToColMap: (
    templateId: string,
  ) => Record<string, ColumnId> | undefined,
): {
  data: SheetData;
  fieldToColId: Record<string, ColumnId>;
  configs: Record<ColumnId, ColumnConfig>;
  totals: Record<ColumnId, boolean>;
} | null => {
  const template = DEFAULT_SHEET_TEMPLATES[sheetId];
  if (!template) return null;

  const columns = template.columns;
  const rawRecords = fetchMockSheetRecords(
    sheetId,
    template.defaultRowCount ?? 100,
  );

  const rows = Array.from({ length: rawRecords.length }, () => createRowId());
  const cols = Array.from({ length: columns.length }, () => createColumnId());
  const colNames: Record<ColumnId, string> = {};
  const fieldToColId: Record<string, ColumnId> = {};
  const configs: Record<ColumnId, ColumnConfig> = {};
  const totals: Record<ColumnId, boolean> = {};
  const initialValues: Record<string, string> = {};

  // 1. 列情報の初期化
  for (let c = 0; c < columns.length; c++) {
    const colDef = columns[c];
    const colId = cols[c];
    if (!colDef || !colId) continue;

    colNames[colId] = colDef.headerName;
    fieldToColId[colDef.field] = colId;

    if (colDef.hasTotal) {
      totals[colId] = true;
    }
    if (colDef.readOnly && colDef.type.type !== "lookup") {
      configs[colId] = { type: "default", readOnly: true };
    }
  }

  // 2. セル値のマッピング
  for (let r = 0; r < rows.length; r++) {
    const record = rawRecords[r] ?? {};
    const rowId = rows[r];
    if (!rowId) continue;

    for (let c = 0; c < columns.length; c++) {
      const colDef = columns[c];
      const colId = cols[c];
      if (!colDef || !colId) continue;

      initialValues[`${rowId}-${colId}`] = record[colDef.field] ?? "";
    }
  }

  // 3. プルダウンおよび参照列（Lookup）の自動バインド解決
  for (const colDef of columns) {
    const colId = fieldToColId[colDef.field];
    if (!colId) continue;

    if (colDef.type.type === "pulldown") {
      const { sourceTemplateId, sourceKeyField, lookupFields, mode } =
        colDef.type;
      const sourceColMap = getFieldToColMap(sourceTemplateId) ?? {};
      const sourceKeyColId = sourceColMap[sourceKeyField];

      if (sourceKeyColId) {
        const resolvedLookups = lookupFields
          .map((lf) => ({
            lookupColId: fieldToColId[lf.field],
            sourceColId: sourceColMap[lf.sourceField],
            sourceColName: lf.headerName,
          }))
          .filter(
            (
              l,
            ): l is {
              lookupColId: ColumnId;
              sourceColId: ColumnId;
              sourceColName: string;
            } => Boolean(l.lookupColId && l.sourceColId),
          );

        configs[colId] = {
          type: "pulldown",
          readOnly: colDef.readOnly,
          pulldown: {
            sourceSheetId: sourceTemplateId,
            sourceKeyColId,
            lookupColumns: resolvedLookups,
            mode,
          },
        };
      }
    } else if (colDef.type.type === "lookup") {
      const { parentField, sourceTemplateId, sourceField } = colDef.type;
      const sourceColMap = getFieldToColMap(sourceTemplateId) ?? {};
      const parentColId = fieldToColId[parentField];
      const sourceColId = sourceColMap[sourceField];

      if (parentColId && sourceColId) {
        configs[colId] = {
          type: "lookup",
          readOnly: true,
          lookup: {
            parentColId,
            sourceSheetId: sourceTemplateId,
            sourceColId,
          },
        };
      }
    }
  }

  return {
    data: {
      id: sheetId,
      name: template.name,
      rows,
      cols,
      colNames,
      values: initialValues,
    },
    fieldToColId,
    configs,
    totals,
  };
};

export const useSheetLoader = () => {
  const [activeSheetId, setActiveSheetId] = useAtom(activeSheetIdAtom);
  const [sheetDataMap, setSheetDataMap] = useAtom(sheetDataMapAtom);
  const [fieldToColMap, setFieldToColMap] = useAtom(sheetFieldToColIdMapAtom);
  const setBaseRowOrder = useSetAtom(baseRowOrderAtom);
  const setBaseColumnOrder = useSetAtom(baseColumnOrderAtom);
  const setBaseColumnNames = useSetAtom(baseColumnNamesAtom);
  const setBaseValues = useSetAtom(baseCellValuesAtom);
  const setColumnConfigs = useSetAtom(columnConfigsAtom);
  const setColumnTotals = useSetAtom(columnTotalsAtom);
  const setReferencedSheets = useSetAtom(referencedSheetsDataAtom);
  const openSheets = useAtomValue(openSheetsAtom);

  const getOrInitSheetData = useCallback(
    (sheetId: string): SheetData | null => {
      // 1. すでに Jotai Atom にデータが存在する場合はそれを返す
      if (sheetDataMap[sheetId]) {
        return sheetDataMap[sheetId];
      }

      // 2. マスタ依存解決用の内部ヘルパー
      const currentFieldMap = { ...fieldToColMap };
      const currentDataMap = { ...sheetDataMap };
      const newConfigs: Record<string, Record<ColumnId, ColumnConfig>> = {};
      const newTotals: Record<string, Record<ColumnId, boolean>> = {};

      const resolveSheet = (targetId: string): SheetData | null => {
        if (currentDataMap[targetId]) {
          return currentDataMap[targetId];
        }

        const template = DEFAULT_SHEET_TEMPLATES[targetId];
        if (!template) return null;

        // 依存先マスタを先に再帰解決
        for (const col of template.columns) {
          if (col.type.type === "pulldown" || col.type.type === "lookup") {
            const depId = col.type.sourceTemplateId;
            if (!currentDataMap[depId]) {
              resolveSheet(depId);
            }
          }
        }

        const built = buildSheetData(targetId, (id) => currentFieldMap[id]);
        if (!built) return null;

        currentDataMap[targetId] = built.data;
        currentFieldMap[targetId] = built.fieldToColId;
        newConfigs[targetId] = built.configs;
        newTotals[targetId] = built.totals;

        return built.data;
      };

      const result = resolveSheet(sheetId);
      if (!result) return null;

      // 3. Jotai Atoms を一括更新（GC管理可能なステートに保存）
      setSheetDataMap((prev) => ({ ...prev, ...currentDataMap }));
      setFieldToColMap((prev) => ({ ...prev, ...currentFieldMap }));
      setColumnConfigs((prev) => ({ ...prev, ...newConfigs }));
      setColumnTotals((prev) => ({ ...prev, ...newTotals }));
      setReferencedSheets((prev) => ({ ...prev, ...currentDataMap }));

      return result;
    },
    [
      sheetDataMap,
      fieldToColMap,
      setSheetDataMap,
      setFieldToColMap,
      setColumnConfigs,
      setColumnTotals,
      setReferencedSheets,
    ],
  );

  const loadSheetData = useCallback(
    (sheetId: string) => {
      const data = getOrInitSheetData(sheetId);
      if (!data) return;

      const { rows, cols, colNames, values } = data;
      setBaseValues(values);
      setBaseRowOrder(rows);
      setBaseColumnOrder(cols);
      setBaseColumnNames(colNames);
      setActiveSheetId(sheetId);
    },
    [
      getOrInitSheetData,
      setBaseValues,
      setBaseRowOrder,
      setBaseColumnOrder,
      setBaseColumnNames,
      setActiveSheetId,
    ],
  );

  useEffect(() => {
    if (!activeSheetId) {
      loadSheetData(INITIAL_OPEN_SHEET_IDS[0]);
    }
  }, [activeSheetId, loadSheetData]);

  const setOpenSheet = useSetAtom(openSheetAtom);
  const setCloseSheet = useSetAtom(closeSheetAtom);
  const openSheetIds = useAtomValue(openSheetIdsAtom);
  const sheetsByCategory = useAtomValue(sheetsByCategoryAtom);

  const handleSelectSheet = useCallback(
    (id: string) => {
      loadSheetData(id);
    },
    [loadSheetData],
  );

  const handleOpenSheet = useCallback(
    (sheetId: string) => {
      setOpenSheet(sheetId);
      loadSheetData(sheetId);
    },
    [setOpenSheet, loadSheetData],
  );

  const handleCloseSheet = useCallback(
    (sheetId: string) => {
      const nextOpenIds = openSheetIds.filter((id) => id !== sheetId);
      if (activeSheetId === sheetId) {
        const nextActiveId = nextOpenIds[0] ?? null;
        if (nextActiveId) {
          loadSheetData(nextActiveId);
        }
      }
      setCloseSheet(sheetId);
    },
    [activeSheetId, openSheetIds, loadSheetData, setCloseSheet],
  );

  const activeSheet = activeSheetId
    ? DEFAULT_SHEET_TEMPLATES[activeSheetId]
    : undefined;

  return {
    activeSheet,
    activeSheetId,
    openSheets,
    openSheetIds,
    sheetsByCategory,
    handleSelectSheet,
    handleOpenSheet,
    handleCloseSheet,
    getOrInitSheetData,
  };
};
