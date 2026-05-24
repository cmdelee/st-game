# LCARS Dual-Deck Tactical Suite — Developer Reference

## Project overview

Single-page Star Trek tactical combat simulator set aboard the **USS Defiant (NX-74205)**. The player commands either the **Tactical station** or **Engineering station**; the unchosen station is delegated to the computer. All game logic lives across **8 files** served from the same directory — no build step, no bundler.

**File load order (matters — each file depends on the previous):**
```
state.js → engineering.js → tactical.js → canvas.js → ui.js → main.js
lcars.css (stylesheet)
index.html (HTML shell + script tags)
```

---

## File responsibilities

| File | Responsibility |
|---|---|
| `state.js` | `C` colour palette, `DIFFICULTY`, `ENEMY_CONFIGS`, `ARRAYS_DICTIONARY`, `CREW_STATIONS`, `WARP_CORE`, `ABLATIVE_ARMOUR` constants; `G` game state object; `getWarpOutput()`, `getTotalAllocatedPower()`, `setDifficulty()`, `postLogEvent()` |
| `engineering.js` | Warp core trip, emergency battery, ablative armour processing, shield regen rate calculation, repair queue, engineering matrix UI, power allocation (`tuneBusAllocation`), EPS conduit conduction, system degradation thresholds, shield manipulation |
| `tactical.js` | Burst-fire salvo, shield frequency rotation, crew casualties, emergency warp, all player weapon fire (`fireSelectedArray`), damage application (`applyDamageToEnemy`), player cloaking, scan profiles, enemy subsystem targeting, enemy cloaking AI, sensor ghosts, new mechanics timers, Jem'Hadar ramming, enemy AI loop (`processEnemyAI`), enemy fire (`executeThreatCounterVolley`), auto-delegation |
| `canvas.js` | All four canvas renders: spatial view (ships, torpedoes, stars), enemy schematic (silhouette + system nodes + readout panel), hull schematic (Defiant outline + ablative rings + system nodes), power distribution (EPS bars) |
| `ui.js` | Deck switching (`toggleActiveDeck`), global UI sync (`synchronizeGlobalInterfaceDisplays`), scoring (`calculateFinalScore`), end-game (`concludeSimulationRun`) |
| `main.js` | Main game loop (`masterSimulationCoreLoop`), simulation init (`initiateVesselSimulation`), boot sequence (`runMasterBootSequence`) |

---

## Global state — key G fields

