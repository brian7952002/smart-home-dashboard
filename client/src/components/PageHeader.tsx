import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { canGoBack, confirmLeave } from "@/lib/navigation";

export function PageHeader({ title, back, actions, badge }: { title: string; back?: string; actions?: ReactNode; badge?: ReactNode }) {
  const [, navigate] = useLocation();
  return (
    <header className="mb-3 flex min-h-11 items-center gap-1">
      {back ? (
        <button
          type="button"
          onClick={() => {
            if (!confirmLeave()) return;
            if (canGoBack()) window.history.back();
            else navigate(back);
          }}
          className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-2 text-[15px] text-primary hover:bg-primary/10"
        >
          <ChevronLeft className="size-6" aria-hidden />
          Back
        </button>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
      {badge}
      {actions ? <div className="flex items-center">{actions}</div> : null}
    </header>
  );
}
