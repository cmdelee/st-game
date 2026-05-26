'use strict';

// ============================================================
// COLOUR PALETTE
// ============================================================
const C = { b:'#4477ff', o:'#ff9900', t:'#cc6699', p:'#9966cc', red:'#ff3333', warn:'#ffaa00', green:'#00cc66', dim:'#0a1122', dim2:'#1a2640' };

// ============================================================
// DIFFICULTY SETTINGS
// ============================================================
const DIFFICULTY = {
  normal: { label:'Normal',  enemyHullMult:1.0, enemyDmgMult:1.0,  enemyLockMult:1.0, enemyFireMult:1.0,  playerHullMult:1.0, targetsSystems:false, repairSpeedMult:1.0 },
  hard:   { label:'Hard',    enemyHullMult:1.3, enemyDmgMult:1.25, enemyLockMult:1.4, enemyFireMult:0.8,  playerHullMult:0.8, targetsSystems:true,  repairSpeedMult:0.8 },
  elite:  { label:'Elite',   enemyHullMult:1.6, enemyDmgMult:1.5,  enemyLockMult:1.8, enemyFireMult:0.65, playerHullMult:0.65,targetsSystems:true,  repairSpeedMult:0.6 },
};
let currentDifficulty = 'normal';

// ============================================================
// ENEMY CONFIGS
// ============================================================
const ENEMY_CONFIGS = {
  ktinga: {
    label:"K'TINGA BATTLE CRUISER", faction:'Klingon', era:'TOS/TMP',
    description:"Heavy battle cruiser. Closes to disruptor range aggressively. Devastating torpedoes at close quarters.",
    hull:900, maxHull:900,
    shields:{ fore:220, port:180, starboard:180, aft:150, maxSectorValue:220 },
    hasCloakDevice:true, recoveryCoefficient:0.4, fireInterval:5500, lockRate:3.5,
    preferredTargets:['fore','port','starboard'],
    prefersCloseRange:true,        // Klingons close aggressively for disruptor advantage
    closeRangeDmgBonus:1.4,        // +40% disruptor damage at close range
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
    plasmaReloadTime:18000,        // 18s reload between plasma torpedo launches
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
    plasmaReloadTime:22000,        // 22s reload on the massive plasma banks
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
    canRam:true,                   // Jem'Hadar will attempt ramming when hull < 20%
    ramDamage:280,                 // collision damage dealt to Defiant (absorbed by ablative first)
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
      cutting_beam: { health:100, label:'Cutting Beam',       isWeapon:true,  firingArc:['fore','port','starboard','aft'], dmgMin:70, dmgMax:120, systemTargetKey:'phasers' },
      tractor_beam: { health:100, label:'Tractor Beam',       isWeapon:false, firingArc:['fore'], isTractor:true },
      shields_sys:  { health:100, label:'Regenerative Matrix',isWeapon:false, firingArc:[] },
      engines:      { health:100, label:'Drive System',       isWeapon:false, firingArc:[] },
      sensors:      { health:100, label:'Sensor Cluster',     isWeapon:false, firingArc:[] },
      warp_core:    { health:100, label:'Transwarp Core',     isWeapon:false, firingArc:[] },
    }
  }
};

// ============================================================
// PLAYER WEAPONS DICTIONARY
// ============================================================
const ARRAYS_DICTIONARY = {
  cannon_port_upper:{ yield:18, cost:20, parentSystem:'cannon_pu', tag:'cpu', label:'Port Upper Pulse Cannon', arc:['fore','port'] },
  cannon_port_lower:{ yield:18, cost:20, parentSystem:'cannon_pl', tag:'cpl', label:'Port Lower Pulse Cannon', arc:['fore','port','aft'] },
  cannon_stbd_upper:{ yield:18, cost:20, parentSystem:'cannon_su', tag:'csu', label:'Stbd Upper Pulse Cannon', arc:['fore','starboard'] },
  cannon_stbd_lower:{ yield:18, cost:20, parentSystem:'cannon_sl', tag:'csl', label:'Stbd Lower Pulse Cannon', arc:['fore','starboard','aft'] },
  emitter_nose:     { yield:55, cost:50, parentSystem:'nose_beam', tag:'emn', label:'Heavy Nose Array Emitter', arc:['fore'] },
  torpedo_fore:     { yield:90, cost:85, parentSystem:'torpedoes', tag:'tff', label:'Forward Quantum Tube',     arc:['fore','port','starboard'] }
};

// ============================================================
// CREW STATIONS
// ============================================================
const CREW_STATIONS = {
  tactical:    { name:'Lt. Cmdr Worf',  role:'Tactical',    status:'nominal', casualties:0 },
  engineering: { name:"Chief O'Brien",  role:'Engineering', status:'nominal', casualties:0 },
  helm:        { name:'Ensign Nog',      role:'Helm',        status:'nominal', casualties:0 },
  medical:     { name:'Dr. Bashir',      role:'Medical',     status:'nominal', casualties:0 },
};

