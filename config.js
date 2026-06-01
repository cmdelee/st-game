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
  normal: { label:'Normal',  enemyHullMult:1.0,  enemyDmgMult:1.0,  enemyLockMult:1.0,  enemyFireMult:1.0,  playerHullMult:1.0,  targetsSystems:false, systemTargetChance:0.00, repairSpeedMult:1.0  },
  hard:   { label:'Hard',    enemyHullMult:1.2,  enemyDmgMult:1.15, enemyLockMult:1.3,  enemyFireMult:0.85, playerHullMult:0.85, targetsSystems:true,  systemTargetChance:0.20, repairSpeedMult:0.85 },
  elite:  { label:'Elite',   enemyHullMult:1.35, enemyDmgMult:1.28, enemyLockMult:1.5,  enemyFireMult:0.78, playerHullMult:0.78, targetsSystems:true,  systemTargetChance:0.30, repairSpeedMult:0.72 },
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
      disruptors_fwd:{ health:100, label:'Forward Disruptors', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:45,  dmgMax:80,  systemTargetKey:'disruptors' },
      disruptors_aft:{ health:100, label:'Aft Disruptors',     isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:30,  dmgMax:55,  systemTargetKey:'disruptors' },
      torpedoes_fwd: { health:100, label:'Forward Torpedoes',  isWeapon:true,  firingArc:['fore'],                    dmgMin:90,  dmgMax:160, systemTargetKey:'torpedoes', isTorpedo:true },
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
      disruptors_fwd:  { health:100, label:'Forward Disruptors', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:55,  dmgMax:95,  systemTargetKey:'disruptors' },
      disruptors_wing: { health:100, label:'Wing Disruptors',    isWeapon:true,  firingArc:['port','starboard'],        dmgMin:35,  dmgMax:60,  systemTargetKey:'disruptors' },
      torpedoes_fwd:   { health:100, label:'Forward Torpedoes',  isWeapon:true,  firingArc:['fore'],                    dmgMin:100, dmgMax:170, systemTargetKey:'torpedoes', isTorpedo:true },
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
      plasma_fwd:  { health:100, label:'Plasma Torpedo Banks', isWeapon:true,  firingArc:['fore'],                    dmgMin:110, dmgMax:190, systemTargetKey:'torpedoes', isTorpedo:true },
      phasers_fwd: { health:100, label:'Forward Phasers',      isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:35,  dmgMax:60,  systemTargetKey:'phasers' },
      phasers_aft: { health:100, label:'Aft Phasers',          isWeapon:true,  firingArc:['aft'],                    dmgMin:25,  dmgMax:45,  systemTargetKey:'phasers' },
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
      disruptors_fwd: { health:100, label:'Forward Disruptors',  isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:50,  dmgMax:85,  systemTargetKey:'disruptors' },
      disruptors_aft: { health:100, label:'Aft Disruptors',      isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:45,  dmgMax:75,  systemTargetKey:'disruptors' },
      plasma_torp:    { health:100, label:'Plasma Torpedo Banks', isWeapon:true,  firingArc:['fore'],                    dmgMin:120, dmgMax:200, systemTargetKey:'torpedoes', isTorpedo:true },
      cloak_device:   { health:100, label:'Cloaking Device',      isWeapon:false, firingArc:[] },
      shields_sys:    { health:100, label:'Shield Generators',    isWeapon:false, firingArc:[] },
      engines:        { health:100, label:'Impulse Engines',      isWeapon:false, firingArc:[] },
      sensors:        { health:100, label:'Sensor Array',         isWeapon:false, firingArc:[] },
      warp_core:      { health:100, label:'Singularity Core',     isWeapon:false, firingArc:[] },
    }
  },
  cardassian_scout: {
    label:"CARDASSIAN SCOUT VESSEL", faction:'Cardassian', era:'DS9',
    description:"Fast, agile. No cloak. Locks on quickly, fires frequent harassing phaser bursts.",
    hull:480, maxHull:480,
    shields:{ fore:120, port:100, starboard:100, aft:80, maxSectorValue:120 },
    hasCloakDevice:false, recoveryCoefficient:0.6, fireInterval:2200, lockRate:7.5,
    preferredTargets:['fore','port','starboard'],
    systems:{
      phasers_fwd: { health:100, label:'Forward Phasers',   isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:22, dmgMax:42, systemTargetKey:'phasers' },
      phasers_aft: { health:100, label:'Aft Phasers',       isWeapon:true,  firingArc:['aft'],                    dmgMin:15, dmgMax:30, systemTargetKey:'phasers' },
      shields_sys: { health:100, label:'Shield Generators', isWeapon:false, firingArc:[] },
      engines:     { health:100, label:'Impulse Engines',   isWeapon:false, firingArc:[] },
      sensors:     { health:100, label:'Sensor Array',      isWeapon:false, firingArc:[] },
      warp_core:   { health:100, label:'Warp Core',         isWeapon:false, firingArc:[] },
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
      phasers_fwd:   { health:100, label:'Forward Phasers',   isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:45, dmgMax:75,  systemTargetKey:'phasers' },
      phasers_aft:   { health:100, label:'Aft Phasers',       isWeapon:true,  firingArc:['aft'],                    dmgMin:30, dmgMax:50,  systemTargetKey:'phasers' },
      torpedoes_fwd: { health:100, label:'Photon Torpedoes',  isWeapon:true,  firingArc:['fore'],                    dmgMin:70, dmgMax:120, systemTargetKey:'torpedoes', isTorpedo:true },
      shields_sys:   { health:100, label:'Shield Generators', isWeapon:false, firingArc:[] },
      engines:       { health:100, label:'Impulse Engines',   isWeapon:false, firingArc:[] },
      sensors:       { health:100, label:'Sensor Array',      isWeapon:false, firingArc:[] },
      warp_core:     { health:100, label:'Warp Core',         isWeapon:false, firingArc:[] },
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
      polaron_aft: { health:100, label:'Aft Polaron Arrays',  isWeapon:true,  firingArc:['aft'],                    dmgMin:20, dmgMax:40,  systemTargetKey:'phasers', isPolaron:true },
      torpedoes:   { health:100, label:'Photon Torpedoes',    isWeapon:true,  firingArc:['fore'],                    dmgMin:60, dmgMax:100, systemTargetKey:'torpedoes', isTorpedo:true },
      shields_sys: { health:100, label:'Shield Generators',  isWeapon:false, firingArc:[] },
      engines:     { health:100, label:'Impulse Engines',    isWeapon:false, firingArc:[] },
      sensors:     { health:100, label:'Sensor Array',       isWeapon:false, firingArc:[] },
      warp_core:   { health:100, label:'Warp Core',          isWeapon:false, firingArc:[] },
    }
  },
  jem_hadar_battleship: {
    label:"JEM'HADAR BATTLE CRUISER", faction:'Dominion', era:'DS9',
    description:"Elite Dominion warship. Heaviest polaron weapons. High hull, thick shields. Will ram as last resort.",
    hull:1100, maxHull:1100,
    shields:{ fore:240, port:220, starboard:220, aft:190, maxSectorValue:240 },
    hasCloakDevice:false, recoveryCoefficient:0.6, fireInterval:4000, lockRate:6.0,
    preferredTargets:['fore','port'],
    polaronWeapons:true,
    canRam:true,
    ramDamage:380,
    systems:{
      polaron_fwd:   { health:100, label:'Forward Polaron Banks', isWeapon:true,  firingArc:['fore','port','starboard'], dmgMin:65,  dmgMax:105, systemTargetKey:'phasers', isPolaron:true },
      polaron_aft:   { health:100, label:'Aft Polaron Banks',     isWeapon:true,  firingArc:['aft','port','starboard'],  dmgMin:45,  dmgMax:75,  systemTargetKey:'phasers', isPolaron:true },
      torpedoes_fwd: { health:100, label:'Photon Torpedoes',      isWeapon:true,  firingArc:['fore'],                    dmgMin:110, dmgMax:180, systemTargetKey:'torpedoes', isTorpedo:true },
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
      tractor_beam: { health:100, label:'Tractor Beam',        isWeapon:false, firingArc:['fore'], isTractor:true },
      shields_sys:  { health:100, label:'Regenerative Matrix', isWeapon:false, firingArc:[] },
      engines:      { health:100, label:'Drive System',        isWeapon:false, firingArc:[] },
      sensors:      { health:100, label:'Sensor Cluster',      isWeapon:false, firingArc:[] },
      warp_core:    { health:100, label:'Transwarp Core',      isWeapon:false, firingArc:[] },
    }
  },
};

