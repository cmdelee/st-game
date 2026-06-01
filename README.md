# 🖖 USS Defiant Battle Simulator - A STAR TREK FAN PRODUCTION

"Star Trek and all related marks, logos and characters are solely owned by CBS Studios Inc. This fan production is not endorsed by, sponsored by, nor affiliated with CBS, Paramount Pictures, or any other Star Trek franchise, and is a non-commercial fan-made film intended for recreational use.  No commercial exhibition or distribution is permitted. No alleged independent rights will be asserted against CBS or Paramount Pictures."

A Star Trek: Deep Space Nine inspired tactical combat game featuring the USS Defiant in intense one-on-one starship battles against iconic adversaries.

**[Play Now →](https://cmdelee.github.io/st-game/)**

---

## Overview

You command the USS Defiant NX-74205 in real-time combat. Choose your operational station — **Tactical**, **Engineering**, **Helm**, or **Captain's Chair** — and the computer automatically handles the stations you don't occupy. Fight across three difficulty levels while managing weapons, shields, power, cloaking systems, navigation, and crew casualties.

---

## Features

- **Four Command Stations**: Tactical (weapons), Engineering (power & repairs), Helm (navigation), or Captain's Chair (command overview with crew orders)
- **Authentic DS9 Interface**: Full LCARS styling with canon ships from Klingons, Romulans, Cardassians, Dominion, and Borg
- **9 Enemy Vessels**: Each with faction-specific AI, weapons, and unique mechanics
- **3D Spatial Battle View**: Three.js WebGL rendering — ships move, bank, and close range dynamically
- **Advanced Combat**:
  - Real-time four-sector shield management with sector reinforcement
  - Cloaking device with vulnerability windows (player and enemy)
  - Burst-fire salvos, alpha salvo, and overload weapon modes
  - Shield frequency rotation countering enemy weapon types
  - Evasive Pattern Delta, Pattern Alpha, Attack Pattern Omega, Picard Manoeuvre
  - Four sensor scan profiles (shields / hull fissures / weapons disrupt / tetryon ECM)
  - Enemy subsystem targeting
  - Ablative armour (6 regenerating layers)
- **Engineering Power System**: Zero-sum EPS allocation across 11 systems, thermal buildup, breaker trips, one-click power presets (Attack / Silent Running / Evasive / Damage Control)
- **Helm Controls**: Speed, attack vector, engagement range, attack runs, come-about, and advanced manoeuvres
- **Dynamic AI**: Klingons close range; Romulans generate sensor ghosts; Borg adapt per-weapon; Jem'Hadar can ram
- **Captain's Chair**: Live crew comms feed, 40+ order buttons across Worf/O'Brien/Nog, autonomous crew automation with command overrides
- **Named Crew**: Worf, O'Brien, Bashir, Nog — casualties degrade their station's effectiveness
- **Emergency Systems**: Battery backup, emergency warp escape, damage control, emergency thrusters

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
Direct weapons fire, manage evasive manoeuvres, operate the cloaking device, and run sensor sweeps. Engineering runs on auto-delegation.

| Control | Effect |
|---|---|
| All Pulse Cannons | Fire all 4 cannons simultaneously |
| Nose Beam | Heavy fore emitter — 55-unit yield |
| Quantum Torpedo | Binary damage — full yield at ≥60% lock |
| Photon Torpedo | Reliable flat damage, no lock required |
| ⚡⚡ Burst Salvo | 4-cannon 800ms barrage; overwhelms shield regen |
| 🛡 Rotate Frequency | 25% incoming reduction for 12s; counters enemy weapon type |
| ◈ Evasive Delta | Enemy lock rate −60% for 8s; 20s cooldown |
| Cloak | 1200ms vulnerability on engage/disengage; regen credit accumulates |
| Alpha Salvo | All weapons at once |
| ⚡ Overcharge | Cannons +50% yield, breaker risk; 30s CD |
| ☢ Unstable Torpedo | Quantum +70% yield, 25% misfire chance; 35s CD |
| ⚡⚡ Power Dump | All weapons +40% for 10s, EPS spike, shields −30%; 50s CD |
| Sensor Scans | +25% vs shields / +35% all dmg / −50% enemy fire / −70% enemy lock |
| Subsystem Grid | Target enemy weapons, shields, engines, sensors individually |
| Emergency Warp | Escape at hull ≤35% |

### 🟣 Engineering
Allocate power, manage repairs, and run the cloaking device. Auto-tactical fires weapons on a 2.4s clock.

| Control | Effect |
|---|---|
| EPS Allocation | Distribute up to 120MW across 11 systems (zero-sum) |
| Power Presets | One-click Attack / Silent Running / Evasive / Damage Control modes |
| Repair Teams | Alpha and Beta teams independently dispatched to damaged systems |
| Shield Regen | Boost or normalise shield power |
| Emergency Battery | Backup power when warp core trips |
| Breaker Grid | Re-latch tripped EPS conduits |
| Flush All | Clear all conduit stress instantly |
| Damage Control | Emergency +30% repair to weapons or systems (costs battery) |

### 🩷 Helm
Navigate the ship and control the engagement. Both auto-tactical (weapons) and auto-engineering (repairs/power) run simultaneously.

| Control | Options | Effect |
|---|---|---|
| Speed | Stop / Maneuvering / Half / Full Impulse | Scales enemy lock rate (×0.65–1.35) and player weapon yield (×0.88–1.10) |
| Attack Vector | Fore / Port / Stbd / Aft | 65% chance enemy fire hits the selected shield sector |
| Engagement Range | Long / Medium / Close | Torpedoes +15% at long; cannons +20% at close |
| Attack Run | — | 8s cannon +20%, closes to combat range. 20s CD |
| Come About | — | 3s rotation; auto-presents strongest shields on completion. 18s CD |
| Evasive Pattern Delta | — | Enemy lock −60% for 8s. 20s CD |
| Picard Manoeuvre | — | Micro-warp jump; enemy cannot fire for 3s. 60s CD |
| Attack Pattern Omega | — | All weapons +40% for 10s. 45s CD |
| Evasive Pattern Alpha | — | Maximum evasion for 5s. 15s CD |
| Emergency Warp | — | Escape at hull ≤35% |

### ⭐ Captain's Chair
Command overview with all three stations fully automated. Issue orders to the crew and override their autonomous decisions.

The crew acts independently — Worf fires weapons and uses burst fire when conditions are right, O'Brien manages repairs and activates the emergency battery, Nog presents shields and initiates attack runs. The captain directs priorities and timing.

| Crew | Orders Available |
|---|---|
| **Worf** | Fire Cannons, Quantum/Photon Torpedo, Burst Salvo, Alpha Salvo, Rotate Freq, Cloak/Decloak, Hold Fire, Target enemy subsystems (7), Sensor scans (4), Evasive Pattern |
| **O'Brien** | Equalise Shields, Boost Shield Regen, Emergency Battery, Repair Weapons/Systems/Cloak, Flush EPS, Damage Control |
| **Nog** | Attack Vector (4), Speed (3), Range (3), Attack Run, Come About, Picard Manoeuvre, Pattern Omega, Evasive Alpha, Auto Shield Track, Silent Running, Emergency Thrusters, Emergency Warp |

---

## Enemy Vessels

| Vessel | Faction | Signature Mechanic |
|---|---|---|
| K'Tinga Battle Cruiser | Klingon | Closes to disruptor range over 45s (+40% damage at close) |
| Vor'Cha Attack Cruiser | Klingon | Heavier close-range disruptors (+35%), cloak |
| Romulan Bird-of-Prey | Romulan | Plasma torpedo (18s reload), sensor ghosts while cloaked |
| D'Deridex Warbird | Romulan | Heaviest plasma banks (22s reload), sensor ghosts, massive hull |
| Cardassian Scout | Cardassian | Fast lock (7.5/s), frequent harassment fire |
| Galor-Class Warship | Cardassian | Balanced weapons, photon torpedoes |
| Jem'Hadar Attack Ship | Dominion | Polaron bypass (30% of shots penetrate shields), will **ram** at <20% hull |
| Jem'Hadar Battle Cruiser | Dominion | Heavy polaron, ram damage 380, elite pool only |
| Borg Probe | Borg | Per-weapon resistance 0–65%, tractor beam, escalating damage |

---

## Combat Tips

1. **Attack Vector**: Angle your strongest shields toward incoming fire — fore (320SP) is strongest
2. **Burst Fire**: Use when lock ≥20% to overwhelm enemy shield regen before it recovers
3. **Cloak timing**: Engage during a lull; regen credit accrues while cloaked, restoring shields on decloak
4. **Borg weapons**: Rotate through all weapon types — each builds resistance independently (caps at 65%)
5. **Klingons**: Stay at long range or use Evasive Pattern when they close to brawling distance
6. **Romulan ghosts**: False sensor contacts while cloaked — hold fire and await the real decloak window
7. **Jem'Hadar ram**: Pump fore shields and activate Evasive Pattern when you see "RAMMING RUN"
8. **EPS heat**: Sustained fire heats conduits — above 70% reduces capacitor recharge rate
9. **Subsystem targeting**: Destroying enemy weapons or cloak device changes the whole fight
10. **Captain's Chair**: Issue Hold Fire to O'Brien before cloaking — saves capacitor charge for the decloak window
11. **Power presets**: Switch to Damage Control mode when shields are low; Attack mode for a decisive strike

---

## Crew

| Officer | Station | Wounded | Incapacitated |
|---|---|---|---|
| Lt. Cmdr Worf | Tactical | 65% targeting accuracy | 30% accuracy |
| Chief O'Brien | Engineering | 65% repair speed | 30% repair speed |
| Ensign Nog | Helm | Evasive: 40% lock reduction | Evasive: 20% lock reduction |
| Dr. Bashir | Medical | Casualty threshold ×0.7 | Casualty threshold ×0.4 |

---

## Difficulty

| Level | Enemy Hull | Enemy Damage | Enemy Lock | Enemy Fire | Player Hull | Features |
|---|---|---|---|---|---|---|
| Normal | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | Hull-sector targeting only |
| Hard | ×1.2 | ×1.15 | ×1.3 | ×0.85 | ×0.85 | AI targets player subsystems (20%) |
| Elite | ×1.35 | ×1.28 | ×1.5 | ×0.78 | ×0.78 | Subsystem strikes (30%), slower repairs |

---

## Architecture

No build step. 13 plain JS files loaded in order:

```
config.js       — all game constants (DIFFICULTY, ENEMY_CONFIGS, ARRAYS_DICTIONARY, …)
state.js        — G state object + utility functions (getWarpOutput, postLogEvent, …)
engineering.js  — power allocation, repairs, EPS conduit, ablative armour, power presets
crew.js         — crew casualties, efficiency modifiers, emergency warp
sensors.js      — scan profiles, subsystem targeting grid
tactical.js     — player weapons, cloaking, burst/evasive/overload modes
helm.js         — speed, attack vector, range, all helm manoeuvres
enemy-ai.js     — enemy AI, enemy fire, cloaking AI, mechanics timers, auto-delegation
command.js      — Captain's Chair: crew comms, order cooldowns, autonomous crew behaviors
canvas-three.js — Three.js 3D battle view
canvas-2d.js    — 2D enemy schematic / hull / power canvases
ui.js           — deck switching (4 stations), global UI sync, scoring, end-game
main.js         — game loop, simulation init, boot sequence, captain manoeuvre tickers
lcars.css       — LCARS styling
index.html      — splash screen, shell + script tags
```

---

## Browser Compatibility

Requires WebGL for the 3D spatial view (Three.js r128).

- Chrome / Chromium ✓
- Firefox ✓
- Edge ✓
- Safari ✓ (WebGL must be enabled)

---

## Credits

Inspired by Star Trek: Deep Space Nine. Ship designs and faction mechanics based on canon DS9/TNG/TOS encounters.

---

**Engage!** 🖖
