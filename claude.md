# LCARS Dual-Deck Tactical Suite — Developer Reference

## Project overview

Single-page Star Trek tactical combat simulator set aboard the **USS Defiant (NX-74205)**. The player commands the **Tactical**, **Engineering**, **Helm**, or **Captain's Chair** station; the unchosen stations are delegated to the computer. All game logic lives across **13 JS files** served from the same directory — no build step, no bundler.

**File load order (matters — each file depends on the previous):**
```
config.js → state.js → engineering.js → crew.js → sensors.js → tactical.js →
helm.js → enemy-ai.js → command.js → canvas-three.js → canvas-2d.js → ui.js → main.js
lcars.css (stylesheet)
index.html (HTML shell + script tags)
```

---

## File responsibilities

| File | Responsibility |
|---|---|
| `config.js` | All game constants: `C` colour palette, `DIFFICULTY`, `ENEMY_CONFIGS`, `ARRAYS_DICTIONARY`, `CREW_STATIONS`, `WARP_CORE`, `ABLATIVE_ARMOUR`, `HELM_SPEED_CONFIG`; `let currentDifficulty` |
| `state.js` | `G` game state object; `getWarpOutput()`, `getTotalAllocatedPower()`, `setDifficulty()`, `postLogEvent()` |
| `engineering.js` | Warp core trip, emergency battery, ablative armour processing, shield regen rate calculation, repair queue (2 independent teams), engineering matrix UI, power allocation (`tuneBusAllocation`), power presets (`applyPowerPreset`), EPS conduit conduction + thermal buildup, system degradation thresholds, shield manipulation |
| `crew.js` | Crew casualties (`inflictCrewCasualty`), efficiency modifiers (`getCrewEfficiency`, `getMedicalEfficiency`, `getHelmEvasiveModifier`), `updateCrewStatusDisplay`, `attemptEmergencyWarp`, `updateWarpAvailability`, `postTacticalAdvisory` |
| `sensors.js` | Scan profiles (`activateScanProfile`, `commitScanProfile`), active sensor toggle, enemy subsystem target grid (`buildEnemySubsystemTargetGrid`, `setEnemyTarget`) |
| `tactical.js` | Player weapons only: burst-fire salvo, shield frequency rotation, evasive pattern, `fireSelectedArray`, `applyDamageToEnemy`, overload modes (overcharge/unstable torp/power dump), player cloaking (`toggleCloakingDevice`) |
| `helm.js` | Helm timer processing (`processHelmTimers`), speed control (`setHelmSpeed`), attack vector (`setHelmAttackVector`), engagement range (`setPlayerRangeBracket`), attack run, come about, Picard Manoeuvre, Attack Pattern Omega, Evasive Pattern Alpha, helm panel UI (`updateHelmPanel`) |
| `enemy-ai.js` | Enemy cloaking AI (`processEnemyCloakDecision`, `triggerEnemyCloak/Decloak`), sensor ghosts, all mechanics timers (`processNewMechanicsTimers` — delegates to `processHelmTimers`), Jem'Hadar ramming, enemy AI loop (`processEnemyAI`), enemy fire (`executeThreatCounterVolley`), full auto-delegation (`processAutomatedDelegation`) |
| `command.js` | Captain's Chair: crew report feed (`postCrewReport`), captain overview panels (`updateCaptainOverview`), order cooldown table (`_CAP_CD`), all captain order functions (40+), new manoeuvres (Hold Fire, Auto Shield Track, Silent Running, Emergency Thrusters), manoeuvre ticker (`tickCaptainManoeuvres`), periodic + event-driven crew reports, `initCaptainStation()` |
| `canvas-three.js` | Three.js 3D spatial battle view (ships, weapon beams, torpedoes, particles, engine glow, starfield) |
| `canvas-2d.js` | Enemy schematic 2D canvas (silhouette + system nodes); hull schematic 2D canvas (Defiant outline + ablative rings); power distribution 2D canvas (EPS bars + thermal) |
| `ui.js` | Deck switching (`toggleActiveDeck` — handles tactical/engineering/helm/captain), global UI sync (`synchronizeGlobalInterfaceDisplays`), scoring with hull integrity bonus (`calculateFinalScore`), end-game (`concludeSimulationRun`) |
| `main.js` | Main game loop (`masterSimulationCoreLoop`), simulation init with full state reset (`initiateVesselSimulation`), boot sequence (`runMasterBootSequence`), captain manoeuvre tickers, splash screen (`dismissSplash`) |

