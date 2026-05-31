'use strict';

// ============================================================
// COMMAND.JS — CAPTAIN'S CHAIR
// Loaded after helm.js, before canvas.js
// ============================================================

const CREW_COLOURS = {
  worf:   '#ff9900',
  obrien: '#4477ff',
  nog:    '#cc6699',
  system: '#6688aa',
};
const CREW_LABELS = {
  worf:   "Lt. Cmdr Worf",
  obrien: "Chief O'Brien",
  nog:    'Ensign Nog',
  system: 'BRIDGE SYS',
};

// ── Crew Report Feed ──────────────────────────────────────────

function postCrewReport(crew, text, type) {
  type = type || 'status';
  if (!G.running && type !== 'system') return;
  G.crewReports.unshift({ crew, text, type, ts: Date.now() });
  if (G.crewReports.length > 50) G.crewReports.pop();
  if (G.playerChosenStation === 'captain') _renderCrewComms();
}

function _renderCrewComms() {
  const feed = document.getElementById('captain-comms-feed');
  if (!feed) return;
  const lines = G.crewReports.slice(0, 10);
  feed.innerHTML = lines.map(r => {
    const col  = CREW_COLOURS[r.crew] || '#aabbcc';
    const lbl  = CREW_LABELS[r.crew]  || r.crew;
    const cls  = r.type === 'alert' ? ' comms-alert' : r.type === 'good' ? ' comms-good' : '';
    return `<div class="comms-line${cls}">` +
           `<span class="comms-speaker" style="color:${col};">${lbl}:</span> ` +
           `<span class="comms-text">${r.text}</span></div>`;
  }).join('');
}

// ── Captain Overview Mini-Panels ──────────────────────────────

function updateCaptainOverview() {
  if (G.playerChosenStation !== 'captain') return;

  // Hull
  const hullPct = Math.round((G.player.hull / G.player.maxHull) * 100);
  _setTxt('cap-hull-val', hullPct + '%');
  _fillBar('cap-hull-bar', hullPct);

  // Tactical panel
  _setTxt('cap-tac-lock',       Math.round(G.lockProgress) + '%');
  _setTxt('cap-tac-enemy-hull', Math.round((G.threat.hull / G.threat.maxHull) * 100) + '%');
  _setTxt('cap-tac-fore-shld',  Math.round(G.player.shields.fore) + '/' + G.player.shields.maxSectorValue);
  _fillBar('cap-tac-lock-bar',  G.lockProgress);
  _fillBar('cap-tac-enemy-bar', (G.threat.hull / G.threat.maxHull) * 100);
  _fillBar('cap-tac-shld-bar',  (G.player.shields.fore / G.player.shields.maxSectorValue) * 100);

  // Engineering panel
  const mw = getTotalAllocatedPower();
  const regen = (G.shieldRegenRate || 0).toFixed(1);
  const repairing = G.repairTeams.some(t => t.sysKey);
  _setTxt('cap-eng-power',  mw + ' MW');
  _setTxt('cap-eng-regen',  regen + ' SP/s');
  _setTxt('cap-eng-repair', repairing ? 'ACTIVE' : 'IDLE');
  _fillBar('cap-eng-power-bar', (mw / 120) * 100);
  const repEl = document.getElementById('cap-eng-repair');
  if (repEl) repEl.style.color = repairing ? 'var(--green)' : 'var(--warn)';

  // Helm panel
  const speedLabel = { stop:'ALL STOP', maneuvering:'MANEUVERING', half:'HALF IMPULSE', full:'FULL IMPULSE' };
  const rangeLabel = { long:'LONG', medium:'MEDIUM', close:'CLOSE' };
  const maneuver   = G.attackRunActive ? 'ATTACK RUN' :
                     G.comeAboutActive ? 'COME ABOUT' :
                     G.evasiveActive   ? 'EVASIVE ◈'  : '—';
  _setTxt('cap-helm-speed',    speedLabel[G.helmSpeed] || G.helmSpeed.toUpperCase());
  _setTxt('cap-helm-range',    rangeLabel[G.playerRangeBracket] || G.playerRangeBracket.toUpperCase());
  _setTxt('cap-helm-vector',   (G.helmAttackVector || 'fore').toUpperCase());
  _setTxt('cap-helm-maneuver', maneuver);

  _updateCaptainOrderButtons();
}

