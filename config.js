'use strict';

// ============================================================
// CONFIG.JS — All game constants
// Loaded first so every other file can reference these.
// ============================================================

// ── Colour palette ───────────────────────────────────────────
const C = { b:'#4477ff', o:'#ff9900', t:'#cc6699', p:'#9966cc', red:'#ff3333', warn:'#ffaa00', green:'#00cc66', dim:'#0a1122', dim2:'#1a2640' };

// ── Difficulty settings ───────────────────────────────────────
const DIFFICULTY = {
  //                         enemy HP    enemy dmg   enemy lock  enemy fire  player HP   targets sys  chance    repair spd
  // Normal — accessible, hull-sector targeting only, standard stats
  normal: { label:'Normal',  enemyHullMult:1.0,  enemyDmgMult:1.0,  enemyLockMult:1.0,  enemyFireMult:1.0,  playerHullMult:1.0,  targetsSystems:false, systemTargetChance:0.00, repairSpeedMult:1.0  },
  // Hard — full enemy roster including Warbird and Jem'Hadar battleship; subsystem targeting;
  // multipliers calibrated so the toughest ships are challenging but not impossible
  hard:   { label:'Hard',    enemyHullMult:1.12, enemyDmgMult:1.10, enemyLockMult:1.25, enemyFireMult:0.88, playerHullMult:0.88, targetsSystems:true,  systemTargetChance:0.20, repairSpeedMult:0.88 },
  // Elite — Borg probe ONLY; multipliers tuned for the adaptation encounter specifically;
  // challenge comes from adaptation mechanic, not pure stat inflation
  elite:  { label:'Elite',   enemyHullMult:1.40, enemyDmgMult:1.20, enemyLockMult:1.25, enemyFireMult:0.80, playerHullMult:0.85, targetsSystems:true,  systemTargetChance:0.25, repairSpeedMult:0.80 },
};
let currentDifficulty = 'normal';

