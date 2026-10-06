import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  initWorkbookMetadataAtom,
  openSheetIdsAtom,
  type SheetCategory,
  type SheetTemplate,
  sheetCategoriesAtom,
  sheetTemplatesAtom,
} from "../stores";

export const MOCK_SHEET_CATEGORIES: SheetCategory[] = [
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

export const productionVolumeTemplate: SheetTemplate = {
  id: "production-volume",
  name: "生産量登録",
  category: "planning",
  description: "生産量および上がり数量の実績・計画登録シート",
  defaultRowCount: 10000,
  columns: [
    {
      field: "type",
      headerName: "タイプ",
      type: { type: "text" },
      validations: [{ type: "required" }, { type: "string" }],
      width: 120,
      align: "left",
    },
    {
      field: "category",
      headerName: "データ種別",
      type: { type: "text" },
      validations: [{ type: "required" }],
      width: 140,
      align: "left",
    },
    {
      field: "year",
      headerName: "年度",
      type: { type: "text" },
      validations: [
        { type: "required" },
        { type: "numeric" },
        { type: "minLength", length: 4 },
        { type: "maxLength", length: 4 },
      ],
      width: 100,
      align: "center",
    },
    {
      field: "accounting_unit_code",
      headerName: "会計単位",
      type: {
        type: "pulldown",
        mode: "combobox",
        sourceTemplateId: "accounting-unit-master",
        sourceKeyField: "code",
        lookupFields: [
          {
            field: "accounting_unit_name",
            headerName: "会計単位名",
            sourceField: "name",
          },
        ],
      },
      validations: [{ type: "required" }, { type: "reference" }],
      width: 130,
      align: "left",
    },
    {
      field: "accounting_unit_name",
      headerName: "会計単位名",
      type: {
        type: "lookup",
        parentField: "accounting_unit_code",
        sourceTemplateId: "accounting-unit-master",
        sourceField: "name",
      },
      width: 180,
      readOnly: true,
      align: "left",
    },
    {
      field: "office_code",
      headerName: "事業所",
      type: {
        type: "pulldown",
        mode: "combobox",
        sourceTemplateId: "office-master",
        sourceKeyField: "code",
        lookupFields: [
          {
            field: "office_name",
            headerName: "事業所名",
            sourceField: "name",
          },
        ],
      },
      validations: [{ type: "required" }, { type: "reference" }],
      width: 120,
      align: "left",
    },
    {
      field: "office_name",
      headerName: "事業所名",
      type: {
        type: "lookup",
        parentField: "office_code",
        sourceTemplateId: "office-master",
        sourceField: "name",
      },
      width: 160,
      readOnly: true,
      align: "left",
    },
    {
      field: "cost_dept_code",
      headerName: "原価部門",
      type: {
        type: "pulldown",
        mode: "combobox",
        sourceTemplateId: "cost-department-master",
        sourceKeyField: "code",
        lookupFields: [
          {
            field: "cost_dept_name",
            headerName: "原価部門名",
            sourceField: "name",
          },
        ],
      },
      validations: [{ type: "required" }, { type: "reference" }],
      width: 130,
      align: "left",
    },
    {
      field: "cost_dept_name",
      headerName: "原価部門名",
      type: {
        type: "lookup",
        parentField: "cost_dept_code",
        sourceTemplateId: "cost-department-master",
        sourceField: "name",
      },
      width: 180,
      readOnly: true,
      align: "left",
    },
    {
      field: "cost_spec",
      headerName: "原価規格",
      type: { type: "text" },
      validations: [
        { type: "alphanumeric" },
        { type: "maxLength", length: 10 },
      ],
      width: 130,
      align: "left",
    },
    {
      field: "production_volume",
      headerName: "生産量",
      type: { type: "number", format: "integer" },
      validations: [{ type: "required" }, { type: "number" }],
      width: 140,
      hasTotal: true,
      align: "right",
    },
    {
      field: "yield_volume",
      headerName: "上がり数量",
      type: { type: "number", format: "integer" },
      validations: [{ type: "number" }],
      width: 140,
      hasTotal: true,
      align: "right",
    },
  ],
};

export const accountingUnitTemplate: SheetTemplate = {
  id: "accounting-unit-master",
  name: "会計単位",
  category: "master",
  description: "会計単位（部署・部門）のマスタシート",
  defaultRowCount: 11,
  columns: [
    {
      field: "code",
      headerName: "会計単位コード",
      type: { type: "text" },
      validations: [{ type: "required" }, { type: "alphanumeric" }],
      width: 160,
      align: "left",
    },
    {
      field: "name",
      headerName: "会計単位名",
      type: { type: "text" },
      validations: [{ type: "required" }],
      width: 240,
      align: "left",
    },
  ],
};

export const officeTemplate: SheetTemplate = {
  id: "office-master",
  name: "事業所",
  category: "master",
  description: "全国事業所のマスタシート",
  defaultRowCount: 47,
  columns: [
    {
      field: "code",
      headerName: "事業所コード",
      type: { type: "text" },
      validations: [{ type: "required" }, { type: "alphanumeric" }],
      width: 140,
      align: "left",
    },
    {
      field: "name",
      headerName: "事業所名",
      type: { type: "text" },
      validations: [{ type: "required" }],
      width: 220,
      align: "left",
    },
  ],
};

export const costDepartmentTemplate: SheetTemplate = {
  id: "cost-department-master",
  name: "原価部門マスタ",
  category: "master",
  description: "原価部門および製造課のマスタシート",
  defaultRowCount: 11,
  columns: [
    {
      field: "code",
      headerName: "原価部門コード",
      type: { type: "text" },
      validations: [{ type: "required" }, { type: "alphanumeric" }],
      width: 150,
      align: "left",
    },
    {
      field: "name",
      headerName: "原価部門名",
      type: { type: "text" },
      validations: [{ type: "required" }],
      width: 220,
      align: "left",
    },
    {
      field: "category",
      headerName: "部門区分",
      type: { type: "text" },
      width: 140,
      align: "left",
    },
  ],
};

export const MOCK_SHEET_TEMPLATES: Record<string, SheetTemplate> = {
  [productionVolumeTemplate.id]: productionVolumeTemplate,
  [accountingUnitTemplate.id]: accountingUnitTemplate,
  [officeTemplate.id]: officeTemplate,
  [costDepartmentTemplate.id]: costDepartmentTemplate,
};

export const MOCK_INITIAL_OPEN_SHEET_IDS: string[] = [];

/**
 * アプリケーション初期化時にワークブックのメタデータ（カテゴリ、全シート雛形カタログ、初期オープンシート）を動的にロードするフック
 */
export const useWorkbookMetadataLoader = () => {
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const initMetadata = useSetAtom(initWorkbookMetadataAtom);
  const categories = useAtomValue(sheetCategoriesAtom);
  const sheetTemplates = useAtomValue(sheetTemplatesAtom);
  const openSheetIds = useAtomValue(openSheetIdsAtom);

  useEffect(() => {
    initMetadata({
      categories: MOCK_SHEET_CATEGORIES,
      templates: MOCK_SHEET_TEMPLATES,
      initialOpenSheetIds: MOCK_INITIAL_OPEN_SHEET_IDS,
    });
    setIsMetadataLoaded(true);
  }, [initMetadata]);

  return {
    isMetadataLoaded,
    categories,
    sheetTemplates,
    openSheetIds,
  };
};
