import type { ColumnId, RowId, RowStatus } from "../stores/types";
import {
  PRODUCT_COLUMNS,
  type ProductRow,
} from "../adapters/productSheetAdapter";
import {
  RowIdSchema,
  type ColumnId,
  type RowId,
  type RowStatus,
} from "../stores";

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
  metadata?: {
    rowVersions?: Record<RowId, number>;
  };
};

export type SaveSheetResult = {
  success: boolean;
  rowVersions?: Record<RowId, number>;
};

// export const saveSheetApi = async (
//   payload: SaveSheetPayload,
// ): Promise<{ success: boolean }> => {
//   console.log("[SaveSheetAPI] Request payload:", payload);
//   // 擬似的なネットワーク遅延
//   await new Promise((resolve) => setTimeout(resolve, 600));
//   console.log("[SaveSheetAPI] Sheet data saved successfully!");
//   return { success: true };
// };

export const saveSheetApi = async (
  payload: SaveSheetPayload,
): Promise<SaveSheetResult> => {
  if (payload.sheetId !== "product-master") {
    throw new Error("このシートは保存対象ではありません");
  }

  const rowVersions = payload.metadata?.rowVersions ?? {};

  const getValue = (rowId: RowId, columnId: ColumnId): string => {
    return payload.snapshot.values[`${rowId}-${columnId}`] ?? "";
  };

  const currentProductValues = (rowId: RowId) => ({
    productCode: getValue(rowId, PRODUCT_COLUMNS.productCode),
    productName: getValue(rowId, PRODUCT_COLUMNS.productName),
    unitPrice: Number(getValue(rowId, PRODUCT_COLUMNS.unitPrice)),
    quantity: Number(getValue(rowId, PRODUCT_COLUMNS.quantity)),
    description: getValue(rowId, PRODUCT_COLUMNS.description),
  });

  const addedRowIds = payload.snapshot.rows.filter(
    (rowId) => payload.diff.rowStatuses[rowId] === "added",
  );

  const editedRowIds = payload.snapshot.rows.filter(
    (rowId) => payload.diff.rowStatuses[rowId] === "edited",
  );

  const deletedRowIds = Object.entries(payload.diff.rowStatuses)
    .filter(
      ([rowId, status]) =>
        status === "deleted" && rowVersions[rowId as RowId] !== undefined,
    )
    .map(([rowId]) => RowIdSchema.parse(rowId));

  const creates = addedRowIds.map((rowId) => ({
    id: rowId,
    ...currentProductValues(rowId),
  }));

  const updates = editedRowIds.map((rowId) => {
    const version = rowVersions[rowId];

    if (version === undefined) {
      throw new Error(`versionが取得できません: ${rowId}`);
    }

    return {
      id: rowId,
      ...currentProductValues(rowId),
      version,
    };
  });

  const deletes = deletedRowIds.map((rowId) => {
    const version = rowVersions[rowId];

    if (version === undefined) {
      throw new Error(`versionが取得できません: ${rowId}`);
    }

    return {
      id: rowId,
      version,
    };
  });

  const response = await fetch("/api/backend/api/spreadsheet/rows/batch", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      creates,
      updates,
      deletes,
    }),
  });

  if (response.status === 409) {
    throw new Error(
      "他のユーザーによって更新されています。再取得してください。",
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`保存に失敗しました: ${response.status} ${text}`);
  }

  // 最新versionを取得
  const reloadResponse = await fetch("/api/backend/api/spreadsheet/rows", {
    cache: "no-store",
  });

  if (!reloadResponse.ok) {
    throw new Error("保存後の再取得に失敗しました");
  }

  const latestRows: ProductRow[] = await reloadResponse.json();

  const latestVersions = Object.fromEntries(
    latestRows.map((row) => [RowIdSchema.parse(row.id), row.version]),
  ) as Record<RowId, number>;

  return {
    success: true,
    rowVersions: latestVersions,
  };
};