// ── Enemy configs ─────────────────────────────────────────────
const ENEMY_CONFIGS = {
  ktinga: {
    label:"K'TINGA BATTLE CRUISER", faction:'Klingon', era:'TOS/TMP',
    description:"Heavy battle cruiser. Closes to disruptor range aggressively. Devastating torpedoes at close quarters.",
    hull:900, maxHull:900,
    shields:{ fore:220, port:180, starboard:180, aft:150, maxSectorValue:220 },
    hasCloakDevice:true, recoveryCoefficient:0.4, fireInterval:5500, lockRate:3.5,
    preferredTargets:['fore','port','starboard'],
    prefersCloseRange:true,
    closeRangeDmgBonus:1.4,
    systems:{
      // Canon: Mark-8 disruptors (upgrade from D7 Mark-7), forward-mounted in command pod
      disruptors_fwd:{ health:100, label:'Forward Disruptors', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:45, dmgMax:80,  systemTargetKey:'disruptors' },
      // Canon: secondary aft disruptors (dorsal/ventral secondary emitters)
      disruptors_aft:{ health:100, label:'Aft Disruptors',     isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:28, dmgMax:50,  systemTargetKey:'disruptors' },
      // Canon: 1 forward torpedo tube (below bridge in forward command pod)
      torpedoes_fwd: { health:100, label:'Forward Torpedoes',  isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:90, dmgMax:160, systemTargetKey:'torpedoes', isTorpedo:true },
      // Canon: 1 aft torpedo tube (between impulse engines at stern)
      torpedoes_aft: { health:100, label:'Aft Torpedoes',      isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:70, dmgMax:130, systemTargetKey:'torpedoes', isTorpedo:true },
      cloak_device:  { health:100, label:'Cloaking Device',    isWeapon:false, firingArc:[] },
      shields_sys:   { health:100, label:'Shield Generators',  isWeapon:false, firingArc:[] },
      engines:       { health:100, label:'Impulse Engines',    isWeapon:false, firingArc:[] },
      sensors:       { health:100, label:'Sensor Array',       isWeapon:false, firingArc:[] },
      warp_core:     { health:100, label:'Warp Core',          isWeapon:false, firingArc:[] },
    }
  },
  vor_cha: {
    label:"VOR'CHA ATTACK CRUISER", faction:'Klingon', era:'TNG',
    description:"Upgraded Klingon warship. Faster lock, heavier disruptors. Closes to brawling range.",
    hull:1050, maxHull:1050,
    shields:{ fore:250, port:200, starboard:200, aft:170, maxSectorValue:250 },
    hasCloakDevice:true, recoveryCoefficient:0.5, fireInterval:4500, lockRate:4.5,
    preferredTargets:['fore','port','starboard'],
    prefersCloseRange:true,
    closeRangeDmgBonus:1.35,
    systems:{
      // Canon: 1 large heavy forward disruptor in forward assault module + flanking cannons
      disruptors_fwd:  { health:100, label:'Forward Disruptors', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:55, dmgMax:95,  systemTargetKey:'disruptors' },
      // Canon: quad heavy disruptor cannons in wing/claw extensions — broadside-dominant
      disruptors_wing: { health:100, label:'Wing Disruptors',    isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:35, dmgMax:60,  systemTargetKey:'disruptors' },
      // Canon: 2 forward torpedo launchers in forward pod
      torpedoes_fwd:   { health:100, label:'Forward Torpedoes',  isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:100, dmgMax:170, systemTargetKey:'torpedoes', isTorpedo:true },
      // Canon: 2 aft torpedo launchers — 1 in aft pod, 1 in superstructure beneath aft pod
      torpedoes_aft:   { health:100, label:'Aft Torpedoes',      isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:80,  dmgMax:140, systemTargetKey:'torpedoes', isTorpedo:true },
      cloak_device:    { health:100, label:'Cloaking Device',    isWeapon:false, firingArc:[] },
      shields_sys:     { health:100, label:'Shield Generators',  isWeapon:false, firingArc:[] },
      engines:         { health:100, label:'Impulse Engines',    isWeapon:false, firingArc:[] },
      sensors:         { health:100, label:'Sensor Array',       isWeapon:false, firingArc:[] },
      warp_core:       { health:100, label:'Warp Core',          isWeapon:false, firingArc:[] },
    }
  },
  romulan_bop: {
    label:"ROMULAN BIRD-OF-PREY", faction:'Romulan', era:'TOS',
    description:"Classic Romulan vessel. Plasma torpedo is catastrophic but has a long reload. Generates sensor ghosts.",
    hull:750, maxHull:750,
    shields:{ fore:220, port:200, starboard:200, aft:170, maxSectorValue:220 },
    hasCloakDevice:true, recoveryCoefficient:0.3, fireInterval:6500, lockRate:3.0,
    preferredTargets:['fore','port'],
    hasSensorGhosts:true,
    plasmaReloadTime:18000,
    systems:{
      // Canon: plasma torpedo — forward-firing but can bear on broadside targets
      // Arc expanded from ['fore'] only to ['fore','port','starboard'] so torpeodcharge
      // state can aim at the weakest player shield sector, not always fore
      plasma_fwd:  { health:100, label:'Plasma Torpedo Banks', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:110, dmgMax:190, systemTargetKey:'torpedoes', isTorpedo:true, label:'Plasma Torpedo Banks' },
      // Canon: Romulan disruptors — this class uses disruptors, not Federation phasers
      disruptors_fwd: { health:100, label:'Forward Disruptors', isWeapon:true, firingArc:['fore','port','starboard'], dmgMin:35, dmgMax:60, systemTargetKey:'disruptors' },
      disruptors_aft: { health:100, label:'Aft Disruptors',     isWeapon:true, firingArc:['aft','port','starboard'],  dmgMin:25, dmgMax:45, systemTargetKey:'disruptors' },
      cloak_device:{ health:100, label:'Cloaking Device',      isWeapon:false, firingArc:[] },
      shields_sys: { health:100, label:'Shield Generators',    isWeapon:false, firingArc:[] },
      engines:     { health:100, label:'Impulse Engines',      isWeapon:false, firingArc:[] },
      sensors:     { health:100, label:'Sensor Array',         isWeapon:false, firingArc:[] },
      warp_core:   { health:100, label:'Warp Core',            isWeapon:false, firingArc:[] },
    }
  },
  romulan_warbird: {
    label:"D'DERIDEX-CLASS WARBIRD", faction:'Romulan', era:'TNG',
    description:"Massive Romulan warbird. Heavily shielded. Plasma torpedo fires all arcs simultaneously but reloads slowly.",
    hull:1200, maxHull:1200,
    shields:{ fore:280, port:260, starboard:260, aft:230, maxSectorValue:280 },
    hasCloakDevice:true, recoveryCoefficient:0.25, fireInterval:7000, lockRate:2.8,
    preferredTargets:['fore','port','starboard','aft'],
    hasSensorGhosts:true,
    plasmaReloadTime:22000,
    systems:{
      // Canon: forward disruptors in the "head" — primary directed energy weapons,
      // fires both beams and pulses, covers full forward hemisphere
      disruptors_fwd: { health:100, label:'Forward Disruptors',     isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:50, dmgMax:85,  systemTargetKey:'disruptors' },
      // Canon: aft/lateral disruptors — D'Deridex has 360° disruptor coverage
      disruptors_aft: { health:100, label:'Lateral Disruptors',     isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:45, dmgMax:75,  systemTargetKey:'disruptors' },
      // Canon: plasma torpedoes — expanded arc so torpedocharge can aim at weakest sector
      // D'Deridex fires from forward section but plasma can bear on broadside
      plasma_torp:    { health:100, label:'Plasma Torpedo Banks',   isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:120, dmgMax:200, systemTargetKey:'torpedoes', isTorpedo:true },
      cloak_device:   { health:100, label:'Cloaking Device',        isWeapon:false, firingArc:[] },
      shields_sys:    { health:100, label:'Shield Generators',      isWeapon:false, firingArc:[] },
      engines:        { health:100, label:'Impulse Engines',        isWeapon:false, firingArc:[] },
      sensors:        { health:100, label:'Sensor Array',           isWeapon:false, firingArc:[] },
      // Canon: D'Deridex uses artificial quantum singularity as power source — not M/ARA
      warp_core:      { health:100, label:'Quantum Singularity Core', isWeapon:false, firingArc:[] },
    }
  },
  cardassian_scout: {
    label:"CARDASSIAN SCOUT VESSEL", faction:'Cardassian', era:'DS9',
    description:"Fast, agile. No cloak. Locks on quickly, fires frequent harassing spiral-wave disruptor bursts.",
    hull:480, maxHull:480,
    shields:{ fore:120, port:100, starboard:100, aft:80, maxSectorValue:120 },
    hasCloakDevice:false, recoveryCoefficient:0.6, fireInterval:2200, lockRate:7.5,
    preferredTargets:['fore','port','starboard'],
    systems:{
      // Canon: Cardassian spiral-wave disruptors — NOT Federation phasers.
      // systemTargetKey changed to 'disruptors' so shield frequency rotation works correctly.
      disruptors_fwd: { health:100, label:'Spiral-Wave Disruptors', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:22, dmgMax:42, systemTargetKey:'disruptors' },
      disruptors_aft: { health:100, label:'Aft Disruptor Array',    isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:15, dmgMax:30, systemTargetKey:'disruptors' },
      shields_sys:    { health:100, label:'Shield Generators',      isWeapon:false, firingArc:[] },
      engines:        { health:100, label:'Impulse Engines',        isWeapon:false, firingArc:[] },
      sensors:        { health:100, label:'Sensor Array',           isWeapon:false, firingArc:[] },
      warp_core:      { health:100, label:'Warp Core',              isWeapon:false, firingArc:[] },
    }
  },
  galor_class: {
    label:"GALOR-CLASS WARSHIP", faction:'Cardassian', era:'DS9',
    description:"Primary Cardassian combat ship. Heavy fore weapons, strong shields. No cloak but high hull.",
    hull:800, maxHull:800,
    shields:{ fore:200, port:180, starboard:180, aft:150, maxSectorValue:200 },
    hasCloakDevice:false, recoveryCoefficient:0.5, fireInterval:4000, lockRate:5.5,
    preferredTargets:['fore','port','starboard'],
    systems:{
      // Canon: heavy forward spiral-wave disruptors (equivalent to Starfleet Type-IX)
      // Poor forward arc is a noted design weakness — balanced in game with good damage
      disruptors_fwd:   { health:100, label:'Spiral-Wave Disruptors', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:45, dmgMax:75,  systemTargetKey:'disruptors' },
      // Canon: large aft disruptor wave cannon — a distinctive Galor feature, powerful aft weapon
      disruptor_cannon: { health:100, label:'Aft Disruptor Cannon',   isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:40, dmgMax:65,  systemTargetKey:'disruptors' },
      // Canon: 2 forward torpedo tubes + 1 aft torpedo tube (standard complement 200 torps)
      torpedoes_fwd:    { health:100, label:'Forward Torpedoes',       isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:70, dmgMax:120, systemTargetKey:'torpedoes', isTorpedo:true },
      torpedoes_aft:    { health:100, label:'Aft Torpedoes',           isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:55, dmgMax:90,  systemTargetKey:'torpedoes', isTorpedo:true },
      shields_sys:      { health:100, label:'Shield Generators',       isWeapon:false, firingArc:[] },
      engines:          { health:100, label:'Impulse Engines',         isWeapon:false, firingArc:[] },
      sensors:          { health:100, label:'Sensor Array',            isWeapon:false, firingArc:[] },
      warp_core:        { health:100, label:'Warp Core',               isWeapon:false, firingArc:[] },
    }
  },
  jem_hadar_fighter: {
    label:"JEM'HADAR ATTACK SHIP", faction:'Dominion', era:'DS9',
    description:"Suicide-run capable. Polaron weapons bypass shields. Will attempt ramming at low hull. Fast lock, aggressive AI.",
    hull:420, maxHull:420,
    shields:{ fore:100, port:90, starboard:90, aft:70, maxSectorValue:100 },
    hasCloakDevice:false, recoveryCoefficient:0.8, fireInterval:2500, lockRate:8.0,
    preferredTargets:['fore'],
    polaronWeapons:true,
    canRam:true,
    ramDamage:280,
    systems:{
      polaron_fwd: { health:100, label:'Polaron Beam Arrays', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:35, dmgMax:65,  systemTargetKey:'phasers', isPolaron:true },
      polaron_aft: { health:100, label:'Aft Polaron Arrays',  isWeapon:true,  firingArc:['aft','port','starboard'], dmgMin:20, dmgMax:40,  systemTargetKey:'phasers', isPolaron:true },
      torpedoes:   { health:100, label:'Photon Torpedoes',    isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:60, dmgMax:100, systemTargetKey:'torpedoes', isTorpedo:true },
      shields_sys: { health:100, label:'Shield Generators',  isWeapon:false, firingArc:[] },
      engines:     { health:100, label:'Impulse Engines',    isWeapon:false, firingArc:[] },
      sensors:     { health:100, label:'Sensor Array',       isWeapon:false, firingArc:[] },
      warp_core:   { health:100, label:'Warp Core',          isWeapon:false, firingArc:[] },
    }
  },
  jem_hadar_battleship: {
    label:"JEM'HADAR BATTLE CRUISER", faction:'Dominion', era:'DS9',
    description:"Elite Dominion warship. Heaviest polaron weapons. High hull, thick shields. Will ram as last resort.",
    hull:920, maxHull:920,
    shields:{ fore:240, port:220, starboard:220, aft:190, maxSectorValue:240 },
    hasCloakDevice:false, recoveryCoefficient:0.6, fireInterval:4000, lockRate:5.5,
    preferredTargets:['fore','port'],
    polaronWeapons:true,
    canRam:true,
    ramDamage:380,
    systems:{
      polaron_fwd:   { health:100, label:'Forward Polaron Banks', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:65,  dmgMax:105, systemTargetKey:'phasers', isPolaron:true },
      polaron_aft:   { health:100, label:'Aft Polaron Banks',     isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:45,  dmgMax:75,  systemTargetKey:'phasers', isPolaron:true },
      torpedoes_fwd: { health:100, label:'Photon Torpedoes',      isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:110, dmgMax:180, systemTargetKey:'torpedoes', isTorpedo:true },
      shields_sys:   { health:100, label:'Shield Generators',     isWeapon:false, firingArc:[] },
      engines:       { health:100, label:'Impulse Engines',       isWeapon:false, firingArc:[] },
      sensors:       { health:100, label:'Sensor Array',          isWeapon:false, firingArc:[] },
      warp_core:     { health:100, label:'Warp Core',             isWeapon:false, firingArc:[] },
    }
  },
  borg_probe: {
    label:"BORG PROBE", faction:'Borg', era:'TNG/VOY',
    description:"Adaptive shielding — shields recharge faster each hit. Tractor beam can disable weapons.",
    hull:1400, maxHull:1400,
    shields:{ fore:300, port:280, starboard:280, aft:250, maxSectorValue:300 },
    hasCloakDevice:false, recoveryCoefficient:1.0, fireInterval:5000, lockRate:5.0,
    preferredTargets:['fore','port','starboard','aft'],
    adaptiveShields:true,
    systems:{
      cutting_beam: { health:100, label:'Cutting Beam',        isWeapon:true,  firingArc:['fore','port','starboard','aft'], dmgMin:70, dmgMax:120, systemTargetKey:'phasers' },
      tractor_beam: { health:100, label:'Tractor Beam',        isWeapon:false, firingArc:['fore','port','starboard','aft'], isTractor:true },
      shields_sys:  { health:100, label:'Regenerative Matrix', isWeapon:false, firingArc:[] },
      engines:      { health:100, label:'Drive System',        isWeapon:false, firingArc:[] },
      sensors:      { health:100, label:'Sensor Cluster',      isWeapon:false, firingArc:[] },
      warp_core:    { health:100, label:'Transwarp Core',      isWeapon:false, firingArc:[] },
    }
  },
};

