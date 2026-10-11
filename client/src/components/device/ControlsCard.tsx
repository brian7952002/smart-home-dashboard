import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Slider } from "radix-ui";
import { toast } from "sonner";
import { BRIGHTNESS_RANGE, TEMP_RANGE_F } from "@shared/constants";
import type { Device } from "@shared/types";
import { errorMessage } from "@/lib/api";
import { useUpdateDevice } from "@/lib/queries";
import { Card, CardHeader, DisabledReason } from "../ui";

function unavailableReason(d: Device): string | null {
  if (d.hasError) return "Unavailable while the device has an error";
  if (!d.isOnline) return "Unavailable while offline";
  if (!d.isOn) return "Turn the device on to change this";
  return null;
}

/** Brightness (lights) or target temperature (climate). Persisted as simulated state. */
export function ControlsCard({ device }: { device: Device }) {
  if (device.type !== "light" && device.type !== "climate") return null;
  return (
    <Card aria-labelledby="controls-title">
      <CardHeader id="controls-title" title="Controls" sub="Demo control: changes simulated state only." />
      {device.type === "light" ? <BrightnessControl device={device} /> : <TemperatureControl device={device} />}
    </Card>
  );
}

function BrightnessControl({ device }: { device: Device }) {
  const update = useUpdateDevice();
  const server = device.brightness ?? 100;
  const [value, setValue] = useState(server);
  useEffect(() => setValue(server), [server]);
  const reason = unavailableReason(device);

  function commit(v: number) {
    if (v === server) return;
    update.mutate(
      { id: device.id, brightness: v },
      {
        onError: (err) => {
          setValue(server);
          toast.error(`Couldn't change brightness: ${errorMessage(err)}`);
        },
      },
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span id="brightness-label" className="text-sm font-semibold">
          Brightness
        </span>
        <span className="text-sm text-ink-2" aria-hidden>
          {value}%
        </span>
      </div>
      <Slider.Root
        value={[value]}
        min={BRIGHTNESS_RANGE.min}
        max={BRIGHTNESS_RANGE.max}
        step={1}
        disabled={!!reason || update.isPending}
        onValueChange={([v]) => setValue(v)}
        onValueCommit={([v]) => commit(v)}
        className="relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-50"
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-[#e5e5ea]">
          <Slider.Range className="absolute h-full rounded-full bg-type-light" />
        </Slider.Track>
        <Slider.Thumb
          aria-labelledby="brightness-label"
          aria-valuetext={`${value}%`}
          aria-describedby={reason ? "brightness-reason" : undefined}
          className="block size-7 rounded-full bg-white shadow-md ring-1 ring-black/10 focus-visible:ring-2 focus-visible:ring-primary"
        />
      </Slider.Root>
      {reason ? <DisabledReason id="brightness-reason">{reason}</DisabledReason> : null}
    </div>
  );
}

function TemperatureControl({ device }: { device: Device }) {
  const update = useUpdateDevice();
  const server = device.targetTempF ?? 72;
  const [value, setValue] = useState(server);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setValue(server), [server]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const reason = unavailableReason(device);

  function change(delta: number) {
    const next = Math.min(TEMP_RANGE_F.max, Math.max(TEMP_RANGE_F.min, value + delta));
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next === server) return;
      update.mutate(
        { id: device.id, targetTempF: next },
        {
          onError: (err) => {
            setValue(server);
            toast.error(`Couldn't change the temperature: ${errorMessage(err)}`);
          },
        },
      );
    }, 400);
  }

  const btn =
    "inline-flex size-11 items-center justify-center rounded-full bg-page text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-ink-2";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" id="temp-label">
          Target temperature
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="temp-label">
          <button type="button" className={btn} aria-label="Decrease target temperature" disabled={!!reason || value <= TEMP_RANGE_F.min} onClick={() => change(-1)}>
            <Minus className="size-5" aria-hidden />
          </button>
          <output aria-live="polite" className="w-14 text-center text-xl font-semibold">
            {value}°F
          </output>
          <button type="button" className={btn} aria-label="Increase target temperature" disabled={!!reason || value >= TEMP_RANGE_F.max} onClick={() => change(1)}>
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-2">Range 60–90°F.</p>
      {reason ? <DisabledReason id="temp-reason">{reason}</DisabledReason> : null}
    </div>
  );
}
