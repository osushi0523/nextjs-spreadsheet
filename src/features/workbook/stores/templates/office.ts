import type { SheetTemplate } from "../types";

export const officeTemplate: SheetTemplate = {
  id: "office-master",
  name: "事業所",
  description: "全国事業所のマスタシート",
  defaultRowCount: 47,
  columns: [
    {
      field: "code",
      headerName: "事業所コード",
      type: { type: "text" },
      width: 140,
      align: "left",
    },
    {
      field: "name",
      headerName: "事業所名",
      type: { type: "text" },
      width: 220,
      align: "left",
    },
  ],
};
