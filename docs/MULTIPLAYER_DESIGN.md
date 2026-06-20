# Networked Multiplayer — Design / Plan

> Status: **design only** (not implemented). Goal: let several players each man a
> bridge station (Tactical / Engineering / Helm / Captain) of the *same* ship,
> each on their own device. Co-op vs the AI enemy — no PvP.

## 1. Why this codebase is well-suited

- **All four stations already run every frame.** Unmanned ones are driven by
  `processAutomatedDelegation` (auto-delegation.js). "Manning" a station over the
  network = replacing that station's auto-delegation with a remote player's
  inputs. **That seam is the entire feature.**
- **Single state object `G`** (state.js) — mostly numbers/strings/small
  arrays, so it serializes to JSON. Three.js mesh handles live in
  `canvas-three.js` module scope, *not* in `G`, so `G` stays serializable.
- **Sim and render are already ~90% separated** — subsystem ticks
  (`computeConduitConduction`, `processEnemyAI`, `executeThreatCounterVolley`, …)
  mutate `G`; render functions (`synchronizeGlobalInterfaceDisplays`,
  `renderSpatialViewCanvas`, the 2D canvases) only read it.
- **Every player action is already a function call** (button `onclick` →
  `fireSelectedArray`, `applyPowerPreset`, `setHelmSpeed`, `divertPowerToWeapons`,
  captain `cap*` orders, …). Forwarding those calls is the input protocol.

## 2. Chosen model — host-authoritative input forwarding

One client is the **host**: it runs the authoritative `G` and the full sim loop,
and may also man a station. Every other client is a **terminal**: it renders only
the shared view + its station's panels, runs **no sim**, and sends its button
presses to the host. The host applies them and broadcasts state snapshots.

Why this model (not lockstep / not peer state-merge):
- **Co-op → no anti-cheat needed**, so a trusted host is fine.
- The sim uses `Math.random` and `setTimeout` heavily; **lockstep** would need
  seeded RNG + deterministic timers across clients — fragile. Host-authoritative
  means only the host runs RNG/timers, so **no determinism work is required**.
- UI panels change a few times/sec; only the 3D view is smooth, and that
  smoothness already comes from the render loop **lerping** mesh positions toward
  targets derived from `G` — so a terminal can render smoothly off snapshots
  arriving at ~15 Hz.

## 3. Transport

**MVP: WebRTC via PeerJS** (free public signaling cloud; data is P2P).
- Host opens a room → gets a short room code. Terminals join by code.
- Star topology: host holds one `DataChannel` per terminal.
- **No backend to deploy** — fits the static GitHub Pages hosting.
- Risk: NAT traversal can fail on some networks (needs a TURN server, which is
  not free). Document a fallback.

**Fallback / alternative: a tiny relay** — PartyKit, Cloudflare Durable Objects,
Supabase Realtime, or Ably. More reliable than P2P NAT, but requires deploying a
small service (and possibly cost). Same message protocol; only the transport
swaps. Keep transport behind an interface so this is a drop-in change.

## 4. Message protocol (small, JSON over DataChannel)

Terminal → Host:
- `join { name, requestedStation }`
- `input { station, action, args, seq }` — `action` is a whitelisted function
  name; `seq` for ordering/ack.
- `ping { t }`

Host → All:
- `welcome { youAre, crew }` / `crew_update { crew }` — station assignments
  (`crew = { tactical:{name}|null, engineering:…, helm:…, captain:… }`).
- `snapshot { tick, g }` at ~15 Hz — the synced subset of `G` (see §6).
- `event { kind, … }` — one-shots that must not be dropped between snapshots:
  weapon-beam fired, torpedo impact, explosion, log line, audio cue. Drives
  terminal-side visuals/audio reliably.
- `pong { t }`
- `bye { station, reason }` — a terminal left → station reverts to auto.

Host validates every `input`: the sender must own `station`, and `action` must be
in that station's allow-list. The real game functions still enforce cooldowns /
arcs / lock, so validation is mostly ownership + allow-list.

## 5. Refactors required (in dependency order)

1. **Split the loop.** In `main.js`, factor `masterSimulationCoreLoop` into:
   - `simStep(dt)` — all state-mutating subsystem calls + enemy fire cycle
     (host only).
   - `renderStep()` — `synchronizeGlobalInterfaceDisplays` + the canvas renders
     (everyone). Already mostly separated; just formalise the boundary.
