import type { SheetTemplate } from "../types";

export const costDepartmentTemplate: SheetTemplate = {
  id: "cost-department-master",
  name: "原価部門マスタ",
  description: "原価部門および製造課のマスタシート",
  defaultRowCount: 11,
  columns: [
    {
      field: "code",
      headerName: "原価部門コード",
      type: { type: "text" },
      width: 150,
      align: "left",
    },
    {
      field: "name",
      headerName: "原価部門名",
      type: { type: "text" },
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
