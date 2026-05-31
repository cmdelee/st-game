# LCARS Dual-Deck Tactical Suite — Developer Reference

## Project overview

Single-page Star Trek tactical combat simulator set aboard the **USS Defiant (NX-74205)**. The player commands the **Tactical**, **Engineering**, or **Helm** station; the unchosen stations are delegated to the computer. All game logic lives across **9 files** served from the same directory — no build step, no bundler.

**File load order (matters — each file depends on the previous):**
```
state.js → engineering.js → tactical.js → helm.js → canvas.js → ui.js → main.js
lcars.css (stylesheet)
index.html (HTML shell + script tags)
```

---

## File responsibilities

| File | Responsibility |
|---|---|
| `state.js` | `C` colour palette, `DIFFICULTY`, `ENEMY_CONFIGS`, `ARRAYS_DICTIONARY`, `CREW_STATIONS`, `WARP_CORE`, `ABLATIVE_ARMOUR`, `HELM_SPEED_CONFIG` constants; `G` game state object; `getWarpOutput()`, `getTotalAllocatedPower()`, `setDifficulty()`, `postLogEvent()` |
| `engineering.js` | Warp core trip, emergency battery, ablative armour processing, shield regen rate calculation, repair queue (2 independent teams), engineering matrix UI, power allocation (`tuneBusAllocation`), EPS conduit conduction + thermal buildup, system degradation thresholds, shield manipulation |
| `tactical.js` | Burst-fire salvo, shield frequency rotation, evasive pattern, crew casualties + role effects, emergency warp, all player weapon fire (`fireSelectedArray`), damage application (`applyDamageToEnemy`), player cloaking, scan profiles (4 types), enemy subsystem targeting, enemy cloaking AI, sensor ghosts, mechanics timers (`processNewMechanicsTimers` — delegates helm timers to `processHelmTimers`), Jem'Hadar ramming, enemy AI loop (`processEnemyAI`), enemy fire (`executeThreatCounterVolley`), auto-delegation (both tactical and engineering auto-fire when at helm) |
| `helm.js` | Helm timer processing (`processHelmTimers`), speed control (`setHelmSpeed`), attack vector (`setHelmAttackVector`), engagement range (`setPlayerRangeBracket`), attack run (`executeAttackRun`), come about (`executeComeAbout`), helm panel UI (`updateHelmPanel`) |
| `canvas.js` | Three.js 3D spatial battle view (ships, weapon beams, torpedoes, particles, engine glow — glow intensity + Defiant drift scale with helm speed); enemy schematic 2D canvas (silhouette + system nodes + readout panel); hull schematic 2D canvas (Defiant outline + ablative rings + system nodes); power distribution 2D canvas (EPS bars + thermal) |
| `ui.js` | Deck switching (`toggleActiveDeck` — handles tactical/engineering/helm), global UI sync (`synchronizeGlobalInterfaceDisplays`), scoring with hull integrity bonus (`calculateFinalScore`), end-game (`concludeSimulationRun`) |
| `main.js` | Main game loop (`masterSimulationCoreLoop`), simulation init with full state reset (`initiateVesselSimulation`), boot sequence (`runMasterBootSequence`) |

---

## Global state — key G fields

