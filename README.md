# 🖖 USS Defiant Battle Simulator

A Star Trek: Deep Space Nine tactical combat game featuring the USS Defiant in intense one-on-one starship battles against iconic Federation adversaries.

**[Play Now →](https://cmdelee.github.io/st-game/)**

## Overview

You command the USS Defiant, the Federation's most advanced tactical starship, in dynamic real-time combat encounters. Choose your operational station and engage enemy vessels across three difficulty levels while managing weapons, shields, cloaking systems, and crew casualties.

### Features

- **Dual-Station Command**: Control from **Tactical** (weapons & maneuvers) or **Engineering** (power distribution & repairs)
- **Authentic DS9 Design**: LCARS-styled interface with Star Trek canon ships from the Federation, Klingons, Romulans, Cardassians, Borg, and Jem'Hadar
- **Advanced Combat Mechanics**:
  - Real-time shield sector management (Fore/Port/Starboard/Aft)
  - Cloaking device with vulnerability windows
  - Burst fire salvos and shield frequency rotation
  - Evasive pattern maneuvers
  - Sensor scanning profiles
  - Enemy adaptive AI with faction-specific behaviors
- **Dynamic Difficulty**: Normal, Hard (system targeting), Elite (aggressive adaptation)
- **Persistent Crew Roster**: Named officers with casualty tracking and role-specific penalties
- **Ablative Armor System**: 6-layer armor that regenerates between hits
- **Subsystem Targeting**: Disable enemy weapons, shields, engines, sensors, and more
- **Emergency Systems**: Battery backup, emergency warp escape, damage control

## Getting Started

### Quick Play (No Installation)
Simply visit **[https://cmdelee.github.io/st-game/](https://cmdelee.github.io/st-game/)** in your web browser and select your station!

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/cmdelee/st-game.git
   cd st-game
   ```

2. Start a local web server:
   ```bash
   python -m http.server 8000
   # or: npx http-server
   ```

3. Open your browser to `http://localhost:8000`

## How to Play

### Station Selection
Choose your command position at game start:
- **Tactical**: Direct weapons, manage evasive maneuvers, and coordinate sensor sweeps
- **Engineering**: Allocate power distribution, perform repairs, and monitor subsystem health

### Tactical Controls
- **Fire Weapons**: Pulse cannons, nose beam phaser, quantum torpedoes
- **Burst Salvo**: All-cannon barrage (12s cooldown)
- **Shield Frequency**: Counter incoming weapon types (30s cooldown)
- **Evasive Pattern**: Reduce enemy lock rate 60% for 8 seconds
- **Cloaking**: Go dark with vulnerability window on decloak
- **Sensor Scans**: Profile enemy shields, hull, weapons, or tetryon ECM

### Engineering Controls
- **Power Allocation**: Distribute 120MW across weapons, shields, sensors, engines, warp core
- **Repair Queue**: Prioritize damaged systems
- **Shield Regen**: Manage shield regeneration rate (normal/boost modes)
- **Emergency Battery**: Backup power when warp core trips
- **Ablative Armor**: Monitor 6-layer ablative armor regeneration

### Combat Tips

1. **Manage Power**: Don't max out all systems—focus power on your tactical priorities
2. **Shield Sectors**: Rotate incoming fire across shield sectors to spread damage
3. **Cloaking**: Use cloak strategically during repairs, but watch for vulnerability
4. **Enemy Adaptation**: Borg probes adapt to repeated weapons—**switch frequently**
5. **Crew Casualties**: Losing key crew (Worf, O'Brien, Bashir, Nog) reduces effectiveness
6. **Burst Fire**: Overwhelms enemy shield regeneration when lock is good (20%+)
7. **Emergency Warp**: Only available below 35% hull—escape with honor!

## Enemy Vessels

Each enemy has unique characteristics:

- **Klingon D'deridex (Vor'cha)**: Heavy armor, close-range disruptor bonus, ramming threat
- **Romulan Warbird**: Cloaking device, plasma torpedoes, sensor ghosts
- **Cardassian Galor**: Balanced weapons, system-targeting AI
- **Borg Cube/Probe**: Adaptive shielding (switch weapons!), tractor beam, tetryon attacks
- **Jem'Hadar Fighter**: Can ram at low hull, unpredictable maneuvers
- **Romulan Bird of Prey**: Sensor decoys, hit-and-fade tactics

## Game Mechanics

### Shield System
- Four sectors (Fore/Port/Starboard/Aft) regenerate separately
- Shield frequency rotation provides 25% damage reduction vs. specific weapon types
- Cloaking disables shields but accumulates regeneration credit

### Power Management
- Zero-sum system: Total allocated power cannot exceed 120MW (150MW with battery)
- System stress accumulates with heavy load—can cause overheating/burnout
- Conduit breakers trip systems when stress maxes out

### Crew Status
Each crew member affects combat:
- **Worf (Tactical)**: Reduces targeting accuracy when wounded/incapacitated
- **O'Brien (Engineering)**: Slows repair speed when incapacitated
- **Bashir (Medical)**: Affects casualty rates and crew recovery
- **Nog (Helm)**: Reduces evasive maneuver effectiveness when injured

### Scoring

Points awarded for:
- Time survived (difficulty multiplier)
- Damage dealt
- Enemy subsystems destroyed
- Successful repairs
- Hull integrity (victory bonus)
- Penalties for breaches, casualties, emergency warp

## Difficulty Levels

| Difficulty | Enemy Health | Fire Rate | Features |
|---|---|---|---|
| **Normal** | ×1.0 | ×1.0 | Basic engagement |
| **Hard** | ×1.3 | ×0.8 | System targeting AI |
| **Elite** | ×1.6 | ×0.7 | Aggressive adaptation, precise strikes |

## Architecture

- **main.js**: Master game loop, initialization
- **state.js**: Global game state, subsystems, crew data
- **tactical.js**: Weapons, cloaking, enemy AI, combat logic
- **engineering.js**: Power allocation, repairs, damage control
- **canvas.js**: Rendering (spatial view, hull schematic, power distribution)
- **ui.js**: UI synchronization, deck switching, scoring
- **lcars.css**: LCARS-themed styling

## Browser Compatibility

- Chrome/Chromium ✓
- Firefox ✓
- Safari ✓
- Edge ✓
- Requires modern browser with HTML5 Canvas support

## Development

### Adding Features
1. Game state lives in `state.js`
2. Combat logic in `tactical.js`
3. Systems management in `engineering.js`
4. UI updates in `ui.js`
5. Canvas rendering in `canvas.js`

### Running Tests
No external dependencies—just serve files via HTTP.

## Known Limitations

- No keyboard shortcuts (button-click interface only)
- Single-player only
- No save/load between sessions
- Mobile optimization in progress

## Credits

Inspired by Star Trek: Deep Space Nine tactical gameplay. Ship designs and factions based on canon Federation encounters.

## License

Open source. Feel free to fork, modify, and contribute!

---

**Engage!** 🖖

*"Never give up. Never surrender."* — USS Defiant Motto
