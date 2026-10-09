import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import {
  PRODUCT_COLUMNS,
  toProductSheet,
  type ProductRow,
} from "../adapters/productSheetAdapter";
import {
  activeSheetIdAtom,
  baseCellValuesAtom,
  baseRowOrderAtom,
  cellEditsAtom,
  modifiedRowOrdersAtom,
  rowOrderAtom,
  rowStatusesAtom,
  rowVersionsAtom,
  type ColumnId,
  type RowId,
  RowIdSchema,
} from "../stores";

export function useProductSheetSave() {
  const [isSaving, setIsSaving] = useState(false);

  const activeSheetId = useAtomValue(activeSheetIdAtom);
  const baseValues = useAtomValue(baseCellValuesAtom);
  const cellEdits = useAtomValue(cellEditsAtom);
  const rowOrder = useAtomValue(rowOrderAtom);
  const rowStatuses = useAtomValue(rowStatusesAtom);
  const rowVersions = useAtomValue(rowVersionsAtom);
  const setModifiedRowOrders = useSetAtom(modifiedRowOrdersAtom);

  const setBaseValues = useSetAtom(baseCellValuesAtom);
  const setBaseRowOrder = useSetAtom(baseRowOrderAtom);
  const setCellEdits = useSetAtom(cellEditsAtom);
  const setRowStatuses = useSetAtom(rowStatusesAtom);
  const setRowVersions = useSetAtom(rowVersionsAtom);

  const getCurrentValue = (rowId: RowId, columnId: ColumnId): string => {
    const key = `${rowId}-${columnId}`;

    return cellEdits[key] ?? baseValues[key] ?? "";
  };

  const currentProductValues = (rowId: RowId) => {
    return {
      productCode: getCurrentValue(rowId, PRODUCT_COLUMNS.productCode),
      productName: getCurrentValue(rowId, PRODUCT_COLUMNS.productName),
      unitPrice: Number(getCurrentValue(rowId, PRODUCT_COLUMNS.unitPrice)),
      quantity: Number(getCurrentValue(rowId, PRODUCT_COLUMNS.quantity)),
      description: getCurrentValue(rowId, PRODUCT_COLUMNS.description),
    };
  };

  const handleSaveClick = async () => {
    if (activeSheetId !== "product-master") {
      return;
    }

    setIsSaving(true);

    try {
      const addedRowIds = rowOrder.filter(
        (rowId) => rowStatuses[rowId] === "added",
      );

      const editedRowIds = rowOrder.filter(
        (rowId) => rowStatuses[rowId] === "edited",
      );

      const deletedRowIds = Object.entries(rowStatuses)
        .filter(
          ([rowId, status]) =>
            status === "deleted" && rowVersions[rowId as RowId] !== undefined,
        )
        .map(([rowId]) => rowId as RowId);

      if (
        addedRowIds.length === 0 &&
        editedRowIds.length === 0 &&
        deletedRowIds.length === 0
      ) {
        console.log("保存対象の変更はありません");
        return;
      }

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

      const payload = {
        creates,
        updates,
        deletes,
      };

      console.log("Spring Bootへ送信:", payload);

      const response = await fetch("/api/backend/api/spreadsheet/rows/batch", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        console.error(
          "他のユーザーによって更新されています。再取得が必要です。",
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();

        console.error("保存に失敗しました:", response.status, errorText);

        return;
      }

      // -----------------------------
      // 保存成功後、DBから最新状態を再取得
      // -----------------------------

      const reloadResponse = await fetch("/api/backend/api/spreadsheet/rows", {
        cache: "no-store",
      });

      if (!reloadResponse.ok) {
        throw new Error("保存後の再取得に失敗しました");
      }

      const latestRows: ProductRow[] = await reloadResponse.json();

      // 最新version
      const latestVersions = Object.fromEntries(
        latestRows.map((row) => [RowIdSchema.parse(row.id), row.version]),
      );

      setRowVersions(latestVersions);

      // 最新DBデータをbaseへ反映
      const latestSheet = toProductSheet(latestRows);

      setBaseValues(latestSheet.values);
      setBaseRowOrder(latestSheet.rows);

      // 行追加・削除で作られた一時的な行順を破棄
      setModifiedRowOrders((prev) => {
        const next = { ...prev };
        delete next["product-master"];
        return next;
      });

      const savedRowIds = [...addedRowIds, ...editedRowIds, ...deletedRowIds];

      // 保存済みセルの編集差分を削除
      setCellEdits((prev) => {
        const next = { ...prev };

        for (const key of Object.keys(next)) {
          const belongsToSavedRow = savedRowIds.some((rowId) =>
            key.startsWith(`${rowId}-`),
          );

          if (belongsToSavedRow) {
            delete next[key];
          }
        }

        return next;
      });

      // 保存済み行のedited状態を削除
      setRowStatuses((prev) => {
        const next = { ...prev };

        for (const rowId of savedRowIds) {
          delete next[rowId];
        }

        return next;
      });

      console.log("保存成功");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    currentProductValues,
    handleSaveClick,
    isSaving,
  };
}