// ============================================================
// WARP CORE CONSTANTS
// ============================================================
const WARP_CORE = {
  maxOutput:120,
  impulseOutput:40,
};

// ============================================================
// ABLATIVE ARMOUR — Defiant-class unique system
// ============================================================
const ABLATIVE_ARMOUR = {
  maxLayers: 6,                 // 6 layers (up from 5) — Defiant's hull is reinforced
  layerAbsorption: 0.60,        // Each layer absorbs 60% of incoming hull damage
  regenCooldown: 45000,         // 45 s before a consumed layer starts regenerating
  regenTime: 30000,             // 30 s to regenerate one layer fully
};

// ============================================================
// MAIN GAME STATE
// ============================================================
const G = {
  running:false, dead:false,
  playerChosenStation:'tactical', activePanel:'tactical',
  lastFrameTimestamp:0,
  threatCycleTimer:0,
  lockProgress:0,
  activeScanningProfile:false,
  headingDegrees:180, velocitySpeedRating:65,
  gameSessionId:0,        // incremented each game start; guards async intervals

  // Scan
  activeScanProfile:null, scanAnalysisProgress:0, scanBonus:null,

  // Emergency battery
  batteryCharge:100,
  batteryActive:false,
  batteryDrainRate:3.3,
  batteryRechargeRate:1.2,
  batteryUses:0,

  // Ablative armour state
  ablative: {
    layers: 6,                  // current intact layers
    layerHealth: [100,100,100,100,100,100], // % health of each layer
    regenTimers: [0,0,0,0,0,0],   // ms remaining before each consumed layer begins regen
    regenProgress: [0,0,0,0,0,0], // ms of active regen progress
  },

  // Enemy
  enemyArchetype:'ktinga',
  enemyLockProgress:0,
  enemyManeuverState:'neutral',
  enemyManeuverTimer:0,
  enemyManeuverThreshold:9000,   // first threshold set; refreshed on each maneuver
  enemyPreferredSector:'fore',
  enemyCloaked:false,
  enemyCloakCooldown:0,
  enemyCloakVulnTimer:0,
  enemyCloakPower:100,
  enemyCloakEngagedAt:0,
  enemyFrozenShields:{ fore:0, port:0, starboard:0, aft:0 },
  enemySystems:{},
  enemyRepairQueue:[],
  weaponsDisrupted:false, weaponsDisruptedTimer:0,
  enemyTractorActive:false,
  enemyAdaptiveHits:0,
  enemyAdaptiveResist:{ cannon_pu:0, cannon_pl:0, cannon_su:0, cannon_sl:0, nose_beam:0, torpedoes:0 }, // per-weapon Borg adaptation 0-1
  sensorGhostTimer:0,
  sensorGhostActive:false,
  inFlightTorpedoes:[],

  // Klingon close-range tracking
  enemyRangeBracket:'long',      // 'long' | 'medium' | 'close' — affects Klingon damage
  enemyRangeTimer:0,             // ticks up; Klingons close over time

  // Jem'Hadar ramming
  enemyRammingRun:false,         // true when a ramming attack is declared
  enemyRammingTimer:0,           // countdown to impact

  // Plasma torpedo reload (Romulan)
  plasmaTorpedoReady:true,       // false while reloading
  plasmaTorpedoReloadTimer:0,    // ms remaining on reload

  // Shield frequency rotation
  shieldFreqActive:false,
  shieldFreqTimer:0,             // ms remaining on frequency rotation bonus
  shieldFreqCooldown:0,          // ms before can rotate again
  shieldFreqWeaponType:null,     // weapon type being countered ('disruptors'|'phasers'|'polaron'|'plasma')

  // EPS thermal buildup (item 4) — sustained fire heats conduits
  epsHeat:0,            // 0-100; above 70 reduces capacitor recharge rate
  epsHeatCoolRate:8,    // per second when not firing
  shieldTransferInProgress:false, // item 8 — shield equalisation delay
  lastPlayerFireTime:0, // item 9 — timestamp of last weapon fire (for regen advisory)
  // Evasive manoeuvres
  evasiveActive:false,
  evasiveCooldown:0,
  evasiveDuration:8000,    // 8s of reduced enemy lock build rate
  evasiveCooldownTime:20000, // 20s cooldown

  // Player
  player:{
    hull:500, maxHull:500,
    torpedoes:30, maxTorpedoes:30,
    shields:{ fore:320, port:260, starboard:260, aft:200, maxSectorValue:320 }
  },
  threat:{ hull:900, maxHull:900 },

  // Player systems
  systems:{
    cannon_pu:{ health:100, allocatedPower:8,  cap:100, stress:0, tripped:false, label:'Pulse Cannon P/U',  isWeapon:true  },
    cannon_pl:{ health:100, allocatedPower:8,  cap:100, stress:0, tripped:false, label:'Pulse Cannon P/L',  isWeapon:true  },
    cannon_su:{ health:100, allocatedPower:8,  cap:100, stress:0, tripped:false, label:'Pulse Cannon S/U',  isWeapon:true  },
    cannon_sl:{ health:100, allocatedPower:6,  cap:100, stress:0, tripped:false, label:'Pulse Cannon S/L',  isWeapon:true  },
    nose_beam:{ health:100, allocatedPower:10, cap:100, stress:0, tripped:false, label:'Nose Array Beam',   isWeapon:true  },
    torpedoes:{ health:100, allocatedPower:10, cap:100, stress:0, tripped:false, label:'Quantum Torpedoes', isWeapon:true  },
    shields:  { health:100, allocatedPower:28, cap:100, stress:0, tripped:false, label:'Deflector Shields', isWeapon:false },
    sensors:  { health:100, allocatedPower:16, cap:100, stress:0, tripped:false, label:'Sensor Arrays',     isWeapon:false },
    engines:  { health:100, allocatedPower:10, cap:100, stress:0, tripped:false, label:'Impulse Engines',   isWeapon:false },
    cloak_dev:{ health:100, allocatedPower:0,  cap:100, stress:0, tripped:false, label:'Cloaking Device',   isWeapon:false },
    warp_core:{ health:100, allocatedPower:10, cap:100, stress:0, tripped:false, label:'Warp Core',         isWeapon:false },
  },

  // Cloaking
  cloaked:false,
  cloakCooldown:0,
  cloakVulnTimer:0,
  cloakVulnDuration:1200,
  cloakPowerReserve:100,
  cloakPowerDrainRate:4,
  cloakEngagedAt:0,
  frozenShields:{ fore:0, port:0, starboard:0, aft:0 },

  // Shield regen
  shieldRegenRate:2.0,
  shieldUnderAttackTimer:0,

  // Targeting
  targetedSubsystemType:'hull',
  repairQueue:[],
  autoTacticalFireClock:0,

  // Repair teams — 2 independent teams (feature 7)
  repairTeams:[
    { sysKey:null, label:'', totalTime:0, remaining:0 },
    { sysKey:null, label:'', totalTime:0, remaining:0 },
  ],
  repairQueue:[],  // kept for enemy repair tracking

  // Scoring
  score:{ totalDmgDealt:0, volleysFired:0, hullBreaches:0, systemsDestroyed:0, repairsCompleted:0, timeSurvived:0, warpedOut:false },

  renderedBeamsVector:[],
  historicalLogTracks:[],
};

