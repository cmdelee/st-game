'use strict';

// ============================================================
// STATE.JS — Game state object (G) and utility functions
// All constants live in config.js (loaded before this file).
// ============================================================

const G = {
  running:false, dead:false,
  playerChosenStation:'tactical', activePanel:'tactical',
  // Per-station control source (multiplayer foundation — see docs/MULTIPLAYER_DESIGN.md).
  // 'auto' = computer-delegated; 'local' = a human at this machine; 'remote' = a
  // networked teammate. Single-player = exactly one 'local', the rest 'auto'.
  stationControl:{ tactical:'auto', engineering:'auto', helm:'auto', captain:'auto' },
  coopMode:false,   // local hot-seat co-op: ≥2 'local' stations, switch decks to operate each
  lastFrameTimestamp:0,
  threatCycleTimer:0,
  lockProgress:0,
  activeScanningProfile:false,
  headingDegrees:180, velocitySpeedRating:65,
  gameSessionId:0,

  // Player ship selection — set by selectPlayerShip() before each game
  playerShipKey:    'defiant',
  playerShipConfig: null,      // reference to PLAYER_SHIP_CONFIGS[key], set at boot
  activeWeaponArrays: null,    // reference to active ship's weaponArrays; set at boot

  // Saucer separation (Enterprise-E) — toggle mechanic, stays separated until ordered back
  // State machine: ready → separated → reconnecting → cooldown → ready
  saucerSepActive:       false,  // true while separated (including during reconnect)
  saucerSepReconnecting: false,  // true during 6s docking window
  saucerSepReconnectTimer: 0,    // ms remaining in docking sequence
  saucerSepCooldown:     0,      // ms cooldown after reconnect completes
  saucerAutoFireTimer:   10000,  // ms until saucer section fires autonomously
  deflectorActive:       false,  // Antiproton Tactical Deflector (Enterprise-E signature)

  // Tricobalt warhead (Enterprise-E special — 1 per engagement)
  tricobalReady: true,
  maxPulseBurstReady: true,

  // Scan
  activeScanProfile:null, scanAnalysisProgress:0, scanBonus:null,
  permanentScanBonuses:{},    // { shield_freq, hull_weakness, sensor_blind, weapon_disrupt }
  deepScanActive:false, deepScanProgress:0, deepScanCooldown:0,
  fireAtWill:false,           // captain order — aggressive auto-fire mode

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

  // Wolfpack — Jem'Hadar Attack Ships fight in packs. G.threat/G.enemySystems
  // hold the live ACTIVE target; G.pack holds full snapshots of every member.
  pack:[], packActive:false, packCount:0, activePackIndex:0, disablePack:false, packBerserk:false,

  weaponsDisrupted:false, weaponsDisruptedTimer:0,
  enemyDecloakStrike:false,   // one-shot: next enemy volley is a shield-bypassing decloak ambush
  campaignDmgMult:1.0,        // campaign per-level escalation (see _applyCampaignEscalation); 1.0 in single battles
  campaignBypass:0,           // campaign per-level shield-bypass fraction (0–1); 0 in single battles
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

  // Engineering combat toolkit — give the engineering station real combat agency
  weaponSurgeActive:false, weaponSurgeTimer:0, weaponSurgeCooldown:0,   // +35% crew damage, faster caps, shields −50% (8s, 28s CD)
  fireCoordination:false,                                               // toggle: crew fires aggressively + focus-fires
  forcefieldsActive:false, forcefieldsTimer:0, forcefieldsCooldown:0,   // incoming −45% (5s, 30s CD)

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
    torpedoes:18, maxTorpedoes:18,
    photonTorpedoes:12, maxPhotonTorpedoes:12,
    shields:{ fore:320, port:260, starboard:260, aft:200, maxSectorValue:320 }
  },
  threat:{ hull:900, maxHull:900, shields:{ fore:0, port:0, starboard:0, aft:0 } },

  // Player systems
  systems:{
    cannon_pu:{ health:100, allocatedPower:8,  cap:100, stress:0, tripped:false, label:'Pulse Cannon P/U',  isWeapon:true  },
    cannon_pl:{ health:100, allocatedPower:8,  cap:100, stress:0, tripped:false, label:'Pulse Cannon P/L',  isWeapon:true  },
    cannon_su:{ health:100, allocatedPower:8,  cap:100, stress:0, tripped:false, label:'Pulse Cannon S/U',  isWeapon:true  },
    cannon_sl:{ health:100, allocatedPower:6,  cap:100, stress:0, tripped:false, label:'Pulse Cannon S/L',  isWeapon:true  },
    nose_beam:{ health:100, allocatedPower:10, cap:100, stress:0, tripped:false, label:'Nose Array Beam',   isWeapon:true  },
    torpedoes:{ health:100, allocatedPower:10, cap:100, aftCap:100, stress:0, tripped:false, label:'Quantum Torpedoes', isWeapon:true  },
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

  // Last stand
  lastStandActive:false,
  lastStandReported:false,

  // Enemy hull milestones (tracks which % thresholds have already fired)
  enemyHullMilestones:{},

  // Campaign mode
  campaignMode:    false,
  campaignStation: 'tactical',
  campaignLevel:   0,      // 0-indexed into CAMPAIGN_ORDER
  campaignScore:   0,      // accumulated score across levels
  campaignLevelResults: [], // [{level, enemy, score, hullPct, time, won}]

  // Scoring
  score:{
    totalDmgDealt:0, volleysFired:0, hullBreaches:0, systemsDestroyed:0,
    repairsCompleted:0, timeSurvived:0, warpedOut:false,
    // debrief tracking
    weaponsFired:{ cannons:0, nose:0, quantum:0, photon:0 },
    sectorBreaches:{ fore:0, port:0, starboard:0, aft:0 },
    peakHullHit:0,
    systemsTripped:[],
    enemyPhaseReached:'',
    enemiesDestroyed:0,
  },

  // Visual effects state
  shieldHitFlash:{ player:{ sector:null, timer:0 }, enemy:{ sector:null, timer:0 } },
  damageParticles:[],
  renderedBeamsVector:[],
  historicalLogTracks:[],
};

