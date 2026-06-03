# Starship Battle Simulator — Developer Reference

> **Git workflow:** commit and push directly to `main` after testing — do **not** create feature branches for changes here.

## Project overview

Single-page Star Trek tactical combat simulator. The player selects a vessel (**USS Defiant NX-74205** or **USS Enterprise NCC-1701-E**) and a command station (**Tactical**, **Engineering**, **Helm**, or **Captain's Chair**); the unchosen stations are delegated to the computer. All game logic lives across **20 JS files** served from the same directory (plus an optional `smoketest.js` test harness) — no build step, no bundler.

**File load order (matters — each file depends on the previous):**
```
config.js → state.js → engineering.js → crew.js → sensors.js → tactical.js →
helm.js → encounter-phases.js → enemy-ai.js → auto-delegation.js →
command.js → canvas-three.js → canvas-three-geometry.js → canvas-three-render.js →
canvas-2d.js → ui.js → setup.js → campaign.js → briefing.js → main.js →
smoketest.js (optional — only runs work on ?test=1)
lcars.css (stylesheet)
index.html (HTML shell + script tags)
```

> **Classic-script scoping note:** these are plain `<script>` files (no modules). Top-level `function`/`var` become `window` properties; top-level `let`/`const` live in a shared global lexical environment accessible across all files. `canvas-three-geometry.js` reads colour/offset consts (`_FACTION_*`, `_NAC_OFFSET`, …) and `canvas-three-render.js` reads `let`-declared render state (`THREE_scene`, `mesh_defiant`, `beam_lines`, shield/glow/particle handles, …) — both defined in `canvas-three.js`, so **canvas-three.js must load first**. `setup.js`/`campaign.js`/`briefing.js` only *call* functions (resolved at runtime), so their order is flexible as long as they load before the first call.

> **Cache-busting:** every local `<script src>` carries a `?v=<sha1>` content hash. Run `./cachebust.ps1` before committing to refresh hashes for changed files (`./cachebust.ps1 -Check` exits non-zero if any are stale). Changed files get a new URL (browsers refetch); unchanged files keep theirs (stay cached). This replaced the old manual `?v=N` bumps. A checked-in pre-commit hook (`.githooks/pre-commit`) runs the `-Check` and blocks the commit if hashes are stale — enable once per clone with `git config core.hooksPath .githooks`.

---

## File responsibilities

| File | Responsibility |
|---|---|
| `config.js` | All game constants: `C` colour palette, `DIFFICULTY`, `ENEMY_CONFIGS`, `ARRAYS_DICTIONARY`, `PLAYER_SHIP_CONFIGS` (both ships — stats, weapon arrays, crew, labels), `CREW_STATIONS`, `WARP_CORE`, `ABLATIVE_ARMOUR`, `HELM_SPEED_CONFIG`, `CAMPAIGN_ORDER`; `let currentDifficulty` |
| `state.js` | `G` game state object; `SHIELD_SECTORS` constant; `getStrongestShieldSector()`, `getWeakestShieldSector()`; `getWarpOutput()`, `getTotalAllocatedPower()`, `setDifficulty()`, `postLogEvent()` |
| `engineering.js` | Warp core trip, emergency battery, ablative armour processing, shield regen rate calculation, repair queue (2 independent teams), engineering matrix UI, power allocation (`tuneBusAllocation`), power presets (`applyPowerPreset`), EPS conduit conduction + thermal buildup, system degradation thresholds, shield manipulation |
| `crew.js` | Crew casualties (`inflictCrewCasualty`), efficiency modifiers (`getCrewEfficiency`, `getMedicalEfficiency`, `getHelmEvasiveModifier`), `updateCrewStatusDisplay`, `attemptEmergencyWarp`, `updateWarpAvailability`, `postTacticalAdvisory` |
| `sensors.js` | Deep scan system (`startDeepScan`, `processDeepScan`, `_SCAN_RESULTS`, `checkBorgScanExpiry`), active sensor toggle, enemy subsystem target grid (`buildEnemySubsystemTargetGrid`, `setEnemyTarget`); scan results grant permanent bonuses (shields/fissures/disrupt/tetryon) until Borg expiry check |
| `tactical.js` | Player weapons: burst-fire/concentrated phaser fire, shield freq rotation, evasive, `fireSelectedArray`, `fireEnergyWeapons`, `fireTorpedoBanks`, `fireAllWeapons`, `applyDamageToEnemy` (subsystem hits: 45% shield absorb → 62% sys + 22% hull bleed), overload modes; Defiant: `executeMaximumPulseBurst`, `toggleCloakingDevice`; Enterprise-E: `toggleSaucerSeparation`, `fireSaucerAutomatic`, `executeConcentratedPhaserFire`, `executeMaxPhaserOutput`, `executeTricobalWarhead`. (All energy fire routes through `fireEnergyWeapons()`.) |
| `helm.js` | Helm timer processing (`processHelmTimers`), speed control (`setHelmSpeed`), attack vector (`setHelmAttackVector`), engagement range (`setPlayerRangeBracket`), attack run, come about, Picard Manoeuvre, Attack Pattern Omega, Evasive Pattern Alpha, helm panel UI (`updateHelmPanel`) |
| `encounter-phases.js` | Faction encounter phase arcs (`initEncounterPhases`, `processEncounterPhase`, `_applyPhase`); hull milestone events at 75/50/25/10% (`checkEnemyHullMilestones`, `_MILESTONE_DATA`); Klingon death salvo (`_triggerKlingonDeathSalvo`); `_getFactionKey` helper |
| `enemy-ai.js` | Enemy cloaking AI (`processEnemyCloakDecision`, `triggerEnemyCloak/Decloak`), sensor ghosts (`processEnemySensorGhosts`), mechanics timers (`processNewMechanicsTimers`), Jem'Hadar ramming (`initiateRammingRun`, `executeRammingImpact`), enemy AI loop (`processEnemyAI`), enemy fire (`executeThreatCounterVolley`) |
| `auto-delegation.js` | Computer management of uncrewed stations (`processAutomatedDelegation`): auto-engineering relay resets + repair dispatch, auto-tactical fire cycle, captain-mode Worf/O'Brien/Nog autonomous behaviours |
| `command.js` | Captain's Chair: `postCrewReport`, `_renderCrewComms` (uses `_crewLabel`/`_crewColour` getters — ship-aware); `_CAP_CD` cooldowns; 40+ order functions; manoeuvre ticker; ship-specific periodic reports (`_WORF_REPORTS`, `_OBRIEN_REPORTS`/`_LAFORGE_REPORTS`, `_NOG_REPORTS`/`_DATA_REPORTS`); `initCaptainStation()` |
| `canvas-three.js` | Three.js scene setup only: shared render-state declarations (`THREE_scene`, mesh/shield/glow/particle handles), model loading, `initThreeScene()`, `rebuildPlayerMesh()`/`rebuildEnemyMesh()`, shield/particle/starfield/nebula builders, `resizeThreeRenderer()`, `_cleanupSaucerSep()`, `_makeTubeMesh`; `_FACTION_GLOW_COL` / `_FACTION_BEAM_COL` colour maps. **Must load before the geometry + render files** (they read its module state) |
| `canvas-three-geometry.js` | Three.js mesh/geometry builders only — `buildDefiantGeometry`, `buildSovereignGeometry`, `buildKtinga/Vorcha/RomulanWarbird/EnemyGeometry`, `buildSaucerSepGeometry`. Each returns a `THREE.Group`; invoked at runtime by scene init / mesh rebuild |
| `canvas-three-render.js` | Per-frame spatial render loop (`renderSpatialViewCanvas`): camera orbit/shake, ship drift, hull-damage colouring, engine glow + exhaust particles, cloak fade, shield bubbles, enemy movement, saucer-sep flight, ramming trajectory line, 3D beam tubes, burst shockwave rings, torpedo impacts, hull-damage sparks (`_emitHullSparks`/`_tickHullSparks`). Shares `canvas-three.js` module state — loads after it |
| `canvas-2d.js` | Enemy schematic, hull schematic (`_renderDefiantSchematic` / `_renderEnterpriseESchematic`), power distribution canvas. Shared `_lcarsHdr(ctx,t,x,y,w,col)` / `_row(ctx,lbl,val,pct,col,…)` / `_trow` helpers. All panels use LCARS-style filled section headers, inline mini-bars for hull/shields/systems/ordnance/lock, background grid, scan bonus readout, lock reticle arc, node glow radials. |
| `ui.js` | Deck switching (`toggleActiveDeck` — handles tactical/engineering/helm/captain), `_EL` DOM-element cache (`_buildELCache`/`_rebuildCapBarCache`/`_rebuildEngCache`), global UI sync (`synchronizeGlobalInterfaceDisplays`), scoring with hull integrity bonus (`calculateFinalScore`), end-game (`concludeSimulationRun`), `_cleanupPostBattleOverlays` |
| `setup.js` | Setup wizard (`_setupGoMode`/`_setupPickStation`/`_setupBack`/`_setupReset`), ship selection (`selectPlayerShip`), tactical fire/overload button + capacitor-bar builders (`rebuildWeaponFireMatrix`, `_rebuildCapBarGrid`, `_updateCapacitorBarLabels`, `_updateSpecialAbilityButtons`), splash (`dismissSplash`) (moved out of main.js) |
| `campaign.js` | Campaign run mode: `startCampaign`, `_launchCampaignLevel`, `_updateCampaignHUD`, `concludeCampaignLevel`, `_nextCampaignLevel`, `_restartCampaign` (moved out of main.js) |
| `briefing.js` | Pre-battle intel briefing + combat engagement: `_drawBriefingSilhouette`, `showPreBattleBriefing`, `engageFromBriefing`, `_engageCombat`, `startCombat` (moved out of main.js) |
| `main.js` | Game loop (`masterSimulationCoreLoop`); simulation init (`initiateVesselSimulation` — calls each module's `*ResetForBattle()` then resets cross-cutting score/visual/lifecycle state); boot (`runMasterBootSequence`); `returnToSetup()`; viewport resize. Setup/ship-select → `setup.js`, campaign → `campaign.js`, pre-battle briefing → `briefing.js` |
| `smoketest.js` | Invariant + behaviour test harness (`runSmokeTests`). Drives every ship × station × enemy combo through the real per-frame ticks (no RAF/canvas), exercises every special ability, and runs scenario tests (repair heals, warp-core trip scales power, emergency warp / ramming end the game). Asserts no exception + finite/in-range values + firing deals damage. Auto-runs on `?test=1` (publishes `window.__SMOKE_RESULT` / `__SMOKE_DONE`); or call `runSmokeTests()`. Runs in CI via `tests/run-smoke.mjs` (Playwright headless Chromium) on every push/PR — see `.github/workflows/smoke.yml` |

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

// Saucer separation (Enterprise-E only — replaces cloak) — toggle, not timed
// State: ready → separated (until reconnect ordered) → reconnecting (6s docking) → cooldown (60s) → ready
G.saucerSepActive / G.saucerSepReconnecting / G.saucerSepReconnectTimer / G.saucerSepCooldown

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

**Firing-arc resolution — `weaponInArc(weapon)` (state.js):** single source of truth for "can this weapon bear right now?", combining two checks:
- **Horizontal arc** — `weapon.arc.includes(G.helmAttackVector)` (fore/port/starboard/aft).
- **Vertical mount** — `mountBearsOnTarget(weapon)`. Each weapon carries an optional `mount` (`'dorsal'` = top-of-hull, `'ventral'` = belly; absent = `'any'`/centerline). A dorsal array can't depress onto a target *below* the ship; a ventral array can't elevate onto one *above* (core test: `_elevationBlocks(mount, elev)`). `G.enemyElevation` (`'above'|'level'|'below'`) is derived **from the real 3D mesh Y-difference** in `renderSpatialViewCanvas` (canvas-three-render.js) with a hysteresis band (enter ±7, leave ±4) to stop flicker as the enemy weaves vertically. Defaults to `'level'` (no restriction) when no spatial view drives it — headless smoke tests and the engineering deck are unaffected. Reset to `'level'` in `enemyResetForBattle`.

  **Player mounts (config.js):** Defiant — upper cannons (`cannon_pu/su`) dorsal, lower cannons (`cannon_pl/sl`) ventral, nose/torpedoes `'any'`. Enterprise-E — dorsal: `cannon_port_upper` (Saucer Dorsal Fwd), `phaser_saucer_port`, `cannon_stbd_upper` (Stardrive Fwd); ventral: `cannon_port_lower` (Saucer Ventral Fwd), `phaser_saucer_stbd`, `phaser_secondary` (engineering-hull underside), `cannon_stbd_lower` (Saucer Aft); `'any'`: nose/aft emitters + all torpedoes (3 dorsal / 4 ventral / centerline). The helm status line shows the live elevation (`Tgt: ▲ ABOVE / ◆ LEVEL / ▼ BELOW`); button tooltips and fire-rejection log lines distinguish a vertical block from a horizontal one. All player gating sites (button dimming in ui.js, every fire/validation path in tactical.js) route through `weaponInArc`. At least one centerline weapon always bears, so auto-tactical never fully stalls.

  **Enemy mounts (symmetric):** the enemy obeys the same limitation — `getPlayerElevation()` returns the **inverse** of `G.enemyElevation` (if the enemy is above the player, the player is below the enemy), and `enemyWeaponBears(sys)` gates enemy fire in `executeThreatCounterVolley`. Enemy weapon mounts are assigned procedurally in `enemyResetForBattle` (alien hulls vary, so not in config): torpedo launchers `'any'`; beam/disruptor/polaron arrays alternate dorsal/ventral when a ship has ≥2 (guaranteeing ≥1 bears at any elevation), but a lone beam stays `'any'` so single-gun ships (e.g. Borg cutting beam) never stall. The enemy fire path filters candidate weapons to those bearing, with a fallback to the full list if somehow none bear. Helm manoeuvring now matters offensively *and* defensively — climb/dive to deny the enemy's dorsal or ventral arrays.

### USS Defiant — ARRAYS_DICTIONARY (9 entries)

| Key | Label | Yield | Cost | Arc | System |
|---|---|---|---|---|---|
| `cannon_port_upper` | Port Upper Pulse Cannon | **22** | 20 | fore | cannon_pu |
| `cannon_port_lower` | Port Lower Pulse Cannon | **22** | 20 | fore, port | cannon_pl |
| `cannon_stbd_upper` | Stbd Upper Pulse Cannon | **22** | 20 | fore | cannon_su |
| `cannon_stbd_lower` | Stbd Lower Pulse Cannon | **22** | 20 | fore, starboard | cannon_sl |
| `emitter_nose` | Heavy Nose Array Emitter | **65** | 50 | fore only | nose_beam |
| `torpedo_quantum` | Fwd Quantum Tube | **125** | 45 | fore, port, starboard | torpedoes |
| `torpedo_photon` | Fwd Photon Tube | 60 | 15 | fore, port, starboard | torpedoes |
| `torpedo_quantum_aft` | Aft Quantum Tube | **125** | 45 | aft, port, starboard | torpedoes |
| `torpedo_photon_aft` | Aft Photon Tube | 60 | 15 | aft, port, starboard | torpedoes |

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
| `torpedo_quantum` | Fwd Quantum Tube A | **125** | 45 | fore/port/stbd | torpedoes |
| `torpedo_quantum_b` | Fwd Quantum Tube B | **125** | 45 | fore/port/stbd | torpedoes |
| `torpedo_photon` | Fwd Photon Tube | 65 | 15 | fore/port/stbd | torpedoes |
| `torpedo_quantum_aft` | Aft Quantum Tube | **125** | 45 | aft/port/stbd | torpedoes |
| `torpedo_photon_aft` | Aft Photon Tube | 65 | 15 | aft/port/stbd | torpedoes |

Enterprise arc coverage: FORE = 7 phaser arrays + fwd torps. AFT = 4 arrays + aft torps. The ship has meaningful firepower on every vector.

Enterprise `primaryWeaponKeys` = all 9 phaser array keys (used for the "⚡ All Phaser Arrays ×N" arc counter; the fire button calls `fireEnergyWeapons()`).

The capacitor bar grid for Enterprise-E shows 6 system-level bars (one per weapon system, 3-column compact layout) rather than 14 individual weapon bars, since arrays sharing a system always show the same cap%.

**Torpedo mechanics:**
- `fireTorpedoBanks()` fires **both launchers** of the active bay simultaneously (80ms stagger). Quantum first; photon fallback when quantum magazine empty. Enterprise-E uses `torpedo_quantum` + `torpedo_quantum_b` as distinct fwd tubes; other ships fire the same key twice
- Cap costs are halved (quantum 45, photon 15) so both launchers can fire from a single full charge (2×45=90%)
- Fwd tubes use `G.systems.torpedoes.cap`; aft tubes use `G.systems.torpedoes.aftCap`. Independent charging/display
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
- All 4 cannons fire in 800ms window (200ms stagger); 9s recharge
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

### Deep scan system (sensors.js)
Single comprehensive scan initiated by `startDeepScan()` (no type argument), processed by `processDeepScan(dt)`, committed via `_commitDeepScan()` → `_SCAN_RESULTS[archetype]`. One button reveals **all** bonuses for the current enemy simultaneously. Bonuses are **permanent frequency locks** — they persist until the next scan overwrites them or `checkBorgScanExpiry` resets them when the Borg adaptation level increases.

Each enemy archetype has 2–4 entries in `_SCAN_RESULTS`; possible bonus types:

| Bonus type | Key in `permanentScanBonuses` | Effect |
|---|---|---|
| `shield_freq` | `G.permanentScanBonuses.shield_freq` | −25% incoming damage of matched weapon type |
| `hull_weakness` | `G.permanentScanBonuses.hull_weakness` | +20% all outgoing damage |
| `sensor_blind` | `G.permanentScanBonuses.sensor_blind` | −40% enemy lock rate (via `permSensorBlind ×0.60`) |
| `weapon_disrupt` | `G.permanentScanBonuses.weapon_disrupt` | +30% longer enemy fire interval (applied immediately) |

Borg scans expire when `borgEscalationLevel` increases (`checkBorgScanExpiry`); Borg scan cooldown is 10s vs 60s for all others.

### Subsystem targeting — collateral hull damage
When `G.targetedSubsystemType` is a system key (not `'hull'` or `'shields'`), `applyDamageToEnemy` applies a three-way damage split:
1. **Shields** on the attack vector absorb up to 45% of the shot (partial bypass — focused beam, not full absorption like hull-targeting mode)
2. **Subsystem** takes 62% of total damage regardless of shield state (beam concentrates on the target system)
3. **Hull** bleeds 22% of penetrating damage (collateral from energy passing through ship structure — higher when shields are already down: ~22 vs ~12)

Log line shows both: `Subsystem [Disruptor Array]: 74% hull −12.`

This prevents grinding subsystems with zero hull risk while still rewarding focused targeting over hull shots.

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
- **Evasive counter (`executeRammingImpact`):** the run is dodgeable — Picard Manoeuvre = guaranteed escape (1.0), an active evasive pattern (Delta `evasiveActive` / Alpha `evasiveAlphaActive`) = 0.85, hard come-about = 0.50, full impulse alone = 0.35, otherwise it connects. On a dodge the enemy **overshoots and survives** (lock collapses, `enemyManeuverState='neutral'`) — you avoid the 280/380 hit but must still finish it conventionally. The 3D trajectory line turns **green** while you're in a dodging posture (red otherwise). `crewReportRammingEvaded()` reports it on the Captain's chair.

### Manoeuvre choreography (3D view, canvas-three-render.js)
Helm orders read visibly on the hull, on top of the attack-vector yaw/bank: **come-about** spins the hull through a full sweep (all sectors exposed); **evasive Delta/Alpha** corkscrew-jink (fast roll + pitch + lateral slip); **Pattern Omega** holds a nose-down attack attitude; **Picard Manoeuvre** renders the micro-warp jump as a flickering double-image plus two cyan warp streaks and a camera shake on activation (opacity restored on the falling edge, tracked by `_picardPrev`).

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
- **Toggle mechanic** — saucer stays separated until player orders reconnect (no fixed duration)
- Separated: `saucerSepActive=true, saucerSepReconnecting=false` — saucer arrays (cannon_pu/pl) offline; decoy active
- Reconnecting: `saucerSepReconnecting=true` — 6s docking sequence; decoy effect drops
- Enemy lock rate ×0.4 (−60%) via `saucerSepMod` in `processEnemyAI` (×0.75 while reconnecting)
- Stardrive cap recharge ×1.15 boost (freed EPS budget); stardrive weapon yield ×1.20
- Engine stress +15 on separate; 60s cooldown after full reconnect
- `G.saucerSepActive / G.saucerSepReconnecting / G.saucerSepReconnectTimer / G.saucerSepCooldown`
- Timers tick in `masterSimulationCoreLoop`; status bar shows in tactical panel and eng-utility panel

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
59. Captain scan orders (`capScanShields`/`Hull`/`Weapons`/`Tetryon`) called non-existent `activateScanProfile`/`commitScanProfile` — replaced with `startDeepScan()` delegation
60. `G.captainOrderCooldowns` not reset between games — only cleared in `initCaptainStation()` (captain station only); added reset to `initiateVesselSimulation`
61. `G.activeScanningProfile` boolean not reset between games — active scanner stayed on permanently; added reset to `initiateVesselSimulation`
62. Borg `borgEscalationLevel` capped at 3 but damage formula only applies up to 2 levels — fixed cap to `Math.min(2, ...)`
63. `executeUnstableTorpedo` consumed 35s cooldown before arc check — added arc validation before setting cooldown
64. `executeTricobalWarhead` passed string `'torpedoes'` to `applyDamageToEnemy` — Borg never built resistance to it; fixed to pass proper weapon object `{ parentSystem: 'torpedoes', isQuantum: true }`
65. `inflictCrewCasualty` logged hardcoded DS9 crew names (Nog, O'Brien) on Enterprise-E — fixed to use `CREW_STATIONS[station].name`
66. Repair progress display showed `NaN%` when `team.totalTime === 0` — added guard
67. `G.historicalLogTracks` grew unbounded — added cap at 600 entries, trimmed to 500
68. Ablative armour strip `innerHTML` updated every frame for Enterprise-E (no armour) — added `hasAblativeArmour` guard
69. `checkBorgScanExpiry` restored fire interval without reapplying `activeScanningProfile` modifier — fixed
70. `toggleActiveSensorSystems` applied `0.85×` multiplicatively on every toggle-on, shrinking fire interval each call — now computes from base rate each time
71. Helm auto-tac summary hardcoded "4 cannons" for Enterprise-E — now uses `primaryWeaponKeys` system count
72. Campaign mode: `initiateVesselSimulation` randomly overwrote `G.enemyArchetype` even in campaign mode — now skips the random pool pick when `G.campaignMode` is true
73. Tricobalt warhead double shield check — `applyDamageToEnemy(hullDmg)` was called without a sector override, so hull bleed-through was absorbed by shields a second time on a random sector; fixed by passing `G.helmAttackVector` as `targetSectorOverride`
74. `updateEngUtilityPanel` repair percentage showed `NaN%` when `team.totalTime === 0` — added guard (same as bug #66 fix in `refreshEngineeringPanelGraphics`)
75. `_updateSpecialAbilityButtons` hid `eng-cloak-section` for Enterprise-E, conflicting with `updateEngUtilityPanel` which repurposes it for saucer-sep status — section now always kept visible; `updateEngUtilityPanel` manages its content for both ships
76. `tetryonMod` in `processEnemyAI` checked `G.scanBonus.type === 'tetryon'` which is never set by the new deep-scan system — removed dead variable; sensor-blind effect is correctly handled by `permSensorBlind` (permanent scan bonuses)
77. `saucerSepMod` applied ×0.34 (−66% enemy lock) but docs and log message say −60% (×0.4) — corrected to 0.40
78. `executeConcentratedPhaserFire` did not filter saucer-section weapons from the `ready` array, inflating the logged count when saucer was separated — added `_isSaucerWeapon` check
79. `processBattery` called `handleWarpCoreTrip()` when battery exhausted while warp core was already tripped, re-applying the EPS cascade stress spike and potentially causing a second set of system trips — replaced with a simple log message
80. `masterSimulationCoreLoop` re-scheduled itself every frame via `requestAnimationFrame` even when `G.running=false` (setup, post-game), burning CPU/battery continuously — loop now exits immediately when not running; `startCombat()` re-enters the loop when combat begins
81. Weapon hardpoints added — beams and torpedoes now fire from their actual hull positions: Defiant pulse cannons from nacelle flanks, nose emitter from bow tip, fwd torpedo launcher under bow, aft tube at stern. Enterprise-E: saucer dorsal/ventral/port/stbd/aft arrays at saucer rim, stardrive emitter at deflector, aft emitter at stern
82. Enemy beam visuals added — `executeThreatCounterVolley` now pushes to `renderedBeamsVector` with `fromEnemy:true`, faction colour, and hardpoint lookup. Plasma beams are green; faction beams use `_FACTION_BEAM_COL`. Enemy torpedoes also spawn flying balls in `inFlightTorpedoes`
83. Player beam `weaponKey` now flows into `renderedBeamsVector` so exact array (e.g. `phaser_saucer_port`) maps to its hardpoint instead of falling back to parent system only. Beam colour lookup updated to use `weaponKey` before `type` fallback
84. All torpedo bays now have independent capacitors — `cap` (fwd quantum), `aftCap` (aft quantum/photon) tracked separately so firing one tube does not drain others' bars. Derived from weapon arc at runtime — no config flag needed
85. `fireTorpedoBanks()` redesigned to fire both launchers per bay simultaneously (80ms stagger) — quantum first, photon fallback. Enterprise-E uses `torpedo_quantum` + `torpedo_quantum_b` as distinct fwd tubes; all other ships fire the same key twice. Torpedo cap costs lowered to 45/15 (quantum/photon) so both launchers fire from a single full charge
86. `executeEvasivePattern` set `G.evasiveCooldown = G.evasiveDuration` (8s) instead of `G.evasiveCooldownTime` (20s) — evasive CD was effectively 8s instead of the documented 20s
87. `fireSaucerAutomatic` passed `null` as weapon to `applyDamageToEnemy` — would crash with TypeError on Borg adaptive shield check. Now passes a proper phaser weapon stub
88. Saucer separation `postCrewReport` hardcoded `'nog'` speaker — wrong name/colour on Enterprise-E (Data is helm officer). Fixed to `'helm'` key
89. `G.threat.shields` undefined before first game start — `G.threat` now initialised with all four shield sectors at 0 in `state.js` to prevent pre-game null dereference
90. `G.permanentScanBonuses` accessed without null-safety in `toggleActiveSensorSystems` — changed to optional chaining `?.weapon_disrupt`
91. `setEnemyTarget` reset `G.deepScanProgress = 0` (wrong field) on subsystem target change, corrupting the in-progress scan bar display — line removed
92. `G.threat` enemy shield regen used `G.enemySystems.shields_sys` — changed to `G.enemySystems.shields`. **NOTE: this fix was wrong and was reverted — see #126.**
93. Same change in `engineering.js` enemy regen calculation. **Also reverted — see #126.**
94. Enemy cloak power drain used `G.cloakPowerDrainRate` (the player's drain rate) — enemy cloak now uses a hardcoded 4%/s constant independent of player config
95. `G.enemyLockProgress` not decayed while enemy was cloaked — enemy lock now reduces by 2/s during cloak, same logic as player lock decay
96. `triggerEnemyCloak` at Romulan 25% hull milestone had no guard for enemy already cloaking/in-transition — added `!G.enemyCloaked && G.enemyCloakVulnTimer <= 0` check to prevent double-cloak corruption
97. `G.enemyPreferredSector.toUpperCase()` crashed on first render frame before first manoeuvre fired — guarded with `|| 'fore'` fallback
98. `queueSystemRepair` tiebreak comparison was inverted — picked the team with the most work remaining (least done) to redirect, instead of the team nearest completion. Fixed comparison direction
99. Repair ETA log ignored crew efficiency — displayed time was shorter than actual when engineering crew was wounded. Fixed to include `getCrewEfficiency('engineering')`
100. Auto-tac summary denominator hardcoded `/5` for Enterprise-E but `nose_beam` was excluded from the healthy count; Defiant showed `/4` correctly. Now uses a dynamic key list including `nose_beam` for both ships
101. `auto-delegation.js` repair team assignment used team index as damaged-list index — second team got the second-worst system even when both teams were free and first-worst was unrepaired. Fixed with independent `_dIdx` counter
102. `crewReportWarpCoreTrip()` called when auto-delegation activated emergency battery — wrong event report. Replaced with direct `postCrewReport` battery activation message
103. Auto-O'Brien shield equalise threshold `totalShields > max * 0.5` was always true (comparing sum of 4 sectors against half of one sector max) — raised to `max * 1.5` (~38% of full pool)
104. Auto-Worf burst salvo in captain mode missing `!G.enemyTractorActive` guard — burst would be attempted and log-spam when tractor beam was active
105. `capEmergWarp` attributed to `'worf'` crew instead of `'nog'` — emergency warp is helm manoeuvre, now correctly attributed to Nog/Data
106. `_WORF_REPORTS[1]` hardcoded "Burst salvo" text on Enterprise-E — now shows "Concentrated fire" when `G.playerShipKey === 'enterprise_e'`
107. Cardassian hull milestone dialogue hardcoded "Defiant" — now uses `G.playerShipConfig.label` dynamically
108. `canvas-2d.js` enemy shield arc opacity divided by `cfg.shields[sa.key]` with no zero/undefined guard — `NaN` globalAlpha made canvas transparent for a frame. Fixed with `|| 1` fallback
109. `canvas-2d.js` Enterprise-E schematic `G.shieldRegenRate.toFixed(1)` had no null guard — inconsistent with Defiant schematic. Fixed with `|| 0` fallback
110. `ui.js` `G.shieldRegenRate.toFixed(1)` in `synchronizeGlobalInterfaceDisplays` had no null guard — could throw on first frame before `recalculateShieldRegenRate()`. Fixed with `|| 0`
111. `ui.js` Enterprise-E `_primKeys` arc-grey check hardcoded only 5 weapon keys but `primaryWeaponKeys` has 9 — "×N IN ARC" label never cleared suffix even at full arc coverage. Fixed to use `G.playerShipConfig.primaryWeaponKeys` directly
112. `ui.js` saucer-sep power bar used `50000` as cooldown divisor but actual CD is `60000ms` — bar showed 100% when 10s remained. Fixed to `60000`
113. `ui.js` cloak-status-bar text said "Lock −66%" after bug #77 fixed the mechanic to −60% — UI string updated to match
114. `main.js` `G.stardate` used `Math.random().toFixed(1) * 1` string-to-number coercion — replaced with `parseFloat(Math.random().toFixed(1))`
115. `main.js` dead `requestAnimationFrame(masterSimulationCoreLoop)` call at boot (bug #80 left this behind) — removed; loop is entered by `startCombat()` only
116. `canvas-three.js` mesh disposal on `rebuildPlayerMesh` and `rebuildEnemyMesh` — old geometry and materials were removed from scene but never disposed, leaking GPU memory on every ship switch. Now traverses and disposes before removal
117. `canvas-three.js` enemy shield bubble opacity divided by `cfg.shields.fore` — inconsistent across enemy types with different fore values. Fixed to use `cfg.shields.maxSectorValue || cfg.shields.fore`
118. `canvas-three.js` beam colour lookup used `bCols[b.type]` — `b.type` is parent system key but `_PLAYER_BEAM_COL` indexes by parent system, while `b.weaponKey` is the exact array key. Fallback chain now tries `weaponKey` first, then `type`
119. `config.js` duplicate `label` property on `romulan_bop.systems.plasma_fwd` — second value silently overwrote first. Duplicate removed
120. `config.js` Jem'Hadar battleship intel card stated "1100 hull" but actual `hull` value is 920 — corrected to match config
121. `helm.js` torpedo status showed "LOW" when quantum was empty but photon torpedoes were still available — condition updated to `torpedoes > 0 || photonTorpedoes > 0`
122. `SHIELD_SECTORS` constant + `getStrongestShieldSector()` / `getWeakestShieldSector()` added to `state.js`; 22 literal `['fore','port','starboard','aft'].forEach/reduce` instances across 7 files replaced with the shared constant/helpers
123. `_getFactionKey` in `encounter-phases.js` simplified from 6-line if-chain to `(cfg.faction||'').toLowerCase()||null`; `toggleActiveSensorSystems` fire interval computation deduped (8 lines → 3); `_SYS_ABBREV` map extracted to module-level constant in `ui.js` eliminating duplicate inline maps; `_cleanupPostBattleOverlays()` helper deduplicates post-battle cleanup in `ui.js` and `main.js`; `THREE.Vector3` camera lookAt reused across frames; player/enemy mesh traversal gated — skipped when ship is fully opaque (60fps win); `processNewMechanicsTimers` 4 copy-paste cooldown blocks replaced with data-table loop; dead `scanType` parameter removed from `_capScan`; `_capDamageControl` crew name via `_crewLabel('obrien')` instead of ship-key branch; `processAutomatedDelegation` relay-reset loop early-exits when no systems are tripped; `_setManoeuvreBtn` helper replaces 6 copy-paste helm button state blocks (48 lines → 8)
124. 2D canvas readout panels redesigned — LCARS-style filled section headers, inline mini-bars for hull/shields/systems/ordnance/lock across all three canvases; enemy panel gains lock reticle arc with corner brackets, scan bonus readout, adaptive resistance bars per-weapon, node glow radials, hull damage pulse; hull schematics gain EPS heat bar, torpedo counts, regen rate row, background grid, title border box; power distribution gains gradient bar fills, cap% indicator strip, EPS heat meter, styled headroom footer; shared `_lcarsHdr`/`_row`/`_trow` helpers replace per-function `dRow`/`dHdr` duplication
125. Subsystem targeting now deals collateral hull damage — shields absorb up to 45%, subsystem takes 62%, hull bleeds 22% of penetrating energy; log line shows both hits: `Subsystem [X]: 74% hull −12.` Prevents ignoring hull entirely while grinding subsystems
126. **Regression from #92/#93 — reverted.** The real enemy shield-generator key in `ENEMY_CONFIGS[*].systems` is `shields_sys`, NOT `shields` (there is no `shields` key inside enemy `systems`; `shields` is the separate top-level sector-value object). #92/#93 changed the correct `shields_sys` to the nonexistent `shields`, so `eSS` was always `undefined` and enemy shield regen silently stopped scaling down with shield-generator damage (enemy always regenerated at full rate). Reverted both sites — `enemy-ai.js` `triggerEnemyDecloak` and `engineering.js` `computeConduitConduction` — back to `G.enemySystems.shields_sys`. `tactical.js` `applyDamageToEnemy` (shields target) and `canvas-2d.js` already used the correct key.
127. **Five enemy STL/OBJ models were mis-oriented in the 3D combat view (appeared to point up/down or sideways).** The spatial view loads real `models/*.stl|.obj` meshes (procedural `build*Geometry` is only the fallback); per-ship orientation lives in `_MODEL_ROTATIONS` (canvas-three.js). Several entries rotated only about the wrong axis, leaving the model's long (nose-tail) axis vertical so the ship "pointed down/up" (or, for the warbird, broadside). Verified via bounding-box analysis (long axis must be world-X, height world-Y) plus side/top-down screenshots of every campaign ship. Fixes: `galor_class`, `ktinga`, `vor_cha` (native long axis Y, height Z) → `{x:π/2, y:0, z:π/2}`; `jem_hadar_battleship` (OBJ, Y-up, nose along Z) → `{x:0, y:π/2, z:0}`; `romulan_warbird` (native long axis Y, tall ring on X) → `{x:0, y:0, z:−π/2}`. All now sit horizontal with nose at model +X, so the enemy-group's `rotation.y = π` faces them at the player. Already-correct: cardassian_scout, romulan_bop, jem_hadar_fighter, borg_probe (cube), and both player ships (defiant, enterprise_e). The procedural Defiant nacelle layout (#earlier session) is unrelated — the procedural builders are not used while STL models load successfully.

---

## Player actions available

### Tactical panel

Weapon buttons dim (`opacity:0.35; pointer-events:none`) when the weapon's arc doesn't include `G.helmAttackVector`. The cannon button relabels dynamically: "⚡ Pulse Cannons ×N IN ARC".

| Button | Function | Constraint |
|---|---|---|
| ⚡ Pulse Cannons ×N | `fireEnergyWeapons()` | In-arc cannons only; cap charged |
| Nose Beam | `fireSelectedArray('emitter_nose')` | Fore arc only; cap charged |
| Fwd Quantum Torpedo | `fireSelectedArray('torpedo_quantum')` | Fore/port/stbd arc; ≥5% lock; torps > 0 |
| Fwd Photon Torpedo | `fireSelectedArray('torpedo_photon')` | Fore/port/stbd arc; no lock required |
| Aft Quantum Torpedo | `fireSelectedArray('torpedo_quantum_aft')` | Aft/port/stbd arc; ≥5% lock; torps > 0 |
| Aft Photon Torpedo | `fireSelectedArray('torpedo_photon_aft')` | Aft/port/stbd arc; no lock required |
| ⚡⚡ BURST SALVO | `executeBurstFireSalvo()` | In-arc cannons only; ≥20% lock; 9s CD |
| ALPHA SALVO | `executeAlphaSalvoFire()` | All in-arc weapons (cannons + nose + all torp tubes) |
| ⚡ OVERCHARGE | `executeCannonOvercharge()` | 30s CD |
| ☢ UNSTABLE TORP | `executeUnstableTorpedo()` | Fires `torpedo_quantum` (fwd tube explicitly); 35s CD |
| ⚡⚡ POWER DUMP | `executeEmergencyPowerDump()` | 50s CD |
| ◉ ENGAGE CLOAK | `toggleCloakingDevice()` | Health ≥20%, no active cooldown |
| 🛡 ROTATE FREQ | `rotateShieldFrequency()` | 30s CD |
| ◈ EVASIVE PATTERN | `executeEvasivePattern()` | Engines ≥20%, 20s CD |
| 🔭 DEEP SCAN | `startDeepScan()` | Single comprehensive scan; reveals all enemy frequency bonuses permanently |
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
**Worf — Scans:** Deep Scan button (calls `startDeepScan()`; reveals all enemy frequency bonuses; auto-commits on completion)  
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

---

## Deferred improvements (identified, not yet applied)

Identified during the June 2026 simplification review. Tick off as completed.

### Performance
- [x] **DOM element caching** — done. `_EL` map built by `_buildELCache()` (ui.js) at game start, re-primed on ship select / deck switch; hot-path lookups use the cache-first `_g(id)` helper.
- [x] **`getWarpOutput` / `getTotalAllocatedPower` computed 3× per frame** — done. `state.js` now memoises both via `_refreshPowerCache()`, keyed on `G.lastFrameTimestamp` (recomputed at most once per frame, invalidated on any power change via `_invalidatePowerCache()`).
- [ ] **`recalculateShieldRegenRate` DOM write every frame** — rate only changes when power/health changes; add dirty flag, skip DOM update when value unchanged.
- [ ] **Button update throttling** — `updateEvasiveButton`, `updateShieldFreqButton`, `_updateDeepScanButton` update DOM 60×/s for values that change once per second. Only update when `Math.ceil(timer/1000)` differs from the previous frame.

### Simplification
- [x] **`processHelmTimers` data-table** — done. `_HELM_MANOEUVRES` table + shared `_tickManoeuvre(dt, m)` helper (helm.js) replace the 5 copy-paste active/cooldown blocks; each entry's `onExpire` owns its deferred cooldown (e.g. Omega).
- [x] **`_capTargetSystem` / `capTgtWeaponsAny` consolidation** — done. `_capTargetSystem` now accepts a single hint *or* an array; `capTgtWeapons` passes `['disruptors','phasers','polaron','torpedoes']`. `capTgtWeaponsAny` removed. Match now requires `health > 0` (won't target a destroyed subsystem).
- [x] **`firePulseCannons` / `fireAllPhaserArrays` one-liner wrappers** — done. Removed; `capFireCannons` (command.js) calls `fireEnergyWeapons()` directly. (`fireAllPhaserArrays` had no remaining callers; auto-delegation already used `fireEnergyWeapons`.)

### Architecture
- [x] **`G.threat.fireInterval` as derived value** — done. `getEffectiveFireInterval()` (state.js) computes base × difficulty × `weapon_disrupt` × active-scanner each frame; `G.threat.fireInterval` is no longer mutated (the field is gone — only the derived getter is used).
- [x] **`initiateVesselSimulation` module reset pattern** — done. The ~180-line monolith is replaced by per-module `*ResetForBattle()` functions, each owning its own state: `enemyResetForBattle(cfg,diff)` (enemy-ai.js), `engineeringResetForBattle(shipCfg,diff)` (engineering.js — player hull/shields/ordnance/systems/EPS/battery/repair/ablative), `tacticalResetForBattle()`, `helmResetForBattle()`, `sensorsResetForBattle()`, `commandResetForBattle()`, `crewResetForBattle()`. `initiateVesselSimulation` calls them in order, then resets only cross-cutting lifecycle/score/visual state inline. Guarded by the smoke harness (which runs many sequential engagements). Root cause of bugs #34, #36, #60, #61.
- [x] **Enemy regen in `computeConduitConduction`** — done. Moved to `processEnemyAI()` (enemy-ai.js), in the non-cloaked path where `cfg`/`sc` are already in scope, alongside the other enemy state updates. This was the root cause of #92/#93/#126 (the `shields_sys` key error hid because it lived in the wrong file).

### File structure (June 2026 split)
- [x] **main.js** (1,127 → 509 lines) — campaign mode → `campaign.js`; pre-battle briefing + `startCombat` → `briefing.js`; setup wizard + ship selection + weapon-matrix/cap-bar builders + splash → `setup.js`.
- [x] **canvas-three.js** (1,725 → 562 lines) — per-frame render loop → `canvas-three-render.js`; all mesh/geometry builders → `canvas-three-geometry.js`. Scene setup + model loading + scene-construction helpers remain.
