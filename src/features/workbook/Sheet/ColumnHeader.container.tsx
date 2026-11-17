import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAtomValue } from "jotai";
import type { FC, ReactNode } from "react";
import {
  activeColumnConfigsAtom,
  activeColumnFiltersAtom,
  activeColumnTotalsAtom,
  activeSheetIdAtom,
  isColumnId,
  sheetTemplatesAtom,
} from "../stores";
import type { ColumnHeaderPresenterProps } from "./ColumnHeader.presenter";
import type { AxisLayout } from "./Sheet.presenter";

type Props = {
  col: AxisLayout;
  resizingId: string | number | bigint | null;
  onMouseDownResizer: (
    id: string | number | bigint,
    width: number,
  ) => (event: React.MouseEvent) => void;
  children: (props: ColumnHeaderPresenterProps) => ReactNode;
};

export const ColumnHeaderContainer: FC<Props> = ({
  col,
  resizingId,
  onMouseDownResizer,
  children,
}) => {
  const configs = useAtomValue(activeColumnConfigsAtom);
  const filters = useAtomValue(activeColumnFiltersAtom);
  const totals = useAtomValue(activeColumnTotalsAtom);
  const activeSheetId = useAtomValue(activeSheetIdAtom);
  const templates = useAtomValue(sheetTemplatesAtom);
  const colId = isColumnId(col.id) ? col.id : null;
  const config = colId ? configs[colId] : undefined;
  const isLookup = config?.type === "lookup";

  const template = activeSheetId ? templates[activeSheetId] : undefined;
  const isFilterable = template?.filters
    ? template.filters.some((f) => f.field === colId)
    : true;

  const isFiltered = Boolean(colId && filters[colId]);
  const hasTotal = Boolean(colId && totals[colId]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(col.id),
    disabled: isLookup,
  });

  const dndStyle = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };

  const isResizing = resizingId === col.id;

  return (
    <>
      {children({
        col,
        colId,
        config,
        isFiltered,
        isFilterable,
        hasTotal,
        setNodeRef: isLookup ? () => {} : setNodeRef,
        dndStyle: isLookup ? {} : dndStyle,
        attributes: isLookup ? undefined : attributes,
        listeners: isLookup ? undefined : listeners,
        isDragging: isLookup ? false : isDragging,
        isResizing,
        onMouseDownResizer: onMouseDownResizer(col.id, col.size),
      })}
    </>
  );
};

ColumnHeaderContainer.displayName = "ColumnHeaderContainer";