function _setTxt(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function _fillBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

// ── Order Cooldowns ───────────────────────────────────────────

const _CAP_CD = {
  fire_cannons:3000, fire_quantum:5000, fire_photon:3000,
  fire_burst:14000,  fire_alpha:9000,   rotate_freq:32000,
  evasive:22000,     cloak:28000,
  boost_shields:8000, emerg_batt:22000, repair_wpn:12000,
  repair_sys:12000,  flush_eps:16000,   dmg_ctrl:22000,
  speed_full:1500,   speed_half:1500,   speed_stop:1500,
  attack_run:22000,  come_about:20000,
  range_long:1500,   range_close:1500,  emerg_warp:0,
};

function tickCaptainCooldowns(dt) {
  for (const k in G.captainOrderCooldowns) {
    if (G.captainOrderCooldowns[k] > 0)
      G.captainOrderCooldowns[k] = Math.max(0, G.captainOrderCooldowns[k] - dt);
  }
}

function _canOrder(key) { return (G.captainOrderCooldowns[key] || 0) <= 0; }
function _startCD(key)  { G.captainOrderCooldowns[key] = _CAP_CD[key] || 0; }

function _updateCaptainOrderButtons() {
  Object.keys(_CAP_CD).forEach(key => {
    const btn = document.getElementById('cap-ord-' + key);
    if (!btn) return;
    const ready = _canOrder(key);
    btn.disabled    = !ready;
    btn.style.opacity = ready ? '1' : '0.38';
    const cd = G.captainOrderCooldowns[key] || 0;
    const lbl = btn.getAttribute('data-label') || btn.textContent.split('\n')[0];
    btn.setAttribute('data-label', lbl);
    btn.firstChild.textContent = ready ? lbl : lbl + ' (' + Math.ceil(cd / 1000) + 's)';
  });
}

// ── Issue an Order ────────────────────────────────────────────

function _order(key, fn, crew, msg) {
  if (!G.running || !_canOrder(key)) return;
  _startCD(key);
  postCrewReport(crew, msg, 'status');
  setTimeout(() => { try { fn(); } catch(e) { console.warn('Captain order failed:', e); } }, 350);
  _updateCaptainOrderButtons();
}

// Tactical — Worf
function capFireCannons()  { _order('fire_cannons', firePulseCannons,                              'worf',   "Aye, Captain — all pulse cannons firing."); }
function capFireQuantum()  { _order('fire_quantum',  () => fireSelectedArray('torpedo_quantum'),    'worf',   "Quantum torpedo away, sir."); }
function capFirePhoton()   { _order('fire_photon',   () => fireSelectedArray('torpedo_photon'),     'worf',   "Photon torpedo launched, Captain."); }
function capFireBurst()    { _order('fire_burst',    executeBurstFireSalvo,                         'worf',   "Initiating burst salvo — four cannon barrage."); }
function capFireAlpha()    { _order('fire_alpha',    executeAlphaSalvoFire,                         'worf',   "All weapons firing, Captain."); }
function capRotateFreq()   { _order('rotate_freq',   rotateShieldFrequency,                        'worf',   "Rotating shield frequencies now, Captain."); }
function capEvasive()      { _order('evasive',       executeEvasivePattern,                         'worf',   "Evasive Pattern Delta, aye."); }
function capCloak()        { _order('cloak',         toggleCloakingDevice,                          'worf',   "Engaging cloaking device, Captain."); }

// Engineering — O'Brien
function capBoostShields() { _order('boost_shields', () => _capPumpShields(),                      'obrien', "Rerouting power to fore shields, Captain."); }
function capEmergBatt()    { _order('emerg_batt',    _capActivateBattery,                           'obrien', "Switching to emergency battery, aye."); }
function capRepairWpn()    { _order('repair_wpn',    emergencyRepairWeapons,                        'obrien', "Dispatching repair team to weapons, Captain."); }
function capRepairSys()    { _order('repair_sys',    emergencyRepairSystems,                        'obrien', "Repair team on critical systems, aye."); }
function capFlushEPS()     { _order('flush_eps',     masterConduitFlush,                            'obrien', "Flushing EPS conduits, Captain."); }
function capDmgCtrl()      { _order('dmg_ctrl',      () => _capDamageControl(),                    'obrien', "Damage control engaged, Captain."); }

// Helm — Nog
function capSpeedFull()    { _order('speed_full',    () => setHelmSpeed('full'),                   'nog',    "Full impulse, aye Captain."); }
function capSpeedHalf()    { _order('speed_half',    () => setHelmSpeed('half'),                   'nog',    "Half impulse, aye."); }
function capSpeedStop()    { _order('speed_stop',    () => setHelmSpeed('stop'),                   'nog',    "All stop, Captain."); }
function capAttackRun()    { _order('attack_run',    executeAttackRun,                              'nog',    "Initiating attack run, Captain."); }
function capComeAbout()    { _order('come_about',    executeComeAbout,                              'nog',    "Coming about, aye."); }
function capRangeLong()    { _order('range_long',    () => setPlayerRangeBracket('long'),           'nog',    "Increasing to long-range engagement, Captain."); }
function capRangeClose()   { _order('range_close',   () => setPlayerRangeBracket('close'),          'nog',    "Closing to combat range, aye Captain."); }
function capEmergWarp()    { _order('emerg_warp',    attemptEmergencyWarp,                          'worf',   "Emergency warp engaged, Captain!"); }

// ── Engineering wrappers (bypass station guards) ──────────────

function _capPumpShields() {
  // Re-implement pumpShieldSector for captain (bypasses station guard in engineering.js)
  if (G.cloaked) return;
  const spill = Math.min(30, G.player.shields.fore * 0.1);
  G.player.shields.fore = Math.min(G.player.shields.maxSectorValue, G.player.shields.fore + spill * 3);
  G.player.shields.port     = Math.max(0, G.player.shields.port     - spill);
  G.player.shields.starboard= Math.max(0, G.player.shields.starboard- spill);
  G.player.shields.aft      = Math.max(0, G.player.shields.aft      - spill);
  postLogEvent("O'Brien: power rerouted — fore shields reinforced.", 'good');
}

function _capActivateBattery() {
  // Allow captain to activate battery
  if (G.batteryCharge < 10) { postCrewReport('obrien', "Emergency battery depleted, Captain.", 'alert'); return; }
  if (!G.systems.warp_core.tripped && G.systems.warp_core.health > 20) {
    postCrewReport('obrien', "Battery reserve not needed — warp core is online, Captain.", 'status'); return;
  }
  G.batteryActive = true;
  postLogEvent("Emergency battery online — supplementing impulse power.", 'good');
}

function _capDamageControl() {
  // Find worst-damaged system and queue repair
  let worst = null, worstH = 101;
  Object.keys(G.systems).forEach(k => {
    if (G.systems[k].health < worstH) { worst = k; worstH = G.systems[k].health; }
  });
  if (!worst || worstH >= 95) {
    postCrewReport('obrien', "All systems nominal, Captain. No emergency repairs needed.", 'status');
    return;
  }
  const freeIdx = G.repairTeams.findIndex(t => !t.sysKey);
  if (freeIdx < 0) {
    postCrewReport('obrien', "Both repair teams already deployed, Captain.", 'alert');
    return;
  }
  const sys = G.systems[worst];
  const dmg = Math.max(1, 100 - sys.health + (sys.tripped ? 20 : 0));
  const rt  = Math.max(5000, (dmg / 10) * 5000);
  G.repairTeams[freeIdx].sysKey    = worst;
  G.repairTeams[freeIdx].label     = sys.label;
  G.repairTeams[freeIdx].totalTime = rt;
  G.repairTeams[freeIdx].remaining = rt;
  postLogEvent(`O'Brien: ${freeIdx === 0 ? 'Alpha' : 'Beta'} Team dispatched to ${sys.label} on captain's order.`, 'good');
}

// ── Periodic Crew Reports ─────────────────────────────────────

const _WORF_REPORTS = [
  () => `Targeting lock at ${Math.round(G.lockProgress)}%. Enemy hull at ${Math.round((G.threat.hull / G.threat.maxHull) * 100)}%.`,
  () => `Fore shields ${Math.round(G.player.shields.fore)}SP. ${G.burstFireReady ? 'Burst salvo standing by.' : 'Burst salvo recharging.'}`,
  () => `Weapons nominal. ${G.player.torpedoes} quantum, ${G.player.photonTorpedoes} photon torpedoes remaining.`,
  () => G.enemyCloaked
    ? "Enemy cloaked, Captain — running passive sweeps. Awaiting decloak window."
    : `Enemy firing every ${((G.threat.fireInterval || 5000) / 1000).toFixed(1)}s. Shields holding.`,
  () => `Tactical assessment: ${ENEMY_CONFIGS[G.enemyArchetype] ? ENEMY_CONFIGS[G.enemyArchetype].label : 'hostile'} at ${G.enemyRangeBracket} range.`,
];

const _OBRIEN_REPORTS = [
  () => `Engineering report: EPS at ${getTotalAllocatedPower()}MW. Shield regen ${(G.shieldRegenRate || 0).toFixed(1)} SP/s.`,
  () => {
    const allOk = Object.values(G.systems).every(s => s.health > 70 && !s.tripped);
    return allOk ? "All systems running within normal parameters, Captain." : "Systems showing stress — recommend repair priority, Captain.";
  },
  () => `EPS thermal ${Math.round(G.epsHeat)}%. ${G.epsHeat > 65 ? "Suggest easing weapons fire to cool conduits." : "Thermal levels nominal."}`,
  () => `Ablative armour: ${G.ablative.layers} layer${G.ablative.layers !== 1 ? 's' : ''} active. Hull at ${Math.round((G.player.hull / G.player.maxHull) * 100)}%.`,
  () => {
    const active = G.repairTeams.filter(t => t.sysKey).map(t => t.label);
    return active.length ? `Repair teams working on: ${active.join(', ')}.` : "Repair teams standing by, Captain.";
  },
];

const _NOG_REPORTS = [
  () => `Helm report: ${G.helmSpeed} impulse, ${G.playerRangeBracket} range, ${G.helmAttackVector} attack vector.`,
  () => G.attackRunActive ? "Attack run in progress, Captain." : G.comeAboutActive ? "Coming about, Captain." : "Holding current heading and speed.",
  () => {
    const eLock = Math.round(G.enemyLockProgress || 0);
    return `Enemy targeting lock at ${eLock}%. ${eLock > 70 ? "Recommend evasive action, Captain!" : "Within acceptable parameters."}`;
  },
  () => `Navigation: enemy at ${G.enemyRangeBracket} range. Engagement distance ${G.playerRangeBracket === G.enemyRangeBracket ? 'matched' : 'differential — your order, Captain'}.`,
];

let _worfIdx = 0, _obrienIdx = 0, _nogIdx = 0;

function tickCaptainPeriodicReports(dt) {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  G.captainPeriodicTimer -= dt;
  if (G.captainPeriodicTimer > 0) return;
  G.captainPeriodicTimer = 10000 + Math.random() * 10000; // 10–20s

  const r = Math.random();
  try {
    if (r < 0.38) {
      postCrewReport('worf',   _WORF_REPORTS[_worfIdx % _WORF_REPORTS.length](),   'status');
      _worfIdx++;
    } else if (r < 0.70) {
      postCrewReport('obrien', _OBRIEN_REPORTS[_obrienIdx % _OBRIEN_REPORTS.length](), 'status');
      _obrienIdx++;
    } else {
      postCrewReport('nog',    _NOG_REPORTS[_nogIdx % _NOG_REPORTS.length](),       'status');
      _nogIdx++;
    }
  } catch(e) {}
}

// ── Event-Driven Reports (called from other files) ────────────

function crewReportShieldHit(sector, damage) {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  if (damage < 15) return; // ignore minor grazes
  const pool = [
    `${sector.toUpperCase()} shields taking fire — ${Math.round(damage)} damage absorbed.`,
    `Direct hit on ${sector} quarter, Captain.`,
    `${sector.toUpperCase()} shields down to ${Math.round(G.player.shields[sector] || 0)}SP.`,
  ];
  postCrewReport('worf', pool[Math.floor(Math.random() * pool.length)], 'alert');
}

function crewReportHullBreach(damage) {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  postCrewReport('obrien',
    `Hull breach! ${Math.round(damage)} structural damage. Integrity at ${Math.round((G.player.hull / G.player.maxHull) * 100)}%.`,
    'alert');
}

function crewReportEnemyCloak() {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('worf', "Captain — enemy has cloaked. Switching to passive sensor sweep.", 'alert');
}

function crewReportEnemyDecloak() {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('worf', "Enemy decloaking — vulnerability window open. Fire at will, Captain?", 'good');
}

function crewReportSystemTripped(systemLabel) {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  postCrewReport('obrien', `${systemLabel} breaker tripped, Captain. Rerouting through secondary conduit.`, 'alert');
}

function crewReportRepairComplete(systemLabel) {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  postCrewReport('obrien', `${systemLabel} repaired and back online, Captain.`, 'good');
}

function crewReportWarpCoreTrip() {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('obrien', "Warp core offline! Switching to impulse power. Emergency battery available on your order.", 'alert');
}

function crewReportLowHull() {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  postCrewReport('obrien',
    `Hull integrity at ${Math.round((G.player.hull / G.player.maxHull) * 100)}%, Captain. Emergency warp available on your order.`,
    'alert');
}

function crewReportEnemyRamming() {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('nog', "Captain — enemy on a ramming trajectory! Evasive action recommended NOW!", 'alert');
}

function crewReportKlingonClosing() {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('worf', "Captain, enemy closing to combat range. Disruptor damage will increase significantly.", 'alert');
}

function crewReportAttackRunComplete() {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('nog', "Attack run complete, Captain. Returning to medium-range approach.", 'status');
}

function crewReportComeAboutComplete(sector) {
  if (G.playerChosenStation !== 'captain') return;
  postCrewReport('nog',
    `Come about complete. Presenting ${sector.toUpperCase()} shields to the enemy — ${Math.round(G.player.shields[sector] || 0)}SP.`,
    'good');
}

function crewReportWeaponsDisrupted() {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  postCrewReport('worf', "Captain, enemy scan has disrupted our weapons. Reduced fire rate.", 'alert');
}

function crewReportWeaponsOnline() {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  postCrewReport('worf', "Weapons disruption cleared, Captain. Full fire rate restored.", 'good');
}

function crewReportScanCommitted(type) {
  if (G.playerChosenStation !== 'captain' || !G.running) return;
  const msgs = {
    shields: "Scan committed — weapons calibrated against enemy shield frequencies.",
    hull:    "Hull fissures mapped — all weapons yielding increased damage, Captain.",
    weapons: "Enemy weapons disrupted, Captain. Fire rate cut by fifty percent.",
    tetryon: "Tetryon pulse active — enemy targeting severely degraded.",
  };
  postCrewReport('worf', msgs[type] || "Scan profile committed.", 'good');
}

// ── Init ──────────────────────────────────────────────────────

function initCaptainStation() {
  G.crewReports          = [];
  G.captainOrderCooldowns = {};
  G.captainPeriodicTimer  = 6000;
  _worfIdx = 0; _obrienIdx = 0; _nogIdx = 0;

  const enemy = (ENEMY_CONFIGS[G.enemyArchetype] || {}).label || 'hostile vessel';
  postCrewReport('system', `Commanding USS Defiant NX-74205. ${enemy} on long-range sensors.`, 'system');
  postCrewReport('nog',    "Helm responding. Half impulse, medium range, fore attack vector.", 'good');
  postCrewReport('obrien', "Engineering nominal. Warp core online, EPS at full output.", 'good');
  postCrewReport('worf',   "All weapons armed and ready, Captain. Awaiting your orders.", 'good');

  _renderCrewComms();
  updateCaptainOverview();
}
