import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";
import {
  activeSheetModeAtom,
  clearCopyModeAtom,
  copySelectionAtom,
  internalClipboardAtom,
  pasteCellsAtom,
  pendingPasteConfirmationAtom,
  requestInternalPasteAtom,
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

const isEditableElement = (element: Element | null): boolean =>
  element instanceof HTMLElement &&
  (element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable);

const isModalOrDrawerOpen = (): boolean =>
  typeof document !== "undefined" &&
  document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

const normalizeLineEndings = (text: string): string =>
  text.replace(/\r\n/g, "\n").replace(/\n$/, "");

export const useSheetClipboard = () => {
  const store = useStore();
  const sheetMode = useAtomValue(activeSheetModeAtom);
  const copySelection = useSetAtom(copySelectionAtom);
  const clearCopyMode = useSetAtom(clearCopyModeAtom);
  const requestInternalPaste = useSetAtom(requestInternalPasteAtom);
  const pasteCells = useSetAtom(pasteCellsAtom);
  const setStatus = useSetAtom(workbookStatusAtom);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (isModalOrDrawerOpen() || isEditableElement(document.activeElement)) {
        return;
      }

      const tsvText = copySelection();
      if (tsvText === null) return;

      event.preventDefault();
      event.clipboardData?.setData("text/plain", tsvText);
    };

    window.addEventListener("copy", handleCopy);
    return () => {
      window.removeEventListener("copy", handleCopy);
    };
  }, [copySelection]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (
        sheetMode === "inquiry" ||
        isModalOrDrawerOpen() ||
        store.get(pendingPasteConfirmationAtom) !== null
      ) {
        return;
      }
      if (isEditableElement(document.activeElement)) return;

      const text = event.clipboardData?.getData("text/plain") ?? "";
      const internalClipboard = store.get(internalClipboardAtom);

      if (internalClipboard) {
        const isSameAsInternalCopy =
          normalizeLineEndings(text) ===
          normalizeLineEndings(internalClipboard.tsvText);

        if (isSameAsInternalCopy) {
          event.preventDefault();
          requestInternalPaste();
          return;
        }
        clearCopyMode();
      }

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
  }, [sheetMode, store, requestInternalPaste, clearCopyMode, pasteCells]);

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
