# 🖖 USS Defiant Battle Simulator - A STAR TREK FAN PRODUCTION

“Star Trek and all related marks, logos and characters are solely owned by CBS Studios Inc. This fan production is not endorsed by, sponsored by, nor affiliated with CBS, Paramount Pictures, or any other Star Trek franchise, and is a non-commercial fan-made film intended for recreational use.  No commercial exhibition or distribution is permitted. No alleged independent rights will be asserted against CBS or Paramount Pictures.”

A Star Trek: Deep Space Nine tactical combat game featuring the USS Defiant in intense one-on-one starship battles against iconic adversaries.

**[Play Now →](https://cmdelee.github.io/st-game/)**

---

## Overview

You command the USS Defiant NX-74205 in real-time combat. Choose your operational station — **Tactical**, **Engineering**, or **Helm** — and the computer automatically handles the stations you don't occupy. Fight across three difficulty levels while managing weapons, shields, power, cloaking systems, navigation, and crew casualties.

---

## Features

- **Three Command Stations**: Tactical (weapons), Engineering (power & repairs), or Helm (navigation & manoeuvres)
- **Authentic DS9 Interface**: Full LCARS styling with canon ships from Klingons, Romulans, Cardassians, Dominion, and Borg
- **9 Enemy Vessels**: Each with faction-specific AI, weapons, and unique mechanics
- **3D Spatial Battle View**: Three.js WebGL rendering — ships move, bank, and close range dynamically
- **Advanced Combat**:
  - Real-time four-sector shield management
  - Cloaking device with vulnerability windows (player and enemy)
  - Burst-fire salvos overwhelming enemy shield regen
  - Shield frequency rotation countering weapon types
  - Evasive Pattern Delta reducing enemy lock rate
  - Four sensor scan profiles (shields / hull fissures / disrupt / tetryon ECM)
  - Enemy subsystem targeting
  - Ablative armour (6 regenerating layers)
- **Helm Controls**: Speed setting, attack vector, engagement range, attack runs, come-about
- **Dynamic AI**: Klingons close range over time; Romulans generate sensor ghosts; Borg adapt per weapon; Jem'Hadar can ram
- **Named Crew**: Worf, O'Brien, Bashir, Nog — casualties degrade their station's effectiveness
- **Emergency Systems**: Battery backup, emergency warp escape, damage control

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
| Sensor Scans | +25% vs shields / +35% all dmg / −50% enemy fire / −70% enemy lock |
| Subsystem Grid | Target enemy weapons, shields, engines, sensors individually |
| Emergency Warp | Escape at hull ≤35% — costs torpedoes |

### 🟣 Engineering
Allocate power, manage repairs, and run the cloaking device. Auto-tactical fires weapons on a 2.4s clock.

| Control | Effect |
|---|---|
| EPS Allocation | Distribute up to 120MW across 11 systems (zero-sum) |
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
| Speed | Stop / Maneuvering / Half / Full Impulse | Scales enemy lock rate (×0.65–1.35) and player weapon yield (×0.88–1.10). Engine glow and Defiant drift reflect current speed in 3D view. |
| Attack Vector | Fore / Port / Stbd / Aft | 65% chance enemy fire hits the selected shield sector. Shows live MW on each button. |
| Engagement Range | Long / Medium / Close | Torpedoes +15% at long; cannons +20% at close. Moves ships in 3D view. |
| Attack Run | — | 8s cannon +20% boost, closes to combat range; resets to medium on expiry. 20s CD. |
| Come About | — | 3s rotation (all sectors exposed); auto-presents strongest shields on completion. 18s CD. |
| Evasive Delta | — | Same as tactical station. |
| Emergency Warp | — | Same as tactical station. |

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
| Borg Probe | Borg | Per-weapon resistance 0–75%, tractor beam, escalating damage |

---

## Combat Tips

1. **Attack Vector (Helm)**: Angle your strongest shields toward incoming fire — fore (320MW) is strongest
2. **Burst Fire**: Use when lock is ≥20% to overwhelm enemy shield regen before it recovers
3. **Cloak timing**: Engage cloak during a lull; regen credit accrues while cloaked
4. **Borg weapons**: Rotate through all weapon types — each builds resistance independently
5. **Klingons**: Stay at long range or use Evasive Pattern when they close to brawling distance
6. **Romulan ghosts**: False sensor contact while cloaked — ignore and await the real decloak window
7. **Jem'Hadar ram**: Pump fore shields and activate Evasive Pattern when you see "RAMMING RUN"
8. **EPS heat**: Sustained fire heats conduits — above 70% reduces capacitor recharge rate
9. **Subsystem targeting**: Destroying enemy weapons or cloak changes the whole fight

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

| Level | Enemy Hull | Enemy Damage | Enemy Lock | Features |
|---|---|---|---|---|
| Normal | ×1.0 | ×1.0 | ×1.0 | Hull-sector targeting only |
| Hard | ×1.3 | ×1.25 | ×1.4 | AI targets player subsystems (25%) |
| Elite | ×1.6 | ×1.5 | ×1.8 | Precise subsystem strikes (45%), slower repairs |

---

## Architecture

No build step. Nine plain JS files loaded in order:

```
state.js        — constants (HELM_SPEED_CONFIG, DIFFICULTY, ENEMY_CONFIGS, …), G state object
engineering.js  — power allocation, repairs, EPS conduit, ablative armour
tactical.js     — weapons, enemy AI, cloaking, scanning, auto-delegation
helm.js         — speed control, attack vector, engagement range, attack run, come-about
canvas.js       — Three.js 3D battle view + 2D enemy schematic / hull / power canvases
ui.js           — deck switching, global UI sync, scoring, end-game
main.js         — game loop, simulation init, boot sequence
lcars.css       — LCARS styling
index.html      — shell + script tags
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
