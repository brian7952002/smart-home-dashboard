import { useEffect, useId, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { LIMITS, type ScenarioIcon } from "@shared/constants";
import type { Scenario } from "@shared/types";
import { createScenarioSchema } from "@shared/validation";
import { ConfirmDialog, Dialog } from "@/components/Dialog";
import { IconPicker } from "@/components/IconPicker";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge, Button, Card, Field, IconButton, Skeleton, TextInput } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { SCENARIO_ICON_META, scenarioIcon } from "@/lib/deviceMeta";
import { useCreateScenario, useDeleteScenario, useScenarios } from "@/lib/queries";

export default function Scenarios() {
  const scenarios = useScenarios();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Scenario | null>(null);

  return (
    <>
      <PageHeader
        title="Scenarios"
        actions={
          <IconButton label="Create scenario" onClick={() => setCreateOpen(true)}>
            <Plus className="size-6" aria-hidden />
          </IconButton>
        }
      />
      <Card className="mb-4 text-sm">
        <p>
          Scenes group device settings you can trigger with one tap, like dimming the lights for a movie. In this demo,
          scenes are saved as records only and don't control devices.
        </p>
      </Card>

      {scenarios.isPending ? (
        <div className="grid grid-cols-2 gap-3" role="status">
          <span className="sr-only">Loading scenarios…</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : scenarios.isError ? (
        <Card>
          <ErrorState error={scenarios.error} onRetry={() => scenarios.refetch()} />
        </Card>
      ) : scenarios.data.length === 0 ? (
        <Card>
          <EmptyState title="No scenarios yet" action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create Scenario</Button>} />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {scenarios.data.map((s) => {
            const Icon = scenarioIcon(s.icon);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className="flex h-full min-h-28 w-full flex-col items-start gap-2 rounded-xl border border-black/5 bg-white p-3 text-left shadow-sm hover:border-primary/40"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <span className="text-[15px] font-semibold">{s.name}</span>
                  <Badge className="text-[11px] whitespace-nowrap">No actions configured</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CreateScenarioDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ScenarioSheet scenario={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function ScenarioSheet({ scenario, onClose }: { scenario: Scenario | null; onClose: () => void }) {
  const del = useDeleteScenario();
  const [confirm, setConfirm] = useState(false);
  const Icon = scenario ? scenarioIcon(scenario.icon) : null;
  return (
    <>
      <Dialog open={!!scenario && !confirm} onOpenChange={(o) => !o && onClose()} title={scenario?.name ?? "Scenario"} variant="sheet">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {Icon ? (
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
                <Icon className="size-6" />
              </span>
            ) : null}
            <p className="text-sm">No device actions are configured. Scenes can't run in this demo.</p>
          </div>
          <Button variant="secondary" className="w-full text-[#d70015]" onClick={() => setConfirm(true)}>
            Delete scenario
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${scenario?.name ?? "scenario"}?`}
        body="This can't be undone."
        confirmLabel="Delete"
        pending={del.isPending}
        onConfirm={() =>
          scenario &&
          del.mutate(scenario.id, {
            onSuccess: () => {
              toast.success(`${scenario.name} deleted`);
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

function CreateScenarioDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const id = useId();
  const create = useCreateScenario();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<ScenarioIcon | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setIcon("");
      setErrors({});
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createScenarioSchema.safeParse({ name, icon: icon || undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (s) => {
        toast.success(`${s.name} created`);
        onOpenChange(false);
      },
      onError: (err) => setErrors(err instanceof ApiError && err.fieldErrors ? err.fieldErrors : { _: errorMessage(err) }),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      title="Create New Scenario"
      description="Saved as a record. Device actions can't be configured in this demo."
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
            maxLength={LIMITS.scenarioName}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
        </Field>
        <IconPicker name={`${id}-icon`} value={icon} onChange={setIcon} options={SCENARIO_ICON_META} error={errors.icon} />
      </form>
    </Dialog>
  );
}
