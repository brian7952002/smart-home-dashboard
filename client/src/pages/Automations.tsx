import { useEffect, useId, useState, type FormEvent } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { toast } from "sonner";
import { LIMITS, type AutomationIcon } from "@shared/constants";
import type { Automation } from "@shared/types";
import { createAutomationSchema } from "@shared/validation";
import { ConfirmDialog, Dialog } from "@/components/Dialog";
import { IconPicker } from "@/components/IconPicker";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button, Card, CardHeader, Field, IconButton, Switch, TextInput } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { AUTOMATION_ICON_META, automationIcon } from "@/lib/deviceMeta";
import { useAutomations, useCreateAutomation, useDeleteAutomation, useToggleAutomation } from "@/lib/queries";

const IDEAS = [
  { title: "Porch light at sunset", body: "Turn the porch light on when the sun sets." },
  { title: "Away mode", body: "When everyone leaves, turn off lights and set the thermostat to eco." },
  { title: "Leak alert", body: "If a water sensor detects a leak, send a notification." },
];

export default function Automations() {
  const automations = useAutomations();
  const toggle = useToggleAutomation();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Automation | null>(null);

  return (
    <>
      <PageHeader
        title="Automations"
        actions={
          <IconButton label="Create automation" onClick={() => setCreateOpen(true)}>
            <Plus className="size-6" aria-hidden />
          </IconButton>
        }
      />
      <Card aria-labelledby="configured-title">
        <CardHeader id="configured-title" title="Configured automations" sub="Demo records. Turning one on or off saves the setting; nothing runs." />
        {automations.isPending ? (
          <LoadingRows rows={2} label="Loading automations" />
        ) : automations.isError ? (
          <ErrorState error={automations.error} onRetry={() => automations.refetch()} />
        ) : automations.data.length === 0 ? (
          <EmptyState title="No automations yet" action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create Automation</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {automations.data.map((a) => {
              const Icon = automationIcon(a.icon);
              const pending = toggle.isPending && toggle.variables?.id === a.id;
              return (
                <li key={a.id} className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{a.name}</span>
                      <span className="block truncate text-[13px] text-ink-2">{a.description}</span>
                      <span className="block text-xs text-ink-2">Demo record: doesn't run</span>
                    </span>
                  </button>
                  <Switch
                    checked={pending ? toggle.variables!.isActive : a.isActive}
                    pending={pending}
                    label={`Enabled: ${a.name}`}
                    onCheckedChange={(v) =>
                      toggle.mutate({ id: a.id, isActive: v }, { onError: (err) => toast.error(`${a.name}: ${errorMessage(err)}`) })
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section aria-labelledby="ideas-title" className="mt-4 rounded-xl border border-dashed border-[#c7c7cc] bg-transparent p-4">
        <h2 id="ideas-title" className="flex items-center gap-2 text-base font-semibold">
          <Lightbulb className="size-4 text-type-light" aria-hidden />
          Example automations (not configured)
        </h2>
        <p className="mb-2 text-xs text-ink-2">Ideas for what an automation could do. These aren't saved records.</p>
        <ul className="space-y-2 text-sm">
          {IDEAS.map((i) => (
            <li key={i.title}>
              <span className="font-semibold">{i.title}.</span> {i.body}
            </li>
          ))}
        </ul>
      </section>

      <CreateAutomationDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AutomationSheet automation={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function AutomationSheet({ automation, onClose }: { automation: Automation | null; onClose: () => void }) {
  const del = useDeleteAutomation();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Dialog open={!!automation && !confirm} onOpenChange={(o) => !o && onClose()} title={automation?.name ?? "Automation"} variant="sheet">
        {automation ? (
          <div className="space-y-3 text-sm">
            <p>{automation.description}</p>
            <p className="text-ink-2">
              {automation.isActive ? "Enabled" : "Disabled"}. This is a demo record: there are no triggers or actions, so it never runs.
            </p>
            <Button variant="secondary" className="w-full text-[#d70015]" onClick={() => setConfirm(true)}>
              Delete automation
            </Button>
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${automation?.name ?? "automation"}?`}
        body="This can't be undone."
        confirmLabel="Delete"
        pending={del.isPending}
        onConfirm={() =>
          automation &&
          del.mutate(automation.id, {
            onSuccess: () => {
              toast.success(`${automation.name} deleted`);
              setConfirm(false);
              onClose();
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </>
  );
}

function CreateAutomationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const id = useId();
  const create = useCreateAutomation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<AutomationIcon | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setIcon("");
      setErrors({});
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createAutomationSchema.safeParse({ name, description, icon: icon || undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (a) => {
        toast.success(`${a.name} created`);
        onOpenChange(false);
      },
      onError: (err) => setErrors(err instanceof ApiError && err.fieldErrors ? err.fieldErrors : { _: errorMessage(err) }),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      title="Create Automation"
      description="Saved as a demo record. Triggers and actions aren't supported, so it won't run."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} pending={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate className="space-y-4">
        {errors._ ? (
          <p role="alert" className="rounded-lg bg-error/10 p-2 text-sm text-[#d70015]">
            {errors._}
          </p>
        ) : null}
        <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
          <TextInput
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.automationName}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
        </Field>
        <Field
          label="Description"
          htmlFor={`${id}-desc`}
          error={errors.description}
          hint="Describe when it should happen, e.g. “Every weekday at 7 AM”."
        >
          <TextInput
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.automationDescription}
            autoComplete="off"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? `${id}-desc-error` : `${id}-desc-hint`}
          />
        </Field>
        <IconPicker name={`${id}-icon`} value={icon} onChange={setIcon} options={AUTOMATION_ICON_META} error={errors.icon} />
      </form>
    </Dialog>
  );
}
