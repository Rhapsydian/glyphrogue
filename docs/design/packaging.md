# Packaging & distribution

Deep-dive design doc for Glyphrogue's four build targets — static HTML,
GitHub Pages, itch.io, and Electron/Steam — covering deploy mechanics, the
`steamworks.js` integration (achievements, cloud saves), update strategy,
code-signing, and Steam build/page requirements. Produced in the session-9
planning pass (see `BACKLOG.md` for the roadmap this fits into and
`docs/design/build-pipeline.md` for the build-artifact boundary this doc
builds on: a `vite build` output directory with `base: './'` already decided
for Electron/itch). This was the last item on the **original** 8-topic
deep-dive roadmap — three further sessions (10–12: custom UI/interaction
hooks, audio, AI & behavior) were added afterward, prompted by gaps found
reviewing the completed roadmap; see `BACKLOG.md` for the full list.
`DESIGN.md` will be trimmed to a short summary linking here, same pattern as
the eight prior docs.

Existing precedent throughout: the `pixelyph` repo, which already has a
working `electron.vite.config.mjs`, an `electron/main` + `electron/preload`
split, a `deploy-pages.yml` GitHub Actions workflow, a `release.yml` that
builds an **unsigned** Windows NSIS installer via `electron-builder`, and a
manual (non-CI) `butler push` for itch.io. It has no `steamworks.js`, no
auto-updater, and doesn't target Steam at all — useful as a floor to extend
from, not a finished template.

## Static HTML / GitHub Pages / itch.io deploy mechanics

The build artifact itself needs nothing new — `build-pipeline.md` already
fixed the `vite build` output and the per-mode `base` switch. What's left is
*deploying* that artifact, and the two remaining targets don't deserve the
same treatment:

**Decision: `create-glyphrogue-game`'s scaffold ships a GitHub Pages
deploy workflow, but documents itch.io deploy rather than scripting it.**
Pages deploy is credential-free — `actions/configure-pages` +
`actions/deploy-pages`, no secrets to manage — so baking
`pixelyph`'s `deploy-pages.yml` into the scaffold verbatim is a pure win: a
new game gets Pages hosting the moment it has a repo with Pages enabled, no
setup step required. itch.io's `butler push` needs a `BUTLER_API_KEY`
secret and a channel name tied to the specific itch project
(`user/game:channel`) — per-project setup a template can't fill in. A
scaffold-generated itch workflow would either fail on first run (secret not
configured) or silently need the author to discover and configure it
correctly before it's safe. The scaffold's README documents the `butler
push` command with a placeholder channel name instead, keeping it a
conscious one-time setup step — the same shape `pixelyph` already uses today.

## Platform-capability abstraction

**Decision: `@glyphrogue/core` exposes a thin `platform` capability on its
existing public API, with a no-op default always present.** This follows
`core-architecture.md`'s standing rule that everything touching core state
goes through one public API with no side channels — an achievement or
cloud-save call living outside that surface would be the first exception to
a principle held through eight prior sessions. Concretely, `platform` is
just another dependency-injection point on `core`, the same shape as its
existing rendering-backend and input-adapter injection — `core` itself stays
completely unaware of Electron or Steam. Game/mod code calls
`api.platform.unlockAchievement(id)` unconditionally; on a plain web/itch
build (where nothing ever injects a real implementation) it's a no-op, and
on an Electron+Steam build the scaffold injects a real one (see the IPC
section below). This is the one piece of packaging.md that touches `core`
itself — everything else in this doc is scaffold/CI/config, not engine code.

## Achievements trigger mechanism

**Decision: purely game-content's job — no generic achievement-hook
mechanism.** "Unlock achievement X" is exactly the kind of arbitrary,
game-specific condition (kill 100 rats, reach depth 10, read a specific
book) that `scripting-api.md` already has a home for: a rule's own logic,
keyed to whatever action type it cares about. A rule calls
`api.platform.unlockAchievement(id)` as one of its effects, the same way it
calls any other core mutation through the existing rule API. Building a
separate registration/condition system for achievements specifically would
just be a narrower, redundant copy of the rule pipeline that already exists.

## Cloud saves & storage backend selection

`core-architecture.md` deferred two things to this session: Steam Cloud
specifically, and general storage-backend selection/config (it already
decided *what* backends exist — localStorage for static/Pages/itch,
filesystem with atomic temp-file-then-rename writes for Electron — but not
how a build picks one or how Steam Cloud fits in).

Steam offers two distinct mechanisms: **automatic folder-based Cloud**
(configured entirely on the Steamworks partner dashboard — point it at a
save-path pattern, zero client code, Steam handles sync and conflict
resolution itself) and the **explicit `ISteamRemoteStorage` API**
(`steamworks.js`'s `cloud.*` methods — full control, but the game owns
quota handling and conflict resolution itself).

**Decision: use automatic folder-based Cloud.** The Electron filesystem
backend's existing atomic writes to a normal directory are already exactly
the shape Steam's automatic Cloud wants to watch — no changes needed on the
engine side. This means cloud saves are **not** a `platform.*` adapter
method at all; they're purely a Steamworks-dashboard configuration step
("watch this save directory"), documented in this doc as setup guidance for
a game's Steam page, not engine code. The trade-off is less control over
exactly when sync happens and no custom in-game conflict UI — accepted,
consistent with this project's general bias against building machinery a
platform already provides for free.

This also settles the deferred storage-backend-selection question:
**selection stays purely per-build-target** (localStorage web/itch,
filesystem Electron), wired through the same dependency-injection point as
`platform` above — no Steam-specific branching anywhere in `core`.

## Electron main/preload IPC surface

