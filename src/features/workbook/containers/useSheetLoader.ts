import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
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

const MOCK_TYPES = ["TYPE-A", "TYPE-B", "TYPE-C", "TYPE-D", "TYPE-E", "TYPE-F"];

const MOCK_CATEGORIES = [
  "CATEGORY-A",
  "CATEGORY-B",
  "CATEGORY-C",
  "CATEGORY-D",
  "CATEGORY-E",
  "CATEGORY-F",
];

const MOCK_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

const MOCK_ACCOUNTING_UNITS = [
  { code: "1000", name: "経営企画部" },
  { code: "1001", name: "総務部" },
  { code: "1002", name: "人事部" },
  { code: "1003", name: "財務経理部" },
  { code: "1004", name: "営業本部" },
  { code: "1005", name: "マーケティング部" },
  { code: "1006", name: "研究開発部" },
  { code: "1007", name: "生産技術部" },
  { code: "1008", name: "製造本部" },
  { code: "1009", name: "品質管理部" },
  { code: "1010", name: "購買調達部" },
];

const MOCK_OFFICES_MASTER = [
  { code: "01", name: "北海道事業所" },
  { code: "02", name: "青森事業所" },
  { code: "03", name: "岩手事業所" },
  { code: "04", name: "宮城事業所" },
  { code: "05", name: "秋田事業所" },
  { code: "06", name: "山形事業所" },
  { code: "07", name: "福島事業所" },
  { code: "08", name: "茨城事業所" },
  { code: "09", name: "栃木事業所" },
  { code: "10", name: "群馬事業所" },
  { code: "11", name: "埼玉事業所" },
  { code: "12", name: "千葉事業所" },
  { code: "13", name: "東京事業所" },
  { code: "14", name: "神奈川事業所" },
  { code: "15", name: "新潟事業所" },
  { code: "16", name: "富山事業所" },
  { code: "17", name: "石川事業所" },
  { code: "18", name: "福井事業所" },
  { code: "19", name: "山梨事業所" },
  { code: "20", name: "長野事業所" },
  { code: "21", name: "岐阜事業所" },
  { code: "22", name: "静岡事業所" },
  { code: "23", name: "愛知事業所" },
  { code: "24", name: "三重事業所" },
  { code: "25", name: "滋賀事業所" },
  { code: "26", name: "京都事業所" },
  { code: "27", name: "大阪事業所" },
  { code: "28", name: "兵庫事業所" },
  { code: "29", name: "奈良事業所" },
  { code: "30", name: "和歌山事業所" },
  { code: "31", name: "鳥取事業所" },
  { code: "32", name: "島根事業所" },
  { code: "33", name: "岡山事業所" },
  { code: "34", name: "広島事業所" },
  { code: "35", name: "山口事業所" },
  { code: "36", name: "徳島事業所" },
  { code: "37", name: "香川事業所" },
  { code: "38", name: "愛媛事業所" },
  { code: "39", name: "高知事業所" },
  { code: "40", name: "福岡事業所" },
  { code: "41", name: "佐賀事業所" },
  { code: "42", name: "長崎事業所" },
  { code: "43", name: "熊本事業所" },
  { code: "44", name: "大分事業所" },
  { code: "45", name: "宮崎事業所" },
  { code: "46", name: "鹿児島事業所" },
  { code: "47", name: "沖縄事業所" },
];

const MOCK_COST_DEPTS = [
  { code: "3000", name: "統括製造課", category: "管理" },
  { code: "3001", name: "第1製造課", category: "製造" },
  { code: "3002", name: "第2製造課", category: "製造" },
  { code: "3003", name: "第3製造課", category: "製造" },
  { code: "3004", name: "精製加工課", category: "製造" },
  { code: "3005", name: "充填課", category: "製造" },
  { code: "3006", name: "包装課", category: "製造" },
  { code: "3007", name: "品質保証課", category: "補助" },
  { code: "3008", name: "工務課", category: "補助" },
  { code: "3009", name: "生産管理課", category: "補助" },
  { code: "3010", name: "資材課", category: "補助" },
];

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

