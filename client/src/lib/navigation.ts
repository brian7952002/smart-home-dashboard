/**
 * Tiny navigation helpers:
 * - an in-app history depth so Back can fall back to a parent route on direct visits;
 * - a guard used while the floor plan has unsaved edits.
 */
let inAppDepth = 0;
export function recordNavigation() {
  inAppDepth += 1;
}
export function canGoBack() {
  return inAppDepth > 1;
}

let guardMessage: string | null = null;
export function setNavigationGuard(message: string | null) {
  guardMessage = message;
}
/** Returns true if navigation may proceed. */
export function confirmLeave(): boolean {
  return guardMessage === null || window.confirm(guardMessage);
}
export function hasNavigationGuard() {
  return guardMessage !== null;
}

/** Route ids must be positive 32-bit integers; anything else is treated as not found. */
export function parseRouteId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && n <= 2_147_483_647 ? n : null;
}