// ── Player weapons ────────────────────────────────────────────
const ARRAYS_DICTIONARY = {
  cannon_port_upper:{ yield:18, cost:20, parentSystem:'cannon_pu', tag:'cpu', label:'Port Upper Pulse Cannon', arc:['fore','port'] },
  cannon_port_lower:{ yield:18, cost:20, parentSystem:'cannon_pl', tag:'cpl', label:'Port Lower Pulse Cannon', arc:['fore','port','aft'] },
  cannon_stbd_upper:{ yield:18, cost:20, parentSystem:'cannon_su', tag:'csu', label:'Stbd Upper Pulse Cannon', arc:['fore','starboard'] },
  cannon_stbd_lower:{ yield:18, cost:20, parentSystem:'cannon_sl', tag:'csl', label:'Stbd Lower Pulse Cannon', arc:['fore','starboard','aft'] },
  emitter_nose:     { yield:55, cost:50, parentSystem:'nose_beam', tag:'emn', label:'Heavy Nose Array Emitter', arc:['fore'] },
  torpedo_quantum:  { yield:90, cost:85, parentSystem:'torpedoes', tag:'tff', label:'Forward Quantum Tube',     arc:['fore','port','starboard'], isQuantum:true },
  torpedo_photon:   { yield:60, cost:30, parentSystem:'torpedoes', tag:'tph', label:'Photon Torpedo Tube',      arc:['fore','port','starboard'], isPhoton:true },
};

// ── Crew stations ─────────────────────────────────────────────
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

// ── Helm speed profiles ───────────────────────────────────────
const HELM_SPEED_CONFIG = {
  stop:        { label:'ALL STOP',     enemyLockMult:1.35, yieldMult:1.10 },
  maneuvering: { label:'MANEUVERING',  enemyLockMult:1.10, yieldMult:1.00 },
  half:        { label:'HALF IMPULSE', enemyLockMult:0.85, yieldMult:0.97 },
  full:        { label:'FULL IMPULSE', enemyLockMult:0.65, yieldMult:0.88 },
};
