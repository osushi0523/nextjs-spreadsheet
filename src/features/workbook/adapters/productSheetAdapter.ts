import { ColumnIdSchema, RowIdSchema, type SheetData } from "../stores";

export type ProductRow = {
  id: string;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  description?: string;
  updatedAt: string;
  version: number;
};

export const PRODUCT_COLUMNS = {
  productCode: ColumnIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
  productName: ColumnIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
  unitPrice: ColumnIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"),
  quantity: ColumnIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4"),
  description: ColumnIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5"),
};

export function toProductSheet(rows: ProductRow[]): SheetData {
  const cols = Object.values(PRODUCT_COLUMNS);
  const values: Record<string, string> = {};
  const rowIds = rows.map((row) => RowIdSchema.parse(row.id));

  rows.forEach((row) => {
    values[`${row.id}-${PRODUCT_COLUMNS.productCode}`] = row.productCode;
    values[`${row.id}-${PRODUCT_COLUMNS.productName}`] = row.productName;
    values[`${row.id}-${PRODUCT_COLUMNS.unitPrice}`] = String(row.unitPrice);
    values[`${row.id}-${PRODUCT_COLUMNS.quantity}`] = String(row.quantity);
    values[`${row.id}-${PRODUCT_COLUMNS.description}`] = row.description ?? "";
  });

  return {
    id: "sheet-2",
    name: "商品マスター",
    rows: rowIds,
    cols,
    colNames: {
      [PRODUCT_COLUMNS.productCode]: "商品コード",
      [PRODUCT_COLUMNS.productName]: "商品名",
      [PRODUCT_COLUMNS.unitPrice]: "単価",
      [PRODUCT_COLUMNS.quantity]: "数量",
      [PRODUCT_COLUMNS.description]: "説明",
    },
    values,
  };
}
