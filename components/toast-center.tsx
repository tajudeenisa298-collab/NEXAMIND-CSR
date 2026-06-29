"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = {
  id: string;
  title: string;
  tone: "success" | "info";
};

export function ToastCenter() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent<Partial<Toast>>).detail || {};
      const toast = {
        id: detail.id || crypto.randomUUID(),
        title: detail.title || "Done",
        tone: detail.tone || "success"
      } satisfies Toast;

      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 3800);
    }

    window.addEventListener("nexamind:toast", handleToast);
    return () => window.removeEventListener("nexamind:toast", handleToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-center" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone}`} key={toast.id}>
          {toast.tone === "success" ? <CheckCircle2 size={16} /> : <Info size={16} />}
          <span>{toast.title}</span>
          <button aria-label="Dismiss" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} type="button">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