```js
G.running / G.dead                    // game lifecycle
G.playerChosenStation                 // 'tactical' | 'engineering' | 'helm'
G.activePanel                         // same — drives canvas and UI selection

// Player
G.player.hull / G.player.maxHull      // 500 base (scaled by difficulty)
G.player.torpedoes / G.player.maxTorpedoes        // quantum: 18 per game
G.player.photonTorpedoes / G.player.maxPhotonTorpedoes  // photon: 12 per game
G.player.shields    // { fore:320, port:260, starboard:260, aft:200, maxSectorValue:320 }

// Systems (11 total)
G.systems[key]  // { health, allocatedPower, cap, stress, tripped, label, isWeapon }
  // keys: cannon_pu, cannon_pl, cannon_su, cannon_sl, nose_beam, torpedoes,
  //       shields, sensors, engines, cloak_dev, warp_core

// Enemy
G.enemyArchetype                      // string key into ENEMY_CONFIGS
G.enemySystems                        // deep copy of cfg.systems at game start
G.threat.hull / G.threat.maxHull
G.threat.shields                      // { fore, port, starboard, aft }
G.threat.fireInterval / G.threat.lockRate / G.threat.recoveryCoefficient

// Cloaking (player)
G.cloaked / G.cloakCooldown / G.cloakVulnTimer  // cloakVulnDuration = 1200ms
G.cloakPowerReserve / G.cloakPowerDrainRate      // 4%/s drain
G.frozenShields                       // shield values captured at cloak engage

// Cloaking (enemy)
G.enemyCloaked / G.enemyCloakCooldown / G.enemyCloakVulnTimer
G.enemyCloakPower / G.enemyCloakEngagedAt / G.enemyFrozenShields

// Shield regen
G.shieldRegenRate                     // sp/9 * health_pct; 28MW→3.1/s, 60MW→6.7/s
G.shieldUnderAttackTimer              // 3000ms suppression after any hit
G.shieldTransferInProgress            // true during 2s shield equalisation delay

// Ablative armour — 6 layers
G.ablative = { layers, layerHealth[6], regenTimers[6], regenProgress[6] }
  // each layer absorbs 60% of incoming hull damage
  // consumed layer: 45s cooldown → 30s regen
  // layer cost per hit: (absorbed/40)*20 (gentler than original /30 formula)

// EPS thermal buildup
G.epsHeat                             // 0-100; >70 reduces cap recharge up to 30%
G.epsHeatCoolRate                     // 8/s passive cooling

// Faction-specific enemy mechanics
G.enemyRangeBracket                   // 'long'|'medium'|'close' (Klingon auto-closes)
G.enemyRangeTimer                     // accumulates; brackets at 20s/45s
G.enemyRammingRun / G.enemyRammingTimer  // Jem'Hadar ramming (4s countdown)
G.plasmaTorpedoReady / G.plasmaTorpedoReloadTimer  // Romulan 18/22s reload
G.enemyAdaptiveResist  // { cannon_pu, cannon_pl, cannon_su, cannon_sl, nose_beam, torpedoes, photon }
G.enemyAdaptiveHits    // legacy counter for Borg regen scaling

// Player tactical mechanics
G.burstFireReady / G.burstFireCooldown   // 12s cooldown
G.shieldFreqActive / G.shieldFreqTimer / G.shieldFreqCooldown / G.shieldFreqWeaponType
G.evasiveActive / G.evasiveCooldown / G.evasiveDuration / G.evasiveCooldownTime

// Helm station state
G.helmSpeed            // 'stop'|'maneuvering'|'half'|'full' — affects enemy lock + player yield
G.helmAttackVector     // 'fore'|'port'|'starboard'|'aft' — 65% chance enemy hits this sector
G.playerRangeBracket   // 'long'|'medium'|'close' — weapon damage modifiers + 3D distance
G.attackRunActive / G.attackRunTimer / G.attackRunCooldown   // 8s active, 20s CD
G.comeAboutActive / G.comeAboutTimer / G.comeAboutCooldown   // 3s rotate, 18s CD

// Scanning / targeting
G.lockProgress                         // 0-100 player targeting lock
G.targetedSubsystemType                // 'hull'|'shields'|system key
G.activeScanProfile / G.scanAnalysisProgress
G.scanBonus                            // { type, value, expiry } | null
G.weaponsDisrupted / G.weaponsDisruptedTimer
G.lastPlayerFireTime                   // timestamp; drives hull regen advisory

// Scoring
G.score = { totalDmgDealt, volleysFired, hullBreaches, systemsDestroyed,
            repairsCompleted, timeSurvived, warpedOut }
```

---

## Enemy configs — key properties

