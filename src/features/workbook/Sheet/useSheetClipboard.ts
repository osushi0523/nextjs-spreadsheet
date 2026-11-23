import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import {
  activeSheetModeAtom,
  pasteCellsAtom,
  workbookStatusAtom,
} from "../stores";

/**
 * Excel 等からコピーされた TSV テキストを 2 次元配列へパースする。
 * クォートされたセル内の改行・タブやエスケープされたクォート（""）にも対応し、
 * 末尾の改行コード 1 つだけを除去して途中の空行は保持する。
 */
const ROW_PATTERN = /(?:^|\r?\n)((?:[^\r\n"]|"(?:[^"]|"")*")*)/g;
const CELL_PATTERN = /(?:^|\t)(?:"((?:[^"]|"")*)"|([^\t]*))/g;

const parseClipboardTsv = (text: string): string[][] => {
  const normalized = text.replace(/\r?\n$/, "");
  if (!normalized.includes('"')) {
    return normalized.split(/\r?\n/).map((row) => row.split("\t"));
  }

  return Array.from(normalized.matchAll(ROW_PATTERN), ([, row]) =>
    Array.from(row.matchAll(CELL_PATTERN), ([, quoted, plain]) =>
      quoted !== undefined ? quoted.replaceAll('""', '"') : (plain ?? ""),
    ),
  );
};

export const useSheetClipboard = () => {
  const sheetMode = useAtomValue(activeSheetModeAtom);
  const pasteCells = useSetAtom(pasteCellsAtom);
  const setStatus = useSetAtom(workbookStatusAtom);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (sheetMode === "inquiry") return;

      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);

      if (isInput) return;

      const text = event.clipboardData?.getData("text/plain");
      if (!text) return;

      const rowsData = parseClipboardTsv(text);
      if (rowsData.length > 0) {
        event.preventDefault();
        pasteCells(rowsData);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [pasteCells, sheetMode]);

  useEffect(() => {
    const handleMouseUp = () => {
      setStatus((prev) => (prev === "selecting" ? "idle" : prev));
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setStatus]);
};