// ── Station control helpers ───────────────────────────────────
const STATIONS = ['tactical','engineering','helm','captain'];
// Is a station computer-delegated (no human at it)?
function _stationAuto(s)   { return (G.stationControl[s] || 'auto') === 'auto'; }
// Is a station controlled by a human (this machine or a networked teammate)?
function _stationManned(s)  { const c = G.stationControl[s]; return c === 'local' || c === 'remote'; }
// Set which stations a human controls locally; the rest revert to auto.
// (Single-player passes one station; local co-op / host-assignment pass several.)
function setMannedStations(list) {
  STATIONS.forEach(s => { if (G.stationControl[s] !== 'remote') G.stationControl[s] = list.includes(s) ? 'local' : 'auto'; });
}

// ── Shield sector helpers ─────────────────────────────────────
const SHIELD_SECTORS = ['fore','port','starboard','aft'];

function getStrongestShieldSector() {
  return SHIELD_SECTORS.reduce((b, s) => G.player.shields[s] > G.player.shields[b] ? s : b, 'fore');
}

function getWeakestShieldSector() {
  return SHIELD_SECTORS.reduce((b, s) => G.player.shields[s] < G.player.shields[b] ? s : b, 'fore');
}

// ── Weapon firing-arc resolution ──────────────────────────────
// Horizontal arc (fore/port/starboard/aft vs the presented attack vector) AND
// vertical mount: a dorsal (top-mounted) array can't depress onto a target
// below the ship; a ventral (belly) array can't elevate onto one above.
// G.enemyElevation ('above'|'level'|'below') is derived from the real 3D
// positions in the spatial render loop; defaults to 'level' (no restriction)
// when no spatial view is driving it (e.g. headless tests, engineering deck).
// Does a given mount fail to bear on a target at the given elevation?
// dorsal (top) can't depress onto a target below; ventral (belly) can't
// elevate onto one above. 'any'/centerline and 'level' targets always bear.
function _elevationBlocks(mount, elev) {
  if (!mount || mount === 'any' || elev === 'level') return false;
  if (mount === 'dorsal')  return elev === 'below';
  if (mount === 'ventral') return elev === 'above';
  return false;
}