2. **Per-station control map.** Replace the single `G.playerChosenStation` notion
   with `G.stationControl = { tactical:'auto'|'local'|'remote', … }`.
   `processAutomatedDelegation` already keys off "unmanned"; change its guards to
   *"run auto only where control === 'auto'"*. **This also delivers local
   shared-screen co-op for free.**
3. **Input dispatcher.** A `dispatchAction(station, fnName, args)` that local play
   calls through too (single code path): host/local → invoke from a registered
   action table; terminal → send `input` message. Build the action allow-list per
   station from the existing button handlers.
4. **`G` (de)serialization.** `serializeG()` → the synced subset (§6);
   `applySnapshot(g)` on terminals merges it into their local `G`. Transient
   visual arrays are handled via `event` messages, not the snapshot.
5. **`netplay.js`** (new module, loads late): PeerJS setup, lobby, connection
   state, message handlers, input queue, snapshot send/recv, ping/latency.
6. **Lobby UI** (in `index.html` / `setup.js`): Host Game (show code) / Join Game
   (enter code + pick an open station), crew roster with connection dots, "start
   when ready". Reuses the existing setup overlay.

## 6. State sync detail

- **Snapshot = a curated subset of `G`**, not the whole thing. Include: `player`,
  `threat`, `systems`, `pack`/`packActive`, shields, `score`, cloak/cooldown
  timers, `enemy*` AI state needed for rendering, `stationControl`, `crewReports`
  tail, and the engineering/helm/captain readout fields. Exclude transient
  effect buffers (`renderedBeamsVector`, `damageParticles`) — send those as
  `event`s so they fire exactly once on each terminal.
- **Rate:** 15 Hz baseline. Optimise later with **delta snapshots** (only changed
  fields) — `G` is flat enough that a shallow diff is easy and cuts bandwidth a
  lot. Full snapshot is a few KB; fine on LAN/good links for the MVP.
- **Terminal render:** runs its own RAF `renderStep()` off the latest snapshot.
  The 3D view stays smooth because `renderSpatialViewCanvas` lerps toward
  `G`-derived targets; beams/impacts come from the `event` channel.
- **Local input feedback:** optional optimism — a terminal can show "firing…" on
  click, confirmed/overwritten by the next snapshot. For button-based play,
  ~50–150 ms round-trip is unnoticeable, so optimism is optional.

## 7. Authority & edge cases

- **Host authoritative** — RNG, `setTimeout`, conclude/victory all run host-side
  only. Terminals never mutate `G` except by applying snapshots.
- **Terminal disconnect** → its station's `stationControl` flips back to `'auto'`;
  `processAutomatedDelegation` resumes it seamlessly (graceful degradation, the
  exact behaviour that already exists).
- **Host disconnect** → game ends for the MVP (host migration is out of scope).
- **Reconnect** → terminal rejoins the room, re-takes its (or an open) station,
  resumes from the next snapshot.
- **Pause/lobby** → host holds `G.running=false` until all assigned crew signal
  ready.

## 8. Phasing

- **Phase 0 (prereq, also = local co-op):** loop split (§5.1) + `stationControl`
  map (§5.2) + input dispatcher (§5.3). Ship local shared-screen co-op here.
- **Phase 1:** PeerJS lobby — host/join, station assignment, crew roster.
- **Phase 2:** snapshot broadcast + terminal render-only loop; **one** remote
  terminal manning **one** station end-to-end.
- **Phase 3:** all four stations, the `event` channel (beams/impacts/log/audio),
  disconnect→auto fallback, latency display.
- **Phase 4 (optional):** delta snapshots, TURN/relay fallback for hard NATs,
  host migration, spectator mode.

## 9. Risks

- **NAT traversal (WebRTC)** — some networks need TURN (a paid relay). Mitigation:
  the relay-transport fallback (§3).
- **Bandwidth** — full 15 Hz snapshots add up with 3 terminals; mitigate with the
  curated subset + delta snapshots.
- **Terminal 3D smoothness** — relies on render-loop lerping + the event channel;
  validate early in Phase 2.
- **Complexity / maintenance** — this turns a zero-dependency static app into a
  networked one. Keep `netplay.js` and the transport interface isolated so
  single-player stays untouched when the network is off (`stationControl` all
  `'local'`/`'auto'` = today's game, no net code paths hit).

## 10. Smallest viable first step

Phase 0 alone is worth doing regardless of networking: it cleanly separates
sim/render and generalises station control, **delivering local shared-screen
co-op** and laying every foundation networked play needs. Recommend building
Phase 0 first, then deciding on WebRTC vs relay before Phase 1.