// ============================================================
// HELPER — WARP OUTPUT (takes tripped/battery state into account)
// ============================================================
function getWarpOutput() {
  const wc = G.systems.warp_core;
  if (wc.tripped) return G.batteryActive ? WARP_CORE.impulseOutput : 0;
  return Math.round(WARP_CORE.maxOutput * (wc.health / 100));
}

function getTotalAllocatedPower() {
  return Object.values(G.systems).reduce((t, s) => t + s.allocatedPower, 0);
}

// ============================================================
// DIFFICULTY SELECTOR (called from HTML)
// ============================================================
function setDifficulty(level) {
  currentDifficulty = level;
  const descs = {
    normal:'Standard engagement. Enemy fires at hull sectors only.',
    hard:'Enhanced AI. Enemy targets specific systems. Reduced repair speed.',
    elite:'Elite AI. Enemy prioritises critical systems. Severe penalties.'
  };
  const d = document.getElementById('diff-desc'); if (d) d.textContent = descs[level];
  ['normal','hard','elite'].forEach(l => {
    const btn = document.getElementById(`diff-btn-${l}`);
    if (!btn) return;
    if (l === level) { btn.style.background = l==='normal'?'var(--green)':l==='hard'?'var(--warn)':'var(--red)'; btn.style.color = '#000'; }
    else { btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc'; }
  });
}

// ============================================================
// LOGGING
// ============================================================
function postLogEvent(msg, tier='info') {
  const ts = new Date().toLocaleTimeString('en-GB',{hour12:false});
  G.historicalLogTracks.push({ts, msg, tier});
  const box = document.getElementById('terminal-transcript-box');
  if (box && box.style.display !== 'none') {
    const cols = {info:'#aabbff', good:'#00cc66', warn:'#ffaa00', crit:'#ff4444'};
    const d = document.createElement('div');
    d.style.color = cols[tier] || '#aabbcc';
    d.textContent = `[${ts}] ${msg}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
}
