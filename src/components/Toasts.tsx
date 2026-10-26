import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useUi } from "../store/ui";
import { cn } from "../lib/format";

export function Toasts() {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismissToast);

  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon =
          toast.tone === "success" ? CircleCheck : toast.tone === "error" ? CircleAlert : Info;
        return (
          <div className={cn("toast", toast.tone)} key={toast.id}>
            <Icon size={17} />
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Закрыть уведомление"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
