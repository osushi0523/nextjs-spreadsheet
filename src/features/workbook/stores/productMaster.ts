import type { SheetTemplate } from "./types";

export const productMasterTemplate: SheetTemplate = {
  id: "product-master",
  name: "商品マスター",
  category: "master",
  description: "商品情報を管理するマスタシート",
  defaultRowCount: 0,
  columns: [
    {
      field: "productCode",
      headerName: "商品コード",
      type: { type: "text" },
      width: 160,
      align: "left",
    },
    {
      field: "productName",
      headerName: "商品名",
      type: { type: "text" },
      width: 240,
      align: "left",
    },
    {
      field: "unitPrice",
      headerName: "単価",
      type: { type: "text" },
      width: 120,
      align: "right",
    },
    {
      field: "quantity",
      headerName: "数量",
      type: { type: "text" },
      width: 120,
      align: "right",
    },
    {
      field: "description",
      headerName: "説明",
      type: { type: "text" },
      width: 300,
      align: "left",
    },
  ],
};