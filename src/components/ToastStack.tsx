import React from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  message: string;
  variant: "success" | "error";
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`vv-on-dark animate-fade-in pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-sans font-medium ${
            toast.variant === "success" ? "vv-toast-success text-white" : "vv-toast-error text-white"
          }`}
        >
          {toast.variant === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
