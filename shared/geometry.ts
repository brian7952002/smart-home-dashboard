import { PLAN } from "./constants";

export interface Rect {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export function isWithinPlan(r: Rect): boolean {
  return (
    r.positionX >= 0 &&
    r.positionX + r.width <= PLAN.width &&
    r.positionY >= PLAN.entranceBand &&
    r.positionY + r.height <= PLAN.height
  );
}

/** Touching edges is allowed; `gap` widens the exclusion zone. */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.positionX < b.positionX + b.width + gap &&
    b.positionX < a.positionX + a.width + gap &&
    a.positionY < b.positionY + b.height + gap &&
    b.positionY < a.positionY + a.height + gap
  );
}

export function clampToPlan<T extends Rect>(r: T): T {
  const x = Math.min(Math.max(r.positionX, 0), PLAN.width - r.width);
  const y = Math.min(Math.max(r.positionY, PLAN.entranceBand), PLAN.height - r.height);
  return { ...r, positionX: Math.round(x), positionY: Math.round(y) };
}

/** Pairs of ids whose rectangles overlap. */
export function findOverlaps<T extends Rect & { id: number }>(rooms: T[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (rectsOverlap(rooms[i], rooms[j])) pairs.push([rooms[i].id, rooms[j].id]);
    }
  }
  return pairs;
}

/** First free spot scanning top-to-bottom, left-to-right; null when the plan is full. */
export function findFreeSpot(
  existing: Rect[],
  size: { width: number; height: number },
): { positionX: number; positionY: number } | null {
  const { placementStep: step, placementGap: gap } = PLAN;
  for (let y = PLAN.entranceBand; y + size.height <= PLAN.height; y += step) {
    for (let x = 0; x + size.width <= PLAN.width; x += step) {
      const candidate = { positionX: x, positionY: y, ...size };
      if (!existing.some((r) => rectsOverlap(candidate, r, gap))) return { positionX: x, positionY: y };
    }
  }
  return null;
}
