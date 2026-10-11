import { asc, eq } from "drizzle-orm";
import type { AutomationIcon, ScenarioIcon } from "../../shared/constants";
import { automations, scenarios } from "../../shared/schema";
import type { Automation, Scenario } from "../../shared/types";
import type { DbLike } from "../db";
import { badRequest, notFound } from "../errors";
import { toAutomation, toScenario } from "../serialize";

/** Scenario and automation records. These are metadata only: nothing here runs devices. */

export async function listScenarios(db: DbLike): Promise<Scenario[]> {
  const rows = await db.select().from(scenarios).orderBy(asc(scenarios.id));
  return rows.map(toScenario);
}

export async function getScenario(db: DbLike, id: number): Promise<Scenario> {
  const [row] = await db.select().from(scenarios).where(eq(scenarios.id, id));
  if (!row) throw notFound("Scenario");
  return toScenario(row);
}

export async function createScenario(db: DbLike, input: { name: string; icon: ScenarioIcon }): Promise<Scenario> {
  const [row] = await db.insert(scenarios).values(input).returning();
  return toScenario(row);
}

export async function deleteScenario(db: DbLike, id: number): Promise<void> {
  const deleted = await db.delete(scenarios).where(eq(scenarios.id, id)).returning({ id: scenarios.id });
  if (deleted.length === 0) throw notFound("Scenario");
}

export async function listAutomations(db: DbLike): Promise<Automation[]> {
  const rows = await db.select().from(automations).orderBy(asc(automations.id));
  return rows.map(toAutomation);
}

export async function getAutomation(db: DbLike, id: number): Promise<Automation> {
  const [row] = await db.select().from(automations).where(eq(automations.id, id));
  if (!row) throw notFound("Automation");
  return toAutomation(row);
}

export async function createAutomation(
  db: DbLike,
  input: { name: string; description: string; icon: AutomationIcon },
): Promise<Automation> {
  const [row] = await db.insert(automations).values({ ...input, isActive: true }).returning();
  return toAutomation(row);
}

export async function updateAutomation(
  db: DbLike,
  id: number,
  input: { isActive?: boolean; name?: string; description?: string; icon?: AutomationIcon },
): Promise<Automation> {
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) throw badRequest("Nothing to update");
  const [row] = await db.update(automations).set(patch).where(eq(automations.id, id)).returning();
  if (!row) throw notFound("Automation");
  return toAutomation(row);
}

export async function deleteAutomation(db: DbLike, id: number): Promise<void> {
  const deleted = await db.delete(automations).where(eq(automations.id, id)).returning({ id: automations.id });
  if (deleted.length === 0) throw notFound("Automation");
}
