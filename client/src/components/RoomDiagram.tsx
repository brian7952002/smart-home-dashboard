import { TriangleAlert, WifiOff } from "lucide-react";
import { Link } from "wouter";
import type { Device } from "@shared/types";
import { TYPE_META } from "@/lib/deviceMeta";

/** Lightweight decorative fixtures in a 100×100 viewBox, chosen by room name. */
function Fixtures({ name }: { name: string }) {
  const n = name.toLowerCase();
  const f = { fill: "var(--fixture)", stroke: "#d1d1d6", strokeWidth: 0.6 };
  if (n.includes("bath")) {
    return (
      <g {...f}>
        <rect x="8" y="8" width="34" height="18" rx="6" />
        <rect x="12" y="11" width="26" height="12" rx="4" fill="#fff" />
        <circle cx="82" cy="16" r="7" />
        <rect x="70" y="40" width="20" height="14" rx="3" />
      </g>
    );
  }
  if (n.includes("kitchen")) {
    return (
      <g {...f}>
        <rect x="8" y="8" width="84" height="10" rx="1.5" />
        <rect x="8" y="18" width="10" height="40" rx="1.5" />
        <rect x="38" y="42" width="30" height="16" rx="2" />
        <circle cx="30" cy="13" r="2.5" fill="#fff" />
        <circle cx="38" cy="13" r="2.5" fill="#fff" />
      </g>
    );
  }
  if (n.includes("living")) {
    return (
      <g {...f}>
        <rect x="20" y="8" width="60" height="14" rx="4" />
        <rect x="16" y="8" width="7" height="22" rx="3" />
        <rect x="77" y="8" width="7" height="22" rx="3" />
        <rect x="35" y="36" width="30" height="14" rx="3" />
        <rect x="88" y="40" width="6" height="22" rx="1" />
      </g>
    );
  }
  if (n.includes("bed")) {
    return (
      <g {...f}>
        <rect x="30" y="8" width="40" height="46" rx="3" />
        <rect x="34" y="11" width="14" height="8" rx="2" fill="#fff" />
        <rect x="52" y="11" width="14" height="8" rx="2" fill="#fff" />
        <rect x="16" y="8" width="10" height="10" rx="1.5" />
        <rect x="74" y="8" width="10" height="10" rx="1.5" />
      </g>
    );
  }
  return null;
}

/** Deterministic marker grid: devices sorted by id, up to 3 columns, doorway area kept clear. */
export function markerPositions(count: number) {
  if (count === 0) return [];
  const cols = Math.min(count, 3);
  const rows = Math.ceil(count / cols);
  const left = 10;
  const right = 90;
  const top = 12;
  const bottom = 80; // bottom band stays clear for the doorway
  return Array.from({ length: count }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      x: left + ((c + 0.5) * (right - left)) / cols,
      y: top + ((r + 0.5) * (bottom - top)) / rows,
    };
  });
}

export function RoomDiagram({ name, devices }: { name: string; devices: Device[] }) {
  const sorted = [...devices].sort((a, b) => a.id - b.id);
  const positions = markerPositions(sorted.length);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[350px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <rect x="0" y="0" width="100" height="100" fill="#fafafc" />
        <Fixtures name={name} />
        {/* Walls with a centered doorway gap in the bottom wall */}
        <path d="M40 98.5 H1.5 V1.5 H98.5 V98.5 H60" fill="none" stroke="#3a3a3c" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M40 98.5 A20 20 0 0 1 60 98.5" fill="none" stroke="#c7c7cc" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      </svg>
      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-ink-2 uppercase" aria-hidden>
        Door
      </span>
      {sorted.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">No devices placed</p>
      ) : null}
      <ol aria-label="Device markers">
        {sorted.map((d, i) => {
          const p = positions[i];
          const state = d.hasError ? ", error" : !d.isOnline ? ", offline" : "";
          return (
            <li key={d.id}>
              <Link
                href={`/device/${d.id}`}
                aria-label={`${i + 1}: ${d.name}${state}`}
                className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[15px] font-bold text-white shadow-md ring-2 ring-white hover:scale-105"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  backgroundColor: d.isOnline ? TYPE_META[d.type].color : "var(--status-offline)",
                }}
              >
                {i + 1}
                {d.hasError ? (
                  <span className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-error ring-2 ring-white" aria-hidden>
                    <TriangleAlert className="size-3" strokeWidth={3} />
                  </span>
                ) : !d.isOnline ? (
                  <span className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-[#636366] ring-2 ring-white" aria-hidden>
                    <WifiOff className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
