import { expect, test, type Page } from "@playwright/test";

// Seed ids are deterministic because reset restarts identities.
const ROOM = { living: 1, bathroom: 2, kitchen: 3, bedroom: 4 };
const DEVICE = { livingAc: 2 };

test.beforeEach(async ({ request }) => {
  const res = await request.post("/api/demo/reset");
  expect(res.ok()).toBeTruthy();
});

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test.describe("smoke: every screen renders", () => {
  const screens: Array<[string, string | RegExp]> = [
    ["/", "Smart Home Dashboard"],
    ["/devices", "Devices"],
    [`/room/${ROOM.living}`, "Living Room"],
    [`/device/${DEVICE.livingAc}`, "Device Details"],
    ["/scenarios", "Scenarios"],
    ["/automations", "Automations"],
    ["/settings", "Settings"],
  ];
  for (const [path, heading] of screens) {
    test(`${path} renders with navigation`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(nav(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  test("home shows floor plan, legend, then devices", async ({ page }) => {
    await page.goto("/");
    const floor = page.getByRole("heading", { name: "Home Floor Plan" });
    const devices = page.getByRole("heading", { name: "Devices", exact: true });
    await expect(floor).toBeVisible();
    await expect(page.getByRole("list", { name: "Legend" })).toBeVisible();
    const [a, b] = await Promise.all([floor.boundingBox(), devices.boundingBox()]);
    expect(a!.y).toBeLessThan(b!.y);
    await expect(page.getByRole("link", { name: "3 errors" })).toBeVisible();
    await expect(page.getByRole("link", { name: "2 offline" })).toBeVisible();
  });

  test("not-found states", async ({ page }) => {
    await page.goto("/device/99999");
    await expect(page.getByRole("heading", { name: "Device not found" })).toBeVisible();
    await page.goto("/room/abc");
    await expect(page.getByRole("heading", { name: "Room not found" })).toBeVisible();
    await page.goto("/nope");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("no horizontal scroll at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of ["/", "/devices", `/device/${DEVICE.livingAc}`, `/room/${ROOM.kitchen}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe("journeys", () => {
  test("power a healthy device and the change persists", async ({ page }) => {
    await page.goto("/devices");
    const sw = page.getByRole("switch", { name: "Power for Bathroom Light" });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(sw).not.toBeChecked();
    await page.reload();
    await expect(page.getByRole("switch", { name: "Power for Bathroom Light" })).not.toBeChecked();
  });

  test("search and error filter", async ({ page }) => {
    await page.goto("/devices");
    await page.getByRole("button", { name: "Errors (3)" }).click();
    await expect(page).toHaveURL(/filter=errors/);
    await expect(page.getByRole("link", { name: /Living Room AC/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bedroom AC/ })).toHaveCount(0);
    await page.getByRole("button", { name: "All" }).click();
    await page.getByLabel("Search devices").fill("kitchen");
    await expect(page.getByRole("link", { name: /Kitchen Light/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bedroom TV/ })).toHaveCount(0);
    await page.getByLabel("Search devices").fill("zzz");
    await expect(page.getByText("No devices match “zzz”")).toBeVisible();
  });

  test("reconnect clears a fixable error; manual errors explain why", async ({ page }) => {
    await page.goto("/devices?filter=errors");
    await page.getByRole("button", { name: "Reconnect Living Room AC" }).click();
    await expect(page.getByText(/Error cleared by a simulated remote reconnect/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconnect Living Room AC" })).toHaveCount(0);
    await page.getByRole("button", { name: "Reconnect Living Room TV" }).click();
    await expect(page.getByText(/can't be cleared remotely/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconnect Living Room TV" })).toBeVisible();
  });

  test("add a device from room detail", async ({ page }) => {
    await page.goto(`/room/${ROOM.kitchen}`);
    await page.getByRole("button", { name: "Add device to Kitchen" }).click();
    const dialog = page.getByRole("dialog", { name: "Add New Device" });
    await expect(dialog.getByLabel("Room")).toHaveValue(String(ROOM.kitchen));
    await dialog.getByLabel("Device name").fill("Pantry Light");
    await dialog.getByRole("button", { name: "Add Device" }).click();
    await expect(dialog).toBeHidden();
    // Appears both as a numbered marker on the room diagram and as a row in the list.
    await expect(page.getByRole("link", { name: "3: Pantry Light" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Marker 3 Pantry Light/ })).toBeVisible();
  });

  test("add a room, move it with the keyboard, save, and reload", async ({ page, request }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Edit layout" }).click();
    await page.getByRole("button", { name: "Add Room" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Room" });
    await dialog.getByLabel("Room name").fill("Office");
    await dialog.getByRole("button", { name: "Add Room" }).click();
    await expect(dialog).toBeHidden();

    const before = (await (await request.get("/api/rooms")).json()).find((r: { name: string }) => r.name === "Office");
    const tile = page.getByRole("button", { name: /^Office:/ });
    await tile.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Floor plan saved")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("link", { name: /^Office:/ })).toBeVisible();
    const after = (await (await request.get("/api/rooms")).json()).find((r: { name: string }) => r.name === "Office");
    expect(after.positionX).toBe(before.positionX + 10);
  });

  test("create a scenario without implying it runs", async ({ page }) => {
    await page.goto("/scenarios");
    await page.getByRole("button", { name: "Create scenario" }).click();
    const dialog = page.getByRole("dialog", { name: "Create New Scenario" });
    await dialog.getByLabel("Name").fill("Reading");
    await dialog.getByText("Sun").click();
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("button", { name: /Reading/ }).click();
    await expect(page.getByText("Scenes can't run in this demo.")).toBeVisible();
  });

  test("toggle an automation and it persists", async ({ page }) => {
    await page.goto("/automations");
    const sw = page.getByRole("switch", { name: "Enabled: Welcome Home" });
    await sw.click();
    await expect(sw).not.toBeChecked();
    await page.reload();
    await expect(page.getByRole("switch", { name: "Enabled: Welcome Home" })).not.toBeChecked();
  });

  test("chat answers with labeled offline guidance", async ({ page }) => {
    await page.goto(`/device/${DEVICE.livingAc}`);
    await page.getByRole("button", { name: "How do I reset it?" }).click();
    await expect(page.getByRole("log").getByText("Offline guidance")).toBeVisible();
    await page.getByLabel("Ask a question about this device").fill("Why is it offline?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("log").getByText("Offline guidance")).toHaveCount(2);
  });
});