export const getOrInitSheetData = (sheetId: string): SheetData | null => {
  if (!sheetDataCache[sheetId]) {
    const template = DEFAULT_SHEET_TEMPLATES[sheetId];
    if (!template) return null;

    const rowCount = template.defaultRowCount ?? 100;
    const columns = template.columns;

    const rows = Array.from({ length: rowCount }, () => createRowId());
    const cols = Array.from({ length: columns.length }, () => createColumnId());
    const colNames: Record<ColumnId, string> = {};
    const fieldToColId: Record<string, ColumnId> = {};
    const defaultConfigs: Record<ColumnId, ColumnConfig> = {};
    const defaultTotals: Record<ColumnId, boolean> = {};
    const initialValues: Record<string, string> = {};

    for (let c = 0; c < columns.length; c++) {
      const colDef = columns[c];
      const colId = cols[c];
      colNames[colId] = colDef.headerName;
      fieldToColId[colDef.field] = colId;
      if (colDef.hasTotal) {
        defaultTotals[colId] = true;
      }
    }
    sheetFieldToColIdCache[sheetId] = fieldToColId;

    if (sheetId === "production-volume") {
      for (let r = 0; r < rows.length; r++) {
        const type = MOCK_TYPES[r % MOCK_TYPES.length];
        const category =
          MOCK_CATEGORIES[(r + Math.floor(r / 6)) % MOCK_CATEGORIES.length];
        const year = MOCK_YEARS[(r * 3) % MOCK_YEARS.length];
        const unit = MOCK_ACCOUNTING_UNITS[r % MOCK_ACCOUNTING_UNITS.length];
        const office =
          MOCK_OFFICES_MASTER[
            (r + Math.floor(r / 3)) % MOCK_OFFICES_MASTER.length
          ];
        const costDept =
          MOCK_COST_DEPTS[(r + Math.floor(r / 5)) % MOCK_COST_DEPTS.length];

        // 原価規格
        const digit5 = 1 + ((r * 7) % 9);
        const lowerDigits = (r * 11) % 21;
        const costSpec = `${digit5}00${String(lowerDigits).padStart(2, "0")}`;

        // 生産量: 1,000 ~ 500,000
        const baseVolume = 1000 + ((r * 49900 + (r % 7) * 1111) % 499001);
        const productionVolume = Math.max(
          1000,
          Math.min(500000, Math.round(baseVolume / 100) * 100),
        );

        // 上がり数量
        const yieldRatio = 1.05 + (r % 15) * 0.01 + (r % 3) * 0.03;
        const yieldVolume =
          Math.round((productionVolume * yieldRatio) / 10) * 10;

        const rowFieldValues: Record<string, string> = {
          type,
          category,
          year,
          accounting_unit_code: unit.code,
          accounting_unit_name: "", // Lookup
          office_code: office.code,
          office_name: "", // Lookup
          cost_dept_code: costDept.code,
          cost_dept_name: "", // Lookup
          cost_spec: costSpec,
          production_volume: String(productionVolume),
          yield_volume: String(yieldVolume),
        };

        for (let c = 0; c < columns.length; c++) {
          const colDef = columns[c];
          initialValues[`${rows[r]}-${cols[c]}`] =
            rowFieldValues[colDef.field] ?? "";
        }
      }

      // Pre-initialize master sheets so we can resolve their key and lookup col IDs
      const auData = getOrInitSheetData("accounting-unit-master");
      const officeData = getOrInitSheetData("office-master");
      const cdData = getOrInitSheetData("cost-department-master");

      const auColMap = sheetFieldToColIdCache["accounting-unit-master"] ?? {};
      const officeColMap = sheetFieldToColIdCache["office-master"] ?? {};
      const cdColMap = sheetFieldToColIdCache["cost-department-master"] ?? {};

      // 会計単位 Pulldown & Lookup
      const auCodeCol = fieldToColId.accounting_unit_code;
      const auNameCol = fieldToColId.accounting_unit_name;
      if (auData && auCodeCol && auNameCol && auColMap.code && auColMap.name) {
        defaultConfigs[auCodeCol] = {
          type: "pulldown",
          pulldown: {
            sourceSheetId: "accounting-unit-master",
            sourceKeyColId: auColMap.code,
            lookupColumns: [
              {
                lookupColId: auNameCol,
                sourceColId: auColMap.name,
                sourceColName: "会計単位名",
              },
            ],
            mode: "combobox",
          },
        };
        defaultConfigs[auNameCol] = {
          type: "lookup",
          readOnly: true,
          lookup: {
            parentColId: auCodeCol,
            sourceSheetId: "accounting-unit-master",
            sourceColId: auColMap.name,
          },
        };
      }

      // 事業所 Pulldown & Lookup
      const officeCodeCol = fieldToColId.office_code;
      const officeNameCol = fieldToColId.office_name;
      if (
        officeData &&
        officeCodeCol &&
        officeNameCol &&
        officeColMap.code &&
        officeColMap.name
      ) {
        defaultConfigs[officeCodeCol] = {
          type: "pulldown",
          pulldown: {
            sourceSheetId: "office-master",
            sourceKeyColId: officeColMap.code,
            lookupColumns: [
              {
                lookupColId: officeNameCol,
                sourceColId: officeColMap.name,
                sourceColName: "事業所名",
              },
            ],
            mode: "combobox",
          },
        };
        defaultConfigs[officeNameCol] = {
          type: "lookup",
          readOnly: true,
          lookup: {
            parentColId: officeCodeCol,
            sourceSheetId: "office-master",
            sourceColId: officeColMap.name,
          },
        };
      }

      // 原価部門 Pulldown & Lookup
      const cdCodeCol = fieldToColId.cost_dept_code;
      const cdNameCol = fieldToColId.cost_dept_name;
      if (cdData && cdCodeCol && cdNameCol && cdColMap.code && cdColMap.name) {
        defaultConfigs[cdCodeCol] = {
          type: "pulldown",
          pulldown: {
            sourceSheetId: "cost-department-master",
            sourceKeyColId: cdColMap.code,
            lookupColumns: [
              {
                lookupColId: cdNameCol,
                sourceColId: cdColMap.name,
                sourceColName: "原価部門名",
              },
            ],
            mode: "combobox",
          },
        };
        defaultConfigs[cdNameCol] = {
          type: "lookup",
          readOnly: true,
          lookup: {
            parentColId: cdCodeCol,
            sourceSheetId: "cost-department-master",
            sourceColId: cdColMap.name,
          },
        };
      }
    } else if (sheetId === "accounting-unit-master") {
      for (let r = 0; r < rows.length; r++) {
        const item = MOCK_ACCOUNTING_UNITS[r % MOCK_ACCOUNTING_UNITS.length];
        initialValues[`${rows[r]}-${cols[0]}`] = item.code;
        initialValues[`${rows[r]}-${cols[1]}`] = item.name;
      }
    } else if (sheetId === "office-master") {
      for (let r = 0; r < rows.length; r++) {
        const item = MOCK_OFFICES_MASTER[r % MOCK_OFFICES_MASTER.length];
        initialValues[`${rows[r]}-${cols[0]}`] = item.code;
        initialValues[`${rows[r]}-${cols[1]}`] = item.name;
      }
    } else if (sheetId === "cost-department-master") {
      for (let r = 0; r < rows.length; r++) {
        const item = MOCK_COST_DEPTS[r % MOCK_COST_DEPTS.length];
        initialValues[`${rows[r]}-${cols[0]}`] = item.code;
        initialValues[`${rows[r]}-${cols[1]}`] = item.name;
        initialValues[`${rows[r]}-${cols[2]}`] = item.category;
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

      // Preload all master sheets into referenced sheets atom
      const masterSheetIds = [
        "accounting-unit-master",
        "office-master",
        "cost-department-master",
      ];
      const referenced: Record<string, SheetData> = {
        [sheetId]: data,
      };
      for (const mId of masterSheetIds) {
        const mData = getOrInitSheetData(mId);
        if (mData) {
          referenced[mId] = mData;
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
