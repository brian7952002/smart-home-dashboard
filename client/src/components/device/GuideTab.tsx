import type { ReactNode } from "react";
import type { Device } from "@shared/types";
import { useGuide } from "@/lib/queries";
import { ErrorState } from "../states";
import { Badge, Skeleton } from "../ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="mb-1 text-[15px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function GuideTab({ device }: { device: Device }) {
  const guide = useGuide(device, true);

  if (guide.isPending) {
    return (
      <div role="status" className="space-y-2">
        <span className="sr-only">Loading support guide…</span>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="mt-4 h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (guide.isError) return <ErrorState error={guide.error} onRetry={() => guide.refetch()} title="Couldn't load the guide" />;

  const g = guide.data;
  return (
    <div className="text-sm">
      <div className="mb-3 flex items-center gap-2">
        {g.source === "fallback" ? <Badge>Offline guidance</Badge> : <Badge tone="primary">AI guide</Badge>}
        <span className="text-xs text-ink-2">Guidance only, not a guaranteed fix.</span>
      </div>
      <Section title="Overview">
        <p>{g.overview}</p>
      </Section>
      {g.quickFixes.length ? (
        <Section title="Quick fixes">
          <ol className="list-decimal space-y-1 pl-5">
            {g.quickFixes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>
      ) : null}
      {g.commonIssues.length ? (
        <Section title="Common issues">
          <dl className="space-y-2">
            {g.commonIssues.map((c) => (
              <div key={c.issue} className="rounded-lg bg-page p-2">
                <dt className="font-semibold">{c.issue}</dt>
                <dd>{c.solution}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
      {g.maintenanceTips.length ? (
        <Section title="Maintenance tips">
          <ul className="list-disc space-y-1 pl-5">
            {g.maintenanceTips.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {g.advancedTroubleshooting.length ? (
        <Section title="Advanced troubleshooting">
          <ul className="list-disc space-y-1 pl-5">
            {g.advancedTroubleshooting.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {g.possibleCauses.length ? (
        <Section title="Possible causes">
          <ul className="list-disc space-y-1 pl-5">
            {g.possibleCauses.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {g.estimatedSuccessRate !== undefined ? (
        <p className="mt-4 text-xs text-ink-2">
          Rough estimate: {g.estimatedSuccessRate}% of cases resolve with these steps. Not a guarantee.
        </p>
      ) : null}
    </div>
  );
}
