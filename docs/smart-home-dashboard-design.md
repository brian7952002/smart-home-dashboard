# Smart Home Dashboard — Design and Implementation Handoff

**Revision 2.1 · 2026-10-11**. Revision 1 described the Replit prototype. Revision 2 resolved its open questions and contradictions so the app can be built without guessing. Revision 2.1 adds the prototype's firmware versions, rules for verifying support links, and rules for dependency versions. Section 0 lists what changed.

## 0. Changes from revision 1

| Area | Revision 1 | Revision 2 |
|---|---|---|
| Offline devices | No action defined for offline devices with no error | Offline rows get **Reconnect**; the reconnect endpoint handles both offline and error states |
| Error recoverability | "Reconnectable" was undefined | New `errorFixable` column; the seed sets it per device |
| Demo reset | Seeding only runs on an empty DB, so fixes were permanent | `npm run db:reset`, `POST /api/demo/reset`, gated demo tools |
| Error injection | "Development only", with no mechanism | Gated by `ENABLE_DEMO_ENDPOINTS=true`; the route is not registered otherwise |
| Floor-plan geometry | Pixel coordinates with no height or bounds | Fixed 350×450 logical plane scaled to fit (the seeded rooms fill the top 350 units; the rest is free space for new rooms); new `height` column; bounds and no-overlap rules |
| Brightness / temperature | Required persistence, but no columns or endpoint | `brightness` and `targetTempF` columns; `PATCH /api/devices/:id` |
| Device `status` | Free text that went stale on toggle | Column removed; status is derived from state |
| Room-detail markers | No positions | Deterministic grid layout rule |
| Scenario device count | Seeded 7/5/4 while also saying "no actions configured" | `deviceCount` removed; cards say "No actions configured" |
| History | "Store history" contradicted "event log out of scope" | Simulated `device_events` table is in scope; real telemetry is not |
| Last seen | No timestamp | `lastSeenAt`, `createdAt`, `updatedAt` columns |
| Migrations | Asked for migrations but used `db:push` | Committed `drizzle-kit generate` migrations; `push` is local-only |
| Success rate | Required in the shape and also "omit if indefensible" | Optional; never present in fallback responses |
| Delete / edit | None | Delete for all entities; rename/move device; rename room |
| Power API | Non-idempotent `PUT …/toggle` | Idempotent `PUT /api/devices/:id/power { isOn }` |
| AI endpoints | Paid calls on unauthenticated `GET`s; device data in query strings | `POST` only, rate-limited, cached, configurable model, structured output |
| AI suggestions | Separate `suggestions/:deviceType?errorMessage=` endpoint | Merged into diagnosis and guide; one support experience |
| Chat | Stateless `{ deviceId, question }` | Sends recent turns as `history` |
| Support links | Dead "Visit / View Manual / Reset Instructions" buttons | One verified manufacturer-support link, or nothing |
| Home vs. Devices | Duplicate search and filters | Home shows a capped, problem-first overview; Devices owns search and filters |
| Floor-plan editing | Drag-only; N separate saves | Keyboard nudging; one transactional layout save |
| Icon keys | Mixed casing | Lowercase enums |
| Settings route | `/profile` labeled "Settings" | `/settings`; `/profile` redirects |
| Portability | Unstated | Windows-safe scripts, `pg` driver, Docker Compose, CI |
| Firmware (2.1) | Unknown | Seeded from the prototype's values (section 6.6); anything else shows "Not specified", never an invented version |
| Support links (2.1) | Unverified | Each manufacturer's link is checked during implementation and omitted if it can't be confirmed (section 10.3) |
| Dependencies (2.1) | Unstated | Current stable, mutually compatible releases, no prereleases; exact versions plus a committed lockfile |
| `users` table | Present but unused | Removed |

## 1. Purpose

This document specifies the Smart Home Dashboard and how to build it as a working application in a GitHub repository. It is based on the Replit prototype's screens, API, schema, and demo data. The prototype source is **not** in this repository, so this document is the source of truth.

The product is a **mobile-first smart-home management prototype**. It presents a simulated home with rooms, devices, scenes, automations, device health, and AI-assisted support. It is not connected to physical smart-home hardware. The build should keep the compact, Apple Home-inspired visual style without letting any control imply functionality that doesn't exist.

### Goals

1. Recreate the navigation, page hierarchy, visual language, and demo content described here.
2. Make each in-scope control work, with simulated state persisted in PostgreSQL.
3. Keep the AI support experience, with predictable local fallback guidance when the AI provider is unavailable.
4. Make prototype-only or unavailable actions visibly unavailable rather than showing false success.
5. Keep the code deployable outside Replit and developable from a GitHub repository on Windows, macOS, and Linux.

### Product boundary

- Device state is **simulated application state**, not a command to real hardware.
- There is no smart-home vendor or hub integration.
- There is no authentication or per-user data. The Settings screen is presentation-only.
- AI output is advisory. It must not be presented as a guaranteed diagnosis or repair.
- A small **"Demo"** pill in the Home header (and a "Simulated device" caption on Device Details) states the boundary once, so every individual control doesn't need its own disclaimer.

## 2. Users and primary jobs

### Primary user

A homeowner who wants a quick overview of device status and an easy way to find and address device problems.

### Core jobs

- See rooms, devices, and home health at a glance.
- Find devices by name, type, room, or error text, and filter to errors or offline devices.
- Turn a healthy, online device on or off, and adjust brightness or target temperature.
- Identify devices with errors or that are offline, and attempt a simulated reconnect.
- View device details, recent activity, and AI troubleshooting guidance.
- Add, rename, move, and delete simulated rooms and devices; add and delete scenario and automation records.
- Enable or disable an automation record.
- Rearrange rooms on a visual floor plan.

## 3. Information architecture and routes

A persistent five-item bottom navigation sits inside the phone UI:

| Label | Route | Purpose |
|---|---|---|
| Home | `/` | Floor plan, legend, device overview |
| Devices | `/devices` | Search, filter, add, and control devices |
| Scenarios | `/scenarios` | Browse, create, and delete scene records |
| Automations | `/automations` | Browse, create, delete, and enable/disable automation records |
| Settings | `/settings` | Profile summary, demo tools, honest placeholders |

Secondary routes:

| Route | Purpose | Active nav item |
|---|---|---|
| `/room/:id` | Room layout and its devices | Home |
| `/device/:id` | Device status, controls, info, activity, AI support | Devices |
| `/profile` | Redirects to `/settings` (keeps old links working) | Settings |
| `*` | Friendly not-found page with a link to Home | none |

