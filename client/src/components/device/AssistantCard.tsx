import { Bot, Power, RefreshCw, Sparkles, TriangleAlert, WifiOff } from "lucide-react";
import type { Device } from "@shared/types";
import { errorMessage } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useDiagnosis } from "@/lib/queries";
import { useDeviceActions } from "../devices";
import { Badge, Button, Card, DisabledReason, Spinner, Switch } from "../ui";

export function AssistantCard({ device, onViewSteps }: { device: Device; onViewSteps: () => void }) {
  const actions = useDeviceActions();
  const diagnosis = useDiagnosis();
  const healthy = device.isOnline && !device.hasError;
  const pendingValue = actions.pendingPowerValue(device.id);
  const powerReason = device.hasError
    ? "Unavailable while the device has an error"
    : !device.isOnline
      ? "Unavailable while offline"
      : null;
  const reconnectReason = healthy ? "Already connected" : null;
  // Results describe the error they were fetched for; hide them once the error changes.
  const diag = diagnosis.data && diagnosis.variables === device.id && device.hasError ? diagnosis.data : null;

  return (
    <Card aria-labelledby="assistant-title">
      <div className="mb-3 flex items-center gap-2">
        {device.hasError ? <Sparkles className="size-5 text-primary" aria-hidden /> : <Bot className="size-5 text-primary" aria-hidden />}
        <h2 id="assistant-title" className="text-base font-semibold">
          {device.hasError ? "AI-Powered Troubleshooter" : "Device Assistant"}
        </h2>
      </div>

      {healthy ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-page p-3">
          <p className="text-[15px]">
            Online and <strong>{device.isOn ? "on" : "off"}</strong>.
          </p>
          <Switch
            checked={pendingValue ?? device.isOn}
            onCheckedChange={(v) => actions.setPower(device, v)}
            label={`Power for ${device.name}`}
            pending={actions.powerPending(device.id)}
          />
        </div>
      ) : !device.hasError ? (
        <div className="rounded-xl bg-offline/10 p-3">
          <p className="flex items-center gap-2 text-[15px] font-medium">
            <WifiOff className="size-4 text-[#636366]" aria-hidden /> This device is offline.
          </p>
          {device.lastSeenAt ? (
            <p className="mt-0.5 text-sm text-ink-2">Last seen {relativeTime(device.lastSeenAt)} (simulated).</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-3">
            <p className="flex items-center gap-2 font-semibold text-[#d70015]">
              <TriangleAlert className="size-4" aria-hidden /> {device.errorMessage}
            </p>
            <p className="mt-1 text-sm text-ink">
              {device.errorFixable
                ? "This may be resolved with a remote reconnect."
                : "This needs manual troubleshooting. It can't be cleared remotely."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {device.errorFixable ? (
                <Button size="sm" onClick={() => actions.tryReconnect(device)} pending={actions.reconnectPending(device.id)}>
                  Try remote reconnect
                </Button>
              ) : (
                <Button size="sm" onClick={onViewSteps}>
                  View steps
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => diagnosis.mutate(device.id)} pending={diagnosis.isPending}>
                <Sparkles className="size-4" aria-hidden />
                Get AI diagnosis
              </Button>
            </div>
          </div>

          {diagnosis.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-ink-2">
              <Spinner /> Asking the assistant…
            </p>
          ) : diagnosis.isError ? (
            <div role="alert" className="text-sm">
              <p className="text-[#d70015]">{errorMessage(diagnosis.error)}</p>
              <Button size="sm" variant="ghost" onClick={() => diagnosis.mutate(device.id)}>
                Retry
              </Button>
            </div>
          ) : diag ? (
            <div className="rounded-xl bg-page p-3 text-sm" aria-live="polite">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold">Diagnosis</h3>
                {diag.source === "fallback" ? <Badge>Offline guidance</Badge> : <Badge tone="primary">AI</Badge>}
              </div>
              <p>{diag.diagnosis}</p>
              <h4 className="mt-2 font-semibold">Steps to try</h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {diag.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {diag.possibleCauses.length ? (
                <>
                  <h4 className="mt-2 font-semibold">Possible causes</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {diag.possibleCauses.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {diag.estimatedSuccessRate !== undefined ? (
                <p className="mt-2 text-xs text-ink-2">
                  Rough estimate: {diag.estimatedSuccessRate}% of similar cases resolve with these steps. Not a guarantee.
                </p>
              ) : null}
              <p className="mt-2 text-xs text-ink-2">Guidance only. The assistant can't see or repair the device.</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full whitespace-nowrap"
            disabled={!!powerReason}
            pending={actions.powerPending(device.id)}
            onClick={() => actions.setPower(device, !device.isOn)}
            aria-describedby={powerReason ? "power-reason" : undefined}
          >
            <Power className="size-4" aria-hidden />
            Toggle Power
          </Button>
          {powerReason ? <DisabledReason id="power-reason">{powerReason}</DisabledReason> : null}
        </div>
        <div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full whitespace-nowrap"
            disabled={!!reconnectReason}
            pending={actions.reconnectPending(device.id)}
            onClick={() => actions.tryReconnect(device)}
            aria-describedby={reconnectReason ? "reconnect-reason" : undefined}
          >
            <RefreshCw className="size-4" aria-hidden />
            Reconnect
          </Button>
          {reconnectReason ? <DisabledReason id="reconnect-reason">{reconnectReason}</DisabledReason> : null}
        </div>
      </div>
    </Card>
  );
}