```js
{
  label, faction, era, description,
  hull, maxHull,
  shields: { fore, port, starboard, aft, maxSectorValue },
  hasCloakDevice, recoveryCoefficient, fireInterval, lockRate,
  preferredTargets,
  // Optional flags:
  prefersCloseRange,     // Klingon — closes range, disruptors strengthen
  closeRangeDmgBonus,    // ×1.35–1.4 at close range
  hasSensorGhosts,       // Romulan — false sensor contacts while cloaked
  plasmaReloadTime,      // ms reload after plasma torpedo fires
  polaronWeapons,        // Dominion — bypasses 30% of shields
  adaptiveShields,       // Borg — per-weapon resistance + faster regen
  canRam,                // Jem'Hadar — ramming attack < 20% hull
  ramDamage,             // collision damage through ablative
}
```

### Enemy roster

| Key | Label | Faction | Notable |
|---|---|---|---|
| `ktinga` | K'Tinga Battle Cruiser | Klingon | Cloak, closes range, +40% close disruptors |
| `vor_cha` | Vor'Cha Attack Cruiser | Klingon | Cloak, wing disruptors, +35% close |
| `romulan_bop` | Romulan Bird-of-Prey | Romulan | Cloak (2.5× aggression), sensor ghosts, plasma 18s reload |
| `romulan_warbird` | D'Deridex Warbird | Romulan | Cloak (2.5× aggression), sensor ghosts, plasma 22s reload |
| `cardassian_scout` | Cardassian Scout | Cardassian | 2200ms fire rate, fast lock, no cloak |
| `galor_class` | Galor-Class Warship | Cardassian | Torpedoes, no cloak |
| `jem_hadar_fighter` | Jem'Hadar Attack Ship | Dominion | Polaron bypass, ramming 280 dmg |
| `jem_hadar_battleship` | Jem'Hadar Battle Cruiser | Dominion | Heavy polaron, ramming 380 dmg |
| `borg_probe` | Borg Probe | Borg | Per-weapon adaptation 0–75%, tractor beam, escalating dialogue |

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
| `emitter_nose` | Heavy Nose Array Emitter | **55** | 50 | fore only | nose_beam |
| `torpedo_quantum` | Forward Quantum Tube | 90 | 85 | fore, port, stbd | torpedoes |
| `torpedo_photon` | Photon Torpedo Tube | 60 | 30 | fore, port, stbd | torpedoes |

**Quantum torpedo damage is binary:**
- ≥60% lock → 85–115% of yield (clean hit)
- <60% lock → 45–65% of yield (glancing)
- Blind-fire at cloaked enemy → 40% yield

**Photon torpedo:** reliable flat damage, no lock scaling, no lock required to fire.

**Helm range modifiers** (applied in `fireSelectedArray` after base damage):
- Torpedoes: long +15%, close −10%
- Pulse cannons: close +20% (or attackRunActive), long −10%
- Nose beam: close +10%, long −10%

---

## Difficulty multipliers

| Setting | Enemy Hull | Enemy Dmg | Enemy Lock | Enemy Fire | Player Hull | Targets Systems | Repair Speed |
|---|---|---|---|---|---|---|---|
| Normal | ×1.0  | ×1.0  | ×1.0 | ×1.0  | ×1.0  | No        | ×1.0  |
| Hard   | ×1.2  | ×1.15 | ×1.3 | ×0.85 | ×0.85 | Yes (20%) | ×0.85 |
| Elite  | ×1.35 | ×1.28 | ×1.5 | ×0.78 | ×0.78 | Yes (30%) | ×0.72 |

---

## Shield & power values (current)

```
Player shields:  fore 320 | port 260 | starboard 260 | aft 200 | maxSectorValue 320
Shield regen:    sp/9 * health_pct  →  28MW=3.1/s, 60MW=6.7/s (min 0.5)
Attack suppression: 3000ms (regen pauses after any hit)
Equalisation delay: 2s transfer, shields dip to 80% during switch

Default EPS allocations (114MW / 120MW — 6MW headroom):
  cannon_pu:8  cannon_pl:8  cannon_su:8  cannon_sl:6
  nose_beam:10  torpedoes:10
  shields:28  sensors:16  engines:10  cloak_dev:0  warp_core:10
```

---

## Key mechanics

### Helm station (helm.js)

The helm station runs both **auto-tactical** (computer fires weapons) and **auto-engineering** (computer restores breakers and assigns repair teams) simultaneously. The player controls four parameters:

#### Speed control — `HELM_SPEED_CONFIG`
| Setting | Enemy Lock Mult | Player Yield Mult |
|---|---|---|
| ALL STOP | ×1.35 (harder to miss) | ×1.10 (stable platform) |
| MANEUVERING | ×1.10 | ×1.00 |
| HALF IMPULSE *(default)* | ×0.85 | ×0.97 |
| FULL IMPULSE | ×0.65 | ×0.88 |

Engine glow intensity and Defiant drift amplitude in the 3D view both scale with helm speed. Full impulse stresses engines +15 on activation.

#### Attack vector — `G.helmAttackVector`
Sets which of our shield faces the enemy. In `executeThreatCounterVolley`, 65% of enemy fire hits the selected sector (normal fire) or 65% (fallback non-torpedo shots). Disabled during come-about (all sectors equally exposed).

#### Engagement range — `G.playerRangeBracket`
Controls 3D enemy ship distance (min of player and enemy brackets). Weapon damage multipliers applied in `fireSelectedArray`. Locked to 'close' during an active attack run; resets to 'medium' when run expires.

#### Helm manoeuvres
| Action | Effect | Cooldown |
|---|---|---|
| **Attack Run** | 8s cannon +20%, closes to combat range; engine stress +35; resets to medium range on expiry | 20s |
| **Come About** | 3s rotation, all sectors exposed; auto-presents strongest shield sector on completion | 18s |
| **Evasive Pattern Delta** | Enemy lock rate −60% for 8s; engine stress +25 | 20s |
| **Emergency Warp** | Escape (hull ≤35% required) | — |

### Ablative armour
- **6 layers** (was 5), each absorbs **60%** of incoming hull damage
- Layer cost per hit: `(absorbed/40)*20` — layers last ~33% longer than original
- Consumed layer: 45s cooldown → 30s regen
- Visible as concentric arcs on hull schematic, strip on tactical panel

### Burst-fire salvo (`executeBurstFireSalvo`)
- All 4 cannons fire in 800ms window (200ms stagger); 12s recharge
- Requires ≥20% lock; ≥1 cannon charged; no cloak/tractor
- Pushes `burst_flash` to `renderedBeamsVector` → expanding white ring on canvas

### Shield frequency rotation (`rotateShieldFrequency`)
- Detects enemy dominant weapon type (disruptors/phasers/polaron/plasma)
- 25% incoming damage reduction for 12s; 30s cooldown
- Applied in `executeThreatCounterVolley` via `shieldFreqActive` check

### Evasive Pattern Delta (`executeEvasivePattern`)
- Reduces enemy lock build rate by 60% (full helm) for 8s; 20s cooldown
- Burns engine stress +25 points
- Helm crew status scales effectiveness via `getHelmEvasiveModifier()`:
  - Nominal → 0.4× lock rate (60% reduction)
  - Wounded → 0.6× (40% reduction)
  - Incapacitated → 0.8× (20% reduction)

### EPS thermal buildup
- Each weapon shot adds `weapon.cost * 0.12` heat to `G.epsHeat` (0–100)
- Cools passively at 8/s
- Above 70%: capacitor recharge penalised up to 30% (`heatPenalty` in conduit loop)
- Log warning fires periodically at high heat

### Quantum torpedo (binary)
- ≥60% lock: clean hit, full yield ±15%
- <60% lock: glancing, ~55% yield
- Does not scale gradually with lock like energy weapons

### Scan profiles (4 types)
| Profile | Effect | Duration | Note |
|---|---|---|---|
| Shields | +25% weapon yield vs shields | 25s | Energy weapons only |
| Fissures | +35% all damage | 20s | All weapons |
| Disrupt | −50% enemy fire rate | 30s | Via `G.weaponsDisrupted` + main loop 2× fi |
| Tetryon | −70% enemy lock rate | 15s | Stacks with evasive pattern |

### Borg per-weapon adaptation
- `G.enemyAdaptiveResist[weaponKey]` tracks 0–0.75 resistance per weapon
- Builds +0.06 per hit; damage multiplied by `(1 - resist)`
- Enemy schematic shows per-weapon resistance %
- Milestone Borg dialogue at 1/3/5 fully-adapted weapons