---

## Global state — key G fields

```js
G.running / G.dead                    // game lifecycle
G.playerChosenStation                 // 'tactical' | 'engineering' | 'helm' | 'captain'
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
  // layer cost per hit: (absorbed/40)*20

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
G.overchargeReady / G.overchargeCooldown           // 30s CD
G.unstableTorpReady / G.unstableTorpCooldown       // 35s CD
G.powerDumpReady / G.powerDumpTimer / G.powerDumpCooldown  // 10s active, 50s CD

// Helm station state
G.helmSpeed            // 'stop'|'maneuvering'|'half'|'full' — affects enemy lock + player yield
G.helmAttackVector     // 'fore'|'port'|'starboard'|'aft' — 65% chance enemy hits this sector
G.playerRangeBracket   // 'long'|'medium'|'close' — weapon damage modifiers + 3D distance
G.attackRunActive / G.attackRunTimer / G.attackRunCooldown       // 8s active, 20s CD
G.comeAboutActive / G.comeAboutTimer / G.comeAboutCooldown       // 3s rotate, 18s CD
G.picardManoeuverActive / G.picardManoeuverTimer / G.picardManoeuverCooldown  // 3s active, 60s CD
G.attackPatternOmegaActive / G.attackPatternOmegaTimer / G.attackPatternOmegaCooldown  // 10s active, 45s CD
G.evasiveAlphaActive / G.evasiveAlphaTimer / G.evasiveAlphaCooldown  // 5s active, 15s CD

// Scanning / targeting
G.lockProgress                         // 0-100 player targeting lock
G.targetedSubsystemType                // 'hull'|'shields'|system key
G.activeScanProfile / G.scanAnalysisProgress
G.scanBonus                            // { type, value, expiry } | null
G.weaponsDisrupted / G.weaponsDisruptedTimer
G.lastPlayerFireTime                   // timestamp; drives hull regen advisory

// Captain's Chair
G.crewReports[]                        // rolling feed of { crew, text, type, ts }
G.captainOrderCooldowns{}              // per-order CD map keyed by _CAP_CD keys
G.captainPeriodicTimer                 // countdown to next periodic crew report
G.holdFire / G.holdFireTimer           // 8s auto-tactical suppression
G.autoShieldTrack / G.autoShieldTrackTimer  // 15s auto attack vector
G.silentRunning / G.silentRunningTimer      // 12s enemy lock −40%

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
| `borg_probe` | Borg Probe | Borg | Per-weapon adaptation 0–65%, tractor beam, escalating damage |

### Enemy pools by difficulty
- **Normal:** ktinga, romulan_bop, cardassian_scout, galor_class, jem_hadar_fighter, vor_cha
- **Hard:** ktinga, vor_cha, romulan_bop, romulan_warbird, galor_class, jem_hadar_fighter, jem_hadar_battleship
- **Elite:** vor_cha, romulan_warbird, jem_hadar_battleship, borg_probe

---

## Player weapons — ARRAYS_DICTIONARY

Arcs are **enforced** — `fireSelectedArray` blocks a weapon if `G.helmAttackVector` is not in `weapon.arc`. Fire buttons dim and become unclickable when out of arc. The "All Pulse Cannons" button label dynamically shows how many cannons currently bear.

| Key | Label | Yield | Cost | Arc | System |
|---|---|---|---|---|---|
| `cannon_port_upper` | Port Upper Pulse Cannon | **22** | 20 | fore | cannon_pu |
| `cannon_port_lower` | Port Lower Pulse Cannon | **22** | 20 | fore, port | cannon_pl |
| `cannon_stbd_upper` | Stbd Upper Pulse Cannon | **22** | 20 | fore | cannon_su |
| `cannon_stbd_lower` | Stbd Lower Pulse Cannon | **22** | 20 | fore, starboard | cannon_sl |
| `emitter_nose` | Heavy Nose Array Emitter | **65** | 50 | fore only | nose_beam |
| `torpedo_quantum` | Fwd Quantum Tube | **125** | 85 | fore, port, starboard | torpedoes |
| `torpedo_photon` | Fwd Photon Tube | 60 | 30 | fore, port, starboard | torpedoes |
| `torpedo_quantum_aft` | Aft Quantum Tube | **125** | 85 | aft, port, starboard | torpedoes |
| `torpedo_photon_aft` | Aft Photon Tube | 60 | 30 | aft, port, starboard | torpedoes |

**Arc coverage by attack vector:**
- FORE: all 4 cannons + nose + fwd quantum + fwd photon (maximum firepower)
- PORT: port-lower cannon + fwd quantum + fwd photon + aft quantum + aft photon
- STARBOARD: stbd-lower cannon + fwd quantum + fwd photon + aft quantum + aft photon
- AFT: aft quantum + aft photon only (all cannons and nose silent)

Aft tubes share the same `torpedoes` parent system (same magazine, same power, same health). The `isQuantum`/`isPhoton` flags on the weapon entry drive all magazine/damage logic in `fireSelectedArray` — key names are not used for branching.

**Quantum torpedo damage is binary:**
- ≥60% lock → 85–115% of yield (clean hit)
- <60% lock → 45–65% of yield (glancing)
- Blind-fire at cloaked enemy → 40% yield (works from both tubes)

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

`systemTargetChance` lives in the DIFFICULTY config; `processAutomatedDelegation` uses `diff.systemTargetChance` (was hardcoded 0.45/0.25).

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

### Power presets (`POWER_PRESETS` / `applyPowerPreset(name)`)
| Preset | Purpose | Notable allocation changes |
|---|---|---|
| `attack` | Maximum weapons | Weapons maxed, shields/sensors reduced |
| `silent` | Cloak-ready profile | Engines/sensors cut, cloak_dev powered |
| `evasive` | Engine + shield priority | Engines maxed, weapons reduced |
| `damage_control` | Survival mode | Shields maxed, sensors boosted, weapons minimal |

Scales automatically when warp core is offline (impulse budget 40MW).

---

## Key mechanics

### Captain's Chair (command.js)

The 4th station. All three stations run on full auto-delegation simultaneously. Crew act autonomously and report in via the comms feed; captain issues orders to override or time key abilities.

**Crew comms feed:** `postCrewReport(crew, text, type)` — colour-coded by speaker (Worf=orange, O'Brien=blue, Nog=pink). Shows 3 most recent entries. 15+ event-driven hooks fire on: shield hits, hull breaches, enemy cloak/decloak, system trips, repair completions, warp core trips, ramming runs, Klingon range closing, scan commits, weapons disrupted/restored, attack run/come-about completion, low hull.

**Captain order cooldowns** (`_CAP_CD`): matched to full ability cycle (active time + game CD + 1s comms overhead). Buttons grey out with countdown seconds while cooling.

**Autonomous crew behaviors (captain mode only):**
- **Worf:** auto burst-fire (lock >55%), auto evasive (enemy lock >88%), auto rotate shield freq (sustained fire)
- **O'Brien:** auto-activates battery on warp core trip, auto-equalises shields when sector drops <15% of max
- **Nog:** auto-presents strongest shield sector when current facing <10% of max, occasional auto attack run

**Captain-exclusive manoeuvres:**
| Order | Effect | CD |
|---|---|---|
| Hold Fire | Suppresses auto-tactical fire for 8s | 20s |
| Auto Shield Track | Nog auto-presents strongest shield sector for 15s | 30s |
| Silent Running | Enemy lock rate −40% for 12s; drops to maneuvering speed | 40s |
| Emergency Thrusters | Enemy lock −35%, player lock −15%, engine stress +20 | 25s |

### Helm station (helm.js)

The helm station runs both **auto-tactical** and **auto-engineering** simultaneously. The player controls speed, attack vector, range, and manoeuvres.

#### Speed control — `HELM_SPEED_CONFIG`
| Setting | Enemy Lock Mult | Player Yield Mult |
|---|---|---|
| ALL STOP | ×1.35 | ×1.10 (stable platform) |
| MANEUVERING | ×1.10 | ×1.00 |
| HALF IMPULSE *(default)* | ×0.85 | ×0.97 |
| FULL IMPULSE | ×0.65 | ×0.88 |

Engine glow intensity and Defiant drift amplitude in the 3D view both scale with helm speed. Full impulse stresses engines +15 on activation.

#### Helm manoeuvres
| Action | Effect | Cooldown |
|---|---|---|
| **Attack Run** | 8s cannon +20%, closes to combat range; engine stress +35; resets to medium on expiry | 20s |
| **Come About** | 3s rotation, all sectors exposed; auto-presents strongest shield on completion | 18s |
| **Evasive Pattern Delta** | Enemy lock rate −60% for 8s; engine stress +25 | 20s |
| **Picard Manoeuvre** | Micro-warp jump; enemy cannot lock or fire for 3s | 60s |
| **Attack Pattern Omega** | All weapons +40% for 10s; incoming damage +20% | 45s |
| **Evasive Pattern Alpha** | Enemy lock rate −50% for 5s; maximum evasion | 15s |
| **Emergency Warp** | Escape (hull ≤35% required) | — |

### Overload weapon modes (tactical.js)
| Mode | Effect | Risk | Cooldown |
|---|---|---|---|
| **Cannon Overcharge** | All cannon yield +50% for next salvo | Breaker trip on each cannon | 30s |
| **Unstable Torpedo** | Quantum yield +70% | 25% misfire (damages player) | 35s |
| **Emergency Power Dump** | All weapons +40% for 10s, EPS spike | Shields −30% during active window | 50s |

### Ablative armour
- **6 layers**, each absorbs **60%** of incoming hull damage
- Layer cost per hit: `(absorbed/40)*20`
- Consumed layer: 45s cooldown → 30s regen
- Visible as concentric arcs on hull schematic, strip on tactical panel

### Burst-fire salvo (`executeBurstFireSalvo`)
- All 4 cannons fire in 800ms window (200ms stagger); 12s recharge
- Requires ≥20% lock; ≥1 cannon charged; no cloak/tractor
- Pushes `burst_flash` to `renderedBeamsVector` → expanding white ring on canvas

### Shield frequency rotation (`rotateShieldFrequency`)
- Detects enemy dominant weapon type (disruptors/phasers/polaron/plasma)
- 25% incoming damage reduction for 12s; 30s cooldown

### EPS thermal buildup
- Each weapon shot adds `weapon.cost * 0.12` heat to `G.epsHeat` (0–100)
- Cools passively at 8/s
- Above 70%: capacitor recharge penalised up to 30% (`heatPenalty` in conduit loop)

### Quantum torpedo (binary)
- ≥60% lock: clean hit, full yield ±15%
- <60% lock: glancing, ~55% yield
- Does not scale gradually with lock like energy weapons

### Scan profiles (4 types)
| Profile | Effect | Duration |
|---|---|---|
| Shields | +25% weapon yield vs shields | 25s |
| Fissures | +35% all damage | 20s |
| Disrupt | −50% enemy fire rate | 30s |
| Tetryon | −70% enemy lock rate | 15s |

### Borg per-weapon adaptation
- `G.enemyAdaptiveResist[weaponKey]` tracks 0–0.65 resistance per weapon
- Builds **+0.024 per hit (28 hits to cap)** — reduced from 0.04 because the Defiant's weapons were specifically engineered to cycle frequency against Borg adaptation (*The Search*); damage multiplied by `(1 - resist)`
- Escalating damage: +10% per level, capped at 2 levels (+20% max)
- Enemy schematic shows per-weapon resistance %
- Milestone dialogue at 1/3/5 fully-adapted weapons

### Klingon close-range
- `prefersCloseRange` enemies: 20s → medium, 45s → close bracket
- Close bracket: `closeRangeDmgBonus` (×1.35–1.4) on disruptors
- 3D view: enemy closes in (min of `G.enemyRangeBracket` and `G.playerRangeBracket`)

### Romulan cloaking aggressiveness
- `cloakAggressiveness = 2.5` for Romulan faction — cloak much more readily

### Romulan plasma torpedo
- After firing: `G.plasmaTorpedoReady = false`; timer counts down (18/22s)
- Falls back to phasers/disruptors during reload

### Jem'Hadar ramming
- Random check (0.008/frame) when hull < 20%
- 4s countdown on canvas with trajectory line + RAMMING RUN text
- `cfg.ramDamage` (280/380) through ablative; destroys enemy ship on impact

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
- Auto-delegation restores tripped systems; captain auto-delegation also activates battery

### Warp core restart (gradual)
- After repair completes, health ramps from `repaired - 60` to full over 12s
- EPS output climbs gradually

### Repair queue (2 independent teams — Alpha / Beta)
- Time: `max(5000, (damage/10) * 5000)` ms base
- Drain: `dt * crewEfficiency('engineering') * repairSpeedMult`
- Completes at 80% of missing health restored; clears tripped
- Auto-assigned when player is at tactical, helm, or captain

### Shield equalisation
- 2s transfer delay; shields dip to 80% during EPS conduit switching

### Crew role effects
| Station | Crew | Wounded | Incapacitated |
|---|---|---|---|
| Tactical | Worf | 65% fire efficiency | 30% fire efficiency |
| Engineering | O'Brien | 65% repair speed | 30% repair speed |
| Helm | Nog | Evasive: 40% reduction | Evasive: 20% reduction |
| Medical | Bashir | Casualty threshold ×0.7 | Casualty threshold ×0.4 |

### Enemy hull milestone events (`checkEnemyHullMilestones` in enemy-ai.js)
Fires once per threshold (75/50/25/10% hull) tracked in `G.enemyHullMilestones{}` (reset on new game). Each threshold fires:
- Faction-specific `postLogEvent` (Klingon war cry, Romulan tactical comment, Cardassian radio dialogue, Jem'Hadar Founders oath, Borg assimilation quote)
- Captain's Chair `postCrewReport` with tactical advisory
- Faction-specific automatic reaction:
  - 10% Klingon → `_triggerKlingonDeathSalvo()` — 3 rapid volleys in 1.1s
  - 25% Romulan → `triggerEnemyCloak()` — forced emergency cloak
  - 25% Dominion → `G.enemyPhaseFireMult` locked to 0.60 maximum

### Jem'Hadar fury scaling
Applied in `masterSimulationCoreLoop` fire cycle. Dominion faction only:
```js
_jemFury = Math.max(0.50, 1.0 - (1.0 - hullPct) * 0.55)
```
At full health: ×1.0 (normal). At 50% hull: ×0.78 (+28% faster fire). At 10% hull: ×0.50 (fire interval halved). "Victory is life — they get more dangerous as they die."

### Romulan instant plasma strike on decloak
In `triggerEnemyDecloak`: if faction is Romulan, phase is 'strike', and `G.plasmaTorpedoReady`, calls `executeThreatCounterVolley()` 800ms after decloak. Creates the terrifying DS9 decloak→immediate plasma torpedo pattern.

### Enemy weapon degradation at low hull
In `processEnemyAI`: below 35% enemy hull, 0.4% chance per frame-second of randomly degrading a live enemy weapon system by 5–17%. Represents internal battle damage spreading. Can destroy weapon systems without player targeting them. Logged as `INTEL:` when health reaches 0.

### Defiant power balance (canon justification)
| Weapon | Yield | Rationale |
|---|---|---|
| Pulse cannons | **22** each | *"Overpowered and overgunned for its size"* — Sisko, *The Search* |
| Nose emitter | **65** | Heavy Type-XII array; decisive precision strike |
| Quantum torpedo | **125** | Specifically designed to exceed Borg shielding; K'Tinga photon torps avg 125 — Defiant quantum must exceed that |
| Photon torpedo | 60 | Reliable, unlimited-use secondary; intentionally weaker |
| Burst fire CD | **9s** | Defiant's rapid burst sequences in DS9 were frequent and characterised its style |
| Borg adaptation | **+0.024/hit** | Weapons cycle frequency engineered against Borg; 28 hits to cap vs 17 previously |

### Sector-weighted internal damage
On shield breach, random system drawn from sector pool:
- Fore → cannon_pu, cannon_su, nose_beam, torpedoes, sensors
- Port → cannon_pu, cannon_pl, shields, sensors
- Starboard → cannon_su, cannon_sl, shields, sensors
- Aft → engines, warp_core, cloak_dev, cannon_pl, cannon_sl

### Warp core cascade failure (`handleWarpCoreTrip`)
On every warp core trip, an EPS backwash stress spike is applied to adjacent systems **before** the power scale-down:
- Engines: +35 stress
- Shields: +22 stress
- Sensors: +15 stress

If any target system's stress reaches 100 and it isn't already tripped, it trips immediately (`sys.tripped = true`), logs `EPS SURGE`, calls `checkSystemDegradationThresholds`, and fires a Captain's chair crew report. This makes triple-system cascade failures possible when an already-stressed ship loses its core.

### Last stand (`checkLastStandCondition` in command.js)
Called every frame from `masterSimulationCoreLoop`. Triggers once when `G.player.hull / G.player.maxHull ≤ 0.20` and `!G.lastStandActive`:
- Sets `G.lastStandActive = true`
- Adds `last-stand-flash` CSS class to `.main-viewport` (pulsing red border animation, 1.2s cycle)
- Fires station-agnostic `postLogEvent` alerts from Worf/O'Brien/Nog
- Captain's chair gets staggered `postCrewReport` calls (800ms / 1600ms delays for dramatic timing)
- **Mechanical:** calls `setHelmSpeed('full')` if not already at full impulse
- **Mechanical:** boosts shield `allocatedPower` by 5MW if warp output has headroom; calls `recalculateShieldRegenRate()`
- Stands down (removes class, logs recovery) when hull climbs back above 25%

State: `G.lastStandActive` / `G.lastStandReported` (reset on new game in `initiateVesselSimulation`)

### Post-battle debrief (`concludeSimulationRun` in ui.js)
The `terminal-transcript-box` now renders a full tactical debrief before the battle log. Data drawn from `G.score` extended fields:

```js
G.score.weaponsFired    // { cannons, nose, quantum, photon } — tracked per shot in fireSelectedArray
G.score.sectorBreaches  // { fore, port, starboard, aft } — incremented on each hull breach
G.score.peakHullHit     // largest single residual hull hit (post-ablative)
G.score.systemsTripped  // array of system keys that tripped during the game
G.score.enemyPhaseReached // last phase name set in _applyPhase()
```

Debrief sections: enemy vessel + faction, phase reached, time in combat, hull at end; weapons fired by type + total yield; breaches per sector + peak hit; systems tripped list; crew status with casualty counts; last 15 battle log entries.

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
16. Helm attack run had no cooldown — `G.attackRunCooldown = 20000` was never set in `executeAttackRun`
17. Helm range not restored after attack run — `G.playerRangeBracket` stayed at 'close' permanently
18. Dead "Quantum Torpedo" button — `fireSelectedArray('torpedo_fore')` → `'torpedo_quantum'`
19. Helm panel rendered twice per frame — `synchronizeGlobalInterfaceDisplays` now skips `updateHelmPanel` when a helm timer is already driving it
20. Enemy attack-vector snap ignoring weapon arc — `arc.includes(G.helmAttackVector)` guard added before the 65% snap in `executeThreatCounterVolley` (both normal and torpedo-charge paths)
21. Enemy torpedoes targeting out-of-arc sectors — torpedo charge now reduces candidate pool to `firingArc` sectors before picking weakest
22. Duplicate "Quantum Torpedo" button in HTML — extra `fireSelectedArray('torpedo_quantum')` button removed
23. `fireSelectedArray` branching on `weaponKey` string — refactored to use `weapon.isQuantum`/`weapon.isPhoton` flags so aft tube variants work without separate code paths
24. 8 enemy weapon arcs were canon-inaccurate — aft-only `['aft']` arcs corrected to `['aft','port','starboard']`; forward torpedo arcs widened to `['fore','port','starboard']`; Borg tractor corrected to omnidirectional
25. Defiant under-powered vs canon — pulse cannons 18→22, nose emitter 55→65, quantum torpedo 90→125, burst fire CD 12s→9s; Borg adaptation rate reduced 40% (weapons engineered to cycle frequency)

---

## Player actions available

### Tactical panel

Weapon buttons dim (`opacity:0.35; pointer-events:none`) when the weapon's arc doesn't include `G.helmAttackVector`. The cannon button relabels dynamically: "⚡ Pulse Cannons ×N IN ARC".

| Button | Function | Constraint |
|---|---|---|
| ⚡ Pulse Cannons ×N | `firePulseCannons()` | In-arc cannons only; cap charged |
| Nose Beam | `fireSelectedArray('emitter_nose')` | Fore arc only; cap charged |
| Fwd Quantum Torpedo | `fireSelectedArray('torpedo_quantum')` | Fore/port/stbd arc; ≥5% lock; torps > 0 |
| Fwd Photon Torpedo | `fireSelectedArray('torpedo_photon')` | Fore/port/stbd arc; no lock required |
| Aft Quantum Torpedo | `fireSelectedArray('torpedo_quantum_aft')` | Aft/port/stbd arc; ≥5% lock; torps > 0 |
| Aft Photon Torpedo | `fireSelectedArray('torpedo_photon_aft')` | Aft/port/stbd arc; no lock required |
| ⚡⚡ BURST SALVO | `executeBurstFireSalvo()` | In-arc cannons only; ≥20% lock; 12s CD |
| ALPHA SALVO | `executeAlphaSalvoFire()` | All in-arc weapons (cannons + nose + all torp tubes) |
| ⚡ OVERCHARGE | `executeCannonOvercharge()` | 30s CD |
| ☢ UNSTABLE TORP | `executeUnstableTorpedo()` | Fires `torpedo_quantum` (fwd tube explicitly); 35s CD |
| ⚡⚡ POWER DUMP | `executeEmergencyPowerDump()` | 50s CD |
| ◉ ENGAGE CLOAK | `toggleCloakingDevice()` | Health ≥20%, no active cooldown |
| 🛡 ROTATE FREQ | `rotateShieldFrequency()` | 30s CD |
| ◈ EVASIVE PATTERN | `executeEvasivePattern()` | Engines ≥20%, 20s CD |
| 🛡 Shields scan | `activateScanProfile('shields')` | 100% analysis first |
| 💥 Fissures scan | `activateScanProfile('hull')` | 100% analysis first |
| ⚡ Disrupt scan | `activateScanProfile('weapons')` | 100% analysis first |
| 〜 Tetryon scan | `activateScanProfile('tetryon')` | 100% analysis first |
| Reinforce Fore/Port/Stbd/Aft | `pumpShieldSector(sector)` | Not cloaked |
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
| PICARD MANOEUVRE | `executePicardManoeuver()` | Warp core ≥40%, 60s CD |
| PATTERN OMEGA | `executeAttackPatternOmega()` | Engines ≥20%, 45s CD |
| EVASIVE ALPHA | `executeEvasivePatternAlpha()` | 15s CD |
| Power Presets | `applyPowerPreset(name)` | Any time |
| ⚡ EMERGENCY WARP | `attemptEmergencyWarp()` | Hull ≤35%, core online |

### Captain's Chair (command.js)

Orders grouped by crew member. All have cooldowns from `_CAP_CD` (active time + game CD + 1s overhead). Buttons show countdown while cooling.

**Worf — Fire Control:** Cannons, Quantum, Photon, Burst, Alpha, Rotate Freq, Cloak/Decloak toggle, Hold Fire  
**Worf — Targeting:** Target Hull/Shields/Weapons/Engines/Cloak/Sensors/Warp Core  
**Worf — Scans:** Shield/Hull/Disrupt/Tetryon (auto-commits on completion)  
**O'Brien — Shields & Power:** Equalise, Boost Regen, Emergency Battery, Repair Weapons/Systems/Cloak, Flush EPS, Damage Control  
**Nog — Vectors:** Fore/Port/Stbd/Aft  
**Nog — Speed/Range/Manoeuvres:** Full/Half/Stop, Long/Medium/Close, Attack Run, Come About, Picard, Pattern Omega, Evasive Alpha, Auto Shield Track, Silent Running, Emergency Thrusters, Emergency Warp

---

## Canvas layout

```
Tactical view:     3D spatial battle view (Three.js, left 1.2fr) + enemy schematic 2D (right 0.8fr)
Engineering view:  hull schematic 2D (left 1.2fr) + power distribution 2D (right 0.8fr)
Helm view:         reuses tactical monitors (3D spatial + enemy schematic)
Captain view:      reuses tactical monitors (3D spatial + enemy schematic)
```

---

## HTML structure

```
#splash-screen         — fan disclaimer + title + ENTER BRIDGE button (fades to overlay)
#overlay               — startup modal + difficulty + station select (4 buttons) + end-game score
#sensor-ghost-overlay  — Romulan ghost alert (fixed top-right, animated)
#cloak-vuln-overlay    — full-screen purple tint during cloak transition
header                 — brand + accent line + stardate + mission context
.main-viewport         — flex row
  .left-anchor-panel   — LCARS nav pills (Tactical / Engineering / Helm / Command Chair)
                         + enemy readouts + our lock bar
  .center-operations-deck
    .top-monitor-row   — 2 canvases (tactical/helm/captain share spatial+schematic pair;
                         engineering shows hull+power pair)
    #eng-utility-panel — battery, cloak, shield regen, damage control, ablative,
                         repair queue, power presets, auto-tac summary (engineering only)
    #deck-tactical     — capacitor bars, ablative strip, weapon health strip,
                         cloak status bar, fire buttons, overload modes, subsystem target grid,
                         scan profiles (4), crew status, emergency warp
    #deck-engineering  — power allocation table + breaker grid
    #deck-helm         — speed (4), attack vector (4), range (3), manoeuvres (7 buttons),
                         power presets, auto-tactical/engineering summaries, live status line
    #deck-captain      — hull bar, 3 mini station panels (Worf/O'Brien/Nog),
                         crew comms feed (3 lines fixed height), 3 order groups
  .right-telemetry-tower — hull bar, quantum + photon torpedoes, shield sector bars ×4,
                           system health bars ×11, warp + cloak power footer