`/devices` reads and writes URL query parameters: `?filter=errors`, `?filter=offline`, `?q=<text>`.

Navigation rules:

- The bottom navigation is visible on every route. The active item is highlighted in the primary blue, with a text label, not color alone.
- Top-level tabs have **no** back link. Detail routes have a back button and a page title.
- Back goes to the previous in-app page if there is one. Otherwise `/room/:id` goes to `/` and `/device/:id` goes to `/devices`.
- No decorative header actions. Every visible action must work, be disabled with a visible reason, or be omitted.
- An invalid detail ID (non-numeric, non-positive, or missing) shows an intentional "Room not found" or "Device not found" state with a link Home, never a blank page.

## 4. Visual design system

### Overall composition

- Mobile-first, portrait smart-home control UI.
- On desktop (≥ 640 px wide), center a phone mockup on a light gray canvas: about 390 px wide, roughly 9:19 aspect ratio, black rounded bezel, notch/speaker/camera details, a static status bar showing 9:41, and integrated bottom navigation.
- Below 640 px the phone frame goes edge-to-edge (no bezel). There must be no horizontal page scroll at any width from 320 px up.
- The phone screen is white; page backgrounds use a very light cool gray.
- Cards are white with about 12 px corner radius, a subtle border or shadow, and compact spacing.

### Color tokens

Define these once (CSS custom properties consumed by Tailwind) and reference them everywhere.

| Token | Use | Color |
|---|---|---|
| `--primary` | Primary actions, active navigation, links | `#0071e3` |
| `--type-light` | Light devices | `#ffb300` |
| `--type-climate` | Climate devices | `#2196f3` |
| `--type-security` | Security devices | `#4caf50` |
| `--type-media` | Media devices | `#9c27b0` |
| `--status-error` | Error | `#ff3b30` |
| `--status-offline` | Offline/inactive | `#9e9e9e` |
| `--bg-page` | Page background | `#f5f5f7` |
| `--text-secondary` | Secondary text | `#8e8e93` |
| `--text-primary` | Main text | `#1c1c1e` |

Never use color as the only status indicator. Pair it with text, an icon, or a badge. Error devices show an error mark and the error text; offline devices are dimmed and labeled "Offline".

Type icons (Lucide): light → `Lightbulb`, climate → `Thermometer`, security → `Shield`, media → `Tv`. Scenario icons: `moon` → `Moon`, `sun` → `Sun`, `film` → `Film`. Automation icons: `clock` → `Clock`, `home` → `Home`, `calendar` → `Calendar`, `location` → `MapPin`. Unknown keys render a neutral default (`Circle`), though the server's enum validation should make that unreachable.

### Typography and interaction

- System sans-serif font stack.
- Page titles about 20 px semibold; card titles about 16 px semibold; supporting text 12–14 px.
- Touch targets at least 44×44 px where practical (40 px minimum for dense row actions).
- Visible keyboard focus everywhere; semantic `button`/`a` elements; labeled dialogs; switches with accessible names (for example "Power for Living Room Light").
- Every data-backed screen has loading (skeleton), empty, and error (with **Retry**) states. Every mutation has pending, success, and failure feedback.
- Mutation feedback uses toasts announced through an `aria-live="polite"` region.
- Respect `prefers-reduced-motion`; motion is secondary to clarity.

## 5. Screen specifications

### 5.0 Shared device row

Used on Home, Devices, and Room Detail:

- Type icon in its type color (gray when offline), device name, and status text (section 6.3). On the Devices page, also show the room name.
- The whole row (except the trailing action) links to `/device/:id`.
- Trailing action, by state:

| State | Action |
|---|---|
| Online, no error | Power switch (`PUT /api/devices/:id/power`) |
| Error (online or offline) | **Reconnect** button |
| Offline, no error | **Reconnect** button |

- Reconnect calls `POST /api/devices/:id/reconnect`:
  - Success: toast "*Name* reconnected (simulated)", and the data refreshes.
  - `MANUAL_FIX_REQUIRED`: toast with the server's message plus a **View steps** link to `/device/:id?tab=guide`. Device state is unchanged.
  - Other failure: an error toast with the server message.
- Controls are disabled while their mutation is pending.

### 5.1 Home dashboard

Header title **Smart Home Dashboard** with the **Demo** pill. Content order:

1. **Home Floor Plan** card
2. **Legend**
3. **Devices** overview card

#### Floor plan: geometry

- Rooms live on a fixed **350 × 450 logical plane** (350 wide, 450 tall). The plan renders at `scale = containerWidth / 350` with height `450 × scale` (about 450 px at phone width). Stored coordinates are logical units, so layouts survive any viewport.
- The seeded rooms fill the top 350 units at the prototype's positions. The band below them is free space for new rooms; with a 350-unit plane there would be no room to add any.
- An **Entrance** marker sits centered in the top band (y 0–40). Rooms may not enter that band.
- Constraints, enforced by client and server:
  - `0 ≤ positionX`, `positionX + width ≤ 350`
  - `40 ≤ positionY`, `positionY + height ≤ 450`
  - `60 ≤ width ≤ 350`, `50 ≤ height ≤ 310`
  - Values are integers; the client snaps drags to a 5-unit grid
  - **Rooms may not overlap** (touching edges is allowed)

#### Floor plan: room tiles

Each tile is absolutely positioned from `positionX`, `positionY`, `width`, `height` and shows:

- Room name.
- A short summary, such as "4 devices · 2 errors" or "2 devices · 1 offline".
- One colored dot per device type present, with a count when there are several of that type.
- An error badge when any device in the room has an error. The tile is dimmed when *every* device in it is offline.

In normal mode a tile is a link to `/room/:id`.

#### Floor plan: edit mode

- The card header has an **Edit layout** button. Entering edit mode shows a banner: "Editing layout: drag rooms, or select one and use the arrow keys", with **Cancel**, **Add Room**, and **Save** actions.
- **Dragging:** pointer events (mouse and touch), with `touch-action: none` on tiles while editing. Positions are clamped inside the plane, so a tile can't be lost off the edge.
- **Keyboard:** tiles are focusable. Arrow keys move the focused room 5 units; Shift+Arrow moves it 20.
- **Overlap:** an overlapping tile gets a red outline and the text "Overlaps *Room*", and **Save** is disabled with the reason "Rooms can't overlap".
- **Save:**
  - Disabled until something changes.
  - Sends one `PUT /api/rooms/layout` containing only the changed rooms. The save is all-or-nothing.
  - Success is announced only after the server confirms.
  - On failure, edit mode and the local edits stay, along with the server's message.
