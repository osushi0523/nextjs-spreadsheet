import { useAtomValue } from "jotai";
import { useMemo } from "react";
import {
  activeCellAtom,
  activeSheetIdAtom,
  displayRowOrderAtom,
  rowOrderAtom,
  rowStatusesAtom,
  selectionAtom,
} from "../stores";
import type { StatusBarPresenterProps } from "./StatusBar.presenter";

export const useStatusBar = (): StatusBarPresenterProps | null => {
  const activeSheetId = useAtomValue(activeSheetIdAtom);
  const rowOrder = useAtomValue(rowOrderAtom);
  const displayRowOrder = useAtomValue(displayRowOrderAtom);
  const rowStatuses = useAtomValue(rowStatusesAtom);
  const selection = useAtomValue(selectionAtom);
  const activeCell = useAtomValue(activeCellAtom);

  const statusCounts = useMemo(() => {
    const counts = { added: 0, edited: 0, deleted: 0 };
    for (const id of rowOrder) {
      const status = rowStatuses[id];
      if (status && status !== "none") {
        counts[status]++;
      }
    }
    return counts;
  }, [rowOrder, rowStatuses]);

  const currentRow = useMemo(() => {
    const index = activeCell?.row ?? selection?.end.row;
    return index !== undefined && index >= 0 && index < displayRowOrder.length
      ? index + 1
      : null;
  }, [activeCell, selection, displayRowOrder.length]);

  if (!activeSheetId) {
    return null;
  }

  return {
    addedCount: statusCounts.added,
    editedCount: statusCounts.edited,
    deletedCount: statusCounts.deleted,
    currentRow,
    totalRows: rowOrder.length,
    visibleRows: displayRowOrder.length,
  };
};