// ── Player weapons ────────────────────────────────────────────
const ARRAYS_DICTIONARY = {
  // Pulse cannons: 22/each — "overpowered and overgunned for a ship its size" (Sisko, The Search)
  cannon_port_upper:{ yield:22, cost:20, parentSystem:'cannon_pu', tag:'cpu', label:'Port Upper Pulse Cannon', arc:['fore'] },
  cannon_port_lower:{ yield:22, cost:20, parentSystem:'cannon_pl', tag:'cpl', label:'Port Lower Pulse Cannon', arc:['fore','port'] },
  cannon_stbd_upper:{ yield:22, cost:20, parentSystem:'cannon_su', tag:'csu', label:'Stbd Upper Pulse Cannon', arc:['fore'] },
  cannon_stbd_lower:{ yield:22, cost:20, parentSystem:'cannon_sl', tag:'csl', label:'Stbd Lower Pulse Cannon', arc:['fore','starboard'] },
  // Nose emitter: 65 — heavy Type-XII array, precision strike weapon
  emitter_nose:     { yield:65, cost:50, parentSystem:'nose_beam', tag:'emn', label:'Heavy Nose Array Emitter', arc:['fore'] },
  // Quantum torpedo: 125 — designed to exceed Borg shielding; far superior to photon (The Search, Defiant tech manual)
  torpedo_quantum:     { yield:125, cost:85, parentSystem:'torpedoes', tag:'tff', label:'Fwd Quantum Tube',     arc:['fore','port','starboard'], isQuantum:true },
  torpedo_photon:      { yield:60,  cost:30, parentSystem:'torpedoes', tag:'tph', label:'Fwd Photon Tube',      arc:['fore','port','starboard'], isPhoton:true },
  torpedo_quantum_aft: { yield:125, cost:85, parentSystem:'torpedoes', tag:'tqa', label:'Aft Quantum Tube',     arc:['aft','port','starboard'],  isQuantum:true },
  torpedo_photon_aft:  { yield:60,  cost:30, parentSystem:'torpedoes', tag:'tpa', label:'Aft Photon Tube',      arc:['aft','port','starboard'],  isPhoton:true },
};

