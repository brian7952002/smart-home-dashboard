import type { ReactNode } from "react";
import { CircleAlert, SearchX } from "lucide-react";
import { Link } from "wouter";
import { errorMessage } from "@/lib/api";
import { Button, Card, Skeleton } from "./ui";

export function LoadingRows({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center">
      <CircleAlert className="size-8 text-error" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-ink-2">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <p className="text-sm text-ink-2">{children}</p> : null}
      {action}
    </div>
  );
}

export function NotFoundState({ what }: { what: string }) {
  return (
    <Card className="mt-2">
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <SearchX className="size-9 text-ink-2" aria-hidden />
        <h2 className="text-lg font-semibold">{what} not found</h2>
        <p className="text-sm text-ink-2">It may have been deleted, or the link is wrong.</p>
        <Link href="/" className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-white">
          Go to Home
        </Link>
      </div>
    </Card>
  );
}