- **Cancel** discards local edits. Navigating away with unsaved edits asks for confirmation.
- **Add Room:**
  - Opens a dialog with a required name (1–40 characters, unique ignoring case) and a size: Small 90×70, Medium 120×90 (default), or Large 140×110.
  - The server picks the position (section 6.4). On success the new room appears in the plan.
  - If there's no space, the dialog shows the server's message and stays open.
- No pencil icon on tiles. Rooms are renamed from Room Detail.

#### Legend

The legend explains only the device and status symbols: Lights, Climate, Security, Media, Offline, Error.

#### Device overview

- Header "Devices", with an add (+) button that opens the **Add Device** dialog (section 5.2) directly. There is no menu of unimplemented routes.
- Summary chips when the count is above zero: "*N* errors" links to `/devices?filter=errors`; "*N* offline" links to `/devices?filter=offline`. When both are zero, show "All devices healthy".
- Up to **5** shared device rows, ordered errors first, then offline, then the rest by name.
- Then a "See all *N* devices" link to `/devices`.
- There's no search here; search lives on the Devices page.
- Empty inventory: "No devices yet", with an Add Device button.

### 5.2 Devices page

- Title "Devices"; no back link (it's a top-level tab); add (+) button.
- **Search** field (label "Search devices"). It matches, case-insensitively, device name, type label, room name, and error message. It is synced to `?q=`.
- **Filter chips:** "All", "Errors (*N*)" when *N* > 0, and "Offline (*N*)" when *N* > 0, synced to `?filter=`. Search and filter combine with AND. If the active chip's count drops to 0 (for example, the last error was fixed), switch to All and announce "No errors remaining".
- Shared device rows, sorted by room name, then device name.
- Empty states:
  - Empty inventory: "No devices yet", with Add Device.
  - No matches: "No devices match '*q*'", with a **Clear search** button.
- **Add Device** dialog:
  - Name: required, 1–60 characters.
  - Type: Light, Climate, Security, or Media.
  - Room: required select, preselected when opened from Room Detail. If no rooms exist, the dialog says so and links to Home.
  - Optional collapsible "More details": manufacturer (≤ 60 characters) and model (≤ 60 characters).
  - **Cancel** and **Add Device** buttons; the add button is disabled while pending.
  - Success closes and resets the form, shows a toast, and refreshes device and room data.
  - Failure leaves the form filled in and shows the server's message (field errors inline).

### 5.3 Room detail page

- Title is the room name; back button.
- Header actions (an overflow menu with labeled items):
  - **Rename room**: a dialog with the same validation as Add Room.
  - **Delete room**:
    - Disabled with the reason "Move or delete this room's *N* devices first" while the room has devices.
    - Otherwise asks for confirmation, then returns to Home.
- **Room Layout** card: a diagram about 350 px tall with a boundary and a centered doorway gap in the bottom wall.
- **Decorative fixtures**, chosen by a case-insensitive match on the room name:
  - "bath": tub and sink
  - "kitchen": counter run and island
  - "living": sofa and coffee table
  - "bed": bed and nightstands
  - anything else: none

  Fixtures are drawn behind markers, `aria-hidden`, with `pointer-events: none`. They are decoration, not an editable tool.
- **Device markers:**
  - Placed on a deterministic grid: devices sorted by `id`; `cols = min(n, 3)`, `rows = ceil(n / cols)`; markers at cell centers inside the walls, with 24 px padding and the bottom 40 px kept clear for the doorway.
  - Each marker is a numbered circle in the device's type color, with an error mark (or offline dimming) when applicable. Numbers match the order of the device list below.
  - A marker is a link to `/device/:id` with an accessible name, for example "2: Living Room AC, error".
- **Legend:** only the device and status types present in this room.
- **Device list:** chips "All" and "Errors (*N*)" (when *N* > 0), shared rows, and an add (+) button that opens Add Device with this room preselected.
- Empty room: "No devices in this room yet", with Add Device.

### 5.4 Device detail page

Title "Device Details"; back button. Supports `?tab=chat|guide|info` (default `chat`).

#### Summary

Type icon, device name, room name (a link to `/room/:id`), derived status text, and the caption "Simulated device".

#### Assistant card

- The title is **Device Assistant**, or **AI-Powered Troubleshooter** when the device has an error.
- **Healthy (online, no error):** text such as "Online and on" or "Online and off", plus a labeled power switch.
- **Offline, no error:** "This device is offline. Last seen *relative time*." with a **Reconnect** button.
- **Error:** the error message shown prominently, plus a hint:
  - If `errorFixable`: "This may be resolved with a remote reconnect", with a **Try remote reconnect** button.
  - Otherwise: "This needs manual troubleshooting", with a **View steps** button that opens the Support Guide tab.
  - Also a **Get AI diagnosis** button. It calls `POST /api/ai/devices/:id/diagnosis` on demand, not on page load, and renders the diagnosis, numbered steps, and possible causes. When the response's `source` is `fallback`, show the label "Offline guidance".
- **Quick actions:**
  - **Power**: disabled with the reason "Unavailable while offline" or "Unavailable while the device has an error".
  - **Reconnect**: disabled with the reason "Already connected" when the device is healthy.
- No suggestion is labeled "Apply". The only action with an effect is the simulated reconnect, and its label says so.

#### Type-specific controls ("Demo control" caption)

- Light: brightness slider, 0–100 %, labeled with its current value.
- Climate: target temperature stepper, 60–90 °F in 1° steps.
- Security and media: no extra controls.
- Controls are enabled only when the device is on, online, and error-free. Otherwise they are disabled with the reason.
- Changes persist via `PATCH /api/devices/:id`. The slider commits on release; the stepper commits after 400 ms debounce. On failure the control reverts and an error toast appears.

#### Tabs

1. **AI Chat** (section 8.4).
2. **Support Guide**: loads `POST /api/ai/devices/:id/guide` when the tab first opens (cached server-side) and shows:
   - overview
   - quick fixes
   - common issues (issue → solution)
   - maintenance tips
   - advanced troubleshooting
   - possible causes
   - "Rough estimate: *N* % of cases resolve with these steps", only when the field is present

   Plus an "Offline guidance" label when `source` is `fallback`, and **Retry** on failure.
3. **Device Info**:
   - **Details:**
     - type
     - power, online, and error state
     - manufacturer, model, and firmware ("Not specified" when null)
     - room
     - last seen: relative time with an absolute tooltip, labeled "(simulated)"
     - added on
     - device ID
   - **Simulated capabilities:** a short list derived from type, such as "Dimmable 0–100 %" for lights or "Target temperature 60–90 °F" for climate.
   - **Support:** a single **Manufacturer support** link (opens a new tab, `rel="noopener noreferrer"`) when the manufacturer is in the verified support map (section 10.3). Otherwise no link is shown. There are no "View Manual" or "Reset Instructions" buttons.
   - **Recent activity:** the last 10 `device_events`, newest first, each with a relative time. Empty state: "No activity yet".
   - **Manage:**
     - **Edit device**: a dialog for name and room.
     - **Delete device**: asks for confirmation, then navigates to `/devices`.
   - **Demo tools**, only when the demo endpoints are enabled (section 6.5): **Simulate error**, a dialog with an error message (1–200 characters) and a "Can be fixed remotely" checkbox.

### 5.5 Scenarios page

- Title "Scenarios"; add (+) button.
- A short explainer: "Scenes group device settings you can trigger with one tap, like dimming the lights for a movie. In this demo, scenes are saved as records only and don't control devices."
- A grid of scene cards, each showing the icon, the name, and a neutral badge "No actions configured".
- Selecting a card opens a sheet with the name, the icon, the sentence "No device actions are configured. Scenes can't run in this demo.", and a **Delete scenario** button (with confirmation). There is no Run button.
- **Create New Scenario** dialog: name (required, 1–40 characters) and an icon picker (Moon, Sun, Film). It persists through `POST /api/scenarios`.
- Empty state: "No scenarios yet", with Create Scenario.

### 5.6 Automations page

- Title "Automations"; add (+) button.
- **Configured automations** list. Each row shows the icon, name, description, the caption "Demo record: doesn't run", and a switch labeled "Enabled".
- The switch:
  - Sends `PATCH /api/automations/:id { isActive }`.
  - Is disabled while pending.
  - Reverts with an error toast on failure.
  - Has no success toast; the switch state is the feedback.
- Selecting a row opens a sheet with its details and **Delete automation** (with confirmation).
- **Create Automation** dialog: name (1–60 characters), description (1–120 characters, with the hint "Describe when it should happen, e.g. 'Every weekday at 7 AM'"), and an icon picker (Clock, Home, Calendar, Location).
- Below the list, a visually separate **Ideas** card with three static examples, titled "Example automations (not configured)". It makes clear these examples aren't records.
- Empty state: "No automations yet", with Create Automation.

### 5.7 Settings page

- Title "Settings"; route `/settings`.
- **Profile summary:** an avatar placeholder, "Home Owner", and "Smart Home Account (demo)".
- **Account:** Personal Information, Home Settings, Security & Privacy. Each opens a small dialog: "Not available in this demo. There are no accounts or saved settings."
- **Notifications** switch, stored in `localStorage` (wrapped in try/catch), with the caption "Saved on this device only. No notifications are sent."
- **System:**
  - **Connectivity**, **Devices**, and **Hub Status** each open the "Not available in this demo" dialog. The exception is **Devices**, which links to `/devices`.
  - **AI assistant** shows "Connected" or "Offline guidance only", from `GET /api/config`.
- **Demo tools**, shown only when `demoEndpointsEnabled`: **Reset demo data**. It asks for confirmation, calls `POST /api/demo/reset`, then invalidates all queries and returns to Home.
- **Support:**
  - **Help & Support** opens a dialog explaining what the demo does.
  - **Log Out** is omitted.

## 6. Data model and persistence

PostgreSQL with Drizzle ORM. Zod schemas in `shared/` (generated with `drizzle-zod` and extended) validate both client forms and server payloads. Every incoming payload is validated server-side. Unknown fields are stripped.

### 6.1 Tables

#### `rooms`

| Column | Type | Rules |
|---|---|---|
| `id` | serial PK | |
| `name` | varchar(40) not null | Trimmed, 1–40 characters; unique index on `lower(name)` |
| `position_x` | integer not null | `0 ≤ x`, `x + width ≤ 350` |
| `position_y` | integer not null | `40 ≤ y`, `y + height ≤ 450` |
| `width` | integer not null | 60–350 |
| `height` | integer not null | 50–310 |
| `created_at` | timestamptz not null default now() | |

Bounds are DB check constraints. The no-overlap rule is enforced in the service layer inside a transaction.

#### `devices`

| Column | Type | Rules |
|---|---|---|
| `id` | serial PK | |
| `name` | varchar(60) not null | Trimmed, 1–60 characters |
| `type` | enum `device_type` (`light`, `climate`, `security`, `media`) | |
| `room_id` | integer not null FK → `rooms.id` **on delete restrict** | |
| `is_on` | boolean not null default false | |
| `is_online` | boolean not null default true | |
| `has_error` | boolean not null default false | |
| `error_message` | varchar(200) null | |
| `error_fixable` | boolean not null default false | |
| `brightness` | smallint null | 0–100; non-null only when `type = 'light'` |
| `target_temp_f` | smallint null | 60–90; non-null only when `type = 'climate'` |
| `manufacturer` | varchar(60) null | |
| `model` | varchar(60) null | |
| `firmware_version` | varchar(30) null | |
| `last_seen_at` | timestamptz null | |
| `created_at` | timestamptz not null default now() | |
| `updated_at` | timestamptz not null default now() | Set on every update |

Check constraints:

- `(has_error AND error_message IS NOT NULL) OR (NOT has_error AND error_message IS NULL AND NOT error_fixable)`
- `brightness IS NULL OR type = 'light'`
- `target_temp_f IS NULL OR type = 'climate'`

On create, the server sets `brightness = 100` for lights, `target_temp_f = 72` for climate devices, and `last_seen_at = now()`.

#### `device_events`

| Column | Type | Rules |
|---|---|---|
| `id` | serial PK | |
| `device_id` | integer not null FK → `devices.id` **on delete cascade** | |
| `type` | enum `device_event_type`: `created`, `updated`, `power_on`, `power_off`, `setting_changed`, `error_set`, `error_cleared`, `reconnected`, `went_offline` | |
| `detail` | varchar(200) null | For example "Brightness 80 % → 60 %" or the error message |
| `created_at` | timestamptz not null default now() | Index on `(device_id, created_at desc)` |

The server writes events in the same transaction as the change that causes them. Clients never write events directly.

#### `scenarios`

| Column | Type | Rules |
|---|---|---|
| `id` | serial PK | |
| `name` | varchar(40) not null | 1–40 characters |
| `icon` | enum `scenario_icon` (`moon`, `sun`, `film`) | |
| `created_at` | timestamptz not null default now() | |

There is no `deviceCount`. A future scene-action model would add a `scenario_actions` table and derive any count from it.

#### `automations`

| Column | Type | Rules |
|---|---|---|
| `id` | serial PK | |
| `name` | varchar(60) not null | 1–60 characters |
| `description` | varchar(120) not null | 1–120 characters |
| `icon` | enum `automation_icon` (`clock`, `home`, `calendar`, `location`) | |
| `is_active` | boolean not null default true | |
| `created_at` | timestamptz not null default now() | |

The prototype's `users` table is **not** carried over.

### 6.2 Device behavior rules

| Action | Precondition | Effect | Event |
|---|---|---|---|
| Set power | Online and no error (otherwise 400 `DEVICE_UNAVAILABLE`) | `is_on = isOn`; `last_seen_at = now()` | `power_on` / `power_off` (none if unchanged) |
| Change brightness / target temp | Correct type, on, online, no error (otherwise 400) | Update the value; `last_seen_at = now()` | `setting_changed` with before → after |
| Reconnect, healthy device | — | 400 `ALREADY_CONNECTED` | — |
| Reconnect, offline, no error | — | `is_online = true`; `last_seen_at = now()` | `reconnected` |
| Reconnect, error with `error_fixable` | — | Clear the error; `is_online = true`; `last_seen_at = now()` | `error_cleared` |
| Reconnect, error not fixable | — | No change; 400 `MANUAL_FIX_REQUIRED` with an actionable message, e.g. "This error can't be cleared remotely. Follow the Support Guide steps, then power-cycle the device." | — |
| Simulate error (demo) | Demo endpoints enabled | `has_error = true`, set message and fixable; online state unchanged | `error_set` |
| Rename / move room | New room exists | Update fields | `updated` |
| Create | Valid room | Defaults above | `created` |

### 6.3 Derived status text

The server computes `status` with a shared function and includes it in every device response. Clients don't compose their own.

1. Error → the error message
2. Offline → "Offline"
3. Off → "Off"
4. On, by type:
   - light → "On · *N* % brightness"
   - climate → "On · *N* °F"
   - security → "Monitoring"
   - media → "On"

### 6.4 Room placement for `POST /api/rooms`

Given the requested size:

1. Scan `y` from 40 upward and `x` from 0 upward, in steps of 10.
2. Place the room at the first spot that fits in the plane and keeps at least a 10-unit gap from every existing room.
3. If there's no such spot, return 400 `NO_SPACE`: "There's no free space on the floor plan. Move rooms or choose a smaller size."

### 6.5 Seeding, reset, and demo gating

- `npm run db:seed` seeds **only if `rooms` is empty**. It is idempotent.
- Server startup also seeds an empty database unless `SEED_ON_START=false`.
- `npm run db:reset` truncates all tables (restarting identities) and reseeds in one transaction.
- `ENABLE_DEMO_ENDPOINTS=true` registers `POST /api/devices/:id/simulate-error` and `POST /api/demo/reset`. When it's unset or false, the routes **aren't registered** (404), and `GET /api/config` reports `demoEndpointsEnabled: false`, which hides the demo tools in the UI. The default is `false`; `.env.example` sets it to `true` for local development.
- If `DATABASE_URL` is missing or the database is unreachable at startup, the server logs a clear message (without the URL) and exits non-zero. There is **no** in-memory fallback.

### 6.6 Seed inventory

Each seed run captures `now` once and computes every timestamp from it.

**Rooms:**

| Name | positionX | positionY | width | height |
|---|---|---|---|---|
| Living Room | 40 | 60 | 140 | 150 |
| Bathroom | 210 | 60 | 120 | 90 |
| Kitchen | 210 | 170 | 120 | 110 |
| Bedroom | 40 | 240 | 140 | 90 |

None of these overlap, and all are within bounds.

**Devices.** Unlisted brightness and temperature values are null. Firmware versions come from the prototype seed. A device without a firmware value (including any user-created device) shows "Not specified"; never invent a version.

| Room | Name | Type | On | Online | Error (fixable?) | Brightness / °F | Manufacturer / Model | Firmware | last_seen_at |
|---|---|---|---|---|---|---|---|---|---|
| Living Room | Living Room Light | light | yes | yes | — | 80 % | Philips Hue / White and Color Ambiance | 1.65.11 | now |
| Living Room | Living Room AC | climate | yes | yes | "Network connectivity error" (**fixable**) | 70 °F | Ecobee / Smart Thermostat Premium | 4.7.5.352 | now − 20 min |
| Living Room | Living Room TV | media | no | yes | "Smart Hub not responding" (**not fixable**) | — | Samsung / QN90B QLED Smart TV | 2301.0 | now − 45 min |
| Living Room | Living Room Camera | security | yes | yes | — | — | Ring / Indoor Cam | 2.6.1 | now |
| Kitchen | Kitchen Light | light | no | **no** | — | 100 % | LIFX / A19 Color | 3.70 | now − 3 h |
| Kitchen | Kitchen Motion Sensor | security | no | yes | "Connection error" (**fixable**) | — | Aqara / FP2 Presence Sensor | 1.2.9 | now − 10 min |
| Bedroom | Bedroom Light | light | yes | yes | — | 60 % | Nanoleaf / Shapes Hexagons | 6.2.0 | now |
| Bedroom | Bedroom AC | climate | yes | yes | — | 72 °F | Sensibo / Sky | 1.5.4 | now |
| Bedroom | Bedroom TV | media | no | **no** | — | — | LG / C2 OLED | 04.30.75 | now − 26 h |
| Bathroom | Bathroom Light | light | yes | yes | — | 70 % | GE / C by GE Smart Switch | 2.8.0 | now |

Expected health summary: **3 errors** (2 fixable, 1 manual) and **2 offline**.

Seed `created_at` is now − 7 days for every device. Seed events:

- one `created` event per device, at now − 7 days
- one `error_set` event per errored device, at its `last_seen_at`
- one `went_offline` event per offline device, at its `last_seen_at`

**Scenarios:** Good Night (`moon`), Good Morning (`sun`), Movie Time (`film`). The prototype's "Add New" helper row is **not** seeded.

**Automations:**

| Name | Description | Icon | Active |
|---|---|---|---|
| Lights Off at 11 PM | Daily | `clock` | yes |
| Welcome Home | When arriving home | `home` | yes |

## 7. HTTP API contract

All routes are same-origin under `/api`, with JSON request and response bodies. The JSON body limit is 16 KB.

Mutations return the updated or created entity, with a derived `status` on devices. Creates return 201; deletes return 204.

### 7.1 Errors

Every error uses this shape:

```json
{ "message": "Human-readable explanation", "code": "OPTIONAL_MACHINE_CODE", "fieldErrors": { "name": "Required" } }
```

| Status | When |
|---|---|
| 400 | Invalid body or query, or a business-rule violation. Codes: `VALIDATION_ERROR`, `DEVICE_UNAVAILABLE`, `ALREADY_CONNECTED`, `MANUAL_FIX_REQUIRED`, `NO_SPACE`, `ROOM_OVERLAP`, `DEVICE_HAS_NO_ERROR` |
| 400 | Non-integer or out-of-range `:id` (`INVALID_ID`). The client treats this like a 404 on detail pages |
| 404 | Missing entity or unknown `/api` route |
| 409 | Conflict: `ROOM_NOT_EMPTY` (delete), `DUPLICATE_NAME` |
| 429 | Rate limited (`RATE_LIMITED`) |
| 500 | Unexpected failure. Generic message; no stack trace or internals |

### 7.2 Routes

| Method and route | Body / query | Notes |
|---|---|---|
| `GET /api/config` | — | `{ aiAvailable, demoEndpointsEnabled }`. Never includes secrets |
| `GET /api/rooms-with-devices` | — | Rooms (sorted by name) with `devices[]` (sorted by id) |
| `GET /api/rooms` | — | |
| `GET /api/rooms/:id` | — | |
| `POST /api/rooms` | `{ name, size?: "small" \| "medium" \| "large" }` | Server places the room (section 6.4) |
| `PATCH /api/rooms/:id` | `{ name? }` | Rename. Position changes go through `/layout` |
| `PUT /api/rooms/layout` | `{ rooms: [{ id, positionX, positionY }] }` (1–50 items) | One transaction. Validates bounds and overlap against the final layout; all-or-nothing |
| `DELETE /api/rooms/:id` | — | 409 `ROOM_NOT_EMPTY` if it has devices |
| `GET /api/devices` | — | Sorted by room name, then device name |
| `GET /api/devices/:id` | — | |
| `GET /api/devices/:id/events` | `?limit=1..50` (default 10) | Newest first |
| `POST /api/devices` | `{ name, type, roomId, manufacturer?, model? }` | 400 for an unknown `roomId`. Defaults: off, online, no error |
| `PATCH /api/devices/:id` | `{ name?, roomId?, brightness?, targetTempF? }` | Type, range, and availability rules from section 6.2 |
| `PUT /api/devices/:id/power` | `{ isOn: boolean }` | Idempotent |
| `POST /api/devices/:id/reconnect` | — | Section 6.2 |
| `POST /api/devices/:id/simulate-error` | `{ errorMessage, fixable }` | **Demo only** (section 6.5) |
| `DELETE /api/devices/:id` | — | Cascades its events |
| `GET /api/scenarios` / `GET /api/scenarios/:id` | — | |
| `POST /api/scenarios` | `{ name, icon }` | |
| `DELETE /api/scenarios/:id` | — | |
| `GET /api/automations` / `GET /api/automations/:id` | — | |
| `POST /api/automations` | `{ name, description, icon }` | Default `isActive: true` |
| `PATCH /api/automations/:id` | `{ isActive?, name?, description?, icon? }` | |
| `DELETE /api/automations/:id` | — | |
| `POST /api/demo/reset` | — | **Demo only**. Same effect as `db:reset` |
| `POST /api/ai/devices/:id/diagnosis` | — | 400 `DEVICE_HAS_NO_ERROR` for a device without an error |
| `POST /api/ai/devices/:id/guide` | — | Any device |
| `POST /api/ai/chat` | `{ deviceId, question, history? }` | Section 8.4 |

Removed from revision 1:

- `PUT /api/devices/:id/toggle` → replaced by `/power`
- `PUT /api/devices/:id/fix` → replaced by `/reconnect`
- `PUT /api/devices/:id/set-error` → replaced by `/simulate-error`
- `PUT /api/automations/:id/toggle` → replaced by `PATCH`
- `PUT /api/rooms/:id` → replaced by `PATCH` and `/layout`
- `GET /api/ai/troubleshoot/device/:id` → replaced by `POST …/diagnosis`
- `GET /api/ai/suggestions/:deviceType` → merged into diagnosis and guide
- `GET /api/ai/device-guide/:id` → replaced by `POST …/guide`

### 7.3 AI response shapes

Every AI response includes `source: "ai" | "fallback"`. `estimatedSuccessRate` is optional: an integer from 0 to 100 that comes only from the model and is **never** present when `source` is `fallback`.

```json
{
  "source": "ai",
  "diagnosis": "Likely cause in clear language",
  "steps": ["First safe check", "Next step"],
  "possibleCauses": ["Network issue"],
  "estimatedSuccessRate": 70
}
```

```json
{
  "source": "fallback",
  "overview": "Device-type summary",
  "quickFixes": ["Power-cycle the device"],
  "commonIssues": [{ "issue": "Connectivity", "solution": "Check the hub connection." }],
  "maintenanceTips": ["Keep firmware current."],
  "advancedTroubleshooting": ["Check the manufacturer's diagnostic logs."],
  "possibleCauses": ["Weak signal"]
}
```

```json
{ "source": "ai", "answer": "Plain-text answer" }
```

## 8. AI support behavior

### 8.1 Provider and configuration

- The OpenAI Node SDK runs **on the server only**. The key never reaches browser code or responses.
- The model comes from `OPENAI_MODEL`, defaulting to `gpt-4o` to match the prototype. It's configurable because model names get retired.
- Use the API's structured-output mode (a JSON schema response format) for diagnosis and guide. Validate the result again with the shared Zod schemas before returning it. Invalid output falls back.
- Per-request timeout is 20 seconds, with no automatic retries on the request path.

### 8.2 Fallback

Fallback is used when the key is missing, or on timeout, network error, provider error or rate limit, or output that fails validation. It returns local, device-type-specific guidance from `server/ai/fallback.ts`, covering all four types, both error and healthy states, and the fixable/manual distinction, with `source: "fallback"`.

Our own `429` (section 8.5) is not a fallback case. The client shows "Too many requests. Try again in a minute."

### 8.3 Prompt content and privacy

- Send only: device type, manufacturer, model, firmware, on/online/error flags, error message, and `errorFixable`. Chat also sends the user's question and history.
- **Don't send device names, room names, IDs, or timestamps.**
- System prompt requirements:
  - Concise, actionable, ordered steps.
  - Honest about uncertainty.
  - Never claim to have changed or repaired the device.
  - Recommend contacting the manufacturer, or an electrician for wiring, where safety is involved.
- Don't log prompts, questions, or model output. Log only route, status, duration, `source`, and the provider error class.

### 8.4 Chat

- Body: `{ deviceId: int, question: string (1–500 chars), history?: [{ role: "user" | "assistant", content: string (1–1000 chars) }] }`. The client sends at most the last 6 turns.
- Answers are plain text, about 120 words or fewer.
- UI:
  - User and assistant bubbles.
  - Three starter prompts depending on state, for example "Why is it offline?", "How do I reset it?", "Is my firmware current?".
  - A labeled input with Enter to send. **Send** is disabled while empty or pending.
  - Loading dots.
  - Fallback answers labeled "Offline guidance".
  - On a transport error: an inline error bubble with Retry.
- History lives in component state only. It isn't persisted and clears on leaving the page.

### 8.5 Cost and abuse controls

- `/api/ai/*` is rate-limited per client IP: `AI_RATE_LIMIT_PER_MIN`, default 20.
- Diagnosis and guide responses with `source: "ai"` are cached in memory, keyed by `deviceId` and device `updatedAt` (so any state change invalidates), with a 1-hour TTL and at most 200 entries. Fallback responses aren't cached, so recovery is picked up immediately.
- All AI routes are `POST`, so prefetchers and crawlers can't trigger paid calls.
- The README must state that the app has no authentication and must not be exposed publicly as is (section 11).

## 9. Out of scope

These aren't built. The UI must not imply them.

- Real device control or vendor/hub integrations; real telemetry.
- Running scenes (no scene-action model) or executing automations (no trigger/condition/action model).
- Authentication, authorization, multi-user or multi-home data isolation, real account settings, notifications delivery.
- Resizing rooms after creation (size is chosen at creation).
- Persisted chat history.

## 10. Technical implementation

### 10.1 Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite, Wouter router, TanStack Query (central `apiRequest` helper, query-key factory, invalidation after mutations), Tailwind CSS with the section 4 tokens, Radix/shadcn-style accessible primitives, Lucide icons |
| Backend | Node.js + TypeScript + Express, Zod validation middleware, `express-rate-limit` |
| Database | PostgreSQL 16 via **`pg` + `drizzle-orm/node-postgres`**. Not `@neondatabase/serverless`, which needs WebSockets and can't reach a plain local Postgres |
| AI | `openai` SDK, server only |
| Tests | Vitest + Supertest (API), Playwright (UI) |

Use the current stable, mutually compatible releases of each package at implementation time. Don't copy the prototype's old versions or pick prerelease builds. Record exact versions in `package.json` (no `^`/`~` ranges) and commit `package-lock.json` so `npm ci` is reproducible. Don't use Replit Vite plugins or Replit runtime services.

### 10.2 Repository layout

```
client/            React app (src/pages, src/components, src/lib)
server/            Express app, routes, services, ai/, db.ts, seed.ts
shared/            Drizzle schema, Zod schemas, derived-status and support-map helpers
migrations/        Generated SQL migrations (committed)
tests/api/         Vitest + Supertest
tests/e2e/         Playwright
docker-compose.yml Postgres 16 for development and tests
.env.example
```

### 10.3 Manufacturer support map

`shared/supportLinks.ts` maps manufacturers to **official support pages**. Lookup ignores case. User-created devices get a link only when their manufacturer matches.

Verify the destinations for Philips (Hue), Ecobee, Samsung, Ring, LIFX, Aqara, Nanoleaf, Sensibo, LG, and GE during implementation. A URL is kept only if it loads, or redirects successfully, to an official support page owned by that manufacturer and relevant to it or the product. If ownership, relevance, or availability can't be confirmed, omit the link; never substitute a third-party page. Record the verification date in the file.

### 10.4 Portability (Windows, macOS, Linux)

- `engines.node >= 22.12`. Current stable releases of the OpenAI SDK (≥ 22) and Vitest (≥ 22.12) require it, and Node 20 reached end-of-life in April 2026. The development machine runs Node 24.
- Set environment variables in npm scripts with `cross-env`; POSIX `VAR=x cmd` syntax fails in PowerShell and cmd.
- Start the server with a plain `server.listen(PORT)`. **No `reusePort`**, which throws `ENOTSUP` on Windows.
- Load `.env` with `dotenv` in development. In production, read real environment variables.
- Paths via `path`/`fileURLToPath`, never hard-coded separators.

### 10.5 Local database

`docker-compose.yml` runs a `postgres:16` service on port 5432 with a named volume. An init script creates two databases: `smarthome` (development) and `smarthome_test` (tests). Docker Desktop must be running first.

### 10.6 Environment variables (`.env.example`, names and safe defaults only)

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/smarthome
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/smarthome_test
PORT=5000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
AI_RATE_LIMIT_PER_MIN=20
ENABLE_DEMO_ENDPOINTS=true
SEED_ON_START=true
```

The compose credentials above are for the local container only. Real credentials are never committed. Logs and responses never print `DATABASE_URL` or `OPENAI_API_KEY`.

### 10.7 Scripts

| Script | Purpose |
|---|---|
| `npm run db:up` | `docker compose up -d` |
| `npm run db:generate` | `drizzle-kit generate` (after schema changes; commit the output) |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:push` | Local prototyping only; never used in CI or production |
| `npm run db:seed` | Seed if empty |
| `npm run db:reset` | Truncate and reseed |
| `npm run dev` | Express + Vite middleware with HMR on `PORT` |
| `npm run check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | API tests against `TEST_DATABASE_URL` (migrate, then reset before each file) |
| `npm run test:e2e` | Build, start against the test database, run Playwright |
| `npm run build` | Vite client build + server bundle (esbuild) into `dist/` |
| `npm start` | `node dist/index.js`, serving the API and static client from one origin |

### 10.8 Continuous integration

`.github/workflows/ci.yml` runs on push and pull request. It uses a `postgres:16` service container on Node 22, then runs `npm ci`, `check`, `lint`, `test`, and `test:e2e` (which builds and migrates the test database first). CI never sets `OPENAI_API_KEY`, so the fallback path is what gets exercised.

## 11. Error handling, privacy, and reliability

- Validate IDs, enums, required strings, lengths, numeric ranges, and foreign keys at the server boundary (section 7.1).
- Report success only after the database transaction commits.
- Disable duplicate submissions while a mutation is pending.
- After each mutation, invalidate the affected queries: rooms-with-devices, rooms, devices, the device, its events, scenarios, automations.
- Optimistic updates are allowed only for switches, and must roll back on error.
- Request logging covers method, path, status, and duration. It never logs bodies, prompts, or secrets.
- Errors stay visible and recoverable; failures are never silently swallowed.
- **Deployment warning (README):** there's no authentication. Anyone who can reach the server can change all data and spend the OpenAI quota. Run it locally or behind your own access control. Real auth and per-home isolation are a separate future phase.

## 12. Acceptance criteria

### Visual and navigation

- [ ] The five primary destinations plus `/room/:id`, `/device/:id`, and the `/profile` → `/settings` redirect work by click and by direct URL.
- [ ] Invalid or missing IDs show a not-found state; unknown routes show the not-found page.
- [ ] Desktop shows a centered phone mockup. At 320–639 px the layout is edge-to-edge with no horizontal scroll.
- [ ] Home shows the floor plan, legend, and device overview, in that order.
- [ ] Type colors, error/offline indicators (never color-only), cards, the Demo pill, and bottom navigation match section 4.
- [ ] Every visible button, link, icon, and switch either works or is disabled with a visible reason. No dead buttons.

### Data and interactions

- [ ] `db:seed` is idempotent and yields 4 rooms, 10 devices, 3 scenarios, 2 automations, 3 errors (2 fixable), and 2 offline devices. `db:reset` and the demo reset restore exactly that state.
- [ ] Search and the Errors/Offline filters return correct results and counts, and stay in sync with the URL.
- [ ] Power changes on healthy devices persist and appear on every screen. Offline or error devices can't be powered.
- [ ] Reconnect:
  - [ ] restores offline devices
  - [ ] clears fixable errors
  - [ ] returns the manual-fix message for the TV, leaving its state unchanged
- [ ] Brightness and target temperature persist, respect their ranges, and are disabled when unavailable.
- [ ] Devices can be created, renamed, moved, and deleted. Rooms can be created, renamed, and deleted when empty.
- [ ] Floor-plan edits (drag and keyboard) save atomically, reject overlap and out-of-bounds positions, and persist after refresh.
- [ ] Seeded firmware versions match the prototype data; devices without a version show "Not specified".
- [ ] Every displayed manufacturer support link was confirmed during implementation to reach a relevant official support page; unconfirmed links are omitted.
- [ ] Scenarios can be created and deleted. Automations can be created, toggled (persisted), and deleted.
- [ ] Scenario and automation screens never imply execution.
- [ ] Recent activity shows the events produced by the actions above.
- [ ] Loading, empty, error-with-Retry, and not-found states exist on every data-backed screen.

### AI support

- [ ] AI calls run server-side via `POST`, use only the device context allowed by section 8.3, and return the section 7.3 shapes with `source`.
- [ ] With no `OPENAI_API_KEY`, diagnosis, guide, and chat all return labeled fallback guidance, and the app stays fully usable.
- [ ] No suggestion claims to control or repair hardware.
- [ ] `estimatedSuccessRate` is absent from fallbacks and labeled as an estimate when shown.
- [ ] Chat has loading, fallback, and error-with-retry states for all four device types.
- [ ] The AI rate limit returns 429 and the UI explains it.

### Engineering

- [ ] Migrations are committed; the README documents `db:up`, `db:migrate`, `db:seed`, and `db:reset`.
- [ ] Dependencies are current stable compatible releases, with exact versions in `package.json` and a committed lockfile.
- [ ] No credentials are committed or present in the client bundle or logs.
- [ ] `check`, `lint`, and `build` pass on Windows and in Linux CI.
- [ ] API tests cover:
  - [ ] validation errors and `INVALID_ID`
  - [ ] 404s for missing entities
  - [ ] power rules
  - [ ] all reconnect branches
  - [ ] PATCH range and type rules
  - [ ] room placement and `NO_SPACE`
  - [ ] layout overlap and bounds rejection
  - [ ] `ROOM_NOT_EMPTY`
  - [ ] cascade deletes
  - [ ] create flows
  - [ ] demo routes returning 404 when disabled
  - [ ] AI fallback with no key
- [ ] Playwright smoke tests at 390×844 and 1280×800 cover Home, Devices, Room Detail, Device Detail, Scenarios, Automations, and Settings, plus these journeys:
  - [ ] power a device
  - [ ] reconnect a fixable error
  - [ ] add a device from Room Detail
  - [ ] add a room, move it with the keyboard, save, and reload
  - [ ] create a scenario
  - [ ] toggle an automation
  - [ ] chat with fallback

## 13. Implementation sequence

1. Scaffold the project: scripts, `cross-env`, Docker Compose, `.env.example`, ESLint, TypeScript config, CI skeleton.
2. Write the Drizzle schema, generate the initial migration, and build the seed/reset (section 6).
3. Build the services and routes with Zod validation; write the API tests (section 7).
4. Build the app shell: phone frame, tokens, bottom navigation, query client, error/empty/loading primitives, toasts.
5. Build Home (floor plan with edit mode), Devices, Room Detail, and Device Detail.
6. Build Scenarios, Automations, and Settings with the section 5 boundaries.
7. Build the AI layer: fallback content first, then OpenAI structured output, caching, and rate limiting.
8. Write the Playwright journeys and an accessibility pass, finish the README, and run `check`, `lint`, `build`, `test`, and `test:e2e`.

## 14. Handoff prompt for Claude

> Implement the application described in `docs/smart-home-dashboard-design.md` (revision 2.1) in this repository. Follow the document as the source of truth: routes, screens, tokens, schema and constraints, seed data, API contract, error codes, and AI behavior. Use Docker Compose Postgres, `pg` with `drizzle-orm/node-postgres`, and Windows-safe npm scripts. Make every visible control work or disable it with a visible reason. Never claim to control real devices, run scenes, execute automations, or authenticate users. Keep OpenAI credentials server-side, make the app fully usable without an API key, and include `.env.example` without secrets. Seed the prototype's firmware versions. Verify every manufacturer support URL and omit any that can't be confirmed as a working, relevant official support page. Use current stable, compatible package releases with exact versions and a committed lockfile. Commit migrations. Write the API and Playwright tests listed in section 12. Finish by reporting the implemented scope, any deliberate deviations from the document, the required environment variables, and the exact commands and results used to verify the build.