```js
G.running / G.dead                    // game lifecycle
G.playerChosenStation                 // 'tactical' | 'engineering'
G.activePanel                         // same — drives canvas and UI selection

// Player
G.player.hull / G.player.maxHull      // 500 base (scaled by difficulty)
G.player.torpedoes / G.player.maxTorpedoes  // 18 (reduced from 30 — see changes)
G.player.shields                      // { fore:320, port:260, starboard:260, aft:200, maxSectorValue:320 }

// Systems (11 total)
G.systems[key]                        // { health, allocatedPower, cap, stress, tripped, label, isWeapon }
  // keys: cannon_pu, cannon_pl, cannon_su, cannon_sl, nose_beam, torpedoes,
  //       shields, sensors, engines, cloak_dev, warp_core

// Enemy
G.enemyArchetype                      // string key into ENEMY_CONFIGS
G.enemySystems                        // deep copy of cfg.systems at game start
G.threat.hull / G.threat.maxHull
G.threat.shields                      // { fore, port, starboard, aft } — set from cfg at init
G.threat.fireInterval                 // ms between enemy shots
G.threat.lockRate                     // enemy lock build speed
G.threat.recoveryCoefficient          // hull regen per second

// Cloaking (player)
G.cloaked / G.cloakCooldown / G.cloakVulnTimer
G.cloakPowerReserve / G.cloakPowerDrainRate   // 4%/s drain
G.frozenShields                       // shield values captured at cloak engage

// Cloaking (enemy)
G.enemyCloaked / G.enemyCloakCooldown / G.enemyCloakVulnTimer
G.enemyCloakPower / G.enemyCloakEngagedAt
G.enemyFrozenShields

// Shield regen
G.shieldRegenRate                     // calculated by recalculateShieldRegenRate()
G.shieldUnderAttackTimer              // 3000ms suppression after any hit (down from 5000)

// Ablative armour
G.ablative = { layers, layerHealth[5], regenTimers[5], regenProgress[5] }
  // 5 layers, each absorbs 60% of hull damage (ABLATIVE_ARMOUR.layerAbsorption)
  // consumed layer: 45s cooldown then 30s regen

// New mechanics (see Realism Changes below)
G.burstFireReady / G.burstFireCooldown        // 12s cooldown
G.shieldFreqActive / G.shieldFreqTimer / G.shieldFreqCooldown / G.shieldFreqWeaponType
G.enemyRangeBracket                    // 'long'|'medium'|'close' (Klingon)
G.enemyRangeTimer
G.enemyRammingRun / G.enemyRammingTimer        // Jem'Hadar
G.plasmaTorpedoReady / G.plasmaTorpedoReloadTimer  // Romulan
G.enemyAdaptiveResist                  // { cannon_pu, cannon_pl, ... } — Borg per-weapon 0-1
G.enemyAdaptiveHits                    // legacy counter for regen scaling

// Scanning / targeting
G.lockProgress                         // 0-100 player targeting lock
G.targetedSubsystemType                // 'hull'|'shields'|system key
G.activeScanProfile / G.scanAnalysisProgress
G.scanBonus                            // { type, value, expiry } | null
G.weaponsDisrupted / G.weaponsDisruptedTimer

// Scoring
G.score = { totalDmgDealt, volleysFired, hullBreaches, systemsDestroyed, repairsCompleted, timeSurvived, warpedOut }
```

---

## Enemy configs — key properties

Each entry in `ENEMY_CONFIGS`:
```js
{
  label, faction, era, description,
  hull, maxHull,
  shields: { fore, port, starboard, aft, maxSectorValue },
  hasCloakDevice, recoveryCoefficient, fireInterval, lockRate,
  preferredTargets,            // array of sectors enemy likes to hit
  // Optional flags:
  prefersCloseRange,           // Klingon — closes range over time
  closeRangeDmgBonus,          // damage multiplier at close range (1.35–1.4)
  hasSensorGhosts,             // Romulan — generates false sensor contacts
  plasmaReloadTime,            // ms reload after plasma torpedo fires
  polaronWeapons,              // Dominion — bypasses 30% of shields
  adaptiveShields,             // Borg — shields regen faster per hit, per-weapon resistance
  canRam,                      // Jem'Hadar — attempts ramming < 20% hull
  ramDamage,                   // collision damage dealt (absorbed by ablative first)
  systems: { [key]: { health, label, isWeapon, firingArc, dmgMin, dmgMax, systemTargetKey, isTorpedo?, isPolaron?, isTractor? } }
}
```

### Enemy roster

| Key | Label | Faction | Notable |
|---|---|---|---|
| `ktinga` | K'Tinga Battle Cruiser | Klingon | Cloak, closes range, +40% close-range disruptors |
| `vor_cha` | Vor'Cha Attack Cruiser | Klingon | Cloak, wing disruptors, +35% close-range |
| `romulan_bop` | Romulan Bird-of-Prey | Romulan | Cloak, sensor ghosts, plasma torp 18s reload |
| `romulan_warbird` | D'Deridex Warbird | Romulan | Cloak, sensor ghosts, plasma torp 22s reload, massive hull |
| `cardassian_scout` | Cardassian Scout | Cardassian | Fast lock, high fire rate, low damage |
| `galor_class` | Galor-Class Warship | Cardassian | Torpedoes, no cloak |
| `jem_hadar_fighter` | Jem'Hadar Attack Ship | Dominion | Polaron bypass, ramming (280 dmg) |
| `jem_hadar_battleship` | Jem'Hadar Battle Cruiser | Dominion | Heavy polaron, ramming (380 dmg) |
| `borg_probe` | Borg Probe | Borg | Adaptive shields (per-weapon resistance), tractor beam |

