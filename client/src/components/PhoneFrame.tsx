import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { useLocation } from "wouter";
import { confirmLeave, hasNavigationGuard, recordNavigation } from "@/lib/navigation";
import { PortalContainerContext } from "./Dialog";
import { BottomNav } from "./BottomNav";

/**
 * Desktop (≥640px): a centered phone mockup on a gray canvas.
 * Narrow screens: edge-to-edge, no bezel or fake status bar.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  useEffect(() => {
    recordNavigation();
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location]);

  // While a guard is active (unsaved floor-plan edits), confirm before following any in-app link.
  function onClickCapture(e: MouseEvent) {
    if (!hasNavigationGuard()) return;
    const anchor = (e.target as HTMLElement).closest("a[href]");
    if (!anchor || anchor.getAttribute("target") === "_blank") return;
    if (!confirmLeave()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center sm:bg-canvas sm:p-5">
      <div className="relative h-[100dvh] w-full sm:h-[min(844px,calc(100dvh-40px))] sm:w-[390px] sm:rounded-[54px] sm:bg-[#111] sm:p-[11px] sm:shadow-2xl">
        {/* Side buttons, decorative */}
        <span aria-hidden className="absolute top-[150px] -left-[3px] hidden h-14 w-[3px] rounded-l bg-[#2a2a2a] sm:block" />
        <span aria-hidden className="absolute top-[220px] -left-[3px] hidden h-14 w-[3px] rounded-l bg-[#2a2a2a] sm:block" />
        <span aria-hidden className="absolute top-[180px] -right-[3px] hidden h-20 w-[3px] rounded-r bg-[#2a2a2a] sm:block" />

        <div
          ref={setPortal}
          onClickCapture={onClickCapture}
          className="relative flex h-full w-full flex-col overflow-clip bg-white sm:rounded-[44px]"
        >
          {/* Notch with speaker and camera, decorative */}
          <div aria-hidden className="absolute top-2 left-1/2 z-30 hidden h-[30px] w-[120px] -translate-x-1/2 items-center justify-end gap-2 rounded-full bg-black px-3 sm:flex">
            <span className="h-[5px] w-10 rounded-full bg-[#1c1c1e]" />
            <span className="size-[10px] rounded-full bg-[#1a1f3a] ring-2 ring-[#0b0b0b]" />
          </div>
          {/* Static status bar */}
          <div aria-hidden className="hidden h-[50px] shrink-0 items-center justify-between bg-page px-8 pt-1 text-[15px] font-semibold sm:flex">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <Signal className="size-4" strokeWidth={2.5} />
              <Wifi className="size-4" strokeWidth={2.5} />
              <BatteryFull className="size-5" strokeWidth={2} />
            </span>
          </div>

          <PortalContainerContext.Provider value={portal}>
            <div ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto bg-page">
              <main className="mx-auto w-full max-w-[480px] px-4 pt-3 pb-6">{children}</main>
            </div>
            <BottomNav />
          </PortalContainerContext.Provider>
        </div>
      </div>
    </div>
  );
}
