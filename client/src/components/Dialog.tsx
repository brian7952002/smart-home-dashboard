import { createContext, useContext, type ReactNode } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { Button } from "./ui";

/** Dialogs portal into the phone screen so they stay inside the mockup on desktop. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = "center",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "sheet";
}) {
  const container = useContext(PortalContainerContext);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal container={container ?? undefined}>
        <RadixDialog.Overlay className="absolute inset-0 z-40 bg-black/40" />
        <RadixDialog.Content
          className={clsx(
            "absolute z-50 flex max-h-[85%] flex-col bg-white shadow-xl focus:outline-none",
            variant === "center"
              ? "top-1/2 left-1/2 w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl"
              : "inset-x-0 bottom-0 rounded-t-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-2 px-5 pt-5">
            <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mt-2 -mr-2 inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-page"
              >
                <X className="size-5" aria-hidden />
              </button>
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="px-5 pt-1 text-sm text-ink-2">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          <div className="overflow-y-auto px-5 pt-4 pb-5">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  pending,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  destructive?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} pending={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function NoticeDialog({ open, onOpenChange, title, body }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; body: ReactNode }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body}
      footer={<Button onClick={() => onOpenChange(false)}>OK</Button>}
    />
  );
}
