# 🖖 Starship Battle Simulator - A STAR TREK FAN PRODUCTION

"Star Trek and all related marks, logos and characters are solely owned by CBS Studios Inc. This fan production is not endorsed by, sponsored by, nor affiliated with CBS, Paramount Pictures, or any other Star Trek franchise, and is a non-commercial fan-made interactive experience intended for recreational use. No commercial exhibition or distribution is permitted. No alleged independent rights will be asserted against CBS or Paramount Pictures."

Command a Starfleet vessel in real-time tactical combat. Choose from two iconic ships and four command stations — the computer handles everything you don't.

**[Play Now →](https://cmdelee.github.io/st-game/)**

---

## Overview

You command either the **USS Defiant NX-74205** (Defiant-class) or the **USS Enterprise NCC-1701-E** (Sovereign-class) in one-on-one starship combat. Choose your operational station — **Tactical**, **Engineering**, **Helm**, or **Captain's Chair** — and the computer automatically handles the stations you don't occupy. Fight across three difficulty levels while managing weapons, shields, power, navigation, and crew casualties.

---

## Choose Your Ship

### ⬟ USS Defiant NX-74205 — Defiant-class

The overpowered escort from Deep Space Nine. Compact, aggressive, and uncompromising.

| Stat | Value |
|---|---|
| Hull | 500 |
| Fore Shields | 320 |
| Quantum Torps | 18 |
| Photon Torps | 12 |
| Special | Ablative armor (6 layers), Cloaking device |
| Crew | Worf · O'Brien · Nog · Dr. Bashir |

**Weapons:** 4× pulse cannons, heavy nose emitter (65yd), fwd/aft torpedo tubes  
**Overload modes:** Cannon Overcharge (+50%), Unstable Torpedo (+70%), Emergency Power Dump  
**Burst:** 4-cannon burst salvo (800ms window)

---

### ◈ USS Enterprise NCC-1701-E — Sovereign-class

Starfleet's flagship from the TNG films. Larger, tougher, and bristling with phaser arrays.

| Stat | Value |
|---|---|
| Hull | 750 |
| Fore Shields | 500 |
| Quantum Torps | 24 |
| Photon Torps | 30 |
| Special | Regenerative shielding (×1.4 regen), Saucer Separation |
| Crew | Worf · La Forge · Data · Dr. Crusher |

**Weapons:** 9× Type-XII phaser arrays (all arcs), Primary Stardrive Emitter (90yd), Aft Stardrive Emitter (55yd), 2× fwd quantum tubes + aft tube  
**Overload modes:** Max Phaser Output (+60%), Tricobalt Warhead (300yd, 1/game), Emergency Power Dump  
**Burst:** Concentrated Phaser Fire (all in-arc arrays, 180ms/array)

---

## Features

- **Ship Selection**: Choose USS Defiant or USS Enterprise NCC-1701-E before each engagement — each with unique weapons, stats, special abilities, and crew
- **Four Command Stations**: Tactical (weapons), Engineering (power & repairs), Helm (navigation), Captain's Chair (command overview + crew orders)
- **Two Game Modes**:
  - **Single Engagement** — pick Normal / Hard / Elite, fight one random enemy from that pool
  - **Campaign Run** — fight all 9 enemies in order from easiest to hardest; score accumulates, ship restores between fights; Borg Probe is the final boss
- **Authentic LCARS Interface**: Full LCARS styling with canon ships from Klingons, Romulans, Cardassians, Dominion, and Borg. 2D schematics feature LCARS-style section headers, inline mini-bars for hull/shields/systems/lock, scan bonus readouts, and adaptive resistance displays
- **9 Enemy Vessels**: Each with faction-specific AI, weapons, combat phase arcs, and hull milestone events
- **3D Spatial Battle View**: Three.js WebGL — Defiant and Sovereign-class meshes, authentic Star Trek weapon colours (amber phasers, orange-red photon torpedoes, blue-white quantum torpedoes, green plasma), faction-coloured 3D beam tubes fired from **correct hull hardpoints** (pulse cannons from nacelle flanks, nose emitter from bow, saucer arrays from saucer rim, etc.), enemy beams from faction-accurate positions (Klingon wing tips, Romulan head/boom emitters, Jem'Hadar forward wing cannons, Borg all 6 faces), torpedo impacts with shockwave rings, nacelle exhaust particles (scale with helm speed), burst-salvo shockwave, saucer separation flies independently, Jem'Hadar ramming trajectory indicator
- **Advanced Combat**:
  - Real-time four-sector shield management with sector reinforcement and equalisation
  - Cloaking device (Defiant) / Saucer Separation (Enterprise-E) with distinct mechanics
  - Burst salvos, alpha salvo, and ship-specific overload weapon modes
  - Shield frequency rotation countering enemy weapon types
  - Evasive Pattern Delta, Pattern Alpha, Attack Pattern Omega, Picard Manoeuvre
  - Single comprehensive deep scan — reveals **all** of the current enemy's frequency bonuses at once (shield freq / hull weakness / sensor blind / weapon disrupt) as **permanent frequency locks** that persist until overwritten (or until the Borg adapt)
  - Enemy subsystem targeting — focused beam deals 62% system damage + 22% collateral hull bleed through penetrating energy; shields absorb up to 45% first
  - Ablative armour — 6 regenerating layers (Defiant only)
  - Regenerative shielding (Enterprise-E only)
  - **Canon weapon arcs** — all weapons respect Trek-accurate firing arcs across both ships; both torpedo launchers per bay fire simultaneously (quantum first, photon fallback), with fully independent fore/aft capacitors
- **Engineering Power System**: Zero-sum EPS allocation across 11 systems, thermal buildup, breaker trips, warp core cascade failures, one-click power presets
- **Battle Realism**: Enemy hull milestones (75/50/25/10%) trigger faction dialogue and automatic reactions — Klingon death salvo, Romulan emergency cloak, Jem'Hadar fury scaling
- **Dynamic AI**: Klingons close range; Romulans fire plasma immediately on decloak; Borg adapt per-weapon; Jem'Hadar fire faster as they take damage
- **Captain's Chair**: Live crew comms feed (ship-appropriate crew voices), 40+ order buttons, autonomous crew automation with command overrides
- **Named Crew**: Casualties degrade station effectiveness — both crews fully voiced with distinct speech patterns
- **Last Stand**: Below 20% hull the crew reacts — helm goes full impulse, engineering reroutes shield power, Worf calls battle stations; viewport pulses red
- **Post-battle Debrief**: Full tactical report — weapons by type, breaches by sector, systems tripped, peak hit, crew status, enemy phase reached
- **Responsive Multi-device Support**: Tablet and mobile layouts with slide-out panels, bottom navigation bar, and compact status strip — playable on any screen size

---

## Quick Start

**No installation** — visit **[https://cmdelee.github.io/st-game/](https://cmdelee.github.io/st-game/)** and pick your station.

### Local Development

```bash
git clone https://github.com/cmdelee/st-game.git
cd st-game
python -m http.server 8000   # or: npx serve .
```

Open `http://localhost:8000`. No build step, no bundler.

---

## Stations

### 🔴 Tactical

Direct weapons fire, manage evasive manoeuvres, operate cloak or saucer sep, and run sensor sweeps. Engineering runs on auto-delegation.

**Defiant weapons:**

| Control | Arc | Effect |
|---|---|---|
| All Pulse Cannons ×N | Fore (upper); Fore/Port or Fore/Stbd (lower) | All in-arc cannons — label updates dynamically |
| Nose Beam | Fore only | Heavy emitter — 65yd |
| Fwd/Aft Quantum Torpedo | Fore/Port/Stbd · Aft/Port/Stbd | Binary — full yield ≥60% lock |
| Fwd/Aft Photon Torpedo | Fore/Port/Stbd · Aft/Port/Stbd | Flat damage, no lock required |
| ⚡⚡ Burst Salvo | In-arc cannons | 4-cannon 800ms barrage |
| ◉ Cloak | — | 1200ms vulnerability window; regen credit accrues while cloaked |
| ⚡ Overcharge | — | Cannons +50%, breaker risk, 30s CD |
| ☢ Unstable Torpedo | — | Quantum +70%, 25% misfire, 35s CD |

**Enterprise-E weapons:**

| Control | Arc | Effect |
|---|---|---|
| All Phaser Arrays ×9 | Various (see below) | All in-arc arrays fire simultaneously |
| Primary Stardrive Emitter | Fore only | Heaviest single array — 90yd |
| Aft Stardrive Emitter | Aft/Port/Stbd | Powerful aft defence — 55yd |
| Individual phaser buttons | F/P/S or F/P/A or A/P/S | 9 individually targetable arrays |
| Fwd Quantum Tube A + B | Fore/Port/Stbd | Dual forward quantum launchers |
| Aft Quantum / Photon | Aft/Port/Stbd | Aft launcher |
| ◯ Saucer Separation | — | Toggle — stays separated until reconnect ordered. Enemy lock −60%. 60s CD after reconnect |
| ⚡ Max Phaser Output | — | All phasers +60%, 30s CD |
| ☢ Tricobalt Warhead | — | 300yd, no lock, 40% hull bleed-through, 1 per engagement |

Both ships share: Alpha Salvo, Shield Frequency Rotation, Evasive Pattern, Emergency Power Dump, Deep Scan (single comprehensive scan), Subsystem Targeting Grid, Emergency Warp.

**Simplified fire interface**: Quick-fire buttons — **Fire Phasers** (all in-arc energy weapons), **Fire Torpedoes** (both launchers simultaneously — quantum first, photon fallback), and **Fire All** (full alpha salvo) — let you engage immediately without selecting individual arrays.

### 🟣 Engineering

Allocate power, manage repairs. Auto-tactical fires weapons on a 2.4s clock.

| Control | Effect |
|---|---|
| EPS Allocation | Distribute up to 120MW across 11 systems (zero-sum) |
| Power Presets | Attack / Silent Running / Evasive / Damage Control |
| Repair Teams | Alpha and Beta teams independently dispatched |
| Shield Regen | Boost or normalise shield power |
| Emergency Battery | Backup power when warp core trips |
| Breaker Grid | Re-latch tripped EPS conduits |
| Ablative Armour | Status display (Defiant only) |
| Saucer Separation | Status + trigger (Enterprise-E only) |

### 🩷 Helm

Navigate the ship and control the engagement. Both auto-tactical and auto-engineering run simultaneously.

| Control | Options | Effect |
|---|---|---|
| Speed | Stop / Maneuvering / Half / Full Impulse | Enemy lock ×0.65–1.35; player yield ×0.88–1.10 |
| Attack Vector | Fore / Port / Stbd / Aft | 65% chance enemy fire hits selected shield sector |
| Engagement Range | Long / Medium / Close | Torpedoes +15% long; cannons/arrays +20% close |
| Attack Run | — | 8s weapon +20%, closes range. 20s CD |
| Come About | — | 3s rotation; auto-presents strongest shields. 18s CD |
| Evasive Delta | — | Enemy lock −60% for 8s. 20s CD |
| Picard Manoeuvre | — | Micro-warp; enemy cannot fire for 3s. 60s CD |
| Pattern Omega | — | All weapons +40% for 10s. 45s CD |
| Evasive Alpha | — | Maximum evasion for 5s. 15s CD |
| Cloak / Saucer Sep | — | Ship-specific special ability |
| Emergency Warp | — | Escape at hull ≤35% |

### ⭐ Captain's Chair

All three stations fully automated. Issue orders and override crew decisions.

**Defiant crew:**

| Crew | Orders |
|---|---|
| **Worf** | Fire Cannons/Quantum/Photon/Burst/Alpha, Rotate Freq, Cloak, Hold Fire, Target subsystems (7), Deep Scan, Evasive |
| **O'Brien** | Equalise Shields, Boost Regen, Battery, Repair Weapons/Systems/Cloak, Flush EPS, Damage Control |
| **Nog** | Vectors (4), Speed (3), Range (3), Attack Run, Come About, Picard, Omega, Evasive Alpha, Auto Shield Track, Silent Running, Emergency Thrusters, Emergency Warp |

**Enterprise-E crew (same order buttons, different voices):**

| Crew | Voice |
|---|---|
| **Worf** | Tactical — same character, same orders |
| **La Forge** | Engineering — enthusiastic, can-do. *"La Forge here — we'll have it sorted, Captain."* |
| **Data** | Helm/Ops — precise, formal, no contractions. *"Enemy targeting solution at precisely 47 percent."* |

---

## Enemy Vessels

| Vessel | Faction | Signature Mechanic | Campaign Level |
|---|---|---|---|
| Jem'Hadar Attack Ship | Dominion | Polaron bypass (22%), **ram** at <20% hull | L1 |
| Cardassian Scout | Cardassian | Fast lock (7.5/s), frequent harassment fire | L2 |
| Romulan Bird-of-Prey | Romulan | Plasma torpedo (18s reload), fires **immediately on decloak**, sensor ghosts | L3 |
| Galor-Class Warship | Cardassian | Balanced phasers, photon torpedoes | L4 |
| Jem'Hadar Battle Cruiser | Dominion | Heavy polaron bypass, fury scaling, ramming | L5 |
| K'Tinga Battle Cruiser | Klingon | Closes range (+40% close disruptors), cloak, **death salvo** at 10% | L6 |
| Vor'Cha Attack Cruiser | Klingon | Wing disruptors, heavy torpedoes, close aggression, cloak | L7 |
| D'Deridex Warbird | Romulan | Massive plasma (22s reload), sensor ghosts, emergency cloak at 25% | L8 |
| Borg Probe | Borg | Per-weapon resistance 0–65%, tractor beam, escalating damage — **final boss** | L9 |

---

## Combat Tips

1. **Attack Vector & Arcs (Defiant)**: FORE for maximum firepower (4 cannons + nose + fwd torps). Port/Stbd for maximum torpedo throughput. Aft for aft tubes while tanking with fore shields
2. **Attack Vector (Enterprise-E)**: FORE brings 7 of 9 phaser arrays into arc. AFT still fields 4 arrays + aft tubes — the Enterprise fights effectively in every direction
3. **Burst Fire / Concentrated Fire**: Use at ≥20% lock to overwhelm shield regen before it recovers
4. **Cloak timing (Defiant)**: Engage during a lull; regen credit accrues while cloaked, restoring shields on decloak
5. **Saucer Separation (Enterprise-E)**: Toggle mechanic — saucer stays separated until you order reconnect. Enemy lock −60% the whole time. Use offensively to build lock safely, or defensively when you need sustained pressure relief. 60s cooldown starts after the 6s docking sequence completes
6. **Tricobalt Warhead (Enterprise-E)**: 40% bypasses shields directly to hull. Save it for the Borg (adaptation doesn't apply to subspace weapons) or a Klingon berserk window
7. **Regenerative Shields (Enterprise-E)**: The ×1.4 regen bonus means even heavily damaged shield sectors recover quickly — play aggressively and let the shields do their job
8. **Warp core cascades**: A tripped core spikes stress on engines (+35%), shields (+22%), sensors (+15%) — keep EPS stress low before a core risk
9. **Last stand**: Below 20% hull the crew acts immediately — use the window for overload modes the auto-delegation won't think of
10. **Borg**: Rotate through all weapon types — each builds resistance independently. The Enterprise's broad array roster makes rotation easier but you must still do it
11. **Klingons**: Stay at long range; their disruptors gain +40% at close quarters
12. **Romulan ghosts**: False sensor contacts while cloaked — hold fire and await the real decloak window
13. **Jem'Hadar ram**: Pump fore shields and activate Evasive when you see "RAMMING RUN"
14. **EPS heat**: Sustained fire heats conduits — above 70% reduces capacitor recharge up to 30%
15. **Campaign**: Each level restores your ship fully — don't hold back on torpedoes or overload modes
16. **Deep Scan**: Scan bonuses are permanent frequency locks, not timers — run a scan early and it pays off all fight. Disrupt scan (−50% enemy fire rate) is often the strongest opener
17. **Fire at Will**: Use the quick Fire Phasers / Fire Torpedoes / Fire All buttons to keep up pressure; the simplified interface fires the best available weapons without hunting for individual array buttons
18. **Subsystem targeting**: Targeting a specific system still deals hull damage as collateral — roughly 12–22 hull bleed per 100 damage depending on whether attack-vector shields are up. You can't avoid attriting the hull entirely, but focused targeting is still more efficient at destroying systems than general hull fire

---

## Campaign Run

Pick your ship and station once, then fight all 9 enemies in order. Ship fully restored between every fight.

| Level | Enemy | Key Challenge |
|---|---|---|
| L1 | Jem'Hadar Fighter | Fast, polaron bypass, ramming — learn the basics |
| L2 | Cardassian Scout | Fast lock, constant harassment |
| L3 | Romulan Bird-of-Prey | Decloak → instant plasma torpedo |
| L4 | Galor Warship | Heavier fight, Hard multipliers begin |
| L5 | Jem'Hadar Battle Cruiser | Gets faster as it takes damage — kill it quickly |
| L6 | K'Tinga Battle Cruiser | Closes to brawling range — death salvo at 10% hull |
| L7 | Vor'Cha Attack Cruiser | Wing disruptors devastate at close range |
| L8 | D'Deridex Warbird | Longest fight — plasma reload windows are your opportunity |
| **L9** | **Borg Probe** | Rotate all weapon types; never fire the same weapon consecutively |

---

## Crew

### USS Defiant — DS9 Crew

| Officer | Station | Wounded | Incapacitated |
|---|---|---|---|
| Lt. Cmdr Worf | Tactical | 65% targeting accuracy | 30% accuracy |
| Chief O'Brien | Engineering | 65% repair speed | 30% repair speed |
| Ensign Nog | Helm | Evasive: 40% lock reduction | Evasive: 20% reduction |
| Dr. Bashir | Medical | Casualty threshold ×0.7 | Casualty threshold ×0.4 |

### USS Enterprise — TNG Films Crew

| Officer | Station | Wounded | Incapacitated |
|---|---|---|---|
| Lt. Cmdr Worf | Tactical | 65% targeting accuracy | 30% accuracy |
| Lt. Cmdr La Forge | Engineering | 65% repair speed | 30% repair speed |
| Lt. Cmdr Data | Helm/Ops | Evasive: 40% lock reduction | Evasive: 20% reduction |
| Dr. Beverly Crusher | Medical | Casualty threshold ×0.7 | Casualty threshold ×0.4 |

---

## Difficulty

| Level | Enemy Pool | Enemy Hull | Damage | Lock | Fire | Player Hull | Features |
|---|---|---|---|---|---|---|---|
| Normal | Fighter, Scout, BoP, Galor, K'Tinga | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | Hull-sector targeting only |
| Hard | All 8 conventional ships | ×1.12 | ×1.10 | ×1.25 | ×0.88 | ×0.88 | AI targets player subsystems (20%) |
| Elite | **Borg Probe only** | ×1.40 | ×1.20 | ×1.25 | ×0.80 | ×0.85 | Subsystem strikes (25%) |

### Campaign difficulty brackets
- Levels 1–3: Normal · Levels 4–8: Hard · Level 9 (Borg): Elite

---

## Architecture

No build step. 15 plain JS files loaded in order:

```
config.js            — constants: DIFFICULTY, ENEMY_CONFIGS, ARRAYS_DICTIONARY,
                       PLAYER_SHIP_CONFIGS (both ships + weapon arrays + crew + defaultPower)
state.js             — G state object; G.playerShipKey/Config/activeWeaponArrays
engineering.js       — power, repairs, EPS, ablative armour (Defiant), shield regen
crew.js              — casualties, efficiency modifiers, emergency warp
sensors.js           — scan profiles, subsystem targeting
tactical.js          — player weapons, cloaking/saucer sep, saucer auto-fire,
                       burst/overload/Enterprise modes
helm.js              — speed, vector, range, all helm manoeuvres
encounter-phases.js  — faction encounter phase arcs, hull milestone events (75/50/25/10%),
                       Klingon death salvo
enemy-ai.js          — enemy cloaking AI, sensor ghosts, mechanics timers, Jem'Hadar
                       ramming, AI loop, enemy fire
auto-delegation.js   — computer management of uncrewed stations (auto-engineering,
                       auto-tactical, captain-mode autonomous crew behaviours)
command.js           — Captain's Chair: crew reports (ship-aware), order cooldowns, crew AI
canvas-three.js      — Three.js 3D view; Defiant + Sovereign-class meshes; 3D beam tubes,
                       burst shockwave, torpedo impacts, exhaust particles, saucer sep mesh
canvas-2d.js         — 2D schematics: Defiant hull / Enterprise hull / enemy / power
ui.js                — deck switching, global UI sync, scoring, end-game
main.js              — game loop, sim init, ship selection, campaign
lcars.css            — LCARS styling
index.html           — splash, ship selection UI, shell + script tags
```

### Ship config architecture

`PLAYER_SHIP_CONFIGS` in `config.js` defines each vessel — hull, shields, torpedoes, system labels, default power, crew, weapon array definitions, and overload mode variants. `G.activeWeaponArrays` switches between `ARRAYS_DICTIONARY` (Defiant) and Enterprise-E's `weaponArrays` at game start. Adding a third ship means a new entry in `PLAYER_SHIP_CONFIGS` and a geometry function in `canvas-three.js`.

---

## Browser Compatibility

Requires WebGL for the 3D spatial view (Three.js r128).

- Chrome / Chromium ✓  
- Firefox ✓  
- Edge ✓  
- Safari ✓ (WebGL must be enabled)

---

## Credits

Inspired by Star Trek: Deep Space Nine and the TNG films. Ship designs and faction mechanics based on canon DS9/TNG/TOS encounters.

---

**Engage!** 🖖