### Enemy pools by difficulty
- **Normal:** ktinga, romulan_bop, cardassian_scout, galor_class, jem_hadar_fighter, vor_cha
- **Hard:** ktinga, vor_cha, romulan_bop, romulan_warbird, galor_class, jem_hadar_fighter, jem_hadar_battleship
- **Elite:** vor_cha, romulan_warbird, jem_hadar_battleship, borg_probe

---

## Player weapons — ARRAYS_DICTIONARY

| Key | Label | Yield | Cost | Arc | System |
|---|---|---|---|---|---|
| `cannon_port_upper` | Port Upper Pulse Cannon | 18 | 20 | fore, port | cannon_pu |
| `cannon_port_lower` | Port Lower Pulse Cannon | 18 | 20 | fore, port, aft | cannon_pl |
| `cannon_stbd_upper` | Stbd Upper Pulse Cannon | 18 | 20 | fore, starboard | cannon_su |
| `cannon_stbd_lower` | Stbd Lower Pulse Cannon | 18 | 20 | fore, starboard, aft | cannon_sl |
| `emitter_nose` | Heavy Nose Array Emitter | **55** | 50 | fore | nose_beam |
| `torpedo_fore` | Forward Quantum Tube | 90 | 85 | fore, port, starboard | torpedoes |

Quantum torpedo damage is **binary** (not lock-scaled like energy weapons):
- ≥60% lock → 85–115% of yield (clean hit)
- <60% lock → 45–65% of yield (glancing impact)

---

## Difficulty multipliers

| Setting | Enemy Hull | Enemy Dmg | Enemy Lock | Enemy Fire | Player Hull | Targets Systems | Repair Speed |
|---|---|---|---|---|---|---|---|
| Normal | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | No | ×1.0 |
| Hard | ×1.3 | ×1.25 | ×1.4 | ×0.8 | ×0.8 | Yes (25%) | ×0.8 |
| Elite | ×1.6 | ×1.5 | ×1.8 | ×0.65 | ×0.65 | Yes (45%) | ×0.6 |

---

## Shield & power values (current)

```
Player shields:  fore 320 | port 260 | starboard 260 | aft 200 | maxSectorValue 320
Shield regen:    sp/9 * health_pct  →  28MW=3.1/s, 60MW=6.7/s (min 0.5)
Attack suppression: 3000ms (regen pauses after any hit)

Default EPS allocations (114MW / 120MW total — 6MW headroom):
  cannon_pu: 8  cannon_pl: 8  cannon_su: 8  cannon_sl: 6
  nose_beam: 10  torpedoes: 10
  shields: 28  sensors: 16  engines: 10  cloak_dev: 0  warp_core: 10
```

---

## Key mechanics

### Ablative armour
- 5 layers, each absorbs **60%** of incoming hull damage
- Layer degrades per hit: `absorbed/30 * 20` cost to layer health
- Consumed layer: 45s cooldown → 30s regen
- Visible as concentric rings on hull schematic canvas, strip on tactical panel

### Burst-fire salvo (`executeBurstFireSalvo`)
- Fires all 4 pulse cannons in 800ms (200ms stagger between each)
- Requires ≥20% lock, cannons to have charge, no cloak/tractor
- 12s recharge between salvos
- Designed to overwhelm shield regen before it can respond

### Shield frequency rotation (`rotateShieldFrequency`)
- Detects enemy dominant weapon type from cfg.systems
- Applies 25% incoming damage reduction for 12s
- 30s cooldown after
- Types: disruptors | phasers | polaron | plasma

### Quantum torpedo behaviour
- Binary damage — doesn't gracefully scale with lock like phasers
- Forces tactical decision: wait for 60% lock or fire glancing shot now
- Can blind-fire at cloaked enemy at 40% yield (in-flight torpedo tracking)