### Klingon close-range
- `prefersCloseRange` enemies: 20s → medium, 45s → close bracket (`G.enemyRangeBracket`)
- Close bracket: `closeRangeDmgBonus` (×1.35–1.4) on disruptors; disruptors prioritised
- Worf advisory fires on bracket change
- 3D view: enemy closes in (min of `G.enemyRangeBracket` and `G.playerRangeBracket`)

### Romulan cloaking aggressiveness
- `cloakAggressiveness = 2.5` for Romulan faction on cloak trigger check
- Romulans cloak much more readily than Klingons; repairs faster while cloaked

### Romulan plasma torpedo
- After firing: `G.plasmaTorpedoReady = false`; timer counts down (18/22s)
- Falls back to phasers/disruptors during reload
- Enemy schematic shows reload countdown

### Jem'Hadar ramming
- Random check (0.008/frame) when hull < 20%
- 4s countdown on canvas with trajectory line + RAMMING RUN text
- `cfg.ramDamage` (280/380) through ablative; destroys enemy ship
- 2 crew casualties regardless of survival

### Cloaking (player)
- 1200ms vulnerability window on engage AND disengage
- Shields frozen at cloak; regen credit accumulates while cloaked
- On decloak: shields = frozen + (regenRate × cloakSecs)
- 25s cooldown; power drains at 4%/s

### Cloaking (enemy)
- Triggers at hull < 40% or critical system down + hull < 65%
- Romulan: 2.5× more likely to cloak
- Player lock collapses to 15% of current value immediately on full cloak, then −4/s
- On decloak: 1500ms vuln window; shields partially restored

### Sensor ghosts (Romulan)
- Only when enemy cloaked AND sensors healthy
- 3–7s ghost contact on spatial canvas
- `G.sensorGhostActive` drives canvas and left-panel overlay

### EPS conduit system
- Stress builds above 40MW/system; trips breaker at 100%
- Cap charges: `allocatedPower * 0.6 * (health/100) * heatPenalty` per second
- Warp core trip scales allocations to impulse budget (40MW)
- Auto-delegation restores tripped systems (tactical/helm player)

### Warp core restart (gradual)
- After repair completes, health ramps from `repaired - 60` to full over 12s
- EPS output climbs gradually; second log fires when complete

### Repair queue (2 independent teams — Alpha / Beta)
- Time: `max(5000, (damage/10) * 5000)` ms base
- Drain: `dt * crewEfficiency('engineering') * repairSpeedMult`
- Completes at 80% of missing health restored; clears tripped
- Auto-assigned when player is at tactical or helm

### Shield equalisation
- 2s transfer delay; shields dip to 80% during EPS conduit switching
- `G.shieldTransferInProgress` prevents double-trigger

### Crew role effects
| Station | Crew | Wounded | Incapacitated |
|---|---|---|---|
| Tactical | Worf | 65% fire efficiency | 30% fire efficiency |
| Engineering | O'Brien | 65% repair speed | 30% repair speed |
| Helm | Nog | Evasive: 40% reduction | Evasive: 20% reduction |
| Medical | Bashir | Casualty threshold ×0.7 | Casualty threshold ×0.4 |

### Enemy hull regen advisory
- `G.lastPlayerFireTime` stamped on every `fireSelectedArray` call
- If >10s pause and enemy hull < 90%, Worf advisory fires
- Spam-protected: internal reset after advisory

### Sector-weighted internal damage
On shield breach, random system drawn from sector pool:
- Fore → cannon_pu, cannon_su, nose_beam, torpedoes, sensors
- Port → cannon_pu, cannon_pl, shields, sensors
- Starboard → cannon_su, cannon_sl, shields, sensors
- Aft → engines, warp_core, cloak_dev, cannon_pl, cannon_sl

---

## Scoring

```js
total = timeBonus + dmgBonus + sysBonus + repBonus + integrityBonus
        - hullPen - warpPen - crewPen + vicBonus

integrityBonus = hullPct * 800 * diffMult   (victory only)
vicBonus       = 1500 * diffMult             (victory, not escaped)
diffMult       = 1.0 / 1.4 / 2.0            (normal/hard/elite)
```

