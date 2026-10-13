import type { ColumnId, RowId, RowStatus } from "../stores/types";

export type SaveSheetPayload = {
  sheetId: string;
  sheetName: string;
  updatedAt: string;
  diff: {
    cellEdits: Record<string, string>;
    rowStatuses: Record<RowId, RowStatus>;
  };
  snapshot: {
    rows: RowId[];
    columns: ColumnId[];
    values: Record<string, string>;
  };
};

export const saveSheetApi = async (
  payload: SaveSheetPayload,
): Promise<{ success: boolean }> => {
  console.log("[SaveSheetAPI] Request payload:", payload);
  // 擬似的なネットワーク遅延
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.log("[SaveSheetAPI] Sheet data saved successfully!");
  return { success: true };
};