// ── Crew stations ─────────────────────────────────────────────
// Default (Defiant / DS9 crew). Overridden at game start from PLAYER_SHIP_CONFIGS.
const CREW_STATIONS = {
  tactical:    { name:'Lt. Cmdr Worf',  role:'Tactical',    status:'nominal', casualties:0 },
  engineering: { name:"Chief O'Brien",  role:'Engineering', status:'nominal', casualties:0 },
  helm:        { name:'Ensign Nog',      role:'Helm',        status:'nominal', casualties:0 },
  medical:     { name:'Dr. Bashir',      role:'Medical',     status:'nominal', casualties:0 },
};

// ── Ship constants ────────────────────────────────────────────
const WARP_CORE = {
  maxOutput:    120,
  impulseOutput: 40,
};

const ABLATIVE_ARMOUR = {
  maxLayers:       6,
  layerAbsorption: 0.60,
  regenCooldown:   45000,
  regenTime:       30000,
};

// ── Pre-battle intel cards (revealed as sensor scan progresses) ─
// Each card: { label, text, revealAt (0-100%) }
const MISSION_INTEL = {
  ktinga: {
    silhouette: '🛸',
    threat: 'HIGH',
    cards: [
      { label:'VESSEL CLASS',      text:"K'Tinga-class battle cruiser. 900 hull, heavy torpedoes fore AND aft, disruptors all quadrants.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"Cloaking device confirmed. Closes to disruptor range aggressively — disruptors gain +40% at close quarters. Aft torpedo tube is a threat when breaking off.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Hull integrity degrades quickly under sustained cannon fire. Cloaking device is a priority target.", revealAt:90 },
      { label:'TACTICS',           text:"Hold long range. Use Evasive Pattern when they close. Target disruptors or cloak device to neutralise their advantages. Watch aft when manoeuvring.", revealAt:90 },
    ]
  },
  vor_cha: {
    silhouette: '🛸',
    threat: 'HIGH',
    cards: [
      { label:'VESSEL CLASS',      text:"Vor'Cha-class attack cruiser. 1050 hull, heavy forward disruptor, wing cannons, torpedoes fore AND aft.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"More powerful than K'Tinga. Closes aggressively — wing disruptors gain +35% at close range. Cloaking confirmed. Aft torpedo launchers make disengagement dangerous.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Wing disruptors require broadside positioning. Target engines to slow their advance and reduce close-range effectiveness.", revealAt:90 },
      { label:'TACTICS',           text:"Maintain long range and use come-about to present fore shields. Destroy wing disruptors early. Don't break off aft — they have aft torpedo tubes.", revealAt:90 },
    ]
  },
  romulan_bop: {
    silhouette: '🦅',
    threat: 'HIGH',
    cards: [
      { label:'VESSEL CLASS',      text:"Romulan Bird-of-Prey. 750 hull. Plasma torpedo — catastrophic on impact.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"Cloaking device — highly aggressive. Plasma torpedo reload: 18 seconds. Generates false sensor contacts while cloaked.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Relatively light hull for Romulan design. Plasma banks take 18s to reload — fire window opens immediately after launch.", revealAt:90 },
      { label:'TACTICS',           text:"Fire during the 18s plasma reload window. Tetryon scan degrades their lock. Don't ignore sensor ghosts — the real ship is nearby.", revealAt:90 },
    ]
  },
  romulan_warbird: {
    silhouette: '🦅',
    threat: 'CRITICAL',
    cards: [
      { label:'VESSEL CLASS',      text:"D'Deridex-class warbird. 1200 hull, dual disruptors, heavy plasma banks.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"Largest Romulan design in active service. Cloak confirmed. Plasma reload: 22s. Sensor ghosts whilst cloaked. Massive hull integrity.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Slow to manoeuvre. Plasma banks have a 22s vulnerability window after each launch. Singularity core is targetable.", revealAt:90 },
      { label:'TACTICS',           text:"Hull scan (+35% damage) before engaging. Target plasma banks first. Use burst salvo during the reload window. Manage EPS heat carefully — this will be a long fight.", revealAt:90 },
    ]
  },
  cardassian_scout: {
    silhouette: '⬡',
    threat: 'MODERATE',
    cards: [
      { label:'VESSEL CLASS',      text:"Cardassian scout vessel. 480 hull, rapid-fire spiral-wave disruptors, fast targeting lock.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"No cloaking device. Highest lock rate of any Cardassian design — achieves targeting lock in under 15 seconds. Spiral-wave disruptors fire fore and aft.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Thin hull and light shielding. Aggressive fire pattern means EPS conduits run hot. Sustained pressure destroys it quickly.", revealAt:90 },
      { label:'TACTICS',           text:"Attack immediately. Burst salvo early — its shields won't last. Tetryon scan negates its lock-rate advantage. Shield frequency rotation works against their disruptor signature.", revealAt:90 },
    ]
  },
  galor_class: {
    silhouette: '⬡',
    threat: 'MODERATE',
    cards: [
      { label:'VESSEL CLASS',      text:"Galor-class warship. 800 hull, spiral-wave disruptors, photon torpedoes fore AND aft. Large aft wave cannon.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"No cloaking device. Strong fore shields. Spiral-wave disruptors confirmed — frequency-lock countermeasures effective. Aft wave cannon is a significant threat from behind.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Aft shields are the weakest sector. Disruptor systems are targetable and reduce incoming fire rate significantly when disabled.", revealAt:90 },
      { label:'TACTICS',           text:"Come about to present strongest shields then press with cannons. Target disruptors early. Shield frequency rotation counters their spiral-wave signature. Watch the aft wave cannon.", revealAt:90 },
    ]
  },
  jem_hadar_fighter: {
    silhouette: '◈',
    threat: 'HIGH',
    cards: [
      { label:'VESSEL CLASS',      text:"Jem'Hadar attack ship. 420 hull. Polaron weapons bypass 30% of shield capacity.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"Polaron bypass confirmed — 30% of each shot penetrates directly to hull. RAMMING PROTOCOL: will attempt suicide run below 20% hull.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Light hull — aggressive pressure destroys it before it reaches ramming threshold. Polaron arrays have broad firing arcs but low individual yield.", revealAt:90 },
      { label:'TACTICS',           text:"Destroy it fast. If you see RAMMING RUN — all power to fore shields, Evasive Pattern immediately. Target polaron arrays to reduce hull bleed.", revealAt:90 },
    ]
  },
  jem_hadar_battleship: {
    silhouette: '◈',
    threat: 'CRITICAL',
    cards: [
      { label:'VESSEL CLASS',      text:"Jem'Hadar battle cruiser. 1100 hull. Heavy polaron banks, photon torpedoes.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"Elite Dominion vessel. Polaron bypass confirmed. Ramming protocol active below 20% hull — collision damage 380 through ablative.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Heavier and slower than the fighter. Fore shields are its primary defence — come about to exploit aft quarter. Engine damage slows it significantly.", revealAt:90 },
      { label:'TACTICS',           text:"Hull scan immediately. Rotate shield frequencies against polaron signature. Save ablative armour for the ramming run — it will come.", revealAt:90 },
    ]
  },
  borg_probe: {
    silhouette: '⬢',
    threat: 'CRITICAL',
    cards: [
      { label:'VESSEL CLASS',      text:"Borg probe. 1400 hull. Adaptive shielding — per-weapon resistance builds with each hit.", revealAt:50 },
      { label:'THREAT ASSESSMENT', text:"ADAPTIVE SHIELDING CONFIRMED. Each weapon type faces increasing resistance (0→65%). Tractor beam can disable weapons. Damage escalates as it adapts.", revealAt:70 },
      { label:'KNOWN WEAKNESS',    text:"Adaptation is per-weapon — rotate all weapon types to prevent any single resistance reaching cap. Photon torpedoes adapt separately from quantum.", revealAt:90 },
      { label:'TACTICS',           text:"Never fire the same weapon consecutively. Rotate: cannons → nose beam → quantum → photon → cannons. Subsystem targeting on sensors or cutting beam. Resistance is NOT futile.", revealAt:90 },
    ]
  },
};

// ── Encounter phase configs ───────────────────────────────────
// Each faction has named phases. The AI checks G.enemyPhase each tick.
// fireRateMult: multiplier on G.threat.fireInterval (lower = faster fire)
// lockRateMult: multiplier on enemy lock rate
// note: shown in enemy state display when phase changes
const ENCOUNTER_PHASES = {
  klingon: [
    { name:'approach',   duration:18000, fireRateMult:1.0,  lockRateMult:1.0,  note:"Klingon vessel holding position — challenge incoming." },
    { name:'challenge',  duration:6000,  fireRateMult:1.4,  lockRateMult:0.6,  note:"INCOMING HAIL — Klingon commander demanding surrender." },
    { name:'aggression', duration:null,  fireRateMult:0.82, lockRateMult:1.2,  note:"Challenge refused — Klingon vessel closing to attack range!" },
    { name:'berserk',    duration:null,  fireRateMult:0.65, lockRateMult:1.4,  note:"BERSERK — Klingon vessel at critical hull, maximum aggression!" },
  ],
  romulan: [
    { name:'shadow',     duration:22000, fireRateMult:1.5,  lockRateMult:0.5,  note:"Romulan vessel cloaked — holding position, assessing tactics." },
    { name:'strike',     duration:null,  fireRateMult:0.80, lockRateMult:1.3,  note:"Romulan vessel decloaking — plasma banks charged!" },
    { name:'fade',       duration:null,  fireRateMult:1.2,  lockRateMult:0.8,  note:"Romulan vessel withdrawing under cloak to repair." },
  ],
  cardassian: [
    { name:'harassment', duration:20000, fireRateMult:0.90, lockRateMult:1.1,  note:"Cardassian vessel opening with harassment fire — building targeting lock." },
    { name:'sustained',  duration:null,  fireRateMult:0.80, lockRateMult:1.2,  note:"Cardassian vessel shifting to sustained fire pattern." },
    { name:'methodical', duration:null,  fireRateMult:0.85, lockRateMult:1.3,  note:"Cardassian vessel locked to subsystem targeting — methodical approach." },
  ],
  dominion: [
    { name:'advance',    duration:15000, fireRateMult:0.95, lockRateMult:1.0,  note:"Jem'Hadar advancing — polaron suppression fire." },
    { name:'overwhelm',  duration:null,  fireRateMult:0.75, lockRateMult:1.2,  note:"Jem'Hadar shifting to overwhelming fire — maximum aggression." },
    { name:'sacrifice',  duration:null,  fireRateMult:0.60, lockRateMult:1.0,  note:"JEM'HADAR SACRIFICE PROTOCOL ACTIVE — ramming trajectory confirmed!" },
  ],
  borg: [
    { name:'analyze',    duration:25000, fireRateMult:1.3,  lockRateMult:0.8,  note:"Borg probe analysing vessel — adaptation subroutines initialising." },
    { name:'adapt',      duration:null,  fireRateMult:0.90, lockRateMult:1.1,  note:"Borg adaptation progressing — fire rate increasing." },
    { name:'overwhelm',  duration:null,  fireRateMult:0.70, lockRateMult:1.3,  note:"Borg adaptation complete — overwhelming assault commencing." },
  ],
};

// ── Campaign level order (easiest → hardest, data-driven from fight analysis) ─
const CAMPAIGN_ORDER = [
  { level:1, archetype:'jem_hadar_fighter',    diff:'normal', label:"LEVEL 1",  title:"Jem'Hadar Attack Ship",   subtitle:"Dominion — Polaron weapons · Ramming protocol" },
  { level:2, archetype:'cardassian_scout',     diff:'normal', label:"LEVEL 2",  title:"Cardassian Scout Vessel", subtitle:"Cardassian — Fast lock · Harassment fire" },
  { level:3, archetype:'romulan_bop',          diff:'normal', label:"LEVEL 3",  title:"Romulan Bird-of-Prey",    subtitle:"Romulan — Cloaking · Plasma torpedo · Sensor ghosts" },
  { level:4, archetype:'galor_class',          diff:'hard',   label:"LEVEL 4",  title:"Galor-Class Warship",     subtitle:"Cardassian — Heavy phasers · Photon torpedoes [HARD]" },
  { level:5, archetype:'jem_hadar_battleship', diff:'hard',   label:"LEVEL 5",  title:"Jem'Hadar Battle Cruiser",subtitle:"Dominion — Heavy polaron bypass · Ramming [HARD]" },
  { level:6, archetype:'ktinga',               diff:'hard',   label:"LEVEL 6",  title:"K'Tinga Battle Cruiser",  subtitle:"Klingon — Cloaking · Closes to brawl range [HARD]" },
  { level:7, archetype:'vor_cha',              diff:'hard',   label:"LEVEL 7",  title:"Vor'Cha Attack Cruiser",  subtitle:"Klingon — Wing disruptors · Heavy torpedoes [HARD]" },
  { level:8, archetype:'romulan_warbird',      diff:'hard',   label:"LEVEL 8",  title:"D'Deridex Warbird",       subtitle:"Romulan — Massive plasma · Sensor ghosts [HARD]" },
  { level:9, archetype:'borg_probe',           diff:'elite',  label:"LEVEL 9",  title:"Borg Probe",              subtitle:"Borg — Adaptive shielding · Tractor beam [ELITE]" },
];

// ── Player ship configurations ────────────────────────────────
// Each entry defines one playable vessel. weaponArrays overrides ARRAYS_DICTIONARY
// when that ship is active (null = use global ARRAYS_DICTIONARY unchanged).
const PLAYER_SHIP_CONFIGS = {
  defiant: {
    key:            'defiant',
    label:          'USS DEFIANT',
    registry:       'NX-74205',
    shipClass:      'Defiant-class',
    era:            '2371+',
    description:    'Heavily armed escort. Ablative armor, cloaking device, devastating pulse cannon burst salvo.',
    accentColor:    'var(--o)',
    crewStations: {
      tactical:    { name:'Lt. Cmdr Worf',  role:'Tactical',    status:'nominal', casualties:0 },
      engineering: { name:"Chief O'Brien",  role:'Engineering', status:'nominal', casualties:0 },
      helm:        { name:'Ensign Nog',      role:'Helm',        status:'nominal', casualties:0 },
      medical:     { name:'Dr. Bashir',      role:'Medical',     status:'nominal', casualties:0 },
    },
    crewLabels:  { worf:"Lt. Cmdr Worf",    obrien:"Chief O'Brien", nog:'Ensign Nog',           system:'BRIDGE SYS' },
    crewColours: { worf:'#ff9900',           obrien:'#4477ff',       nog:'#cc6699',              system:'#6688aa' },
    captainPanelLabels: { tactical:'⚡ TACTICAL — WORF', engineering:"⚙ ENGINEERING — O'BRIEN", helm:'🚀 HELM — NOG' },
    hull:           500,
    torpedoes:      18, maxTorpedoes:18,
    photonTorpedoes:12, maxPhotonTorpedoes:12,
    shields:        { fore:320, port:260, starboard:260, aft:200, maxSectorValue:320 },
    hasAblativeArmour:      true,
    hasCloakDevice:         true,
    hasSaucerSep:           false,
    hasRegenerativeShields: false,
    shieldRegenBonus:       1.0,
    defaultPower:   { cannon_pu:8, cannon_pl:8, cannon_su:8, cannon_sl:6, nose_beam:10, torpedoes:10, shields:28, sensors:16, engines:10, cloak_dev:0, warp_core:10 },
    systemLabels:   {
      cannon_pu:'Pulse Cannon P/U', cannon_pl:'Pulse Cannon P/L',
      cannon_su:'Pulse Cannon S/U', cannon_sl:'Pulse Cannon S/L',
      nose_beam:'Nose Array Beam',  torpedoes:'Quantum Torpedoes',
      shields:'Deflector Shields',  sensors:'Sensor Arrays',
      engines:'Impulse Engines',    cloak_dev:'Cloaking Device',  warp_core:'Warp Core',
    },
    primaryWeaponKeys: ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'],
    primaryLabel: 'Pulse Cannons',
    weaponArrays: null,   // null = use global ARRAYS_DICTIONARY
  },
  enterprise_e: {
    key:            'enterprise_e',
    label:          'USS ENTERPRISE',
    registry:       'NCC-1701-E',
    shipClass:      'Sovereign-class',
    era:            '2373+',
    description:    "Starfleet's flagship. Regenerative shielding, heavy Type-XII phaser arrays, saucer separation.",
    accentColor:    'var(--b)',
    crewStations: {
      tactical:    { name:'Lt. Cmdr Worf',        role:'Tactical',       status:'nominal', casualties:0 },
      engineering: { name:'Lt. Cmdr La Forge',    role:'Engineering',    status:'nominal', casualties:0 },
      helm:        { name:'Lt. Cmdr Data',         role:'Helm/Ops',       status:'nominal', casualties:0 },
      medical:     { name:'Dr. Beverly Crusher',  role:'Medical',        status:'nominal', casualties:0 },
    },
    crewLabels:  { worf:'Lt. Cmdr Worf',    obrien:'Lt. Cmdr La Forge', nog:'Lt. Cmdr Data',     system:'BRIDGE SYS' },
    crewColours: { worf:'#ff9900',           obrien:'#00cccc',           nog:'#ffcc44',           system:'#6688aa' },
    captainPanelLabels: { tactical:'⚡ TACTICAL — WORF', engineering:'⚙ ENGINEERING — LA FORGE', helm:'🚀 HELM/OPS — DATA' },
    hull:           750,
    torpedoes:      24, maxTorpedoes:24,
    photonTorpedoes:30, maxPhotonTorpedoes:30,
    shields:        { fore:500, port:400, starboard:400, aft:350, maxSectorValue:500 },
    hasAblativeArmour:      false,
    hasCloakDevice:         false,
    hasSaucerSep:           true,
    hasRegenerativeShields: true,
    shieldRegenBonus:       1.4,   // 40% faster regen (regenerative shielding, First Contact)
    defaultPower:   { cannon_pu:12, cannon_pl:10, cannon_su:10, cannon_sl:10, nose_beam:14, torpedoes:10, shields:30, sensors:14, engines:10, cloak_dev:0, warp_core:10 },
    systemLabels:   {
      cannon_pu:'Saucer Dorsal Sys',     cannon_pl:'Saucer Ventral Sys',
      cannon_su:'Stardrive Fwd Sys',     cannon_sl:'Saucer Rim/Aft Sys',
      nose_beam:'Primary Emitter Sys',   torpedoes:'Torpedo Systems',
      shields:'Regenerative Shield Grid', sensors:'Sensor Arrays',
      engines:'Impulse Engines',          cloak_dev:'Saucer Separation Sys', warp_core:'Warp Core M/ARA',
    },
    // All 9 phaser array entry keys (used for "⚡ All Phaser Arrays ×N" arc counter)
    primaryWeaponKeys: ['cannon_port_upper','phaser_saucer_port','cannon_port_lower','phaser_saucer_stbd','cannon_stbd_upper','phaser_secondary','cannon_stbd_lower','phaser_aft_emitter','emitter_nose'],
    primaryLabel: 'Phaser Arrays',
    // ── Enterprise-E full Sovereign-class weapon complement ──────────────────────
    // 9 Type-XII phaser array entries + 5 torpedo launcher entries = 14 total.
    // Tags scp/scs/phs/pae/tfb are new Enterprise-E-only capacitor bars.
    // Phaser arrays share the 5 existing system keys; no engineering matrix changes.
    weaponArrays: {
      // ── Saucer section: dorsal arrays (top of saucer) ──
      // Dorsal forward: best fore coverage, some broadside
      cannon_port_upper: { yield:42, cost:32, parentSystem:'cannon_pu', tag:'cpu', label:'Saucer Dorsal Fwd',   arc:['fore','port','starboard'] },
      // Saucer port rim: sweeps fore through aft on port side
      phaser_saucer_port:{ yield:36, cost:28, parentSystem:'cannon_pu', tag:'scp', label:'Saucer Port Array',   arc:['fore','port','aft'] },

      // ── Saucer section: ventral arrays (underside) ──
      cannon_port_lower: { yield:38, cost:28, parentSystem:'cannon_pl', tag:'cpl', label:'Saucer Ventral Fwd',  arc:['fore','port','starboard'] },
      // Saucer starboard rim: symmetric to port rim
      phaser_saucer_stbd:{ yield:36, cost:28, parentSystem:'cannon_pl', tag:'scs', label:'Saucer Stbd Array',   arc:['fore','starboard','aft'] },

      // ── Stardrive section: forward arrays ──
      // Upper-forward stardrive: covers full forward hemisphere
      cannon_stbd_upper: { yield:40, cost:30, parentSystem:'cannon_su', tag:'csu', label:'Stardrive Fwd Arrays', arc:['fore','port','starboard'] },
      // Secondary hull broadside arrays (largest lateral coverage)
      phaser_secondary:  { yield:42, cost:32, parentSystem:'cannon_su', tag:'phs', label:'Secondary Hull Arrays', arc:['fore','port','starboard'] },

      // ── Saucer aft and rim arrays ──
      // Aft saucer rim: sweeps aft quadrant broadly
      cannon_stbd_lower: { yield:35, cost:26, parentSystem:'cannon_sl', tag:'csl', label:'Saucer Aft Arrays',   arc:['aft','port','starboard'] },

      // ── Primary and aft stardrive emitters ──
      // Primary emitter: heaviest single array, fore-only precision strike
      emitter_nose:      { yield:90, cost:65, parentSystem:'nose_beam', tag:'emn', label:'Primary Stardrive Emitter', arc:['fore'] },
      // Aft stardrive emitter: powerful aft defence / pursuit weapon
      phaser_aft_emitter:{ yield:55, cost:42, parentSystem:'nose_beam', tag:'pae', label:'Aft Stardrive Emitter', arc:['aft','port','starboard'] },

      // ── Torpedo launchers ──
      // 2 forward quantum tubes (above + below saucer-stardrive junction)
      torpedo_quantum:     { yield:125, cost:85, parentSystem:'torpedoes', tag:'tff', label:'Fwd Quantum Tube A', arc:['fore','port','starboard'], isQuantum:true },
      torpedo_quantum_b:   { yield:125, cost:85, parentSystem:'torpedoes', tag:'tfb', label:'Fwd Quantum Tube B', arc:['fore','port','starboard'], isQuantum:true },
      torpedo_photon:      { yield:65,  cost:30, parentSystem:'torpedoes', tag:'tph', label:'Fwd Photon Tube',    arc:['fore','port','starboard'], isPhoton:true },
      // Aft torpedo launcher (quantum + photon capable — Insurrection, Nemesis)
      torpedo_quantum_aft: { yield:125, cost:85, parentSystem:'torpedoes', tag:'tqa', label:'Aft Quantum Tube',   arc:['aft','port','starboard'],  isQuantum:true },
      torpedo_photon_aft:  { yield:65,  cost:30, parentSystem:'torpedoes', tag:'tpa', label:'Aft Photon Tube',    arc:['aft','port','starboard'],  isPhoton:true },
    },
  },
};

// ── Helm speed profiles ───────────────────────────────────────
const HELM_SPEED_CONFIG = {
  stop:        { label:'ALL STOP',     enemyLockMult:1.35, yieldMult:1.10 },
  maneuvering: { label:'MANEUVERING',  enemyLockMult:1.10, yieldMult:1.00 },
  half:        { label:'HALF IMPULSE', enemyLockMult:0.85, yieldMult:0.97 },
  full:        { label:'FULL IMPULSE', enemyLockMult:0.65, yieldMult:0.88 },
};