---

## Bugs fixed (all sessions, chronological)

1. Enemy always hits same shield sector — fixed arc+preferred-target pool selection
2. Repair button destroyed on every tick — fixed with `data-mode` attribute tracking
3. Ablative armour missing — fully implemented
4. Shield power → regen not updating — formula corrected; called on all paths
5. Engineering player near-unwinnable — auto-tactical fires nose beam + torpedoes
6. Firing through cloak — energy weapons blocked when enemy fully cloaked
7. repairSpeedMult applied twice — removed from queue creation; drain rate only
8. Null weapon crash on blind torpedo impact — `weapon &&` guards added
9. G.threat.shields undefined pre-game — `G.running &&` guard in ui.js
10. Weapons scan bonus never cleared — nulled in `processEnemyAI` on timer expiry
11. Maneuver threshold re-rolled every frame — stored in `G.enemyManeuverThreshold`
12. Double requestAnimationFrame loop — removed from `initiateVesselSimulation`
13. cloak_dev auto-restore gets 10MW — `hasOwnProperty` check for falsy 0
14. Weapons disruption 4× fire penalty — removed redundant doubling from `commitScanProfile`
15. Breaker grid rebuilt 60×/s — `tripSig` string gates rebuild
16. Helm attack run had no cooldown — `G.attackRunCooldown = 20000` was never set in `executeAttackRun`; after the 8s window the run could be immediately re-fired
17. Helm range not restored after attack run — `G.playerRangeBracket` stayed at 'close' permanently; now resets to 'medium' on expiry
18. Dead "Quantum Torpedo" button — `fireSelectedArray('torpedo_fore')` called a non-existent ARRAYS_DICTIONARY key; fixed to `'torpedo_quantum'`
19. Helm panel rendered twice per frame — `synchronizeGlobalInterfaceDisplays` now skips `updateHelmPanel` when a helm timer (`attackRunActive` / `comeAboutActive`) is already driving it that frame

---

## Player actions available

### Tactical panel

| Button | Function | Constraint |
|---|---|---|
| ⚡ All Pulse Cannons ×4 | `firePulseCannons()` | Cap charged |
| Nose Beam [FWD] | `fireSelectedArray('emitter_nose')` | Fore arc, cap charged |
| Quantum Torpedo | `fireSelectedArray('torpedo_quantum')` | ≥5% lock, torpedoes > 0 |
| Photon Torpedo | `fireSelectedArray('torpedo_photon')` | No lock required |
| ⚡⚡ BURST SALVO | `executeBurstFireSalvo()` | ≥20% lock, 12s CD |
| ◉ ENGAGE CLOAK | `toggleCloakingDevice()` | Health ≥20%, no cooldown |
| 🛡 ROTATE FREQ | `rotateShieldFrequency()` | 30s CD |
| ◈ EVASIVE PATTERN | `executeEvasivePattern()` | Engines ≥20%, 20s CD |
| ALPHA SALVO | `executeAlphaSalvoFire()` | All weapons |
| 🛡 Shields scan | `activateScanProfile('shields')` | 100% analysis first |
| 💥 Fissures scan | `activateScanProfile('hull')` | 100% analysis first |
| ⚡ Disrupt scan | `activateScanProfile('weapons')` | 100% analysis first |
| 〜 Tetryon scan | `activateScanProfile('tetryon')` | 100% analysis first |
| Reinforce Fore | `pumpShieldSector('fore')` | Not cloaked |
| Equalise | `rebalanceShieldArrays()` | Not cloaked, 2s delay |
| ⚡ EMERGENCY WARP | `attemptEmergencyWarp()` | Hull ≤35%, core online |

### Helm panel

| Button | Function | Constraint |
|---|---|---|
| Speed (4 settings) | `setHelmSpeed(speed)` | Any time |
| Attack Vector (4 dirs) | `setHelmAttackVector(sector)` | Not during come-about |
| Range (3 settings) | `setPlayerRangeBracket(range)` | Not during attack run |
| ◈ EVASIVE DELTA | `executeEvasivePattern()` | Engines ≥20%, 20s CD |
| ◈ ATTACK RUN | `executeAttackRun()` | Engines ≥25%, 20s CD |
| ↺ COME ABOUT | `executeComeAbout()` | Engines ≥20%, 18s CD |
| ⚡ EMERGENCY WARP | `attemptEmergencyWarp()` | Hull ≤35%, core online |

