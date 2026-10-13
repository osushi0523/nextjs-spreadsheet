export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id?: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  requiresConfirm?: boolean;
};

export type ToastPresenterProps = {
  toast: ToastMessage | null;
  onClose: () => void;
};
