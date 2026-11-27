import { useAtomValue, useSetAtom } from "jotai";
import { type ComponentProps, useCallback } from "react";
import {
  cancelPendingPasteAtom,
  confirmPendingPasteAtom,
  pendingPasteConfirmationAtom,
} from "../stores";
import type { PasteConfirmModalPresenter } from "./PasteConfirmModal.presenter";

export type UsePasteConfirmModalParams = {
  onAfterClose?: () => void;
};

export const usePasteConfirmModal = ({
  onAfterClose,
}: UsePasteConfirmModalParams = {}): ComponentProps<
  typeof PasteConfirmModalPresenter
> => {
  const pending = useAtomValue(pendingPasteConfirmationAtom);
  const confirmPendingPaste = useSetAtom(confirmPendingPasteAtom);
  const cancelPendingPaste = useSetAtom(cancelPendingPasteAtom);

  const handleConfirm = useCallback(() => {
    confirmPendingPaste();
  }, [confirmPendingPaste]);

  const handleCancel = useCallback(() => {
    cancelPendingPaste();
  }, [cancelPendingPaste]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        cancelPendingPaste();
      }
    },
    [cancelPendingPaste],
  );

  return {
    open: pending !== null,
    onOpenChange: handleOpenChange,
    mismatches: pending?.mismatches ?? [],
    isCrossSheet: pending?.isCrossSheet ?? false,
    sourceSheetName: pending?.sourceSheetName ?? "",
    targetSheetName: pending?.targetSheetName ?? "",
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    onAfterClose,
  };
};
