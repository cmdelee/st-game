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

  const cannons = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  const ready   = cannons.filter(k => {
    if (!ARRAYS_DICTIONARY[k].arc.includes(G.helmAttackVector)) return false;
    const s = G.systems[ARRAYS_DICTIONARY[k].parentSystem];
    return !s.tripped && s.health >= 10 && s.cap >= ARRAYS_DICTIONARY[k].cost;
  });
  if (ready.length === 0) { postLogEvent("No pulse cannons in arc and ready for burst.", 'warn'); return; }

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

  const weapon    = ARRAYS_DICTIONARY[weaponKey]; if (!weapon) return;
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

  if (G._overchargeActive)   dmg *= 1.50;
  if (G._unstableTorpActive) dmg *= 1.70;
  if (G.powerDumpActive)     dmg *= 1.40;

  if (G.scanBonus && performance.now() < G.scanBonus.expiry) {
    if (G.scanBonus.type === 'shields' && !weapon.isPhoton && weapon.parentSystem !== 'torpedoes') dmg *= G.scanBonus.value;
    if (G.scanBonus.type === 'hull') dmg *= G.scanBonus.value;
  }

  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
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
        G.enemyRepairQueue.push({ sysKey: target, totalTime: 25000 + Math.random() * 15000, remaining: 25000 });
        if (target === 'cloak_device' && G.enemyCloaked) {
          G.enemyCloaked = false; G.enemyCloakVulnTimer = 0;
          postLogEvent("Enemy cloaking destroyed — forced decloak!", 'crit');
        }
      }
    }
  }
  if (G.threat.hull <= 0) concludeSimulationRun(true, "Enemy vessel destroyed.", false);
}

function firePulseCannons() {
  const inArc = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower']
    .filter(k => ARRAYS_DICTIONARY[k].arc.includes(G.helmAttackVector));
  if (inArc.length === 0) { postLogEvent("No pulse cannons bear on current attack vector.", 'warn'); return; }
  inArc.forEach(k => fireSelectedArray(k));
}
function executeAlphaSalvoFire() {
  ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower',
   'emitter_nose','torpedo_quantum','torpedo_photon','torpedo_quantum_aft','torpedo_photon_aft']
    .filter(k => ARRAYS_DICTIONARY[k].arc.includes(G.helmAttackVector))
    .forEach(k => fireSelectedArray(k));
}

// ── Overload modes ────────────────────────────────────────────
function executeCannonOvercharge() {
  if (!G.running || G.dead) return;
  if (!G.overchargeReady) { postLogEvent(`Overcharge capacitors resetting — ${Math.ceil(G.overchargeCooldown/1000)}s.`, 'warn'); return; }
  if (G.cloaked || G.cloakVulnTimer > 0) { postLogEvent("Cannot fire while cloaking.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  const cannonKeys = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  const ready = cannonKeys.filter(k => { const sys = G.systems[ARRAYS_DICTIONARY[k].parentSystem]; return sys && !sys.tripped && sys.health >= 10 && sys.cap >= ARRAYS_DICTIONARY[k].cost; });
  if (ready.length === 0) { postLogEvent("No cannon capacitors charged for overcharge.", 'warn'); return; }
  postLogEvent("CANNON OVERCHARGE — +50% yield, high breaker risk!", 'crit');
  G.overchargeReady   = false;
  G.overchargeCooldown = 30000;
  ready.forEach((k, i) => {
    setTimeout(() => {
      if (G.dead) return;
      const weapon = ARRAYS_DICTIONARY[k]; const sys = G.systems[weapon.parentSystem];
      if (!sys || sys.tripped || sys.cap < weapon.cost) return;
      G._overchargeActive = true; fireSelectedArray(k); G._overchargeActive = false;
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
  postLogEvent("UNSTABLE TORPEDO — +70% yield, misfire risk!", 'crit');
  G.unstableTorpReady    = false;
  G.unstableTorpCooldown = 35000;
  G._unstableTorpActive  = true; fireSelectedArray('torpedo_quantum'); G._unstableTorpActive = false;
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
