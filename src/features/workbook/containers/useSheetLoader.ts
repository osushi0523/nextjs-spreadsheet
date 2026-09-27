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
  columnConfigsAtom,
  columnTotalsAtom,
  createColumnId,
  createRowId,
  DEFAULT_SHEET_TEMPLATES,
  INITIAL_OPEN_SHEET_IDS,
  openSheetsAtom,
  type RowId,
  referencedSheetsDataAtom,
  type SheetData,
} from "../stores";

export const sheetColumnConfigsCache: Record<
  string,
  Record<ColumnId, ColumnConfig>
> = {};

export const sheetColumnTotalsCache: Record<
  string,
  Record<ColumnId, boolean>
> = {};

export const sheetFieldToColIdCache: Record<
  string,
  Record<string, ColumnId>
> = {};

export const sheetDataCache: Record<
  string,
  {
    rows: RowId[];
    cols: ColumnId[];
    colNames: Record<ColumnId, string>;
    values: Record<string, string>;
  }
> = {};

/**
 * 雛形（Template）と生データ（Raw Records）からスプレッドシート用データを自動構築する汎用関数
 */
export const getOrInitSheetData = (sheetId: string): SheetData | null => {
  if (!sheetDataCache[sheetId]) {
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
    const defaultConfigs: Record<ColumnId, ColumnConfig> = {};
    const defaultTotals: Record<ColumnId, boolean> = {};
    const initialValues: Record<string, string> = {};

    // 1. 列情報の初期化
    for (let c = 0; c < columns.length; c++) {
      const colDef = columns[c];
      const colId = cols[c];
      if (!colDef || !colId) continue;

      colNames[colId] = colDef.headerName;
      fieldToColId[colDef.field] = colId;

      if (colDef.hasTotal) {
        defaultTotals[colId] = true;
      }
      if (colDef.readOnly && colDef.type.type !== "lookup") {
        defaultConfigs[colId] = { type: "default", readOnly: true };
      }
    }
    sheetFieldToColIdCache[sheetId] = fieldToColId;

    // 2. セル値のマッピング（生レコード -> cellValues）
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
        const sourceSheetData = getOrInitSheetData(sourceTemplateId);
        const sourceColMap = sheetFieldToColIdCache[sourceTemplateId] ?? {};
        const sourceKeyColId = sourceColMap[sourceKeyField];

        if (sourceSheetData && sourceKeyColId) {
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

          defaultConfigs[colId] = {
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
        const sourceSheetData = getOrInitSheetData(sourceTemplateId);
        const sourceColMap = sheetFieldToColIdCache[sourceTemplateId] ?? {};
        const parentColId = fieldToColId[parentField];
        const sourceColId = sourceColMap[sourceField];

        if (sourceSheetData && parentColId && sourceColId) {
          defaultConfigs[colId] = {
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

    sheetColumnConfigsCache[sheetId] = defaultConfigs;
    sheetColumnTotalsCache[sheetId] = defaultTotals;

    sheetDataCache[sheetId] = {
      rows,
      cols,
      colNames,
      values: initialValues,
    };
  }

  const template = DEFAULT_SHEET_TEMPLATES[sheetId];
  return {
    id: sheetId,
    name: template?.name ?? sheetId,
    ...sheetDataCache[sheetId],
  };
};

export const useSheetLoader = () => {
  const [activeSheetId, setActiveSheetId] = useAtom(activeSheetIdAtom);
  const setBaseRowOrder = useSetAtom(baseRowOrderAtom);
  const setBaseColumnOrder = useSetAtom(baseColumnOrderAtom);
  const setBaseColumnNames = useSetAtom(baseColumnNamesAtom);
  const setBaseValues = useSetAtom(baseCellValuesAtom);
  const setColumnConfigs = useSetAtom(columnConfigsAtom);
  const setColumnTotals = useSetAtom(columnTotalsAtom);
  const setReferencedSheets = useSetAtom(referencedSheetsDataAtom);
  const openSheets = useAtomValue(openSheetsAtom);

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

      // Set default column configs from template cache
      if (sheetColumnConfigsCache[sheetId]) {
        setColumnConfigs((prev) => ({
          ...prev,
          [sheetId]: {
            ...sheetColumnConfigsCache[sheetId],
            ...(prev[sheetId] ?? {}),
          },
        }));
      }

      // Set default column totals from template cache
      if (sheetColumnTotalsCache[sheetId]) {
        setColumnTotals((prev) => ({
          ...prev,
          [sheetId]: {
            ...sheetColumnTotalsCache[sheetId],
            ...(prev[sheetId] ?? {}),
          },
        }));
      }

      // Preload all referenced master sheets
      const template = DEFAULT_SHEET_TEMPLATES[sheetId];
      const referenced: Record<string, SheetData> = {
        [sheetId]: data,
      };

      if (template) {
        for (const col of template.columns) {
          if (col.type.type === "pulldown" || col.type.type === "lookup") {
            const masterId = col.type.sourceTemplateId;
            const masterData = getOrInitSheetData(masterId);
            if (masterData) {
              referenced[masterId] = masterData;
            }
          }
        }
      }

      setReferencedSheets((prev) => ({
        ...prev,
        ...referenced,
      }));
    },
    [
      setBaseValues,
      setBaseRowOrder,
      setBaseColumnOrder,
      setBaseColumnNames,
      setActiveSheetId,
      setColumnConfigs,
      setColumnTotals,
      setReferencedSheets,
    ],
  );

  useEffect(() => {
    if (!activeSheetId) {
      loadSheetData(INITIAL_OPEN_SHEET_IDS[0]);
    }
  }, [activeSheetId, loadSheetData]);

  const handleSelectSheet = useCallback(
    (id: string) => {
      loadSheetData(id);
    },
    [loadSheetData],
  );

  const activeSheet = activeSheetId
    ? DEFAULT_SHEET_TEMPLATES[activeSheetId]
    : undefined;

  return {
    activeSheet,
    activeSheetId,
    openSheets,
    handleSelectSheet,
  };
};
