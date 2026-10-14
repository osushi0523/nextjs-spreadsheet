import { useCallback, useState } from "react";
import type { ToastMessage, ToastPresenterProps } from "../components/types";

export type UseToastContainerReturn = {
  toastProps: ToastPresenterProps;
  showToast: (message: ToastMessage) => void;
};

export const useToastContainer = (): UseToastContainerReturn => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const onClose = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((message: ToastMessage) => {
    setToast({
      ...message,
      id: message.id ?? `${Date.now()}-${Math.random()}`,
    });
  }, []);

  return {
    toastProps: {
      toast,
      onClose,
    },
    showToast,
  };
};