---

## Canvas layout

```
Tactical view:     3D spatial battle view (Three.js, left 1.2fr) + enemy schematic 2D (right 0.8fr)
Engineering view:  hull schematic 2D (left 1.2fr) + power distribution 2D (right 0.8fr)
Helm view:         reuses tactical monitors (3D spatial + enemy schematic)
```

**3D spatial view** (Three.js): Defiant and enemy meshes, engine glow (scales with helm speed for Defiant), weapon beams (colour-coded by weapon type), torpedo spheres, particle sparks, starfield, grid plane, nebula planes. Enemy drift amplitude and range distance update every frame from `G.enemyRangeBracket` / `G.playerRangeBracket` (minimum of both).

Enemy schematic right panel: hull, faction, cloak status, polaron/adaptive/Klingon range/plasma reload/ramming/ghost indicators, shields ×4 sectors, all enemy systems.

---

## HTML structure

```
#overlay               — startup modal + difficulty + end-game score
                         (3 start buttons: COMMAND TACTICAL, CONTROL ENGINEERING, FLY HELM)
#sensor-ghost-overlay  — Romulan ghost alert (fixed top-right, animated)
#cloak-vuln-overlay    — full-screen purple tint during cloak transition
header                 — brand + accent line + stardate + mission context
.main-viewport         — flex row
  .left-anchor-panel   — LCARS nav pills (Tactical / Engineering / Helm) + enemy readouts + our lock bar
  .center-operations-deck
    .top-monitor-row   — 2 canvases (view-tactical + view-helm share spatial/schematic pair;
                         view-engineering shows hull/power pair)
    #eng-utility-panel — battery, cloak, shield regen, damage control, ablative,
                         repair queue, auto-tac summary (engineering mode only)
    #deck-tactical     — capacitor bars, ablative strip, weapon health strip,
                         cloak status bar, fire buttons, subsystem target grid,
                         scan profiles (4), crew status, emergency warp
    #deck-engineering  — power allocation table + breaker grid
    #deck-helm         — speed control (4 buttons), attack vector (4 buttons),
                         engagement range (3 buttons), tactical manoeuvres (4 buttons),
                         auto-tactical summary, auto-engineering summary, live status line
  .right-telemetry-tower — hull bar, quantum + photon torpedoes, shield sector bars ×4,
                           system health bars ×11, warp + cloak power footer
```

---

## CSS classes of note

| Class | Purpose |
|---|---|
| `.nav-pill-btn.active` | White highlight on active station nav |
| `.control-deck-plate.active-deck` | Shows tactical, engineering, or helm deck |
| `.monitor-frame.active-monitor` | Shows correct canvas pair |
| `.tripped-relay-alert` | Flashing red animation on tripped breaker |
| `.pill-action-btn.red-btn/.warn-btn/.green-btn/.p-btn` | Colour variants |
| `#ablative-armour-strip` | Green layer indicator on tactical panel |
| `#cloak-status-bar` | Purple bar shown during cloak states |
| `#sensor-ghost-overlay` | Flashing amber Romulan ghost alert |
| `#cloak-vuln-overlay` | Full-screen purple flash during transition |
| `#btn-burst-fire` | Updated by `synchronizeGlobalInterfaceDisplays` |
| `#btn-shield-freq` | Updated by `updateShieldFreqButton` |
| `#btn-evasive` | Updated by `updateEvasiveButton` |
| `#btn-helm-speed-*` | White glow when active speed; updated by `updateHelmPanel` |
| `#btn-helm-vector-*` | White/blue glow when active; shows live shield MW |
| `#btn-helm-range-*` | White/orange glow when active; updated by `updateHelmPanel` |
| `#lbl-helm-range-status` | Live status line: speed label, lock mod%, yield mod%, vector, range |

---

## Pending items

None — all reviewed suggestions implemented.
