'use strict';

// ============================================================
// STATE.JS — Game state object (G) and utility functions
// All constants live in config.js (loaded before this file).
// ============================================================

const G = {
  running:false, dead:false,
  playerChosenStation:'tactical', activePanel:'tactical',
  lastFrameTimestamp:0,
  threatCycleTimer:0,
  lockProgress:0,
  activeScanningProfile:false,
  headingDegrees:180, velocitySpeedRating:65,
  gameSessionId:0,

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
    layers: 6,
    layerHealth: [100,100,100,100,100,100],
    regenTimers: [0,0,0,0,0,0],
    regenProgress: [0,0,0,0,0,0],
  },

  // Enemy
  enemyArchetype:'ktinga',
  enemyLockProgress:0,
  enemyManeuverState:'neutral',
  enemyManeuverTimer:0,
  enemyManeuverThreshold:9000,
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
  enemyAdaptiveResist:{ cannon_pu:0, cannon_pl:0, cannon_su:0, cannon_sl:0, nose_beam:0, torpedoes:0, photon:0 },
  sensorGhostTimer:0,
  sensorGhostActive:false,
  inFlightTorpedoes:[],

  // Klingon close-range tracking
  enemyRangeBracket:'long',
  enemyRangeTimer:0,

  // Jem'Hadar ramming
  enemyRammingRun:false,
  enemyRammingTimer:0,

  // Plasma torpedo reload (Romulan)
  plasmaTorpedoReady:true,
  plasmaTorpedoReloadTimer:0,

  // Shield frequency rotation
  shieldFreqActive:false,
  shieldFreqTimer:0,
  shieldFreqCooldown:0,
  shieldFreqWeaponType:null,

  // EPS thermal buildup
  epsHeat:0,
  epsHeatCoolRate:8,
  shieldTransferInProgress:false,
  lastPlayerFireTime:0,

  // Evasive manoeuvres
  evasiveActive:false,
  evasiveCooldown:0,
  evasiveDuration:8000,
  evasiveCooldownTime:20000,

  // Burst fire
  burstFireReady:true,
  burstFireCooldown:0,

  // Overload modes
  overchargeReady:true,
  overchargeCooldown:0,
  unstableTorpReady:true,
  unstableTorpCooldown:0,
  powerDumpReady:true,
  powerDumpActive:false,
  powerDumpTimer:0,
  powerDumpCooldown:0,

  // Helm station state
  helmSpeed:'half',
  helmAttackVector:'fore',
  playerRangeBracket:'long',
  attackRunActive:false,
  attackRunTimer:0,
  attackRunCooldown:0,
  comeAboutActive:false,
  comeAboutTimer:0,
  comeAboutCooldown:0,

  // Helm manoeuvres
  picardManoeuverActive:false,
  picardManoeuverTimer:0,
  picardManoeuverCooldown:0,
  attackPatternOmegaActive:false,
  attackPatternOmegaTimer:0,
  attackPatternOmegaCooldown:0,
  evasiveAlphaActive:false,
  evasiveAlphaTimer:0,
  evasiveAlphaCooldown:0,

  // Player
  player:{
    hull:500, maxHull:500,
    torpedoes:30, maxTorpedoes:30,
    photonTorpedoes:12, maxPhotonTorpedoes:12,
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
  autoTacticalFireClock:0,

  // Repair teams — 2 independent teams
  repairTeams:[
    { sysKey:null, label:'', totalTime:0, remaining:0 },
    { sysKey:null, label:'', totalTime:0, remaining:0 },
  ],
  repairQueue:[],

  // Stardate / mission context
  stardate:0,
  missionContext:'',

  // Borg escalation
  borgEscalationLevel:0,

  // Pre-battle briefing
  preBattleActive:false,
  preBattleScanProgress:0,   // 0-100
  preBattleTimer:0,          // ms elapsed
  preBattleDuration:15000,   // 15s full scan

  // Encounter phase
  enemyPhase:'',
  enemyPhaseTimer:0,
  enemyPhaseIndex:0,
  enemyPhaseFireMult:1.0,
  enemyPhaseLockMult:1.0,

  // Captain's Chair
  crewReports:[],
  captainOrderCooldowns:{},
  captainPeriodicTimer:0,

  // Captain manoeuvre states
  holdFire:false,         holdFireTimer:0,
  autoShieldTrack:false,  autoShieldTrackTimer:0,
  silentRunning:false,    silentRunningTimer:0,

  // Scoring
  score:{ totalDmgDealt:0, volleysFired:0, hullBreaches:0, systemsDestroyed:0, repairsCompleted:0, timeSurvived:0, warpedOut:false },

  // Visual effects state
  shieldHitFlash:{ player:{ sector:null, timer:0 }, enemy:{ sector:null, timer:0 } },
  damageParticles:[],
  renderedBeamsVector:[],
  historicalLogTracks:[],
};

// ── Warp output (accounts for tripped/battery state) ─────────
function getWarpOutput() {
  const wc = G.systems.warp_core;
  if (wc.tripped) return G.batteryActive ? WARP_CORE.impulseOutput : 0;
  return Math.round(WARP_CORE.maxOutput * (wc.health / 100));
}

function getTotalAllocatedPower() {
  return Object.values(G.systems).reduce((t, s) => t + s.allocatedPower, 0);
}

// ── Difficulty selector ───────────────────────────────────────
function setDifficulty(level) {
  currentDifficulty = level;
  const descs = {
    normal:'Standard engagement. Enemy fires at hull sectors only. Balanced for all players.',
    hard:'Enhanced AI. 20% chance to target player subsystems. Faster enemy fire, reduced repair speed.',
    elite:'Elite threat. 30% subsystem targeting. Enemy fires 28% faster. Slower repairs. Tough but beatable.'
  };
  const d = document.getElementById('diff-desc'); if (d) d.textContent = descs[level];
  ['normal','hard','elite'].forEach(l => {
    const btn = document.getElementById(`diff-btn-${l}`);
    if (!btn) return;
    if (l === level) { btn.style.background = l==='normal'?'var(--green)':l==='hard'?'var(--warn)':'var(--red)'; btn.style.color = '#000'; }
    else { btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc'; }
  });
}

// ── Logging ───────────────────────────────────────────────────
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