### Borg per-weapon adaptation
- Each weapon system key tracks resistance independently in `G.enemyAdaptiveResist`
- Increases by 0.06 per hit, caps at 0.75 (75% resistance)
- Player must rotate through all 6 weapon types
- Legacy `enemyAdaptiveHits` counter still drives shield regen scaling

### Klingon close-range
- `prefersCloseRange` enemies accumulate `G.enemyRangeTimer`
- 20s → medium bracket; 45s → close bracket
- At close: disruptors get `closeRangeDmgBonus` (1.35–1.4×), prioritised over torpedoes
- Enemy manoeuvre log and status display show range bracket

### Romulan plasma reload
- After firing plasma torpedo, `G.plasmaTorpedoReady = false`
- `plasmaTorpedoReloadTimer` counts down (18000 or 22000ms)
- During reload, Romulan falls back to phasers/disruptors
- Enemy schematic shows reload timer

### Jem'Hadar ramming
- Triggers when enemy hull < 20% via random check (0.008 probability per 60fps frame)
- 4s countdown shown on spatial canvas with trajectory line
- Impact applies `cfg.ramDamage` through ablative armour
- Destroys both vessels (or just Jem'Hadar if Defiant survives)
- Inflicts 2 crew casualties regardless

### Cloaking (player)
- 1200ms vulnerability window on engage AND disengage (no shields, extra damage taken)
- Shields frozen at cloak value; regen credit accumulates while cloaked
- On decloak: shields restored to frozen value + accumulated regen
- 25s cooldown after decloak; cloak power drains at 4%/s

### Cloaking (enemy)
- Triggers at hull < 40% or critical system down + hull < 65%
- Romulan `cloakAggressiveness` multiplier makes them cloak more readily
- Repairs happen faster while cloaked (1.0× vs 0.3× repair speed)
- On decloak: 1500ms vulnerability window, shields partially restored from frozen + regen

### Sensor ghosts (Romulan)
- Only fires when enemy is cloaked AND enemy sensor system is healthy
- Random 3–7s ghost contact shown on spatial canvas
- Log event fires on appearance

### EPS conduit system
- Stress builds above 40MW per system; trips breaker at 100% stress
- Capacitor charges at `allocatedPower * 0.6 * (health/100)` per second
- Warp core trip scales all allocations to impulse budget (40MW)
- Emergency battery: 100% charge, drains at 3.3%/s, recharges at 1.2%/s when core online

### Repair queue
- Dispatch time: `max(5000, (damage/10) * 5000)` ms
- Drain rate in loop: `dt * crewEfficiency * repairSpeedMult`
- `repairSpeedMult` applied once only (in loop drain, not in queue creation)
- On completion: restores 80% of missing health, clears tripped state

---

## Bugs fixed (chronological)

1. **Enemy always hits same shield sector** — `applyDamageToEnemy` used `reduce` to always find weakest sector. Now weapon arc intersected with enemy preferred targets picks sector randomly from valid pool.
2. **Repair button destroyed on every tick** — `refreshEngineeringPanelGraphics` rebuilt entire table innerHTML 60×/s, killing button event listeners. Fixed with `data-mode` attribute tracking — only updates changed cells.
3. **Ablative armour missing** — fully implemented in `engineering.js` (`applyAblativeArmour`, `processAblativeArmour`).
4. **Shield power → regen not updating** — formula was too conservative and not updated on all code paths. Now `sp/9 * health_pct`, updated immediately on every `recalculateShieldRegenRate()` call.
5. **Engineering player near-unwinnable** — auto-tactical only fired pulse cannons. Now also fires nose beam (50% chance) and torpedoes (25% chance when stock > 5) each cycle.
6. **Firing through cloak** — energy weapons now explicitly blocked when enemy fully cloaked; only torpedoes can blind-fire at 40% yield.
7. **repairSpeedMult applied twice** — was dividing repair time in queue creation AND multiplying drain rate in loop (squared effect). Removed from queue creation; drain rate is sole scaling point.
8. **null weapon crash on blind torpedo impact** — `weapon.parentSystem` access in scan bonus check and `renderedBeamsVector` push guarded with `if (weapon)`.
9. **G.threat.shields undefined pre-game** — enemy shield sector bars now guard with `G.running && G.threat.shields`.
10. **Weapons scan bonus never cleared** — `G.scanBonus` now nulled when `weaponsDisruptedTimer` expires in `processEnemyAI`.
11. **Maneuver threshold re-rolled every frame** — `Math.random()` in condition evaluated 60×/s. Fixed: `G.enemyManeuverThreshold` stored in state, refreshed only on trigger.
12. **Double requestAnimationFrame loop** — `initiateVesselSimulation` was calling rAF on top of the boot loop's rAF. Removed.
13. **cloak_dev auto-restore gets 10MW** — `def[key] || 10` is falsy for 0. Fixed with `hasOwnProperty.call(def, key) ? def[key] : 10`.
14. **Weapons disruption 4× fire penalty** — `commitScanProfile` doubled `fireInterval` AND main loop doubled it again. Removed redundant doubling from `commitScanProfile`.
15. **Breaker grid rebuilt 60×/s** — optimised with `tripSig` string; only rebuilds on state change, updates health in-place otherwise.

---

## Realism additions (chronological)

### Shield values (Defiant canon accuracy)
- Fore: **320** (was 150) — Defiant fights bow-on
- Port/Starboard: **260** (was 150)
- Aft: **200** (was 150)
- Shield regen suppression: **3000ms** (was 5000ms) — regenerative shields per canon
- Base shield power: **28MW** (was 20MW)

### Weapon rebalance
- Nose beam yield: **55** (was 30) — heavy emitter should feel heavy
- Nose beam cost: **50** (was 35)
- Torpedo magazine: **18** (was 30) — DS9 Defiant was frequently torpedo-limited
- Default sensor allocation: **16MW** (was 20MW) — gives 6MW EPS headroom

### Burst-fire salvo
- `executeBurstFireSalvo()` in `tactical.js`
- 4-cannon staggered barrage in 800ms; 12s recharge
- Button: "⚡⚡ BURST SALVO — 4-CANNON BARRAGE" in tactical panel

### Shield frequency rotation
- `rotateShieldFrequency()` in `tactical.js`
- Detects dominant weapon type, 25% damage reduction for 12s, 30s cooldown
- Button: "🛡 ROTATE FREQ" in tactical panel

### Quantum torpedo binary damage
- ≥60% lock: clean hit, full yield ±15%
- <60% lock: glancing impact, ~55% yield
- No gradual scaling — torpedoes either intercept cleanly or don't

### Borg per-weapon adaptation
- `G.enemyAdaptiveResist` tracks resistance per weapon key (0–0.75)
- Builds 0.06 per hit; player must rotate weapons
- Enemy schematic shows per-weapon resistance percentages

### Klingon close-range preference
- K'Tinga and Vor'Cha close over 45s (long → medium → close)
- Close bracket: +35–40% disruptor damage, disruptors prioritised
- Status display shows range bracket

### Romulan plasma torpedo reload
- 18s (Bird-of-Prey) or 22s (D'Deridex) reload after firing
- Falls back to phasers during reload
- Enemy schematic shows reload countdown

### Romulan cloaking aggressiveness
- Romulans use cloak more tactically — `cloakAggressiveness` multiplier on random check
- *(Pending implementation — noted for next session)*

### Jem'Hadar ramming
- Triggers at < 20% enemy hull (random check)
- 4s countdown with trajectory line on spatial canvas
- 280–380 damage through ablative armour; destroys enemy; 2 crew casualties

### Tactical advisories
- `postTacticalAdvisory()` prefixes log with "WORF: "
- Fires on: Klingon range bracket change, plasma recharge, enemy hull critical, ramming run

---

## Pending items (for next session)

All 10 items from the previous review have been implemented. See "Recent changes" below.

---

## Recent changes (this session)

1. **Player shields reset between games** — `G.player.shields` now reset to `{fore:320,port:260,starboard:260,aft:200,maxSectorValue:320}` in `initiateVesselSimulation` (`main.js`)
2. **Torpedo count reset** — `G.player.torpedoes` and `maxTorpedoes` reset to **18** at game start (`main.js`)
3. **Auto-delegation power table updated** — shields restored to 28MW, sensors to 16MW (`tactical.js` `processAutomatedDelegation`)
4. **Romulan cloaking aggressiveness** — `cloakAggressiveness` multiplier 2.5× for Romulan faction on cloak trigger check (`tactical.js` `processEnemyCloakDecision`)
5. **Lock collapses on enemy cloak** — player lock drops to 15% of current value immediately when enemy fully cloaks, then slow 4/s decay (`tactical.js` `processEnemyAI`)
6. **Sector-weighted internal damage** — fore breach → fore weapons (cannon_pu/su, nose_beam, torpedoes, sensors); port → port cannons + shields; stbd → stbd cannons + shields; aft → engines/warp/cloak (`tactical.js` `executeThreatCounterVolley`)
7. **Borg escalating threat arc** — milestone log messages at 1/3/5 fully-adapted weapons with authentic Borg dialogue; advisory fires when all primary weapons adapted (`tactical.js` `processEnemyAI`)
8. **Emergency warp threshold** — raised from 20% to **35%** hull; label updated to match (`tactical.js`)
9. **Cardassian scout fire interval** — reduced from 2800ms to **2200ms** (`state.js`)
10. **Burst-fire visual feedback** — `burst_flash` beacon pushed to `G.renderedBeamsVector`; expanding white ring rendered on spatial canvas during burst window (`tactical.js`, `canvas.js`)

---

## Canvas layout

```
Tactical view:     spatial canvas (left, 1.2fr) + enemy schematic (right, 0.8fr)
Engineering view:  hull schematic (left, 1.2fr) + power distribution (right, 0.8fr)
```

Canvas renders are gated: tactical canvases only render when `G.activePanel === 'tactical'` and vice versa.

Enemy schematic right-side readout panel reads from `G.threat` and `G.enemySystems` — sensor health degrades display accuracy (< 40% = "???", 40–70% = approximate, ≥70% = exact).

---

## HTML structure (index.html)

```
#overlay          — startup modal + end-game score display
#sensor-ghost-overlay  — Romulan ghost alert (fixed top-right)
#cloak-vuln-overlay    — full-screen purple tint during transition
header            — brand + accent line
.main-viewport    — flex row
  .left-anchor-panel   — LCARS nav pills + enemy readouts + our lock
  .center-operations-deck
    .top-monitor-row   — 2 canvases (tactical or engineering)
    #eng-utility-panel — engineering strip (battery, cloak, shields, damage control, ablative, repair queue, auto-tac summary)
    #deck-tactical     — weapon bars, ablative strip, health strip, cloak status, fire buttons, subsystem target grid, scan profiles, crew
    #deck-engineering  — power table + breaker grid
  .right-telemetry-tower  — hull bar, torpedoes, shield sector bars, system health, warp/cloak power footer
```

---

## CSS classes of note

| Class | Purpose |
|---|---|
| `.nav-pill-btn.active` | White highlight on active station nav |
| `.control-deck-plate.active-deck` | Shows tactical or engineering deck |
| `.monitor-frame.active-monitor` | Shows correct canvas pair |
| `.tripped-relay-alert` | Flashing red animation on tripped breaker |
| `.pill-action-btn.red-btn/.warn-btn/.green-btn/.p-btn` | Colour variants |
| `#ablative-armour-strip` | Green layer indicator strip on tactical panel |
| `#cloak-status-bar` | Purple status bar shown during cloak states |
| `#sensor-ghost-overlay` | Flashing amber ghost contact alert |
| `#cloak-vuln-overlay` | Full-screen purple flash during transition |
