import { z } from "zod";

export const RowIdSchema = z.uuid().brand<"RowId">();
export const ColumnIdSchema = z.uuid().brand<"ColumnId">();

export type RowId = z.infer<typeof RowIdSchema>;
export type ColumnId = z.infer<typeof ColumnIdSchema>;

export const createRowId = () => RowIdSchema.parse(crypto.randomUUID());
export const createColumnId = () => ColumnIdSchema.parse(crypto.randomUUID());

export const isRowId = (id: unknown): id is RowId =>
  RowIdSchema.safeParse(id).success;
export const isColumnId = (id: unknown): id is ColumnId =>
  ColumnIdSchema.safeParse(id).success;

export type CellAddress = {
  rowId: RowId;
  colId: ColumnId;
};

export type Selection = {
  start: { row: number; col: number };
  end: { row: number; col: number };
} | null;

export type WorkbookStatus = "idle" | "selecting" | "editing";
export type RowStatus = "added" | "edited" | "deleted" | "none";
export type InsertPosition = "above" | "below";

export type ViewMode = "editor" | "pdf-preview";

export type PulldownMode = "dropdown" | "combobox";

export type LookupColumnDefinition = {
  lookupColId: ColumnId;
  sourceColId: ColumnId;
  sourceColName?: string;
};

export type PulldownBinding = {
  sourceSheetId: string;
  sourceKeyColId: ColumnId;
  lookupColumns: LookupColumnDefinition[];
  mode: PulldownMode;
};

export type LookupBinding = {
  parentColId: ColumnId;
  sourceSheetId: string;
  sourceColId: ColumnId;
};

export type ColumnConfig =
  | { type: "default"; readOnly?: boolean }
  | { type: "pulldown"; pulldown: PulldownBinding; readOnly?: boolean }
  | { type: "lookup"; lookup: LookupBinding; readOnly?: boolean };

export type ColumnFilter = {
  selectedValues: string[];
};

export type SheetData = {
  id: string;
  name: string;
  rows: RowId[];
  cols: ColumnId[];
  colNames: Record<ColumnId, string>;
  values: Record<string, string>;
};

// --- Sheet & Column Template Types (雛形スキーマ型定義) ---

export type ColumnTemplateType =
  | { type: "text" }
  | { type: "number"; format?: "currency" | "integer" | "decimal" }
  | {
      type: "pulldown";
      mode: "dropdown" | "combobox";
      sourceTemplateId: string;
      sourceKeyField: string;
      lookupFields: {
        field: string;
        headerName: string;
        sourceField: string;
      }[];
    }
  | {
      type: "lookup";
      parentField: string;
      sourceTemplateId: string;
      sourceField: string;
    };

export type ColumnTemplate = {
  field: string;
  headerName: string;
  type: ColumnTemplateType;
  width?: number;
  hasTotal?: boolean;
  readOnly?: boolean;
  align?: "left" | "center" | "right";
};

export type SheetTemplate = {
  id: string;
  name: string;
  description?: string;
  columns: ColumnTemplate[];
  defaultRowCount?: number;
};