```

---

## CSS classes of note

| Class | Purpose |
|---|---|
| `.nav-pill-btn.active` | White highlight on active station nav |
| `.control-deck-plate.active-deck` | Shows tactical, engineering, helm, or captain deck |
| `.monitor-frame.active-monitor` | Shows correct canvas pair |
| `.tripped-relay-alert` | Flashing red animation on tripped breaker |
| `.pill-action-btn.red-btn/.warn-btn/.green-btn/.p-btn` | Colour variants |
| `#ablative-armour-strip` | Green layer indicator on tactical panel |
| `#cloak-status-bar` | Purple bar shown during cloak states |
| `#sensor-ghost-overlay` | Flashing amber Romulan ghost alert |
| `#cloak-vuln-overlay` | Full-screen purple flash during transition |
| `.captain-overview-row` | 3-column grid of mini station panels |
| `.captain-comms-wrap` | Fixed-height crew comms container (clamp 58-78px) |
| `.captain-orders-group` | Per-crew order section with label + grid |
| `.captain-orders-grid` | Button grid (7-col Worf, 4-col O'Brien, 8-col Nog) |
| `.comms-line / .comms-speaker / .comms-text` | Individual crew report line |
| `.comms-alert / .comms-good` | Alert (orange text) / good (green text) report variants |