// Player weapon vs the enemy (enemy's elevation relative to the player).
function mountBearsOnTarget(weapon) {
  return !_elevationBlocks(weapon && weapon.mount, G.enemyElevation || 'level');
}

// ── Horizontal bearing ────────────────────────────────────────
// Sectors clockwise, 90° apart. The enemy can manoeuvre to a player-relative
// bearing (G.enemyBearing); the player turns the ship (G.helmAttackVector =
// where the bow points) to bring the enemy back into a strong arc.
const _SECTOR_ORDER = ['fore','starboard','aft','port'];
function _sectorIdx(s) { const i = _SECTOR_ORDER.indexOf(s); return i < 0 ? 0 : i; }

// The ship-relative sector the enemy currently occupies. Reduces to
// G.helmAttackVector when enemyBearing is 'fore' (default / headless / no
// spatial view), so behaviour is unchanged unless the enemy actively flanks.
function effectiveEnemySector() {
  const f = _sectorIdx(G.helmAttackVector || 'fore');
  const b = _sectorIdx(G.enemyBearing || 'fore');
  return _SECTOR_ORDER[(f - b + 4) % 4];
}

// Single source of truth for "can this player weapon bear on the target right now?"
function weaponInArc(weapon) {
  return !!weapon && !!weapon.arc && weapon.arc.includes(effectiveEnemySector()) && mountBearsOnTarget(weapon);
}

// The player's elevation as seen by the enemy is the inverse of the enemy's
// elevation as seen by the player.
function getPlayerElevation() {
  const e = G.enemyElevation || 'level';
  return e === 'above' ? 'below' : e === 'below' ? 'above' : 'level';
}

// Enemy weapon vs the player — same dorsal/ventral limitation, mirrored.
function enemyWeaponBears(sys) {
  return !_elevationBlocks(sys && sys.mount, getPlayerElevation());
}

// ── Frame-level power cache ───────────────────────────────────
// Recomputed at most once per RAF frame (keyed by G.lastFrameTimestamp).
// Invalidated explicitly on any power change so user-input paths stay accurate.
let _powerCacheKey  = -1;
let _warpOutCache   = 0;
let _totalPowCache  = 0;

function _invalidatePowerCache() { _powerCacheKey = -1; }

function _refreshPowerCache() {
  if (_powerCacheKey === G.lastFrameTimestamp && _powerCacheKey !== -1) return;
  const wc = G.systems.warp_core;
  _warpOutCache  = wc.tripped ? (G.batteryActive ? WARP_CORE.impulseOutput : 0) : Math.round(WARP_CORE.maxOutput * (wc.health / 100));
  _totalPowCache = Object.values(G.systems).reduce((t, s) => t + s.allocatedPower, 0);
  _powerCacheKey = G.lastFrameTimestamp;
}

function getWarpOutput()          { _refreshPowerCache(); return _warpOutCache; }
function getTotalAllocatedPower() { _refreshPowerCache(); return _totalPowCache; }

// ── Effective enemy fire interval (derived — never mutate G.threat.fireInterval directly) ──
// Combines base rate × difficulty × permanent scan bonuses × active scanner.
function getEffectiveFireInterval() {
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  if (!cfg || !G.running) return 3000;
  const diff = DIFFICULTY[currentDifficulty];
  let iv = Math.round(cfg.fireInterval * diff.enemyFireMult);
  if (G.permanentScanBonuses?.weapon_disrupt) iv = Math.round(iv * 1.30);
  if (G.activeScanningProfile)               iv = Math.round(iv * 0.85);
  return iv;
}

// ── Difficulty selector ───────────────────────────────────────
function setDifficulty(level) {
  currentDifficulty = level;
  const descs = {
    normal:'Standard engagement. Five enemy types. Hull-sector targeting only. Balanced for all players.',
    hard:'Full enemy roster including D\'Deridex Warbird and Jem\'Hadar Battle Cruiser. Subsystem targeting. Experienced players.',
    elite:'BORG PROBE ONLY. Adaptive shielding — each weapon type faces escalating resistance. The adaptation mechanic is the challenge. Winnable with excellent weapon rotation.'
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
  if (G.historicalLogTracks.length >= 600) G.historicalLogTracks = G.historicalLogTracks.slice(-500);
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