`steamworks.js` is Node-native and can only run in Electron's main process;
it also requires the real Steam client running, and throws on `init()` if
launched outside Steam (local testing, or an itch.io Electron build) — the
bridge has to fail gracefully rather than crash. Since cloud saves need no
API calls (previous section), the only surface needed is achievements.

**Decision**, extending `pixelyph`'s existing `electron/main` +
`electron/preload` split:

- **Main process**: at startup, `try { steamworks.init(appId) } catch {
  steamAvailable = false }`. One IPC handler,
  `ipcMain.handle('platform:unlock-achievement', (e, id) => { if
  (steamAvailable) client.achievement.activate(id) })` — a no-op if Steam
  init failed, so main never special-cases "not running under Steam" beyond
  that one flag.
- **Preload**: `contextBridge.exposeInMainWorld('glyphrogueSteam', {
  unlockAchievement: (id) => ipcRenderer.invoke('platform:unlock-achievement',
  id) })` — a small, single-purpose global rather than a generic
  `electronAPI` grab-bag, so its purpose is obvious and it's easy to extend
  later without renaming.
- **Wiring into `core`'s adapter**: the Electron scaffold (not `core`
  itself — this global only exists in the Electron renderer) supplies a
  tiny glue implementation, `{ unlockAchievement: (id) =>
  window.glyphrogueSteam?.unlockAchievement(id) }`, injected as the real
  `platform` implementation in place of `core`'s no-op default. The plain
  web build's `index.html`/`dev.html` never sees `window.glyphrogueSteam`,
  so it keeps the no-op default automatically — no target-detection code
  needed anywhere in `core` or game code.
- **Local dev**: a `steam_appid.txt` file (containing the app's Steam app
  ID) must be present next to the Electron executable during development so
  `init()` succeeds without the app actually being launched through Steam.

## Update strategy

Three distribution channels exist, and two already self-update with zero
app code: **Steam** (the client updates its own depot-installed builds) and
**itch.io via the itch app** (auto-updates installs made through it, given
channeled `butler push` builds — itch's own mechanism). Only **direct
download** (a zip/installer from GitHub Releases, or itch visited in a
browser rather than through the itch app) has no built-in updater.

**Decision: ship without `electron-updater` for v1**, same accepted-gap
treatment `pixelyph` has today, documented explicitly in a scaffolded
game's README as a known limitation rather than a silent gap. This holds
independent of the signing decision below: even with signing available,
`electron-updater` is extra scaffold surface for a channel (direct
download) that's secondary to Steam/itch-app, both of which already
self-update. An author can add it later once they've turned on signing (see
below) — `electron-updater` pulling and auto-running unsigned binaries would
be a materially worse trust story than a one-time manual unsigned install a
user consciously chose to run.

## Code-signing strategy

Code signing requires per-author paid credentials tied to a verified legal
identity — a Windows certificate (OV or EV, roughly $100–500+/yr) and an
Apple Developer Program membership ($99/yr) plus notarization for macOS
(effectively mandatory there; Gatekeeper blocks unsigned/un-notarized apps
outright, unlike Windows SmartScreen's warning-only behavior). An engine
can't own or automate acquiring someone else's certificate or Apple
account, so the real design question is how much the scaffold does to make
signing easy once an author has credentials, not whether Glyphrogue signs
anything itself.

`electron-builder` already supports signing via standard env vars
(`CSC_LINK`/`CSC_KEY_PASSWORD` for Windows; `APPLE_ID`/`APPLE_TEAM_ID`/etc.
plus a `notarize` block for macOS) and silently builds unsigned if they're
unset — no config error either way.

**Decision: ship signing-ready but unsigned by default.** The scaffold's
`electron-builder` config and release CI already read from the standard
env-var names; this doc documents the activation path ("buy a cert / enroll
in Apple Developer, add these secrets, signing turns on") without the
engine owning any certificate cost or acquisition. Same accepted-gap
treatment as `pixelyph` today, but structured so enabling signing later is
additive configuration, not a rewrite.

## Steam build/page requirements

Split the same way as the deploy-mechanics and signing decisions above:
mechanical/scriptable pieces belong in this doc; per-project identity and
business/marketing tasks are a reference note pointing at Steamworks'
partner site, not something this doc designs.

**In scope**:
- **Depot structure**: one depot per OS platform, mapping directly onto
  `electron-builder`'s existing per-platform build output — no new
  structure invented.
- **Branch convention**: a `default` (public) branch plus a `beta` branch
  for staged rollout before promoting to `default`.
- **Upload script**: a `steamcmd` + VDF (`app_build.vdf` /
  `depot_build_N.vdf`) template with placeholder app/depot IDs, wired into
  a CI job shaped like the existing `release.yml`/itch-`butler` pattern —
  credentials via a CI secret, the same shape as `BUTLER_API_KEY`.
- **`steam_appid.txt`** for local dev — see the IPC section above.

**Out of scope, reference-note only**: the Steam Direct fee and app ID
issuance, store page capsule art/trailer/screenshots/description, pricing,
and age ratings — Steamworks-partner-site business/account tasks an author
handles before any of the above applies, the same way this doc wouldn't
design itch.io's own project-creation UI.

## Open items carried forward

- **Actual certificates/credentials** — signing and Steam app/depot IDs are
  inherently per-author; this doc designs the config shape, not the
  acquisition process.
- **`electron-updater` for direct-download distribution** — deferred per
  the update-strategy section; revisit once a game has signing turned on
  and direct-download is a channel that matters for it.
- **Store page marketing assets** — explicitly out of scope, per the Steam
  section above; same treatment would apply to an itch.io page's own
  marketing content if that ever needed design attention.
