"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (title: string, opts?: { description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantStyle: Record<ToastVariant, { icon: ReactNode; border: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    border: "border-green-200 bg-green-50",
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    border: "border-red-200 bg-red-50",
  },
  info: {
    icon: <AlertCircle className="h-5 w-5 text-blue-600" />,
    border: "border-blue-200 bg-blue-50",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (title, opts) => {
      const id = Math.random().toString(36).slice(2, 10);
      const item: ToastItem = {
        id,
        title,
        description: opts?.description,
        variant: opts?.variant ?? "success",
      };
      setItems((prev) => [...prev, item]);
      setTimeout(() => remove(id), 3000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => {
          const s = variantStyle[t.variant];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-md ${s.border}`}
            >
              {s.icon}
              <div className="flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 必须在 ToastProvider 内");
  return ctx;
}
