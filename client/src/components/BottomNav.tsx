import clsx from "clsx";
import { House, LayoutGrid, Settings, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";

const ITEMS: Array<{ label: string; href: string; icon: LucideIcon; match: (path: string) => boolean }> = [
  { label: "Home", href: "/", icon: House, match: (p) => p === "/" || p.startsWith("/room/") },
  { label: "Devices", href: "/devices", icon: LayoutGrid, match: (p) => p.startsWith("/devices") || p.startsWith("/device/") },
  { label: "Scenarios", href: "/scenarios", icon: Sparkles, match: (p) => p.startsWith("/scenarios") },
  { label: "Automations", href: "/automations", icon: Zap, match: (p) => p.startsWith("/automations") },
  { label: "Settings", href: "/settings", icon: Settings, match: (p) => p.startsWith("/settings") },
];

export function BottomNav() {
  const [location] = useLocation();
  return (
    <nav aria-label="Main" className="shrink-0 border-t border-line bg-white/95 pb-[max(env(safe-area-inset-bottom),4px)] backdrop-blur sm:pb-5">
      <ul className="mx-auto flex max-w-[480px]">
        {ITEMS.map(({ label, href, icon: Icon, match }) => {
          const active = match(location);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[54px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
