import type { SheetTemplate } from "../types";

export const accountingUnitTemplate: SheetTemplate = {
  id: "accounting-unit-master",
  name: "会計単位",
  description: "会計単位（部署・部門）のマスタシート",
  defaultRowCount: 11,
  columns: [
    {
      field: "code",
      headerName: "会計単位コード",
      type: { type: "text" },
      width: 160,
      align: "left",
    },
    {
      field: "name",
      headerName: "会計単位名",
      type: { type: "text" },
      width: 240,
      align: "left",
    },
  ],
};
