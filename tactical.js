'use strict';

// ============================================================
// TACTICAL.JS — Player weapons, cloaking, evasive, burst fire
// Depends on: config.js, state.js, engineering.js, crew.js
// ============================================================

// ── Evasive Pattern Delta ─────────────────────────────────────
function executeEvasivePattern() {
  if (!G.running || G.dead) return;
  if (G.evasiveActive) { postLogEvent("Evasive pattern already active.", 'info'); return; }
  if (G.evasiveCooldown > 0) { postLogEvent(`Evasive pattern cooldown: ${Math.ceil(G.evasiveCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.engines.health < 20 || G.systems.engines.tripped) { postLogEvent("Impulse engines too damaged for evasive action.", 'crit'); return; }
  G.systems.engines.stress = Math.min(100, G.systems.engines.stress + 25);
  G.evasiveActive   = true;
  G.evasiveCooldown = G.evasiveDuration;
  postLogEvent("EVASIVE PATTERN DELTA — enemy lock rate −60% for 8s.", 'good');
  postTacticalAdvisory("Executing evasive pattern — hard about on all thrusters.");
  updateEvasiveButton();
}

function updateEvasiveButton() {
  const btn = document.getElementById('btn-evasive'); if (!btn) return;
  if (G.evasiveActive) {
    btn.textContent = `◈ EVADING ${Math.ceil(G.evasiveCooldown/1000)}s`;
    btn.style.background = 'var(--green)'; btn.style.color = '#000';
  } else if (G.evasiveCooldown > 0) {
    btn.textContent = `◈ EVASIVE CD ${Math.ceil(G.evasiveCooldown/1000)}s`;
    btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc';
  } else {
    btn.textContent = '◈ EVASIVE PATTERN';
    btn.style.background = ''; btn.style.color = '';
  }
}

// ── Burst-fire salvo ──────────────────────────────────────────
function executeBurstFireSalvo() {
  if (!G.running || G.dead) return;
  if (!G.burstFireReady) { postLogEvent(`Burst capacitors recharging — ${Math.ceil(G.burstFireCooldown/1000)}s.`, 'warn'); return; }
  if (G.cloaked || G.cloakVulnTimer > 0) { postLogEvent("Cannot fire while cloaking.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  if (G.lockProgress < 20) { postLogEvent("Burst fire requires ≥20% lock.", 'warn'); return; }

  const aw = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const cannons = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  const ready   = cannons.filter(k => {
    if (!aw[k] || !aw[k].arc.includes(G.helmAttackVector)) return false;
    const s = G.systems[aw[k].parentSystem];
    return !s.tripped && s.health >= 10 && s.cap >= aw[k].cost;
  });
  if (ready.length === 0) { postLogEvent("No primary weapons in arc and ready for burst.", 'warn'); return; }

  postLogEvent(`BURST SALVO — ${ready.length} cannons in 800ms window!`, 'crit');
  G.burstFireReady    = false;
  G.burstFireCooldown = 9000;
  ready.forEach((k, i) => {
    setTimeout(() => {
      if (!G.dead) {
        fireSelectedArray(k);
        G.renderedBeamsVector.push({ type:'burst_flash', trackingStartTime: performance.now(), duration: 200 });
      }
    }, i * 200);
  });
}

// ── Shield frequency rotation ─────────────────────────────────
function rotateShieldFrequency() {
  if (!G.running || G.dead) return;
  if (G.cloaked) { postLogEvent("Shields offline while cloaked.", 'warn'); return; }
  if (G.shieldFreqCooldown > 0) { postLogEvent(`Frequency modulator recharging — ${Math.ceil(G.shieldFreqCooldown/1000)}s.`, 'warn'); return; }

  const cfg  = ENEMY_CONFIGS[G.enemyArchetype];
  const wpns = Object.values(cfg.systems).filter(s => s.isWeapon);
  let weaponType = 'phasers';
  if (wpns.some(s => s.systemTargetKey === 'disruptors'))                     weaponType = 'disruptors';
  else if (wpns.some(s => s.isPolaron))                                        weaponType = 'polaron';
  else if (wpns.some(s => s.isTorpedo && s.label.includes('Plasma')))         weaponType = 'plasma';

  G.shieldFreqActive     = true;
  G.shieldFreqTimer      = 12000;
  G.shieldFreqCooldown   = 30000;
  G.shieldFreqWeaponType = weaponType;

  const labels = { disruptors:'disruptor', phasers:'phaser', polaron:'polaron', plasma:'plasma' };
  postLogEvent(`Shield harmonics rotated — countering ${labels[weaponType]} frequencies. −25% incoming for 12s.`, 'good');
  updateShieldFreqButton();
}

function updateShieldFreqButton() {
  const btn = document.getElementById('btn-shield-freq'); if (!btn) return;
  if (G.shieldFreqActive) {
    btn.textContent = `🛡 FREQ ACTIVE ${Math.ceil(G.shieldFreqTimer/1000)}s`;
    btn.style.background = 'var(--green)'; btn.style.color = '#000';
  } else if (G.shieldFreqCooldown > 0) {
    btn.textContent = `🛡 FREQ CD ${Math.ceil(G.shieldFreqCooldown/1000)}s`;
    btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc';
  } else {
    btn.textContent = '🛡 ROTATE FREQ';
    btn.style.background = ''; btn.style.color = '';
  }
}

// ── Particle helper ───────────────────────────────────────────
function spawnParticles(target, count, col) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;
    particles.push({ target, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life:0, maxLife:400+Math.random()*500, col });
  }
  return particles;
}

// ── Player weapon fire ────────────────────────────────────────
function fireSelectedArray(weaponKey) {
  if (!G.running || G.dead) return;
  if (G.cloaked) { postLogEvent("Cannot fire while cloaked.", 'warn'); return; }
  if (G.cloakVulnTimer > 0) { postLogEvent("Cannot fire during cloak transition.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }

  const weapon    = (G.activeWeaponArrays || ARRAYS_DICTIONARY)[weaponKey]; if (!weapon) return;
  // Saucer-section arrays are physically unavailable while separated
  if (_isSaucerWeapon(weapon)) {
    postLogEvent(`${weapon.label} — saucer section separated. Array unavailable.`, 'warn'); return;
  }
  if (weapon.arc && weapon.arc.length > 0 && !weapon.arc.includes(G.helmAttackVector)) {
    postLogEvent(`${weapon.label} — out of firing arc on ${G.helmAttackVector.toUpperCase()} vector.`, 'warn'); return;
  }
  const parentSys = G.systems[weapon.parentSystem];
  if (!parentSys || parentSys.health < 10 || parentSys.tripped) { postLogEvent(`${weapon.label} offline.`, 'warn'); return; }
  if (parentSys.cap < weapon.cost) { postLogEvent(`${weapon.label} capacitor low (${Math.round(parentSys.cap)}%).`, 'warn'); return; }

  // Block energy weapons vs fully cloaked enemy; torpedoes fire blind
  if (G.enemyCloaked && G.enemyCloakVulnTimer <= 0) {
    if (weapon.isQuantum || weapon.isPhoton) {
      const mag = weapon.isPhoton ? G.player.photonTorpedoes : G.player.torpedoes;
      const tube = weapon.isPhoton ? 'Photon' : 'Quantum';
      if (mag <= 0) { postLogEvent(`${tube} torpedo magazine empty.`, 'warn'); return; }
      if (weapon.isPhoton) G.player.photonTorpedoes--; else G.player.torpedoes--;
      parentSys.cap -= weapon.cost;
      G.inFlightTorpedoes.push({ dmg: weapon.yield * 0.4, timeToImpact: 3500, fromEnemy: false });
      postLogEvent(`${tube} torpedo blind-fired from ${weapon.arc.includes('aft') ? 'aft' : 'forward'} tube.`, 'warn');
    } else {
      postLogEvent("Enemy cloaked — energy weapons cannot track target.", 'warn');
    }
    return;
  }

  const needsLock = !weapon.isPhoton;
  if (needsLock && G.lockProgress < 5 && G.enemyCloakVulnTimer <= 0) { postLogEvent("No targeting lock — acquire lock before firing.", 'warn'); return; }

  if (weapon.isQuantum) {
    if (G.player.torpedoes <= 0) { postLogEvent("Quantum torpedo magazine empty.", 'warn'); return; }
    G.player.torpedoes--;
  } else if (weapon.isPhoton) {
    if (G.player.photonTorpedoes <= 0) { postLogEvent("Photon torpedo magazine empty.", 'warn'); return; }
    G.player.photonTorpedoes--;
  }

  parentSys.cap -= weapon.cost;

  const sensorPow    = G.systems.sensors.allocatedPower;
  const sensorHealth = G.systems.sensors.health;
  const sensorMod    = sensorHealth < 70 ? 0.35 + (sensorHealth / 70) * 0.35 : Math.min(1.2, 0.8 + (sensorPow / 20) * 0.4);
  const crewMod      = getCrewEfficiency('tactical');
  const lockMod      = (0.5 + (G.lockProgress / 100) * 0.5) * sensorMod * crewMod;

  let dmg;
  if (weapon.isQuantum) {
    if (G.lockProgress >= 60) { dmg = weapon.yield * (0.85 + Math.random() * 0.30) * (parentSys.health / 100) * crewMod; postLogEvent(`Quantum torpedo [${weapon.arc.includes('aft') ? 'AFT' : 'FWD'}] — clean intercept solution.`, 'good'); }
    else                       { dmg = weapon.yield * (0.45 + Math.random() * 0.20) * (parentSys.health / 100) * crewMod; postLogEvent(`Quantum torpedo [${weapon.arc.includes('aft') ? 'AFT' : 'FWD'}] — partial lock, glancing impact.`, 'warn'); }
  } else if (weapon.isPhoton) {
    dmg = weapon.yield * (parentSys.health / 100) * crewMod;
  } else {
    dmg = weapon.yield * (parentSys.health / 100) * lockMod;
  }

  dmg *= (HELM_SPEED_CONFIG[G.helmSpeed]?.yieldMult ?? 1.0);
  if (G.picardManoeuverActive)   dmg *= 1.50;
  if (G.attackPatternOmegaActive) dmg *= 1.40;

  const _r = G.playerRangeBracket;
  const _isTorp   = weapon.isQuantum || weapon.isPhoton;
  const _isCannon = weapon.parentSystem && weapon.parentSystem.startsWith('cannon');
  const _isNose   = weapon.parentSystem === 'nose_beam';
  if (_isTorp)        { if (_r === 'long') dmg *= 1.15; if (_r === 'close') dmg *= 0.90; }
  else if (_isCannon) { if (_r === 'close' || G.attackRunActive) dmg *= 1.20; else if (_r === 'long' && !G.attackRunActive) dmg *= 0.90; }
  else if (_isNose)   { if (_r === 'close') dmg *= 1.10; if (_r === 'long') dmg *= 0.90; }

  if (G._overchargeActive)   dmg *= (G._maxPhaserActive ? 1.60 : 1.50);
  if (G._unstableTorpActive) dmg *= 1.70;
  if (G.powerDumpActive)     dmg *= 1.40;
  // Stardrive power boost — EPS no longer split with saucer section
  if (G.saucerSepActive && !G.saucerSepReconnecting) dmg *= 1.20;

  if (G.scanBonus && performance.now() < G.scanBonus.expiry) {
    if (G.scanBonus.type === 'shields' && !weapon.isPhoton) dmg *= G.scanBonus.value;
    if (G.scanBonus.type === 'hull') dmg *= G.scanBonus.value;
  }
  // Permanent scan bonuses
  if (G.permanentScanBonuses.hull_weakness) dmg *= 1.20;

  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // Quantum torpedo warhead bonus vs polaron-shielded ships (DS9 Dominion War — quantum
  // warheads specifically engineered to penetrate polaron-based shielding technology)
  if (weapon.isQuantum && cfg.polaronWeapons) dmg *= 1.20;
  if (cfg.adaptiveShields) {
    const adaptKey = weapon.isPhoton ? 'photon' : weapon.parentSystem;
    const resist   = G.enemyAdaptiveResist[adaptKey] || 0;
    dmg *= (1 - resist);
    // Defiant's weapons were specifically engineered to cycle frequency against Borg adaptation
    // (DS9 "The Search" — designed to exceed Borg shielding). Adaptation builds 40% slower.
    G.enemyAdaptiveResist[adaptKey] = Math.min(0.65, resist + 0.024);
    if (resist > 0.1 && resist < 0.65) postLogEvent(`Borg adapting to ${weapon.label} — ${Math.round(resist*100)}% resistance.`, 'warn');
    if (resist >= 0.65) postLogEvent(`Borg fully adapted to ${weapon.label} — modulate to new frequency!`, 'crit');
  }

  G.score.volleysFired++;
  G.score.totalDmgDealt += dmg;
  if (weapon.isQuantum)                     G.score.weaponsFired.quantum++;
  else if (weapon.isPhoton)                 G.score.weaponsFired.photon++;
  else if (weapon.parentSystem === 'nose_beam') G.score.weaponsFired.nose++;
  else                                      G.score.weaponsFired.cannons++;

  const bonusMult = G.enemyCloakVulnTimer > 0 ? 1.4 : 1.0;
  applyDamageToEnemy(dmg * bonusMult, weapon);
  if (weapon) {
    parentSys.stress = Math.min(100, parentSys.stress + weapon.cost * 0.18);
    G.renderedBeamsVector.push({ type: weapon.isPhoton ? 'photon' : weapon.parentSystem, trackingStartTime: performance.now(), duration: 300 });
    if (parentSys.isWeapon) G.epsHeat = Math.min(100, G.epsHeat + weapon.cost * 0.12);
    G.lastPlayerFireTime = performance.now();
  }
}

// ── Apply damage to enemy ─────────────────────────────────────
function applyDamageToEnemy(dmg, weapon, targetSectorOverride) {
  const cfg    = ENEMY_CONFIGS[G.enemyArchetype];
  const target = G.targetedSubsystemType;
  const sH     = G.systems.sensors.health;
  const sNote  = sH < 70 ? ` [SEN:${Math.round(sH)}%]` : '';

  if (target === 'hull') {
    let sectorPool;
    if (G.enemyManeuverState === 'angling' || G.enemyManeuverState === 'torpedocharge') {
      const pref = G.enemyPreferredSector;
      const adj  = { fore:['fore','port','starboard'], aft:['aft','port','starboard'], port:['port','fore','aft'], starboard:['starboard','fore','aft'] };
      sectorPool = adj[pref] || ['fore','port','starboard','aft'];
    } else {
      sectorPool = ['fore','fore','port','starboard','aft'];
    }
    const hitSector = targetSectorOverride || sectorPool[Math.floor(Math.random() * sectorPool.length)];
    let shieldDmg = dmg; let hullPassDmg = 0;
    if (cfg.polaronWeapons) { shieldDmg = dmg * 0.7; hullPassDmg = dmg * 0.3; }
    if (G.threat.shields[hitSector] > 0) {
      const abs  = Math.min(G.threat.shields[hitSector], shieldDmg);
      G.threat.shields[hitSector] = Math.max(0, G.threat.shields[hitSector] - abs);
      const leak = (shieldDmg - abs) + hullPassDmg;
      if (leak > 0) G.threat.hull = Math.max(0, G.threat.hull - leak);
      G.shieldHitFlash.enemy = { sector: hitSector, timer: 350 };
      postLogEvent(`${hitSector.toUpperCase()} shield −${Math.round(abs)}. Enemy hull:${Math.ceil(G.threat.hull)}.${sNote}`, 'good');
    } else {
      G.threat.hull = Math.max(0, G.threat.hull - dmg);
      G.shieldHitFlash.enemy = { sector: hitSector, timer: 600 };
      G.damageParticles.push(...spawnParticles('enemy', 8, C.warn));
      postLogEvent(`Direct hull hit (${hitSector.toUpperCase()}) −${Math.round(dmg)}. Enemy hull:${Math.ceil(G.threat.hull)}.${sNote}`, 'good');
    }
    if (cfg.adaptiveShields) G.enemyAdaptiveHits = Math.min(10, G.enemyAdaptiveHits + 1);

  } else if (target === 'shields') {
    ['fore','port','starboard','aft'].forEach(s => { G.threat.shields[s] = Math.max(0, G.threat.shields[s] - dmg * 0.35); });
    if (G.enemySystems.shields_sys) G.enemySystems.shields_sys.health = Math.max(0, G.enemySystems.shields_sys.health - dmg * 0.3);
    postLogEvent(`Shield generator hit — all sectors −${Math.round(dmg * 0.35)}.${sNote}`, 'good');

  } else {
    const sys = G.enemySystems[target];
    if (sys) {
      sys.health = Math.max(0, sys.health - dmg * 0.7);
      postLogEvent(`Subsystem [${sys.label}]: ${Math.round(sys.health)}%.${sNote}`, 'good');
      if (sys.health <= 0) {
        G.score.systemsDestroyed++;
        postLogEvent(`DESTROYED: [${sys.label}]!`, 'crit');
        const _ert = 25000 + Math.random() * 15000;
        G.enemyRepairQueue.push({ sysKey: target, totalTime: _ert, remaining: _ert });
        if (target === 'cloak_device' && G.enemyCloaked) {
          G.enemyCloaked = false; G.enemyCloakVulnTimer = 0;
          postLogEvent("Enemy cloaking destroyed — forced decloak!", 'crit');
        }
      }
    }
  }
  if (G.threat.hull <= 0) concludeSimulationRun(true, "Enemy vessel destroyed.", false);
}

// ── Simplified fire commands ──────────────────────────────────

// Fire all in-arc energy weapons (cannons/phasers + nose emitter)
function fireEnergyWeapons() {
  if (!G.running || G.dead) return;
  const aw  = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const cfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  // All non-torpedo keys that bear on current attack vector
  const energyKeys = Object.keys(aw).filter(k => {
    const w = aw[k];
    return w && !w.isQuantum && !w.isPhoton && w.arc.includes(G.helmAttackVector);
  });
  if (energyKeys.length === 0) {
    postLogEvent("No energy weapons bear on current attack vector.", 'warn'); return;
  }
  energyKeys.forEach(k => fireSelectedArray(k));
}

// Fire best available torpedo for current arc — one tube, arc-strict.
// Aft vector → aft tubes. All other vectors → fore tubes (fore/port/stbd arc).
// Quantum if lock ≥ 5% and magazine, otherwise photon. Never crosses tube positions.
function fireTorpedoBanks() {
  if (!G.running || G.dead) return;
  const aw  = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const vec = G.helmAttackVector;

  // Pick the tube set whose arc covers the current vector
  const useAft     = vec === 'aft';
  const quantumKey = useAft ? 'torpedo_quantum_aft' : 'torpedo_quantum';
  const photonKey  = useAft ? 'torpedo_photon_aft'  : 'torpedo_photon';

  // Verify the selected tubes actually bear on this vector
  const qInArc = aw[quantumKey] && aw[quantumKey].arc.includes(vec);
  const pInArc = aw[photonKey]  && aw[photonKey].arc.includes(vec);

  // Quantum first (better yield), photon as fallback only — never simultaneous
  if (qInArc && G.lockProgress >= 5 && G.player.torpedoes > 0) {
    fireSelectedArray(quantumKey);
  } else if (pInArc && G.player.photonTorpedoes > 0) {
    fireSelectedArray(photonKey);
  } else {
    postLogEvent("No torpedoes available on current attack vector.", 'warn');
  }
}

// Fire everything in arc (energy + torpedoes)
function fireAllWeapons() {
  fireEnergyWeapons();
  fireTorpedoBanks();
}

// ── Keep for internal / delegation use ───────────────────────
function firePulseCannons() { fireEnergyWeapons(); }
function fireAllPhaserArrays() { fireEnergyWeapons(); }

// Alpha salvo — all in-arc energy weapons + one torpedo (strict single-tube, arc-correct)
function executeAlphaSalvoFire() {
  fireEnergyWeapons();
  fireTorpedoBanks();
}

// ── Overload modes ────────────────────────────────────────────
function executeCannonOvercharge() {
  if (!G.running || G.dead) return;
  if (!G.overchargeReady) { postLogEvent(`Overcharge capacitors resetting — ${Math.ceil(G.overchargeCooldown/1000)}s.`, 'warn'); return; }
  if (G.cloaked || G.cloakVulnTimer > 0) { postLogEvent("Cannot fire while cloaking.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  const aw = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const cannonKeys = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  const ready = cannonKeys.filter(k => { if (!aw[k]) return false; const sys = G.systems[aw[k].parentSystem]; return sys && !sys.tripped && sys.health >= 10 && sys.cap >= aw[k].cost; });
  if (ready.length === 0) { postLogEvent("No cannon capacitors charged for overcharge.", 'warn'); return; }
  postLogEvent("CANNON OVERCHARGE — +50% yield, high breaker risk!", 'crit');
  G.overchargeReady   = false;
  G.overchargeCooldown = 30000;
  ready.forEach((k, i) => {
    setTimeout(() => {
      if (G.dead) return;
      const weapon = aw[k]; const sys = G.systems[weapon.parentSystem];
      if (!sys || sys.tripped || sys.cap < weapon.cost) return;
      G._overchargeActive = true; try { fireSelectedArray(k); } finally { G._overchargeActive = false; }
      sys.stress = Math.min(100, sys.stress + 55);
      G.epsHeat  = Math.min(100, G.epsHeat + 8);
    }, i * 150);
  });
}

function executeUnstableTorpedo() {
  if (!G.running || G.dead) return;
  if (!G.unstableTorpReady) { postLogEvent(`Torpedo tube re-stabilising — ${Math.ceil(G.unstableTorpCooldown/1000)}s.`, 'warn'); return; }
  if (G.cloaked || G.cloakVulnTimer > 0) { postLogEvent("Cannot fire while cloaking.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  if (G.player.torpedoes <= 0) { postLogEvent("Quantum torpedo magazine empty.", 'warn'); return; }
  const sys = G.systems.torpedoes;
  if (!sys || sys.tripped || sys.health < 10) { postLogEvent("Torpedo tube offline.", 'warn'); return; }
  // Validate arc before consuming cooldown — torpedo_quantum is fore/port/stbd only
  const _utWeapon = (G.activeWeaponArrays || ARRAYS_DICTIONARY)['torpedo_quantum'];
  if (_utWeapon && !_utWeapon.arc.includes(G.helmAttackVector)) {
    postLogEvent("Unstable torpedo — forward tubes not bearing on current attack vector.", 'warn'); return;
  }
  postLogEvent("UNSTABLE TORPEDO — +70% yield, misfire risk!", 'crit');
  G.unstableTorpReady    = false;
  G.unstableTorpCooldown = 35000;
  G._unstableTorpActive = true; try { fireSelectedArray('torpedo_quantum'); } finally { G._unstableTorpActive = false; }
  if (Math.random() < 0.25) {
    const dmg = 30 + Math.random() * 20;
    sys.health = Math.max(0, sys.health - dmg);
    postLogEvent(`Containment breach — torpedo tube took ${Math.round(dmg)}% damage!`, 'crit');
    if (sys.health < 20) { sys.tripped = true; postLogEvent("Torpedo tube offline — containment failure.", 'crit'); }
  }
}

function executeEmergencyPowerDump() {
  if (!G.running || G.dead) return;
  if (!G.powerDumpReady)  { postLogEvent(`EPS dump capacitors recharging — ${Math.ceil(G.powerDumpCooldown/1000)}s.`, 'warn'); return; }
  if (G.powerDumpActive)  { postLogEvent("Emergency power dump already active.", 'warn'); return; }
  postLogEvent("EMERGENCY POWER DUMP — all weapons +40% for 10s. EPS heat spike!", 'crit');
  G.powerDumpActive   = true;
  G.powerDumpTimer    = 10000;
  G.powerDumpReady    = false;
  G.powerDumpCooldown = 50000;
  G.epsHeat = Math.min(100, G.epsHeat + 55);
  ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = Math.max(0, G.player.shields[s] * 0.70); });
  postLogEvent("Shield power diverted — sectors at 70%.", 'warn');
}

// ── Player cloaking ───────────────────────────────────────────
function toggleCloakingDevice() {
  if (!G.running || G.dead) return;
  const dev = G.systems.cloak_dev;
  if (dev.health < 20 || dev.tripped) { postLogEvent("Cloaking device too damaged.", 'warn'); return; }
  if (G.cloakCooldown > 0) { postLogEvent(`Cloak recharging: ${Math.ceil(G.cloakCooldown / 1000)}s.`, 'warn'); return; }
  if (G.cloakVulnTimer > 0) { postLogEvent("Cloak transition in progress.", 'warn'); return; }

  if (G.cloaked) {
    G.cloaked = false; G.cloakVulnTimer = G.cloakVulnDuration; G.cloakCooldown = 25000;
    showCloakVulnOverlay(true);
    postLogEvent("DECLOAKING — shields offline 1.2s!", 'crit');
    ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = 0; });
    setTimeout(() => {
      if (G.dead) return;
      G.cloakVulnTimer = 0; showCloakVulnOverlay(false); recalculateShieldRegenRate();
      const cloakSecs   = (performance.now() - G.cloakEngagedAt) / 1000;
      const regenEarned = G.shieldRegenRate * cloakSecs;
      const max         = G.player.shields.maxSectorValue;
      ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = Math.min(max, G.frozenShields[s] + regenEarned); });
      postLogEvent(`Decloak complete. Shields restored to ~${Math.round(G.player.shields.fore)}MW.`, 'good');
      updateCloakButton();
    }, G.cloakVulnDuration);
  } else {
    G.frozenShields = { fore:G.player.shields.fore, port:G.player.shields.port, starboard:G.player.shields.starboard, aft:G.player.shields.aft };
    ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = 0; });
    G.cloakVulnTimer = G.cloakVulnDuration;
    showCloakVulnOverlay(true);
    postLogEvent(`CLOAKING — shields frozen at ${Math.round(G.frozenShields.fore)}MW.`, 'crit');
    setTimeout(() => {
      if (G.dead) return;
      G.cloaked = true; G.cloakVulnTimer = 0; G.cloakPowerReserve = 100;
      G.cloakEngagedAt = performance.now();
      G.enemyLockProgress = Math.max(0, G.enemyLockProgress - 50);
      showCloakVulnOverlay(false);
      postLogEvent("CLOAKED. Shields offline. Regen credit accumulating.", 'good');
      updateCloakButton();
    }, G.cloakVulnDuration);
  }
  updateCloakButton();
}

function showCloakVulnOverlay(show) {
  const el = document.getElementById('cloak-vuln-overlay'); if (el) el.style.display = show ? 'block' : 'none';
}

function updateCloakButton() {
  if (G.playerShipKey === 'enterprise_e') { updateSaucerSepButton(); return; }
  const dev = G.systems.cloak_dev;
  ['btn-cloak','btn-cloak-eng'].forEach(id => {
    const btn = document.getElementById(id); if (!btn) return;
    if (dev.health < 20 || dev.tripped) {
      btn.textContent = '⊗ CLOAK DESTROYED'; btn.style.background = '#330011'; btn.style.color = '#ff6666';
    } else if (G.cloakVulnTimer > 0) {
      btn.textContent = '⚡ TRANSITIONING...'; btn.style.background = 'rgba(153,102,204,0.5)'; btn.style.color = '#fff';
    } else if (G.cloaked) {
      btn.textContent = '🔵 CLOAKED — DECLOAK'; btn.className = 'pill-action-btn green-btn'; btn.style.background = ''; btn.style.color = '';
    } else if (G.cloakCooldown > 0) {
      btn.textContent = `⏳ RECHARGE ${Math.ceil(G.cloakCooldown / 1000)}s`; btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc';
    } else {
      btn.textContent = id === 'btn-cloak' ? '◉ ENGAGE CLOAK' : '◉ Cloak';
      btn.style.background = ''; btn.style.color = '';
      if (id === 'btn-cloak') btn.className = 'pill-action-btn warn-btn';
    }
  });
  updateEngUtilityPanel();
}

// ── Enterprise-E: Saucer Separation ──────────────────────────
// Toggle mechanic — saucer stays separated until player orders reconnect.
//
// SEPARATED state:  saucerSepActive=true, saucerSepReconnecting=false
//   • Saucer-section phaser arrays (cannon_pu / cannon_pl) are physically unavailable
//   • Enemy lock rate ×0.4 (saucer acts as false contact / decoy)
//   • Stardrive section is lighter → helm is 15% more agile (extra ×0.85 lock multiplier)
//   • All other weapons, shields, engines, torpedoes still available
//
// RECONNECTING state:  saucerSepReconnecting=true, 6s docking
//   • Saucer arrays still offline (not yet docked)
//   • Decoy effect drops — enemy sees the docking as it happens
//
// COOLDOWN: 60s after full reconnect (structural operation)
function toggleSaucerSeparation() {
  if (!G.running || G.dead) return;
  if (G.playerShipKey !== 'enterprise_e') return;

  if (G.saucerSepReconnecting) {
    postLogEvent("Docking sequence in progress — stand by.", 'warn'); return;
  }
  if (G.saucerSepCooldown > 0) {
    postLogEvent(`Saucer separation offline — reconnect cooldown ${Math.ceil(G.saucerSepCooldown/1000)}s.`, 'warn'); return;
  }

  if (G.saucerSepActive) {
    // ── Order reconnect ──
    if (G.systems.engines.health < 15 || G.systems.engines.tripped) {
      postLogEvent("Engines too damaged for docking approach.", 'crit'); return;
    }
    G.saucerSepReconnecting    = true;
    G.saucerSepReconnectTimer  = 6000;   // 6s docking sequence
    postLogEvent("RECONNECT ORDER — saucer section on docking approach. 6s.", 'good');
    postCrewReport('nog', "Saucer section coming about for docking. Hold steady, Captain.", 'status');
    updateSaucerSepButton();
  } else {
    // ── Initiate separation ──
    if (G.systems.engines.health < 20 || G.systems.engines.tripped) {
      postLogEvent("Engines too damaged for saucer separation.", 'crit'); return;
    }
    G.saucerSepActive = true;
    G.systems.engines.stress = Math.min(100, G.systems.engines.stress + 15);
    postLogEvent("SAUCER SEPARATION — stardrive section independent. Saucer running decoy.", 'good');
    postLogEvent("OFFLINE: Saucer dorsal and ventral arrays (with saucer section). All stardrive weapons nominal.", 'warn');
    postLogEvent("Stardrive agility +15% — lighter hull profile. Enemy lock −60% (dual contact).", 'good');
    postCrewReport('nog', "Separation complete, Captain. Saucer section clear — stardrive maneuvering at full agility.", 'good');
    updateSaucerSepButton();
  }
}

// Which weapon systems belong to the saucer section (offline to player when separated).
const SAUCER_SECTION_SYSTEMS = new Set(['cannon_pu', 'cannon_pl']);

// ── Saucer section autonomous fire ───────────────────────────
// Saucer runs on impulse power only — arrays fire at 40% yield automatically.
// Saucer flies independently so it can engage from any bearing.
// Stardrive weapons get ×1.20 yield + ×1.15 cap recharge (freed EPS budget).
function fireSaucerAutomatic() {
  if (!G.running || G.dead || !G.saucerSepActive) return;
  if (!G.threat || G.threat.hull <= 0) return;
  if (G.enemyCloaked && G.enemyCloakVulnTimer <= 0) return; // saucer can't track cloaked target

  // Pick a saucer phaser array to fire — saucer flies independently so all arcs available
  const aw = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const saucerArrays = ['cannon_port_upper','phaser_saucer_port','cannon_port_lower','phaser_saucer_stbd'];
  // Filter to arrays whose systems are alive
  const available = saucerArrays.filter(k => {
    const w = aw[k]; if (!w) return false;
    const sys = G.systems[w.parentSystem];
    return sys && !sys.tripped && sys.health >= 10;
  });
  if (available.length === 0) return;

  const key    = available[Math.floor(Math.random() * available.length)];
  const weapon = aw[key];
  const sys    = G.systems[weapon.parentSystem];

  // Saucer fires on its own impulse power — independent of stardrive helm speed
  let dmg = weapon.yield * 0.40 * (sys.health / 100) * 0.65;

  // Apply to enemy shields at the bearing the saucer is currently engaging
  // Saucer picks the weakest visible shield sector to maximise pressure
  const sectors = ['fore','port','starboard','aft'];
  const target  = sectors.reduce((a, b) => (G.threat.shields[a] || 0) < (G.threat.shields[b] || 0) ? a : b);
  applyDamageToEnemy(dmg, null, target);

  // Visual: push a dim beam from offset position
  G.renderedBeamsVector.push({ type:'beam', fromSaucer:true, targetSector:target,
    trackingStartTime:performance.now(), duration:400, col:'#4477aa' });

  postLogEvent(`Saucer section — ${weapon.label} [auto] → ${target.toUpperCase()} −${Math.round(dmg)}MW.`, 'info');

  // Occasional crew report
  if (Math.random() < 0.35 && typeof postCrewReport === 'function') {
    postCrewReport('nog', `Saucer section firing, Captain — ${weapon.label.toLowerCase()} on secondary power.`, 'status');
  }

  G.score.totalDmgDealt  += dmg;
  G.score.volleysFired   += 1;
  G.score.weaponsFired.cannons += 1;
}

// Returns true when a weapon's parent system is on the saucer (unavailable while separated).
function _isSaucerWeapon(weapon) {
  return G.saucerSepActive && weapon && SAUCER_SECTION_SYSTEMS.has(weapon.parentSystem);
}

function updateSaucerSepButton() {
  const btn = document.getElementById('btn-cloak'); if (!btn) return;
  if (G.saucerSepReconnecting) {
    btn.textContent = `◯ DOCKING ${Math.ceil(G.saucerSepReconnectTimer/1000)}s`;
    btn.style.background = 'var(--warn)'; btn.style.color = '#000';
  } else if (G.saucerSepActive) {
    btn.textContent = '◯ SEPARATED — ORDER RECONNECT';
    btn.style.background = 'var(--green)'; btn.style.color = '#000';
    btn.className = 'pill-action-btn green-btn';
  } else if (G.saucerSepCooldown > 0) {
    btn.textContent = `◯ SEP CD ${Math.ceil(G.saucerSepCooldown/1000)}s`;
    btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc';
  } else {
    btn.textContent = '◯ SEPARATE SAUCER';
    btn.style.background = ''; btn.style.color = '';
    btn.className = 'pill-action-btn warn-btn';
  }
}

// ── Enterprise-E: Maximum Phaser Output ──────────────────────
// All phaser arrays +60% yield for the next salvo only.
function executeMaxPhaserOutput() {
  if (!G.running || G.dead) return;
  if (!G.overchargeReady) { postLogEvent(`Phaser capacitors resetting — ${Math.ceil(G.overchargeCooldown/1000)}s.`, 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  const aw  = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const cfg2 = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  const phaserKeys = cfg2.primaryWeaponKeys || ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower','emitter_nose'];
  const ready = phaserKeys.filter(k => { if (!aw[k]) return false; const sys = G.systems[aw[k].parentSystem]; return sys && !sys.tripped && sys.health >= 10 && sys.cap >= aw[k].cost && aw[k].arc.includes(G.helmAttackVector); });
  if (ready.length === 0) { postLogEvent("No phaser arrays in arc and charged.", 'warn'); return; }
  postLogEvent("MAXIMUM PHASER OUTPUT — all arrays +60% yield, firing sequence!", 'crit');
  G.overchargeReady    = false;
  G.overchargeCooldown = 30000;
  ready.forEach((k, i) => {
    setTimeout(() => {
      if (G.dead) return;
      G._overchargeActive = true; G._maxPhaserActive = true;
      try { fireSelectedArray(k); } finally { G._overchargeActive = false; G._maxPhaserActive = false; }
      G.epsHeat = Math.min(100, G.epsHeat + 6);
    }, i * 180);
  });
}

// ── Enterprise-E: Tricobalt Warhead ──────────────────────────
// 300 yield, no lock required. Bypasses normal torpedo mechanics.
// One warhead per engagement (G.tricobalReady). Used in First Contact.
function executeTricobalWarhead() {
  if (!G.running || G.dead) return;
  if (!G.tricobalReady) { postLogEvent("Tricobalt warhead — only one per engagement. Already expended.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  const sys = G.systems.torpedoes;
  if (!sys || sys.tripped || sys.health < 10) { postLogEvent("Torpedo launcher offline.", 'warn'); return; }

  G.tricobalReady = false;
  postLogEvent("TRICOBALT WARHEAD AWAY — massive subspace detonation!", 'crit');

  // Tricobalt bypasses shields if enemy cloaked (as in First Contact)
  let dmg = 250 + Math.random() * 100;
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  // Tricobalt is a subspatial weapon — partially bypasses shields (40% direct hull damage)
  const shieldSector = G.threat.shields[G.helmAttackVector] || G.threat.shields.fore;
  const shieldBlock  = shieldSector * 0.60;   // 40% bleed-through to hull
  const shieldDmg    = Math.min(shieldSector, dmg * 0.60);
  const hullDmg      = Math.max(0, dmg - shieldBlock);
  G.threat.shields[G.helmAttackVector] = Math.max(0, (G.threat.shields[G.helmAttackVector] || 0) - shieldDmg);
  applyDamageToEnemy(hullDmg, { parentSystem:'torpedoes', isQuantum:true, isPhoton:false, label:'Tricobalt Warhead' });
  G.score.totalDmgDealt     += dmg;
  G.score.weaponsFired.quantum++;
  G.renderedBeamsVector.push({ type:'torpedo', fromPlayer:true, targetSector:G.helmAttackVector, trackingStartTime:performance.now(), duration:900, col:'#ff6600' });
  postLogEvent(`Tricobalt detonation — ${Math.round(dmg)} total yield. ${Math.round(hullDmg)} hull damage. Shields stripped.`, 'good');
  G.epsHeat = Math.min(100, G.epsHeat + 12);
}

// ── Enterprise-E: Concentrated Phaser Fire ───────────────────
// All in-arc phaser arrays fire in rapid 300ms sequence (phaser burst mode).
function executeConcentratedPhaserFire() {
  if (!G.running || G.dead) return;
  if (!G.burstFireReady) { postLogEvent(`Phaser emitters recharging — ${Math.ceil(G.burstFireCooldown/1000)}s.`, 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  if (G.lockProgress < 15) { postLogEvent("Concentrated fire requires ≥15% lock.", 'warn'); return; }
  const aw  = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const cfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  const phaserKeys = cfg.primaryWeaponKeys || ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower','emitter_nose'];
  const ready = phaserKeys.filter(k => {
    if (!aw[k] || !aw[k].arc.includes(G.helmAttackVector)) return false;
    const s = G.systems[aw[k].parentSystem];
    return !s.tripped && s.health >= 10 && s.cap >= aw[k].cost;
  });
  if (ready.length === 0) { postLogEvent("No phaser arrays in arc and charged.", 'warn'); return; }
  postLogEvent(`CONCENTRATED FIRE — ${ready.length} arrays in ${Math.round(ready.length * 180)}ms sequence!`, 'crit');
  G.burstFireReady    = false;
  G.burstFireCooldown = 9000;
  ready.forEach((k, i) => {
    setTimeout(() => {
      if (!G.dead) {
        fireSelectedArray(k);
        G.renderedBeamsVector.push({ type:'burst_flash', trackingStartTime:performance.now(), duration:200 });
      }
    }, i * 180);
  });
}
