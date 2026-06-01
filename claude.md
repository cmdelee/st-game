# Starship Battle Simulator — Developer Reference

## Project overview

Single-page Star Trek tactical combat simulator. The player selects a vessel (**USS Defiant NX-74205** or **USS Enterprise NCC-1701-E**) and a command station (**Tactical**, **Engineering**, **Helm**, or **Captain's Chair**); the unchosen stations are delegated to the computer. All game logic lives across **15 JS files** served from the same directory — no build step, no bundler.

**File load order (matters — each file depends on the previous):**
```
config.js → state.js → engineering.js → crew.js → sensors.js → tactical.js →
helm.js → encounter-phases.js → enemy-ai.js → auto-delegation.js →
command.js → canvas-three.js → canvas-2d.js → ui.js → main.js
lcars.css (stylesheet)
index.html (HTML shell + script tags)
```

---

## File responsibilities

| File | Responsibility |
|---|---|
| `config.js` | All game constants: `C` colour palette, `DIFFICULTY`, `ENEMY_CONFIGS`, `ARRAYS_DICTIONARY`, `PLAYER_SHIP_CONFIGS` (both ships — stats, weapon arrays, crew, labels), `CREW_STATIONS`, `WARP_CORE`, `ABLATIVE_ARMOUR`, `HELM_SPEED_CONFIG`, `CAMPAIGN_ORDER`; `let currentDifficulty` |
| `state.js` | `G` game state object; `getWarpOutput()`, `getTotalAllocatedPower()`, `setDifficulty()`, `postLogEvent()` |
| `engineering.js` | Warp core trip, emergency battery, ablative armour processing, shield regen rate calculation, repair queue (2 independent teams), engineering matrix UI, power allocation (`tuneBusAllocation`), power presets (`applyPowerPreset`), EPS conduit conduction + thermal buildup, system degradation thresholds, shield manipulation |
| `crew.js` | Crew casualties (`inflictCrewCasualty`), efficiency modifiers (`getCrewEfficiency`, `getMedicalEfficiency`, `getHelmEvasiveModifier`), `updateCrewStatusDisplay`, `attemptEmergencyWarp`, `updateWarpAvailability`, `postTacticalAdvisory` |
| `sensors.js` | Scan profiles (`activateScanProfile`, `commitScanProfile`), active sensor toggle, enemy subsystem target grid (`buildEnemySubsystemTargetGrid`, `setEnemyTarget`) |
| `tactical.js` | Player weapons: burst-fire/concentrated phaser fire, shield freq rotation, evasive, `fireSelectedArray`, `applyDamageToEnemy`, overload modes; Defiant: `firePulseCannons`, `toggleCloakingDevice`; Enterprise-E: `fireAllPhaserArrays`, `toggleSaucerSeparation`, `fireSaucerAutomatic`, `executeConcentratedPhaserFire`, `executeMaxPhaserOutput`, `executeTricobalWarhead` |
| `helm.js` | Helm timer processing (`processHelmTimers`), speed control (`setHelmSpeed`), attack vector (`setHelmAttackVector`), engagement range (`setPlayerRangeBracket`), attack run, come about, Picard Manoeuvre, Attack Pattern Omega, Evasive Pattern Alpha, helm panel UI (`updateHelmPanel`) |
| `encounter-phases.js` | Faction encounter phase arcs (`initEncounterPhases`, `processEncounterPhase`, `_applyPhase`); hull milestone events at 75/50/25/10% (`checkEnemyHullMilestones`, `_MILESTONE_DATA`); Klingon death salvo (`_triggerKlingonDeathSalvo`); `_getFactionKey` helper |
| `enemy-ai.js` | Enemy cloaking AI (`processEnemyCloakDecision`, `triggerEnemyCloak/Decloak`), sensor ghosts (`processEnemySensorGhosts`), all mechanics timers (`processNewMechanicsTimers` — delegates to `processHelmTimers`), Jem'Hadar ramming (`initiateRammingRun`, `executeRammingImpact`), enemy AI loop (`processEnemyAI`), enemy fire (`executeThreatCounterVolley`) |
| `auto-delegation.js` | Computer management of uncrewed stations (`processAutomatedDelegation`): auto-engineering relay resets + repair dispatch, auto-tactical fire cycle, captain-mode Worf/O'Brien/Nog autonomous behaviours |
| `command.js` | Captain's Chair: `postCrewReport`, `_renderCrewComms` (uses `_crewLabel`/`_crewColour` getters — ship-aware); `_CAP_CD` cooldowns; 40+ order functions; manoeuvre ticker; ship-specific periodic reports (`_WORF_REPORTS`, `_OBRIEN_REPORTS`/`_LAFORGE_REPORTS`, `_NOG_REPORTS`/`_DATA_REPORTS`); `initCaptainStation()` |
| `canvas-three.js` | Three.js 3D spatial battle view; `buildDefiantGeometry()` + `buildSovereignGeometry()` + `rebuildPlayerMesh()` — swaps player mesh on ship select; `buildSaucerSepGeometry()` — independent saucer section; 3D beam tubes, burst shockwave rings, torpedo impact spheres, nacelle exhaust particles, ramming trajectory indicator; `_FACTION_GLOW_COL` / `_FACTION_BEAM_COL` colour maps |
| `canvas-2d.js` | Enemy schematic; hull schematic (`_renderDefiantSchematic` / `_renderEnterpriseESchematic` — branches on `G.playerShipKey`); power distribution canvas |
| `ui.js` | Deck switching (`toggleActiveDeck` — handles tactical/engineering/helm/captain), global UI sync (`synchronizeGlobalInterfaceDisplays`), scoring with hull integrity bonus (`calculateFinalScore`), end-game (`concludeSimulationRun`) |
| `main.js` | Game loop; simulation init (`initiateVesselSimulation`); boot; ship selection (`selectPlayerShip`, `rebuildWeaponFireMatrix`, `_rebuildCapBarGrid`, `_updateSpecialAbilityButtons`); campaign mode; `returnToSetup()` |

---

## Global state — key G fields

```js
G.running / G.dead                    // game lifecycle
G.playerChosenStation                 // 'tactical' | 'engineering' | 'helm' | 'captain'
G.activePanel                         // same — drives canvas and UI selection

// Ship selection — set by selectPlayerShip() before each game
G.playerShipKey                       // 'defiant' | 'enterprise_e'
G.playerShipConfig                    // reference to PLAYER_SHIP_CONFIGS[key]
G.activeWeaponArrays                  // ARRAYS_DICTIONARY (Defiant) or enterprise_e.weaponArrays

// Player (values come from G.playerShipConfig at game start)
G.player.hull / G.player.maxHull      // Defiant:500 / Enterprise:750 (×playerHullMult)
G.player.torpedoes / G.player.maxTorpedoes        // Defiant:18 / Enterprise:24
G.player.photonTorpedoes / G.player.maxPhotonTorpedoes  // Defiant:12 / Enterprise:30
G.player.shields    // Defiant: fore:320 port:260 stbd:260 aft:200 max:320
                    // Enterprise: fore:500 port:400 stbd:400 aft:350 max:500

// Systems (11 total — labels change per ship; cannon_pu/pl/su/sl = weapon arrays for both)
G.systems[key]  // { health, allocatedPower, cap, stress, tripped, label, isWeapon }
  // keys: cannon_pu, cannon_pl, cannon_su, cannon_sl, nose_beam, torpedoes,
  //       shields, sensors, engines, cloak_dev, warp_core
  // Defiant labels: 'Pulse Cannon P/U' etc.
  // Enterprise labels: 'Saucer Dorsal Sys', 'Stardrive Fwd Sys' etc.

// Saucer separation (Enterprise-E only — replaces cloak)
G.saucerSepActive / G.saucerSepTimer / G.saucerSepCooldown  // 15s active, 50s CD

// Tricobalt warhead (Enterprise-E only — 1 per engagement)
G.tricobalReady                       // false after first use; reset on new game

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

// Campaign mode
G.campaignMode         // bool — true during campaign run
G.campaignStation      // station chosen at campaign start (persists all 9 levels)
G.campaignShipKey      // ship chosen at campaign start (persists all 9 levels)
G.campaignLevel        // 0-indexed into CAMPAIGN_ORDER (0–8)
G.campaignScore        // accumulated score across completed levels
G.campaignLevelResults // [{ level, title, score, hullPct, time, won, escaped }]

// Last stand
G.lastStandActive / G.lastStandReported  // true below 20% hull; crew responds

// Enemy hull milestones
G.enemyHullMilestones  // plain object {}; keys = threshold % already fired (75/50/25/10)

// Player tactical mechanics
G.burstFireReady / G.burstFireCooldown   // 9s cooldown
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
            repairsCompleted, timeSurvived, warpedOut,
            weaponsFired:{ cannons, nose, quantum, photon },
            sectorBreaches:{ fore, port, starboard, aft },
            peakHullHit, systemsTripped[], enemyPhaseReached }
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

### Enemy pools by difficulty (single engagement)
- **Normal:** ktinga, romulan_bop, cardassian_scout, galor_class, jem_hadar_fighter
- **Hard:** ktinga, vor_cha, romulan_bop, romulan_warbird, galor_class, jem_hadar_fighter, jem_hadar_battleship
- **Elite:** borg_probe **ONLY** — the adaptation encounter is its own challenge tier

### Campaign order (data-driven, easiest → hardest)
`CAMPAIGN_ORDER` in config.js — 9 entries, each `{ level, archetype, diff, label, title, subtitle }`:
1. jem_hadar_fighter (normal) — polaron + ramming intro
2. cardassian_scout (normal) — fast-lock harassment
3. romulan_bop (normal) — cloak + plasma + sensor ghosts
4. galor_class (hard) — heavier phasers + photon
5. jem_hadar_battleship (hard) — heavy polaron + fury scaling
6. ktinga (hard) — range-closing + berserk + death salvo
7. vor_cha (hard) — wing disruptors + heavy torps
8. romulan_warbird (hard) — massive plasma + emergency cloak at 25%
9. borg_probe (elite) — adaptive shielding + tractor — FINAL BOSS

---

## Player weapons

`G.activeWeaponArrays` is set to `ARRAYS_DICTIONARY` (Defiant) or `PLAYER_SHIP_CONFIGS.enterprise_e.weaponArrays` depending on ship. `fireSelectedArray(key)` reads from `G.activeWeaponArrays`. All weapon arcs are enforced — buttons dim when out of arc.

### USS Defiant — ARRAYS_DICTIONARY (9 entries)

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

Defiant arc coverage: FORE = all 4 cannons + nose + fwd torps. AFT = aft torps only.

### USS Enterprise NCC-1701-E — weaponArrays (14 entries)

Nine Type-XII phaser arrays across all hull sections, sharing 5 weapon system keys:

| Key | Label | Yield | Cost | Arc | System |
|---|---|---|---|---|---|
| `cannon_port_upper` | Saucer Dorsal Fwd | 42 | 32 | fore/port/stbd | cannon_pu |
| `phaser_saucer_port` | Saucer Port Array | 36 | 28 | fore/port/aft | cannon_pu |
| `cannon_port_lower` | Saucer Ventral Fwd | 38 | 28 | fore/port/stbd | cannon_pl |
| `phaser_saucer_stbd` | Saucer Stbd Array | 36 | 28 | fore/stbd/aft | cannon_pl |
| `cannon_stbd_upper` | Stardrive Fwd Arrays | 40 | 30 | fore/port/stbd | cannon_su |
| `phaser_secondary` | Secondary Hull Arrays | 42 | 32 | fore/port/stbd | cannon_su |
| `cannon_stbd_lower` | Saucer Aft Arrays | 35 | 26 | aft/port/stbd | cannon_sl |
| `emitter_nose` | Primary Stardrive Emitter | **90** | 65 | fore | nose_beam |
| `phaser_aft_emitter` | Aft Stardrive Emitter | **55** | 42 | aft/port/stbd | nose_beam |
| `torpedo_quantum` | Fwd Quantum Tube A | **125** | 85 | fore/port/stbd | torpedoes |
| `torpedo_quantum_b` | Fwd Quantum Tube B | **125** | 85 | fore/port/stbd | torpedoes |
| `torpedo_photon` | Fwd Photon Tube | 65 | 30 | fore/port/stbd | torpedoes |
| `torpedo_quantum_aft` | Aft Quantum Tube | **125** | 85 | aft/port/stbd | torpedoes |
| `torpedo_photon_aft` | Aft Photon Tube | 65 | 30 | aft/port/stbd | torpedoes |

Enterprise arc coverage: FORE = 7 phaser arrays + fwd torps. AFT = 4 arrays + aft torps. The ship has meaningful firepower on every vector.

Enterprise `primaryWeaponKeys` = all 9 phaser array keys (used for "⚡ All Phaser Arrays ×N" arc counter and `fireAllPhaserArrays()`).

The capacitor bar grid for Enterprise-E shows 6 system-level bars (one per weapon system, 3-column compact layout) rather than 14 individual weapon bars, since arrays sharing a system always show the same cap%.

**Shared torpedo mechanics (both ships):**
- Quantum ≥60% lock → 85–115% yield. <60% lock → ~55%. Blind-fire (cloaked) → 40%
- Photon: flat damage, no lock required
- `isQuantum`/`isPhoton` flags drive all branching — key names are not used

**Helm range modifiers** (applied after base damage, both ships):
- Torpedoes: long +15%, close −10%
- Cannons/phaser arrays (cannon_* parent): close +20%, long −10%
- Nose/emitter (nose_beam parent): close +10%, long −10%

---

## Difficulty multipliers

| Setting | Enemy Hull | Enemy Dmg | Enemy Lock | Enemy Fire | Player Hull | Targets Systems | Repair Speed |
|---|---|---|---|---|---|---|---|
| Normal | ×1.0  | ×1.0  | ×1.0  | ×1.0  | ×1.0  | No        | ×1.0  |
| Hard   | ×1.12 | ×1.10 | ×1.25 | ×0.88 | ×0.88 | Yes (20%) | ×0.88 |
| Elite  | ×1.40 | ×1.20 | ×1.25 | ×0.80 | ×0.85 | Yes (25%) | ×0.80 |

Elite is tuned specifically for the Borg probe encounter — the challenge comes from the adaptation mechanic, not raw stat inflation.

`systemTargetChance` lives in the DIFFICULTY config; `processAutomatedDelegation` uses `diff.systemTargetChance` (was hardcoded 0.45/0.25).

---

## Shield & power values (per ship)

```
                  Defiant          Enterprise-E
Fore shields:     320              500
Port/Stbd:        260/260          400/400
Aft shields:      200              350
maxSectorValue:   320              500
Shield regen:     sp/9 * health    sp/9 * health * 1.4  (regen bonus)
                  28MW→3.1/s       28MW→4.4/s
Attack suppression: 3000ms (regen pauses after any hit)
Equalisation delay: 2s transfer, shields dip to 80% during switch

Default EPS allocations:
  Defiant   (114/120MW):  cannon_pu:8   cannon_pl:8  cannon_su:8   cannon_sl:6
                          nose_beam:10  torpedoes:10
                          shields:28  sensors:16  engines:10  cloak_dev:0  warp_core:10

  Enterprise (114/120MW):  cannon_pu:12  cannon_pl:10  cannon_su:10  cannon_sl:10
                            nose_beam:14  torpedoes:10
                            shields:30  sensors:14  engines:10  cloak_dev:0  warp_core:10
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

Crew is applied from `G.playerShipConfig.crewStations` at game start and drives `CREW_STATIONS`. The internal role keys (`tactical`, `engineering`, `helm`, `medical`) are ship-agnostic; only names and comms colours change. `_crewLabel(key)` and `_crewColour(key)` in command.js resolve the active ship's display names.

| Station | Defiant crew | Enterprise-E crew | Wounded | Incapacitated |
|---|---|---|---|---|
| Tactical | Lt. Cmdr Worf | Lt. Cmdr Worf | 65% fire efficiency | 30% fire efficiency |
| Engineering | Chief O'Brien (blue) | Lt. Cmdr La Forge (teal) | 65% repair speed | 30% repair speed |
| Helm | Ensign Nog (pink) | Lt. Cmdr Data (gold) | Evasive: 40% reduction | Evasive: 20% reduction |
| Medical | Dr. Bashir | Dr. Beverly Crusher | Casualty threshold ×0.7 | Casualty threshold ×0.4 |

**Captain's Chair periodic report sets:**
- Engineering: `_OBRIEN_REPORTS` (Defiant) / `_LAFORGE_REPORTS` (Enterprise-E — enthusiastic, can-do)
- Helm: `_NOG_REPORTS` (Defiant) / `_DATA_REPORTS` (Enterprise-E — precise, formal, no contractions)

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

### Enterprise-E exclusive mechanics

**Saucer Separation** (`toggleSaucerSeparation` in tactical.js):
- Saucer section flies independent decoy pattern for 15s
- Enemy lock rate ×0.4 (−60%) via `saucerSepMod` in `processEnemyAI`
- Engine stress +20 on activate; 50s cooldown
- `G.saucerSepActive / G.saucerSepTimer / G.saucerSepCooldown`
- Timers tick in `masterSimulationCoreLoop`; status bar shows in tactical panel

**Tricobalt Warhead** (`executeTricobalWarhead`):
- 250–350 total yield (random); 40% bypass shields directly to hull
- No lock required; fires without capacitor cost
- `G.tricobalReady` → false after first use; only one per engagement; reset on new game
- Used in First Contact to destroy Borg temporal vortex; classified as subspatial weapon

**Maximum Phaser Output** (`executeMaxPhaserOutput`):
- All in-arc phaser arrays from `primaryWeaponKeys` +60% yield (via `G._overchargeActive + G._maxPhaserActive` flags)
- 30s cooldown shared with Defiant's cannon overcharge slot
- EPS heat +6 per array fired

**Concentrated Phaser Fire** (`executeConcentratedPhaserFire`):
- All in-arc arrays from `primaryWeaponKeys` in 180ms/array stagger sequence
- 9s burst cooldown (shared with Defiant's burst salvo slot)
- Requires ≥15% lock; fires in background via `setTimeout`

**Regenerative Shielding**:
- `shieldRegenBonus` from `G.playerShipConfig` multiplies regen rate in `recalculateShieldRegenRate()`
- Enterprise-E: ×1.4 → 28MW power gives ~4.4 SP/s vs Defiant's ~3.1 SP/s
- Ablative armour (`processAblativeArmour`, `applyAblativeArmour`) is gated by `G.playerShipConfig.hasAblativeArmour` — skipped entirely for Enterprise-E

**3D mesh**: `buildSovereignGeometry()` draws large saucer disc, elongated stardrive hull, swept nacelles, phaser array torus strips. `rebuildPlayerMesh()` replaces the player mesh at game start.

### Defiant power balance (canon justification)
| Weapon | Yield | Rationale |
|---|---|---|
| Pulse cannons | **22** each | *"Overpowered and overgunned for its size"* — Sisko, *The Search* |
| Nose emitter | **65** | Heavy Type-XII array; decisive precision strike |
| Quantum torpedo | **125** | Specifically designed to exceed Borg shielding; K'Tinga photon torps avg 125 — Defiant quantum must exceed that |
| Photon torpedo | 60 | Reliable, unlimited-use secondary; intentionally weaker |
| Burst fire CD | **9s** | Defiant's rapid burst sequences in DS9 were frequent and characterised its style |
| Borg adaptation | **+0.024/hit** | Weapons cycle frequency engineered against Borg; 28 hits to cap vs 17 previously |

### Campaign mode (`main.js`)
`CAMPAIGN_ORDER` (config.js) defines 9 levels. State:
```js
G.campaignMode / G.campaignStation / G.campaignLevel (0–8) / G.campaignScore / G.campaignLevelResults[]
```

**`startCampaign(station)`** — sets campaign state, calls `_launchCampaignLevel()`

**`_launchCampaignLevel()`** — saves campaign state, calls `initiateVesselSimulation`, then:
1. Restores `G.campaignMode/Station/Level/Score/Results`
2. Overrides `G.enemyArchetype` with the level's archetype
3. Re-applies difficulty-scaled stats (hull, fireInterval, lockRate, shields, systems)
4. Sets `G.running = true` and calls `initEncounterPhases()`
5. Shows campaign HUD strip (`#campaign-hud`)

**`concludeSimulationRun`** routes to **`concludeCampaignLevel(victory, escaped)`** when `G.campaignMode`:
- Computes level score via `calculateFinalScore` and adds to `G.campaignScore`
- Shows `#campaign-level-summary` with score breakdown and next enemy preview
- Shows `#campaign-action-btns`: "NEXT ENGAGEMENT" / "RUN CAMPAIGN AGAIN" / "RETURN TO BRIDGE"
- On loss: campaign ends immediately

**`_nextCampaignLevel()`** — increments `G.campaignLevel`, hides summary panels, calls `_launchCampaignLevel()`

**`returnToSetup()`** — resets all campaign fields to 0/false, hides campaign UI, restores overlay to station-select state. No page reload — splash stays hidden after first load.

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
26. `shieldHitFlash` timers never decremented — set on every hit but never ticked down; CSS shield flash restarted every frame after first hit; 3D shield bubble permanently lit; primary cause of "displays stop working" degradation
27. Ablative armour displayed `/5` not `/6` — three separate locations (engineering.js, ui.js, canvas-2d.js)
28. `capTgtWeapons()` only found Klingon disruptors — `_capTargetSystem('disruptors')` failed on 7 of 9 enemy types; now delegates to `capTgtWeaponsAny()`
29. Enemy repair `remaining` hardcoded to 25000 regardless of randomised `totalTime` (25000–40000ms)
30. `_capDamageControl` could assign both repair teams to the same damaged system
31. Shield frequency 30s cooldown ticked during the 12s active window — effective CD was only 18s; changed to `if/else if`
32. Romulan decloak fired double volley — `G.threatCycleTimer` set AND `executeThreatCounterVolley()` called directly; removed direct call
33. `_capPumpShields` used broken self-multiplying math — added fore's own value to fore instead of draining others; replaced with correct drain-from-others logic
34. `G.crewReports` not reset between games — only cleared in `initCaptainStation()`, not in `initiateVesselSimulation()`
35. Shield scan bonus excluded quantum torpedoes — `weapon.parentSystem !== 'torpedoes'` removed from condition
36. `G._captainLowHullReported`, `G.cloakEngagedAt`, `G.enemyCloakEngagedAt`, `G.frozenShields`, `G.enemyFrozenShields` not reset between games
37. Aft torpedo capacitor bars (`bar-cap-tqa`, `bar-cap-tpa`) missing from HTML — player fired them with no charge readout
38. Overcharge/unstable flags not in `try/finally` — exception in `fireSelectedArray` would leave permanent damage multiplier
39. `btn.firstChild.textContent` in `_updateCaptainOrderButtons` had no null guard — could crash captain panel
40. Torpedo fallback fire path used `enemyPreferredSector` without arc check
41. `state.js` initial `G.player.torpedoes` was 30 instead of 18 — old `initiateVesselSimulation` always overwrote it to 18, but the initial state was stale
42. Ship-selection button clicks landed on zero-dimension elements during the 700ms splash animation — `selectPlayerShip` must be called after the overlay is visible
43. All hardcoded "USS Defiant" strings in user-visible messages (escape warp, ramming log, campaign loss title) replaced with `G.playerShipConfig.label`
44. Campaign end text "DEFIANT DESTROYED" was hardcoded — now uses active ship name
45. `_OBRIEN_REPORTS` ablative armour status line shown for Enterprise-E — now gated by `hasAblativeArmour`; replaced with regenerative shield status line
46. Crew comms feed speaker names were hardcoded constants — replaced with `_crewLabel()`/`_crewColour()` getters that read from `G.playerShipConfig.crewLabels/crewColours`
47. `canvas-three.js` `THREE.Line` beams were always 1px regardless of `linewidth` — replaced with `CylinderGeometry` tube meshes (glow radius 0.22 + core 0.08) for real 3D weapon beams
48. Burst salvo had no 3D visual — `burst_flash` events now spawn two expanding torus shockwave rings with particles
49. Saucer separation had no 3D representation — added independent `buildSaucerSepGeometry()` mesh flying a wide parametric arc through the combat zone with its own `PointLight`
50. Torpedo impacts were silent — impact now spawns an expanding wireframe sphere + white flash + 22-particle burst at impact position
51. Engine glow was a static point light — nacelle exhaust particles now stream continuously, scaled by helm speed, from correct ship-specific nacelle positions
52. Jem'Hadar ramming run had no 3D trajectory indicator — pulsing red `THREE.Line` with particle bursts along approach vector added
53. `enemy-ai.js` split into `encounter-phases.js` (phase arcs + hull milestones), `enemy-ai.js` (cloaking + AI + fire), and `auto-delegation.js` (computer station management)
54. `auto-delegation.js` relay-reset used a hardcoded Defiant default power object — replaced with `G.playerShipConfig.defaultPower` so Enterprise-E systems restore correct allocations
55. `fireSaucerAutomatic` applied helm `yieldMult` to saucer damage — removed; saucer fires on its own impulse power independent of stardrive helm speed
56. Torpedo mesh `_fromEnemy` flag not copied from `inFlightTorpedoes` entry — camera shake was incorrectly triggering on all torpedo impacts including enemy ones
57. Engine glow `PointLight` position used hardcoded `-5` X offset for both ships — now uses ship-specific nacelle end positions (`-5.2`/`-0.5` Defiant, `-8.4`/`-2.4` Enterprise-E)
58. Two separate faction→colour maps in `canvas-three.js` with inconsistent hex values — consolidated into top-level `_FACTION_GLOW_COL` (deep, for point lights) and `_FACTION_BEAM_COL` (bright, for weapon beams)

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
