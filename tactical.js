'use strict';

// ============================================================
// EVASIVE MANOEUVRES — Pattern Delta (DS9 canon)
// Reduces enemy lock build rate by 60% for 8s; burns impulse power
// ============================================================
function executeEvasivePattern() {
  if (!G.running || G.dead) return;
  if (G.evasiveActive) { postLogEvent("Evasive pattern already active.", 'info'); return; }
  if (G.evasiveCooldown > 0) { postLogEvent(`Evasive pattern cooldown: ${Math.ceil(G.evasiveCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.engines.health < 20 || G.systems.engines.tripped) { postLogEvent("Impulse engines too damaged for evasive action.", 'crit'); return; }
  // Burns impulse power — stresses engines
  G.systems.engines.stress = Math.min(100, G.systems.engines.stress + 25);
  G.evasiveActive   = true;
  G.evasiveCooldown = G.evasiveDuration; // used as countdown while active
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

// ============================================================
// BURST-FIRE PULSE CANNON SALVO — Defiant's defining tactic
// All four cannons fire in a tight 800ms window overwhelming
// enemy shield regen before it can respond (DS9 canon behaviour)
// ============================================================
function executeBurstFireSalvo() {
  if (!G.running || G.dead) return;
  if (!G.burstFireReady) { postLogEvent(`Burst capacitors recharging — ${Math.ceil(G.burstFireCooldown/1000)}s.`, 'warn'); return; }
  if (G.cloaked || G.cloakVulnTimer > 0) { postLogEvent("Cannot fire while cloaking.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }
  if (G.lockProgress < 20) { postLogEvent("Burst fire requires ≥20% lock.", 'warn'); return; }

  const cannons = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  const ready   = cannons.filter(k => {
    const s = G.systems[ARRAYS_DICTIONARY[k].parentSystem];
    return !s.tripped && s.health >= 10 && s.cap >= ARRAYS_DICTIONARY[k].cost;
  });
  if (ready.length === 0) { postLogEvent("No pulse cannons available for burst.", 'warn'); return; }

  postLogEvent(`BURST SALVO — ${ready.length} cannons in 800ms window!`, 'crit');
  G.burstFireReady   = false;
  G.burstFireCooldown = 12000;

  // Fire each cannon with a staggered delay — distinct burst beam colour pushed to renderedBeamsVector
  ready.forEach((k, i) => {
    setTimeout(() => {
      if (!G.dead) {
        fireSelectedArray(k);
        // Item 10: mark this as a burst shot for visual distinction in canvas
        G.renderedBeamsVector.push({ type:'burst_flash', trackingStartTime: performance.now(), duration: 200 });
      }
    }, i * 200);
  });
}

// ============================================================
// SHIELD FREQUENCY ROTATION
// Rotates shield harmonics to counter the enemy's primary weapon
// type — 25% damage reduction for 12s, 30s cooldown (DS9 canon)
// ============================================================
function rotateShieldFrequency() {
  if (!G.running || G.dead) return;
  if (G.cloaked) { postLogEvent("Shields offline while cloaked.", 'warn'); return; }
  if (G.shieldFreqCooldown > 0) { postLogEvent(`Frequency modulator recharging — ${Math.ceil(G.shieldFreqCooldown/1000)}s.`, 'warn'); return; }

  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  // Detect dominant incoming weapon type from enemy config
  const wpns = Object.values(cfg.systems).filter(s => s.isWeapon);
  let weaponType = 'phasers';
  if (wpns.some(s => s.systemTargetKey === 'disruptors')) weaponType = 'disruptors';
  else if (wpns.some(s => s.isPolaron))                   weaponType = 'polaron';
  else if (wpns.some(s => s.isTorpedo && s.label.includes('Plasma'))) weaponType = 'plasma';

  G.shieldFreqActive      = true;
  G.shieldFreqTimer       = 12000;
  G.shieldFreqCooldown    = 30000;
  G.shieldFreqWeaponType  = weaponType;

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

// ============================================================
// TACTICAL ADVISORY — Worf-style combat readouts
// ============================================================
function postTacticalAdvisory(msg) {
  postLogEvent(`WORF: ${msg}`, 'info');
}

// ============================================================
// CREW CASUALTIES & ROLE EFFECTS
// ============================================================
function inflictCrewCasualty() {
  const stations = Object.keys(CREW_STATIONS);
  const station  = stations[Math.floor(Math.random() * stations.length)];
  const crew     = CREW_STATIONS[station];
  if (crew.status === 'nominal')       { crew.status = 'wounded';       crew.casualties++; postLogEvent(`CASUALTY: ${crew.name} (${crew.role}) wounded.`, 'crit'); }
  else if (crew.status === 'wounded')  { crew.status = 'incapacitated'; crew.casualties++; postLogEvent(`CREW LOSS: ${crew.name} incapacitated.`, 'crit'); }
  updateCrewStatusDisplay();
  // Item 10: role-specific consequences on incapacitation
  if (crew.status === 'incapacitated') {
    if (station === 'medical')    postLogEvent("Dr. Bashir incapacitated — crew casualty rate will increase.", 'crit');
    if (station === 'helm')       postLogEvent("Ensign Nog incapacitated — evasive pattern effectiveness reduced.", 'crit');
    if (station === 'tactical')   postLogEvent("Lt. Cmdr Worf incapacitated — targeting accuracy severely degraded.", 'crit');
    if (station === 'engineering') postLogEvent("Chief O'Brien incapacitated — repair speed critically reduced.", 'crit');
  }
}

function getCrewEfficiency(station) {
  const c = CREW_STATIONS[station]; if (!c) return 1.0;
  return c.status === 'nominal' ? 1.0 : c.status === 'wounded' ? 0.65 : 0.30;
}

// Item 10: medical crew affects how quickly further casualties occur
// When Dr. Bashir is down, breach damage casualty threshold is halved
function getMedicalEfficiency() {
  const med = CREW_STATIONS.medical;
  return med.status === 'nominal' ? 1.0 : med.status === 'wounded' ? 0.7 : 0.4;
}

// Item 10: helm crew affects evasive pattern effectiveness
function getHelmEvasiveModifier() {
  const helm = CREW_STATIONS.helm;
  if (helm.status === 'nominal')      return 0.40; // full 60% lock reduction
  if (helm.status === 'wounded')      return 0.60; // reduced to 40% lock reduction
  return 0.80;                                      // incapacitated — only 20% reduction
}

function updateCrewStatusDisplay() {
  const div = document.getElementById('crew-casualties-display'); if (!div) return;
  div.innerHTML = Object.values(CREW_STATIONS).map(c => {
    const col  = c.status === 'nominal' ? C.green : c.status === 'wounded' ? C.warn : C.red;
    const icon = c.status === 'nominal' ? '●' : c.status === 'wounded' ? '⚠' : '✕';
    return `<div class="casualty-line"><div class="casualty-dot" style="background:${col};"></div><span style="color:${col};font-size:9px;">${icon} ${c.name} — ${c.role}</span></div>`;
  }).join('');
}

// ============================================================
// EMERGENCY WARP
// ============================================================
function attemptEmergencyWarp() {
  if (!G.running || G.dead) return;
  const wc = G.systems.warp_core;
  if (wc.health < 25 || wc.tripped) { postLogEvent("WARP IMPOSSIBLE: Warp core offline or critically damaged.", 'crit'); return; }
  if (G.player.hull / G.player.maxHull > 0.35) { postLogEvent("Emergency warp denied: hull above 35%.", 'warn'); return; }
  if (G.cloaked) { G.cloaked = false; G.cloakCooldown = 0; }
  const cost = Math.floor(G.player.torpedoes / 2);
  G.player.torpedoes -= cost;
  G.score.warpedOut = true;
  postLogEvent(`EMERGENCY WARP — ${cost} torpedoes as field initiators. Disengaging.`, 'good');
  concludeSimulationRun(false, "USS Defiant escaped via emergency warp. Enemy vessel still active.", true);
}

function updateWarpAvailability() {
  const lbl = document.getElementById('lbl-warp-avail'); if (!lbl) return;
  const wc  = G.systems.warp_core;
  const hp  = G.player.hull / G.player.maxHull;
  if (wc.health < 25 || wc.tripped) { lbl.textContent = '⊗ WARP OFFLINE'; lbl.style.color = 'var(--red)'; }
  else if (hp > 0.35)               { lbl.textContent = 'WARP STANDBY';  lbl.style.color = 'var(--warn)'; }
  else                              { lbl.textContent = '⚡ WARP READY';  lbl.style.color = 'var(--green)'; }
}

// ============================================================
// PLAYER WEAPONS FIRE
// ============================================================
function fireSelectedArray(weaponKey) {
  if (!G.running || G.dead) return;
  if (G.cloaked) { postLogEvent("Cannot fire while cloaked.", 'warn'); return; }
  if (G.cloakVulnTimer > 0) { postLogEvent("Cannot fire during cloak transition.", 'warn'); return; }
  if (G.enemyTractorActive) { postLogEvent("TRACTOR BEAM — weapons offline!", 'crit'); return; }

  const weapon    = ARRAYS_DICTIONARY[weaponKey]; if (!weapon) return;
  const parentSys = G.systems[weapon.parentSystem];
  if (!parentSys || parentSys.health < 10 || parentSys.tripped) { postLogEvent(`${weapon.label} offline.`, 'warn'); return; }
  if (parentSys.cap < weapon.cost) { postLogEvent(`${weapon.label} capacitor low (${Math.round(parentSys.cap)}%).`, 'warn'); return; }

  // Block ALL energy weapons when enemy is fully cloaked
  if (G.enemyCloaked && G.enemyCloakVulnTimer <= 0) {
    if (weaponKey === 'torpedo_fore') {
      if (G.player.torpedoes <= 0) { postLogEvent("Torpedo magazine empty.", 'warn'); return; }
      G.player.torpedoes--;
      parentSys.cap -= weapon.cost;
      G.inFlightTorpedoes.push({ dmg: weapon.yield * 0.4, timeToImpact: 3500, fromEnemy: false });
      postLogEvent("Quantum torpedo blind-fired at last known position — low accuracy.", 'warn');
    } else {
      postLogEvent("Enemy cloaked — energy weapons cannot track target.", 'warn');
    }
    return;
  }

  // Require lock before firing (cloak vuln window is free-fire opportunity)
  if (G.lockProgress < 5 && G.enemyCloakVulnTimer <= 0) { postLogEvent("No targeting lock — acquire lock before firing.", 'warn'); return; }

  if (weaponKey === 'torpedo_fore') {
    if (G.player.torpedoes <= 0) { postLogEvent("Torpedo magazine empty.", 'warn'); return; }
    G.player.torpedoes--;
  }

  parentSys.cap -= weapon.cost;

  const sensorPow    = G.systems.sensors.allocatedPower;
  const sensorHealth = G.systems.sensors.health;
  const sensorMod    = sensorHealth < 70 ? 0.35 + (sensorHealth / 70) * 0.35 : Math.min(1.2, 0.8 + (sensorPow / 20) * 0.4);
  const crewMod      = getCrewEfficiency('tactical');
  const lockMod      = (0.5 + (G.lockProgress / 100) * 0.5) * sensorMod * crewMod;

  let dmg;
  // QUANTUM TORPEDO: binary high-damage — either hits hard or glances.
  // They don't degrade gracefully like phasers; minimum damage floor is high.
  if (weaponKey === 'torpedo_fore') {
    const baseYield = weapon.yield;
    if (G.lockProgress >= 60) {
      // Clean hit — full yield with minimal spread
      dmg = baseYield * (0.85 + Math.random() * 0.30) * (parentSys.health / 100) * crewMod;
      postLogEvent("Quantum torpedo — clean intercept solution.", 'good');
    } else {
      // Glancing hit — still does meaningful damage (quantum torps don't just fizzle)
      dmg = baseYield * (0.45 + Math.random() * 0.20) * (parentSys.health / 100) * crewMod;
      postLogEvent("Quantum torpedo — partial lock, glancing impact.", 'warn');
    }
  } else {
    dmg = weapon.yield * (parentSys.health / 100) * lockMod;
  }

  // Scan bonuses
  if (G.scanBonus && performance.now() < G.scanBonus.expiry) {
    if (G.scanBonus.type === 'shields' && weapon && weapon.parentSystem !== 'torpedoes') dmg *= G.scanBonus.value;
    if (G.scanBonus.type === 'hull') dmg *= G.scanBonus.value;
  }

  // Borg per-weapon adaptation — each weapon becomes progressively less effective
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  if (cfg.adaptiveShields) {
    const adaptKey = weapon.parentSystem;
    const resist   = G.enemyAdaptiveResist[adaptKey] || 0;
    dmg *= (1 - resist);
    // Increase resistance for this weapon type after each hit
    G.enemyAdaptiveResist[adaptKey] = Math.min(0.75, resist + 0.06);
    if (resist > 0.1 && resist < 0.75) {
      postLogEvent(`Borg adapting to ${weapon.label} — ${Math.round(resist * 100)}% resistance.`, 'warn');
    }
    if (resist >= 0.75) postLogEvent(`Borg fully adapted to ${weapon.label} — switch weapons!`, 'crit');
  }

  G.score.volleysFired++;
  G.score.totalDmgDealt += dmg;

  // Cloak vuln window — enemy briefly has no shields
  const bonusMult = G.enemyCloakVulnTimer > 0 ? 1.4 : 1.0;
  applyDamageToEnemy(dmg * bonusMult, weapon);
  if (weapon) {
    parentSys.stress = Math.min(100, parentSys.stress + weapon.cost * 0.18);
    G.renderedBeamsVector.push({ type: weapon.parentSystem, trackingStartTime: performance.now(), duration: 300 });
    // Item 4: EPS thermal buildup from weapons fire
    if (parentSys.isWeapon) {
      G.epsHeat = Math.min(100, G.epsHeat + weapon.cost * 0.12);
    }
    // Item 9: track last fire time for hull regen advisory
    G.lastPlayerFireTime = performance.now();
  }
}

// ============================================================
// APPLY DAMAGE TO ENEMY
// ============================================================
function applyDamageToEnemy(dmg, weapon, targetSectorOverride) {
  const cfg    = ENEMY_CONFIGS[G.enemyArchetype];
  const target = G.targetedSubsystemType;
  const sH     = G.systems.sensors.health;
  const sNote  = sH < 70 ? ` [SEN:${Math.round(sH)}%]` : '';

  if (target === 'hull') {
    let sectorPool;
    if (G.enemyManeuverState === 'angling' || G.enemyManeuverState === 'torpedocharge') {
      const pref  = G.enemyPreferredSector;
      const adj   = { fore:['fore','port','starboard'], aft:['aft','port','starboard'], port:['port','fore','aft'], starboard:['starboard','fore','aft'] };
      sectorPool  = adj[pref] || ['fore','port','starboard','aft'];
    } else {
      sectorPool = ['fore','fore','port','starboard','aft'];
    }
    const hitSector = targetSectorOverride || sectorPool[Math.floor(Math.random() * sectorPool.length)];

    let shieldDmg = dmg;
    let hullPassDmg = 0;
    if (cfg.polaronWeapons) { shieldDmg = dmg * 0.7; hullPassDmg = dmg * 0.3; }

    if (G.threat.shields[hitSector] > 0) {
      const abs  = Math.min(G.threat.shields[hitSector], shieldDmg);
      G.threat.shields[hitSector] = Math.max(0, G.threat.shields[hitSector] - abs);
      const leak = (shieldDmg - abs) + hullPassDmg;
      if (leak > 0) G.threat.hull = Math.max(0, G.threat.hull - leak);
      postLogEvent(`${hitSector.toUpperCase()} shield −${Math.round(abs)}. Enemy hull:${Math.ceil(G.threat.hull)}.${sNote}`, 'good');
    } else {
      G.threat.hull = Math.max(0, G.threat.hull - dmg);
      postLogEvent(`Direct hull hit (${hitSector.toUpperCase()}) −${Math.round(dmg)}. Enemy hull:${Math.ceil(G.threat.hull)}.${sNote}`, 'good');
    }
    // Legacy adaptiveHits counter kept for regen scaling in engineering.js
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

function firePulseCannons()      { ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'].forEach(k => fireSelectedArray(k)); }
function executeAlphaSalvoFire() { Object.keys(ARRAYS_DICTIONARY).forEach(k => fireSelectedArray(k)); }

// ============================================================
// PLAYER CLOAKING
// ============================================================
function toggleCloakingDevice() {
  if (!G.running || G.dead) return;
  const dev = G.systems.cloak_dev;
  if (dev.health < 20 || dev.tripped) { postLogEvent("Cloaking device too damaged.", 'warn'); return; }
  if (G.cloakCooldown > 0) { postLogEvent(`Cloak recharging: ${Math.ceil(G.cloakCooldown / 1000)}s.`, 'warn'); return; }
  if (G.cloakVulnTimer > 0) { postLogEvent("Cloak transition in progress.", 'warn'); return; }

  if (G.cloaked) {
    G.cloaked = false;
    G.cloakVulnTimer = G.cloakVulnDuration;
    G.cloakCooldown  = 25000;
    showCloakVulnOverlay(true);
    postLogEvent("DECLOAKING — shields offline 1.2s!", 'crit');
    ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = 0; });
    setTimeout(() => {
      if (G.dead) return;
      G.cloakVulnTimer = 0;
      showCloakVulnOverlay(false);
      recalculateShieldRegenRate();
      const cloakSecs   = (performance.now() - G.cloakEngagedAt) / 1000;
      const regenEarned = G.shieldRegenRate * cloakSecs;
      const max         = G.player.shields.maxSectorValue;
      ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = Math.min(max, G.frozenShields[s] + regenEarned); });
      postLogEvent(`Decloak complete. Shields restored to ~${Math.round(G.player.shields.fore)}MW.`, 'good');
      updateCloakButton();
    }, G.cloakVulnDuration);

  } else {
    G.frozenShields  = { fore:G.player.shields.fore, port:G.player.shields.port, starboard:G.player.shields.starboard, aft:G.player.shields.aft };
    ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = 0; });
    G.cloakVulnTimer = G.cloakVulnDuration;
    showCloakVulnOverlay(true);
    postLogEvent(`CLOAKING — shields frozen at ${Math.round(G.frozenShields.fore)}MW.`, 'crit');
    setTimeout(() => {
      if (G.dead) return;
      G.cloaked            = true;
      G.cloakVulnTimer     = 0;
      G.cloakPowerReserve  = 100;
      G.cloakEngagedAt     = performance.now();
      G.enemyLockProgress  = Math.max(0, G.enemyLockProgress - 50);
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

// ============================================================
// SCAN PROFILES
// ============================================================
function activateScanProfile(type) {
  G.activeScanProfile = type;
  G.scanAnalysisProgress = 0;
  document.querySelectorAll('.scan-profile-btn').forEach(b => b.classList.remove('active-scan'));
  const btn = document.getElementById(`scan-btn-${type}`); if (btn) btn.classList.add('active-scan');
  postLogEvent(`Sensor sweep: [${type.toUpperCase()}] profile selected.`, 'info');
}

function commitScanProfile() {
  if (!G.activeScanProfile || G.scanAnalysisProgress < 100) { postLogEvent("Analysis incomplete — hold profile longer.", 'warn'); return; }
  const bonuses = {
    shields: { type:'shields', value:1.25, duration:25000, msg:"+25% weapon yield vs shields for 25s." },
    hull:    { type:'hull',    value:1.35, duration:20000, msg:"+35% all damage for 20s." },
    weapons: { type:'weapons', value:1.0,  duration:30000, msg:"Enemy weapons disrupted for 30s." },
    tetryon: { type:'tetryon', value:0.3,  duration:15000, msg:"Tetryon pulse — false warp signature. Enemy lock rate −70% for 15s." },
  };
  const b = bonuses[G.activeScanProfile];
  G.scanBonus = { type:b.type, value:b.value, expiry:performance.now() + b.duration };
  if (b.type === 'weapons') {
    G.weaponsDisrupted = true;
    G.weaponsDisruptedTimer = b.duration;
    // NOTE: do NOT modify G.threat.fireInterval here — the main loop already applies
    // a 2× fi multiplier when G.weaponsDisrupted is true.
  }
  postLogEvent(b.msg, 'good');
  G.activeScanProfile = null;
  G.scanAnalysisProgress = 0;
  document.querySelectorAll('.scan-profile-btn').forEach(b => b.classList.remove('active-scan'));
  const bl = document.getElementById('lbl-scan-bonus');
  if (bl) { bl.textContent = `ACTIVE: ${b.type.toUpperCase()}`; bl.style.cssText = 'background:rgba(0,204,102,0.15);color:var(--green);border:1px solid var(--green);font-size:9px'; }
}

function toggleActiveSensorSystems() {
  G.activeScanningProfile = !G.activeScanningProfile;
  ['btn-active-scanner-toggle','btn-active-scanner-toggle-tac'].forEach(id => {
    const btn = document.getElementById(id); if (!btn) return;
    btn.textContent = G.activeScanningProfile ? "ACTIVE SWEEP ON" : "Passive Scan";
    if (G.activeScanningProfile) btn.classList.add('red-btn'); else btn.classList.remove('red-btn');
  });
  if (G.activeScanningProfile) {
    G.threat.fireInterval = Math.round(G.threat.fireInterval * 0.85);
    postLogEvent("Active scanning on — enemy also benefits from better targeting.", 'warn');
  } else {
    G.threat.fireInterval = Math.round(ENEMY_CONFIGS[G.enemyArchetype].fireInterval * DIFFICULTY[currentDifficulty].enemyFireMult);
    postLogEvent("Passive tracking restored.", 'info');
  }
}

// ============================================================
// ENEMY SUBSYSTEM TARGET GRID
// ============================================================
function buildEnemySubsystemTargetGrid() {
  const grid = document.getElementById('enemy-subsystem-target-grid'); if (!grid) return;
  grid.innerHTML = '';
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  const targets = [
    { key:'hull',    label:'Hull',    arc:'All' },
    { key:'shields', label:'Shields', arc:'All' },
    ...Object.keys(cfg.systems).map(k => ({
      key: k,
      label: cfg.systems[k].label.split(' ').slice(-1)[0],
      arc: cfg.systems[k].firingArc.length ? cfg.systems[k].firingArc.join('/') : 'passive'
    }))
  ];
  targets.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'pill-action-btn warn-btn';
    btn.style.cssText = 'font-size:9px;padding:3px 4px;border-radius:6px;';
    btn.id = `enemy-tgt-btn-${t.key}`;
    btn.textContent = t.label;
    btn.onclick = () => setEnemyTarget(t.key, t.label, t.arc);
    grid.appendChild(btn);
  });
  setEnemyTarget('hull', 'Hull', 'All');
}

function setEnemyTarget(key, label, arc) {
  G.targetedSubsystemType = key;
  G.lockProgress = Math.max(0, G.lockProgress - 30);
  document.querySelectorAll('[id^="enemy-tgt-btn-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`enemy-tgt-btn-${key}`); if (btn) btn.classList.add('active');
  const t = document.getElementById('txt-current-target'); if (t) t.textContent = label.toUpperCase();
  const a = document.getElementById('txt-firing-arc');     if (a) a.textContent = `Arc: ${arc}`;
  postLogEvent(`Target: [${label.toUpperCase()}]. Lock partially reset.`, 'info');
}

// ============================================================
// ENEMY CLOAKING
// ============================================================
function processEnemyCloakDecision(dt) {
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  if (!cfg.hasCloakDevice) return;
  const cloakSys = G.enemySystems.cloak_device;
  if (!cloakSys || cloakSys.health <= 0) return;
  if (G.enemyCloakCooldown > 0) { G.enemyCloakCooldown = Math.max(0, G.enemyCloakCooldown - dt); return; }
  if (G.enemyCloakVulnTimer > 0) { G.enemyCloakVulnTimer = Math.max(0, G.enemyCloakVulnTimer - dt); return; }

  if (G.enemyCloaked) {
    G.enemyCloakPower = Math.max(0, G.enemyCloakPower - G.cloakPowerDrainRate * (dt / 1000));
    ['fore','port','starboard','aft'].forEach(s => { G.threat.shields[s] = 0; });
    if (G.enemyCloakPower <= 0) { triggerEnemyDecloak(cfg, 'power exhausted'); return; }
    const repDone = G.enemyRepairQueue.length === 0;
    const hullOk  = G.threat.hull / G.threat.maxHull > 0.52;
    if (repDone && hullOk && G.enemyCloakPower < 30) triggerEnemyDecloak(cfg, 'repairs complete');
    else if (repDone && hullOk && Math.random() < 0.0015 * (dt / 1000) * 60) triggerEnemyDecloak(cfg, 'ready to engage');
    return;
  }

  const hullPct  = G.threat.hull / G.threat.maxHull;
  const critDown = Object.keys(G.enemySystems).some(k => G.enemySystems[k].health <= 0 && k !== 'cloak_device');
  // Romulans cloak far more tactically than Klingons — 2.5× higher base chance
  const cloakAggressiveness = cfg.faction === 'Romulan' ? 2.5 : 1.0;
  if ((hullPct < 0.40 || (critDown && hullPct < 0.65)) && Math.random() < 0.004 * cloakAggressiveness * (dt / 1000) * 60) {
    triggerEnemyCloak(cfg);
  }
}

function triggerEnemyCloak(cfg) {
  G.enemyFrozenShields = { fore:G.threat.shields.fore, port:G.threat.shields.port, starboard:G.threat.shields.starboard, aft:G.threat.shields.aft };
  ['fore','port','starboard','aft'].forEach(s => { G.threat.shields[s] = 0; });
  G.enemyCloakVulnTimer = 1500;
  postLogEvent(`WARNING: ${cfg.label} cloaking — fire now during transition!`, 'warn');
  setTimeout(() => {
    if (G.dead) return;
    G.enemyCloaked = true; G.enemyCloakVulnTimer = 0; G.enemyCloakPower = 100;
    G.enemyCloakEngagedAt = performance.now();
    postLogEvent(`${cfg.label} CLOAKED — repairing under cloak.`, 'crit');
  }, 1500);
}

function triggerEnemyDecloak(cfg, reason) {
  G.enemyCloaked = false; G.enemyCloakPower = 0; G.enemyCloakVulnTimer = 1500; G.enemyCloakCooldown = 25000;
  ['fore','port','starboard','aft'].forEach(s => { G.threat.shields[s] = 0; });
  postLogEvent(`${cfg.label} DECLOAKING (${reason}) — shields offline 1.5s! Fire now!`, 'crit');
  setTimeout(() => {
    if (G.dead) return;
    G.enemyCloakVulnTimer = 0;
    const eSS       = G.enemySystems.shields_sys;
    const eRegen    = (eSS ? eSS.health / 100 : 1) * 1.2;
    const cloakSecs = (performance.now() - G.enemyCloakEngagedAt) / 1000;
    const regenEarned = eRegen * cloakSecs;
    const frozen    = G.enemyFrozenShields || { fore:0, port:0, starboard:0, aft:0 };
    const cfg2      = ENEMY_CONFIGS[G.enemyArchetype];
    ['fore','port','starboard','aft'].forEach(s => { G.threat.shields[s] = Math.min(cfg2.shields[s], frozen[s] + regenEarned); });
    postLogEvent(`${cfg.label} decloaked — shields partially restored.`, 'warn');
  }, 1500);
}

// ============================================================
// SENSOR GHOSTS
// ============================================================
function processEnemySensorGhosts(dt) {
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  if (!cfg.hasSensorGhosts || !G.enemyCloaked) return;
  const sH = G.enemySystems.sensors ? G.enemySystems.sensors.health : 100;
  if (!G.sensorGhostActive && Math.random() < 0.0008 * (sH / 100) * (dt / 1000) * 60) {
    G.sensorGhostActive = true; G.sensorGhostTimer = 3000 + Math.random() * 4000;
    const el = document.getElementById('sensor-ghost-overlay'); if (el) el.style.display = 'block';
    postLogEvent("SENSOR CONTACT — Romulan ghost signature!", 'warn');
  }
  if (G.sensorGhostActive) {
    G.sensorGhostTimer -= dt;
    if (G.sensorGhostTimer <= 0) {
      G.sensorGhostActive = false;
      const el = document.getElementById('sensor-ghost-overlay'); if (el) el.style.display = 'none';
    }
  }
}

// ============================================================
// SHIELD FREQUENCY & BURST FIRE TIMERS (called from main loop)
// ============================================================
function processNewMechanicsTimers(dt) {
  const sc = dt / 1000;

  // Evasive manoeuvre countdown
  if (G.evasiveActive) {
    G.evasiveCooldown = Math.max(0, G.evasiveCooldown - dt);
    if (G.evasiveCooldown <= 0) {
      G.evasiveActive   = false;
      G.evasiveCooldown = G.evasiveCooldownTime; // now enters actual cooldown
      postLogEvent("Evasive pattern complete — resuming attack vector.", 'info');
      updateEvasiveButton();
    } else {
      updateEvasiveButton();
    }
  } else if (G.evasiveCooldown > 0) {
    G.evasiveCooldown = Math.max(0, G.evasiveCooldown - dt);
    if (G.evasiveCooldown <= 0) {
      postLogEvent("Evasive pattern recharged.", 'good');
      updateEvasiveButton();
    } else {
      updateEvasiveButton();
    }
  }

  // Burst-fire cooldown
  if (!G.burstFireReady) {
    G.burstFireCooldown = Math.max(0, G.burstFireCooldown - dt);
    if (G.burstFireCooldown <= 0) {
      G.burstFireReady = true;
      postLogEvent("Burst capacitors recharged — salvo ready.", 'good');
    }
  }

  // Shield frequency rotation
  if (G.shieldFreqActive) {
    G.shieldFreqTimer = Math.max(0, G.shieldFreqTimer - dt);
    if (G.shieldFreqTimer <= 0) {
      G.shieldFreqActive = false;
      postLogEvent("Shield frequency rotation lapsed — modulator recharging.", 'info');
    }
    updateShieldFreqButton();
  }
  if (G.shieldFreqCooldown > 0) {
    G.shieldFreqCooldown = Math.max(0, G.shieldFreqCooldown - dt);
    if (G.shieldFreqCooldown <= 0) updateShieldFreqButton();
  }

  // Klingon range bracket — they close over time, increasing disruptor damage
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  if (cfg.prefersCloseRange && !G.enemyCloaked) {
    G.enemyRangeTimer += dt;
    const prevBracket = G.enemyRangeBracket;
    if (G.enemyRangeTimer > 45000)      G.enemyRangeBracket = 'close';
    else if (G.enemyRangeTimer > 20000) G.enemyRangeBracket = 'medium';
    else                                 G.enemyRangeBracket = 'long';
    if (G.enemyRangeBracket !== prevBracket) {
      const msgs = {
        medium: `${cfg.label} closing range — disruptors becoming more effective.`,
        close:  `${cfg.label} at CLOSE RANGE — disruptors at full power! Evasive action recommended.`,
      };
      if (msgs[G.enemyRangeBracket]) postTacticalAdvisory(msgs[G.enemyRangeBracket]);
    }
  }

  // Plasma torpedo reload (Romulan)
  if (cfg.plasmaReloadTime && !G.plasmaTorpedoReady) {
    G.plasmaTorpedoReloadTimer = Math.max(0, G.plasmaTorpedoReloadTimer - dt);
    if (G.plasmaTorpedoReloadTimer <= 0) {
      G.plasmaTorpedoReady = true;
      postLogEvent(`${cfg.label} — plasma banks recharged.`, 'warn');
    }
  }

  // Jem'Hadar ramming run countdown
  if (G.enemyRammingRun) {
    G.enemyRammingTimer = Math.max(0, G.enemyRammingTimer - dt);
    if (G.enemyRammingTimer <= 0) {
      G.enemyRammingRun = false;
      executeRammingImpact();
    }
  }
}

// ============================================================
// JEM'HADAR RAMMING ATTACK
// ============================================================
function initiateRammingRun(cfg) {
  if (G.enemyRammingRun) return; // already committed
  G.enemyRammingRun   = true;
  G.enemyRammingTimer = 4000; // 4s countdown to impact
  postLogEvent(`ALERT: ${cfg.label} HAS TURNED TO RAM! EVASIVE ACTION!`, 'crit');
  postTacticalAdvisory("Jem'Hadar on suicide run — all power to fore shields now!");
}

function executeRammingImpact() {
  if (G.dead) return;
  const cfg      = ENEMY_CONFIGS[G.enemyArchetype];
  const ramDmg   = cfg.ramDamage || 300;
  const residual = applyAblativeArmour(ramDmg);
  G.player.hull  = Math.max(0, G.player.hull - residual);
  // Jem'Hadar vessel is also destroyed in the collision
  G.threat.hull  = 0;
  postLogEvent(`COLLISION! ${cfg.label} rammed USS Defiant. Ablative absorbed ${Math.round(ramDmg - residual)}. Hull −${Math.round(residual)}.`, 'crit');
  inflictCrewCasualty(); inflictCrewCasualty(); // collision hurts the crew badly
  if (G.player.hull <= 0) {
    concludeSimulationRun(false, "Vessel destroyed in Jem'Hadar ramming attack.", false);
  } else {
    concludeSimulationRun(true, `${cfg.label} destroyed — ramming attack repelled by ablative armour.`, false);
  }
}

// ============================================================
// ENEMY AI — MANEUVER, LOCK & FACTION BEHAVIOURS
// ============================================================
function processEnemyAI(dt) {
  if (!G.running || G.dead) return;
  const sc   = dt / 1000;
  const cfg  = ENEMY_CONFIGS[G.enemyArchetype];
  const diff = DIFFICULTY[currentDifficulty];

  processEnemyCloakDecision(dt);
  if (cfg.hasSensorGhosts) processEnemySensorGhosts(dt);
  processNewMechanicsTimers(dt);

  if (G.enemyCloaked) {
    // Item 5: lock should collapse hard on full cloak, not trickle away
    // Drop immediately to 15% of current value on first cloaked frame, then slow decay
    if (G.lockProgress > 15) G.lockProgress = Math.max(0, G.lockProgress * 0.15);
    G.lockProgress = Math.max(0, G.lockProgress - 4 * sc);
    const sl = document.getElementById('lbl-enemy-state-left');
    if (sl) {
      const pw   = Math.round(G.enemyCloakPower);
      const reps = G.enemyRepairQueue.length;
      sl.textContent = reps > 0 ? `◉ CLOAKED — REPAIRING(${reps}) PWR:${pw}%` : `◉ CLOAKED — PWR:${pw}%`;
      sl.style.color = 'var(--p)';
    }
    const ll = document.getElementById('txt-enemy-lock-left'); if (ll) ll.textContent = `${Math.round(G.enemyLockProgress)}%`;
    const bl = document.getElementById('bar-enemy-lock-left'); if (bl) bl.style.width = `${G.enemyLockProgress}%`;
    return;
  }

  // Weapons disruption countdown
  if (G.weaponsDisrupted) {
    G.weaponsDisruptedTimer -= dt;
    if (G.weaponsDisruptedTimer <= 0) {
      G.weaponsDisrupted = false;
      G.scanBonus = null;
      G.threat.fireInterval = Math.round(cfg.fireInterval * diff.enemyFireMult);
      if (G.activeScanningProfile) G.threat.fireInterval = Math.round(G.threat.fireInterval * 0.85);
      postLogEvent("Enemy weapons subroutines restored.", 'warn');
      const bl = document.getElementById('lbl-scan-bonus');
      if (bl) { bl.textContent = 'No Profile'; bl.style.cssText = 'background:rgba(255,170,0,0.1);color:var(--warn);border:1px solid var(--warn);font-size:9px'; }
    }
  }

  // Lock rate — sensor health modifier; evasive pattern and tetryon ECM both reduce it
  const eSens      = G.enemySystems.sensors;
  const sMod       = eSens ? eSens.health / 100 : 1;
  const evasiveMod = G.evasiveActive ? getHelmEvasiveModifier() : 1.0;
  const tetryonMod = (G.scanBonus && G.scanBonus.type === 'tetryon' && performance.now() < G.scanBonus.expiry) ? G.scanBonus.value : 1.0;
  G.enemyLockProgress = Math.min(100, G.enemyLockProgress + G.threat.lockRate * sMod * evasiveMod * tetryonMod * sc);

  // Jem'Hadar — check for ramming opportunity (below 20% hull)
  if (cfg.canRam && !G.enemyRammingRun) {
    const hullPct = G.threat.hull / G.threat.maxHull;
    if (hullPct < 0.20 && Math.random() < 0.008 * sc * 60) {
      initiateRammingRun(cfg);
    }
  }

  // Maneuver — fixed threshold
  G.enemyManeuverTimer += dt;
  if (!G.enemyManeuverThreshold) G.enemyManeuverThreshold = 7000 + Math.random() * 5000;
  if (G.enemyManeuverTimer > G.enemyManeuverThreshold) {
    G.enemyManeuverTimer = 0;
    G.enemyManeuverThreshold = 7000 + Math.random() * 5000;
    const pref = cfg.preferredTargets || ['fore','port','starboard','aft'];
    G.enemyPreferredSector = pref[Math.floor(Math.random() * pref.length)];
    G.enemyManeuverState = 'angling';
    postLogEvent(`${cfg.label} manoeuvring — presenting ${G.enemyPreferredSector.toUpperCase()}.`, 'warn');
    setTimeout(() => { if (G.enemyManeuverState === 'angling') G.enemyManeuverState = 'neutral'; }, 4000 + Math.random() * 2000);
  }
  if (G.enemyLockProgress >= 100) {
    G.enemyManeuverState = 'torpedocharge';
    const sl = document.getElementById('lbl-enemy-state-left');
    if (sl) { sl.textContent = '⚠ TORPEDO LOCK — EVADE!'; sl.style.color = 'var(--red)'; }
  }

  // Borg tractor beam
  if (cfg.adaptiveShields && G.enemySystems.tractor_beam && G.enemySystems.tractor_beam.health > 0) {
    if (!G.enemyTractorActive && Math.random() < 0.002 * sc * 60) {
      G.enemyTractorActive = true;
      postLogEvent("BORG TRACTOR BEAM ENGAGED — weapons offline!", 'crit');
      setTimeout(() => { G.enemyTractorActive = false; postLogEvent("Tractor beam disengaged.", 'warn'); }, 8000);
    }
  }

  // Item 7: Borg escalating threat arc — announce adaptation milestones
  if (cfg.adaptiveShields) {
    const totalHits = Object.values(G.enemyAdaptiveResist).reduce((a, v) => a + v, 0);
    const fullyAdapted = Object.entries(G.enemyAdaptiveResist).filter(([k, v]) => v >= 0.75);
    if (fullyAdapted.length === 1 && Math.random() < 0.01 * sc * 60) {
      postLogEvent(`BORG: "Your ${fullyAdapted[0][0].replace('_',' ')} weapons are irrelevant. Adaptation complete."`, 'crit');
    }
    if (fullyAdapted.length >= 3 && Math.random() < 0.005 * sc * 60) {
      postLogEvent('BORG: "Resistance is futile. Your offensive capability has been neutralised."', 'crit');
    }
    if (fullyAdapted.length >= 5 && Math.random() < 0.003 * sc * 60) {
      postTacticalAdvisory("All primary weapons fully adapted — target subsystems or use burst salvo to vary frequencies!");
    }
  }

  // Tactical advisories
  const hullPct = G.threat.hull / G.threat.maxHull;
  if (hullPct < 0.30 && Math.random() < 0.001 * sc * 60) {
    const advisories = [
      "Enemy hull critical — maintain pressure, don't let them repair.",
      "Target their weapons systems to prevent further return fire.",
      "Enemy shields failing — concentrate fire on weakest sector.",
    ];
    postTacticalAdvisory(advisories[Math.floor(Math.random() * advisories.length)]);
  }

  // Item 9: hull regen advisory — warn if player pauses fire for >10s and enemy is recovering
  if (G.lastPlayerFireTime > 0 && (performance.now() - G.lastPlayerFireTime) > 10000) {
    const enemyHullPct = G.threat.hull / G.threat.maxHull;
    if (enemyHullPct < 0.9 && Math.random() < 0.003 * sc * 60) {
      postTacticalAdvisory(`Enemy registering hull repairs — maintain fire! Hull at ${Math.round(enemyHullPct*100)}%.`);
      G.lastPlayerFireTime = performance.now() - 7000; // reset to prevent spam
    }
  }

  const ll = document.getElementById('txt-enemy-lock-left'); if (ll) ll.textContent = `${Math.round(G.enemyLockProgress)}%`;
  const bl = document.getElementById('bar-enemy-lock-left'); if (bl) bl.style.width = `${G.enemyLockProgress}%`;

  if (G.enemyManeuverState !== 'torpedocharge') {
    const sl  = document.getElementById('lbl-enemy-state-left');
    const rng = cfg.prefersCloseRange ? ` [${G.enemyRangeBracket.toUpperCase()}]` : '';
    const m   = {
      neutral:`Holding — ${G.enemyPreferredSector.toUpperCase()} exposed${rng}`,
      angling:`Manoeuvring: ${G.enemyPreferredSector.toUpperCase()}${rng}`,
    };
    if (sl) { sl.textContent = m[G.enemyManeuverState] || '—'; sl.style.color = G.enemyManeuverState === 'angling' ? 'var(--warn)' : '#aabbcc'; }
  }
}

// ============================================================
// ENEMY FIRE — faction-accurate weapon behaviours
// ============================================================
function executeThreatCounterVolley() {
  if (!G.running || G.dead) return;
  const cfg  = ENEMY_CONFIGS[G.enemyArchetype];
  const diff = DIFFICULTY[currentDifficulty];

  if (G.enemyCloaked && G.enemyCloakVulnTimer <= 0) return;
  if (G.enemyRammingRun) return; // committed to ram, not firing

  const wpns = Object.entries(G.enemySystems).filter(([k, s]) => s.isWeapon && s.health > 0);
  if (wpns.length === 0) { postLogEvent("All enemy weapons offline.", 'good'); return; }

  // Cloaked player — enemy fires blind
  if (G.cloaked && G.cloakVulnTimer <= 0) {
    postLogEvent("Enemy fires blind — missed cloaked vessel.", 'info');
    return;
  }

  let chosenKey, chosenSys, dmgMin, dmgMax, targetSector;

  if (G.enemyManeuverState === 'torpedocharge') {
    // Romulan plasma torpedo — check reload state
    const torps = wpns.find(([k, s]) => s.isTorpedo);
    if (torps) {
      const isCfgPlasma = cfg.plasmaReloadTime && torps[1].label.includes('Plasma');
      if (isCfgPlasma && !G.plasmaTorpedoReady) {
        // Plasma not ready — fall through to phasers/disruptors
        const nonTorp = wpns.filter(([k, s]) => !s.isTorpedo);
        if (nonTorp.length === 0) return;
        [chosenKey, chosenSys] = nonTorp[Math.floor(Math.random() * nonTorp.length)];
        dmgMin = chosenSys.dmgMin; dmgMax = chosenSys.dmgMax;
        const arc = chosenSys.firingArc.length ? chosenSys.firingArc : ['fore','port','starboard','aft'];
        targetSector = arc[Math.floor(Math.random() * arc.length)] || 'fore';
        G.enemyLockProgress = 0; G.enemyManeuverState = 'neutral';
      } else {
        [chosenKey, chosenSys] = torps;
        dmgMin = chosenSys.dmgMin; dmgMax = chosenSys.dmgMax;
        targetSector = ['fore','port','starboard','aft'].reduce((w, s) => G.player.shields[s] < G.player.shields[w] ? s : w, 'fore');
        G.enemyLockProgress = 0; G.enemyManeuverState = 'neutral';
        const sl = document.getElementById('lbl-enemy-state-left');
        if (sl) { sl.textContent = 'Holding attack vector'; sl.style.color = '#aabbcc'; }
        // Start plasma reload timer
        if (cfg.plasmaReloadTime) {
          G.plasmaTorpedoReady = false;
          G.plasmaTorpedoReloadTimer = cfg.plasmaReloadTime;
          postLogEvent(`${cfg.label} — plasma banks now reloading (${cfg.plasmaReloadTime/1000}s).`, 'warn');
        }
      }
    } else {
      [chosenKey, chosenSys] = wpns[0]; dmgMin = chosenSys.dmgMin; dmgMax = chosenSys.dmgMax;
      targetSector = G.enemyPreferredSector || 'fore';
      G.enemyLockProgress = 0; G.enemyManeuverState = 'neutral';
    }
  } else {
    // Normal fire — choose weapon from firing arc, Klingons prefer disruptors at close range
    let candidateWpns = wpns;
    if (cfg.prefersCloseRange && G.enemyRangeBracket === 'close') {
      // At close range Klingons prioritise disruptors over torpedoes
      const disruptors = wpns.filter(([k, s]) => s.systemTargetKey === 'disruptors');
      if (disruptors.length > 0) candidateWpns = disruptors;
    }
    [chosenKey, chosenSys] = candidateWpns[Math.floor(Math.random() * candidateWpns.length)];
    dmgMin = chosenSys.dmgMin; dmgMax = chosenSys.dmgMax;
    const arc = chosenSys.firingArc.length ? chosenSys.firingArc : ['fore','port','starboard','aft'];
    const preferred = cfg.preferredTargets || ['fore','port','starboard','aft'];
    const validSectors   = arc.filter(s => ['fore','port','starboard','aft'].includes(s));
    const preferredValid = validSectors.filter(s => preferred.includes(s));
    const pool = preferredValid.length > 0 ? preferredValid : validSectors;
    targetSector = pool[Math.floor(Math.random() * pool.length)] || 'fore';
  }

  let rawDmg = (Math.random() * (dmgMax - dmgMin) + dmgMin) * (chosenSys.health / 100) * diff.enemyDmgMult;
  if (G.weaponsDisrupted)               rawDmg *= 0.5;
  if (G.activePanel === 'engineering')  rawDmg *= 0.85;

  // Klingon close-range bonus
  if (cfg.prefersCloseRange && G.enemyRangeBracket === 'close' && chosenSys.systemTargetKey === 'disruptors') {
    rawDmg *= (cfg.closeRangeDmgBonus || 1.4);
  }

  // Hard/Elite system targeting
  let hitPlayerSystem = null;
  if (diff.targetsSystems && Math.random() < (currentDifficulty === 'elite' ? 0.45 : 0.25)) {
    const systemTargets = {
      torpedo_tube:['torpedoes'], disruptors:['cannon_pu','cannon_pl','cannon_su','cannon_sl'],
      phasers:['cannon_pu','nose_beam'], engines:['engines'], sensors:['sensors'],
      cloak:['cloak_dev'], warp:['warp_core'], shields:['shields']
    };
    const priorities = currentDifficulty === 'elite'
      ? ['warp','cloak','sensors','disruptors','shields']
      : ['disruptors','sensors','shields','engines'];
    const chosenPriority = priorities[Math.floor(Math.random() * priorities.length)];
    const candidateKeys  = systemTargets[chosenPriority] || ['shields'];
    hitPlayerSystem = candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
    postLogEvent(`PRECISION STRIKE: Enemy targeting [${G.systems[hitPlayerSystem] ? G.systems[hitPlayerSystem].label : hitPlayerSystem}]!`, 'crit');
  }

  // Polaron bypass
  let shieldPenMult = 1.0; let hullPassthrough = 0;
  if (chosenSys.isPolaron) { shieldPenMult = 0.7; hullPassthrough = rawDmg * 0.3; }

  // Shield frequency rotation reduction
  if (G.shieldFreqActive) {
    const freqMatch = (G.shieldFreqWeaponType === 'disruptors' && chosenSys.systemTargetKey === 'disruptors') ||
                      (G.shieldFreqWeaponType === 'phasers'    && chosenSys.systemTargetKey === 'phasers')    ||
                      (G.shieldFreqWeaponType === 'polaron'    && chosenSys.isPolaron)                        ||
                      (G.shieldFreqWeaponType === 'plasma'     && chosenSys.isTorpedo && chosenSys.label.includes('Plasma'));
    if (freqMatch) rawDmg *= 0.75; // 25% reduction when frequency is countered
  }

  // Cloak vulnerability — no shields
  if (G.cloakVulnTimer > 0) {
    const vuln     = Math.round(rawDmg * 1.3);
    const residual = applyAblativeArmour(vuln);
    G.player.hull  = Math.max(0, G.player.hull - residual);
    G.score.hullBreaches++;
    postLogEvent(`CLOAK TRANSITION HIT — no shields! Ablative absorbed ${Math.round(vuln - residual)}. Hull −${Math.round(residual)}.`, 'crit');
    inflictCrewCasualty();
    if (G.player.hull <= 0) concludeSimulationRun(false, "Destroyed during cloak transition.", false);
    return;
  }

  const shieldVal    = G.player.shields[targetSector] || 0;
  const shieldAbsorb = shieldVal * shieldPenMult;

  if (shieldAbsorb >= rawDmg * shieldPenMult) {
    G.player.shields[targetSector] -= rawDmg * shieldPenMult;
    if (hullPassthrough > 0) {
      const passResidual = applyAblativeArmour(hullPassthrough);
      G.player.hull = Math.max(0, G.player.hull - passResidual);
    }
    G.shieldUnderAttackTimer = 3000;
  } else {
    const leak     = (rawDmg * shieldPenMult - shieldAbsorb) + hullPassthrough;
    G.player.shields[targetSector] = 0;
    G.shieldUnderAttackTimer = 3000;
    const residual = applyAblativeArmour(leak);
    G.player.hull  = Math.max(0, G.player.hull - residual);
    G.score.hullBreaches++;
    const ablaticNote = (leak - residual) > 1 ? ` Ablative absorbed ${Math.round(leak - residual)}.` : '';
    postLogEvent(`BREACH — ${targetSector.toUpperCase()} down! Hull −${Math.round(residual)}.${ablaticNote}`, 'crit');

    // Item 6: internal damage weighted by which sector was breached
    // Fore hits → fore-mounted weapons; port/stbd → lateral cannons; aft → engines/warp
    const sectorSystemPool = {
      fore:      ['cannon_pu','cannon_su','nose_beam','torpedoes','sensors'],
      port:      ['cannon_pu','cannon_pl','shields','sensors'],
      starboard: ['cannon_su','cannon_sl','shields','sensors'],
      aft:       ['engines','warp_core','cloak_dev','cannon_pl','cannon_sl'],
    };
    const pool   = sectorSystemPool[targetSector] || Object.keys(G.systems);
    const hitKey = hitPlayerSystem || pool[Math.floor(Math.random() * pool.length)];
    const hitDmg = Math.floor(Math.random() * 18) + 8;
    G.systems[hitKey].health = Math.max(0, G.systems[hitKey].health - hitDmg);
    postLogEvent(`Internal damage: [${G.systems[hitKey].label}] −${hitDmg}%.`, 'crit');
    checkSystemDegradationThresholds(hitKey);
    // Item 10: medical crew status affects how easily further casualties occur
    // Dr. Bashir down = crew take casualties at lower breach damage threshold
    const medEff = getMedicalEfficiency();
    const casualtyThreshold = 35 * medEff; // normal: >35 dmg; Bashir down: >14-24 dmg
    if (leak > casualtyThreshold) inflictCrewCasualty();
  }

  if (G.player.hull <= 0) concludeSimulationRun(false, "Vessel destroyed.", false);
}

// ============================================================
// AUTO-DELEGATION
// ============================================================
function processAutomatedDelegation(dt) {
  if (G.playerChosenStation === 'tactical') {
    const ce = getCrewEfficiency('engineering');
    Object.keys(G.systems).forEach(key => {
      const sys = G.systems[key];
      if (sys.tripped && Math.random() < 0.06 * ce * (dt / 1000)) {
        if (key === 'warp_core' && sys.health < 25) return;
        sys.tripped = false; sys.stress = 0;
        const def = { cannon_pu:8, cannon_pl:8, cannon_su:8, cannon_sl:6, nose_beam:10, torpedoes:10, shields:28, sensors:16, engines:10, cloak_dev:0, warp_core:10 };
        sys.allocatedPower = Object.prototype.hasOwnProperty.call(def, key) ? def[key] : 10;
        postLogEvent(`Computer: relay restored [${sys.label}]`, 'info');
        refreshEngineeringPanelGraphics();
      }
    });

  } else {
    G.autoTacticalFireClock += dt;
    if (G.autoTacticalFireClock > 2400) {
      G.autoTacticalFireClock = 0;
      if (!G.cloaked && G.cloakVulnTimer === 0 && G.lockProgress >= 8) {
        const ce = getCrewEfficiency('tactical');
        if (Math.random() < ce) {
          const warpOnline = !G.systems.warp_core.tripped || G.batteryActive;
          if (warpOnline) {
            const pk = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
            pk.filter(k => {
              const s = G.systems[ARRAYS_DICTIONARY[k].parentSystem];
              return !s.tripped && s.health >= 15 && s.cap >= ARRAYS_DICTIONARY[k].cost;
            }).forEach(k => fireSelectedArray(k));
            if (Math.random() < 0.5 * ce)  fireSelectedArray('emitter_nose');
            if (Math.random() < 0.25 * ce && G.player.torpedoes > 5) fireSelectedArray('torpedo_fore');
          }
        }
      }
    }
  }
}
