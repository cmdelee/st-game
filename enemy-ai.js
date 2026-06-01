'use strict';

// ============================================================
// ENEMY-AI.JS — Enemy AI, firing, cloaking, auto-delegation
// Depends on: config.js, state.js, engineering.js, crew.js,
//             sensors.js, tactical.js, helm.js
// ============================================================

// ── Enemy cloaking ────────────────────────────────────────────
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
    crewReportEnemyCloak();
  }, 1500);
}

function triggerEnemyDecloak(cfg, reason) {
  G.enemyCloaked = false; G.enemyCloakPower = 0; G.enemyCloakVulnTimer = 1500; G.enemyCloakCooldown = 25000;
  ['fore','port','starboard','aft'].forEach(s => { G.threat.shields[s] = 0; });
  postLogEvent(`${cfg.label} DECLOAKING (${reason}) — shields offline 1.5s! Fire now!`, 'crit');
  crewReportEnemyDecloak();
  postTacticalAdvisory("Enemy shields down during decloak — maximum yield fire window open!");
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

// ── Sensor ghosts ─────────────────────────────────────────────
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

// ── Mechanics timers (called each frame from main loop) ───────
function processNewMechanicsTimers(dt) {
  const sc = dt / 1000;

  // Evasive manoeuvre countdown
  if (G.evasiveActive) {
    G.evasiveCooldown = Math.max(0, G.evasiveCooldown - dt);
    if (G.evasiveCooldown <= 0) {
      G.evasiveActive   = false;
      G.evasiveCooldown = G.evasiveCooldownTime;
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

  // Overload mode cooldowns + power dump active timer
  if (!G.overchargeReady) {
    G.overchargeCooldown = Math.max(0, G.overchargeCooldown - dt);
    if (G.overchargeCooldown <= 0) { G.overchargeReady = true; postLogEvent("Cannon overcharge capacitors reset.", 'good'); }
  }
  if (!G.unstableTorpReady) {
    G.unstableTorpCooldown = Math.max(0, G.unstableTorpCooldown - dt);
    if (G.unstableTorpCooldown <= 0) { G.unstableTorpReady = true; postLogEvent("Torpedo tube re-stabilised — unstable load ready.", 'good'); }
  }
  if (G.powerDumpActive) {
    G.powerDumpTimer = Math.max(0, G.powerDumpTimer - dt);
    if (G.powerDumpTimer <= 0) {
      G.powerDumpActive = false;
      postLogEvent("Emergency power dump expired — EPS returning to normal.", 'warn');
    }
  }
  if (!G.powerDumpReady) {
    G.powerDumpCooldown = Math.max(0, G.powerDumpCooldown - dt);
    if (G.powerDumpCooldown <= 0) { G.powerDumpReady = true; postLogEvent("EPS power dump capacitors recharged.", 'good'); }
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

  // Klingon range bracket
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
      if (G.enemyRangeBracket === 'close' || G.enemyRangeBracket === 'medium') crewReportKlingonClosing();
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

  processHelmTimers(dt); // → helm.js
}

// ── Jem'Hadar ramming ─────────────────────────────────────────
function initiateRammingRun(cfg) {
  if (G.enemyRammingRun) return;
  G.enemyRammingRun   = true;
  G.enemyRammingTimer = 4000;
  postLogEvent(`ALERT: ${cfg.label} HAS TURNED TO RAM! EVASIVE ACTION!`, 'crit');
  postTacticalAdvisory("Jem'Hadar on suicide run — all power to fore shields now!");
  crewReportEnemyRamming();
}

function executeRammingImpact() {
  if (G.dead) return;
  const cfg      = ENEMY_CONFIGS[G.enemyArchetype];
  const ramDmg   = cfg.ramDamage || 300;
  const residual = applyAblativeArmour(ramDmg);
  G.player.hull  = Math.max(0, G.player.hull - residual);
  G.threat.hull  = 0;
  postLogEvent(`COLLISION! ${cfg.label} rammed USS Defiant. Ablative absorbed ${Math.round(ramDmg - residual)}. Hull −${Math.round(residual)}.`, 'crit');
  inflictCrewCasualty(); inflictCrewCasualty();
  if (G.player.hull <= 0) {
    concludeSimulationRun(false, "Vessel destroyed in Jem'Hadar ramming attack.", false);
  } else {
    concludeSimulationRun(true, `${cfg.label} destroyed — ramming attack repelled by ablative armour.`, false);
  }
}

// ── Enemy AI — manoeuvre, lock, faction behaviours ────────────
function processEnemyAI(dt) {
  if (!G.running || G.dead) return;
  const sc   = dt / 1000;
  const cfg  = ENEMY_CONFIGS[G.enemyArchetype];
  const diff = DIFFICULTY[currentDifficulty];

  processEnemyCloakDecision(dt);
  if (cfg.hasSensorGhosts) processEnemySensorGhosts(dt);
  processNewMechanicsTimers(dt);

  if (G.enemyCloaked) {
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
      crewReportWeaponsOnline();
      G.threat.fireInterval = Math.round(cfg.fireInterval * diff.enemyFireMult);
      if (G.activeScanningProfile) G.threat.fireInterval = Math.round(G.threat.fireInterval * 0.85);
      postLogEvent("Enemy weapons subroutines restored.", 'warn');
      const bl = document.getElementById('lbl-scan-bonus');
      if (bl) { bl.textContent = 'No Profile'; bl.style.cssText = 'background:rgba(255,170,0,0.1);color:var(--warn);border:1px solid var(--warn);font-size:9px'; }
    }
  }

  // Enemy lock rate
  const eSens      = G.enemySystems.sensors;
  const sMod       = eSens ? eSens.health / 100 : 1;
  const evasiveMod = G.evasiveActive ? getHelmEvasiveModifier() : 1.0;
  const tetryonMod = (G.scanBonus && G.scanBonus.type === 'tetryon' && performance.now() < G.scanBonus.expiry) ? G.scanBonus.value : 1.0;
  const helmSpeedCfg  = HELM_SPEED_CONFIG[G.helmSpeed] || HELM_SPEED_CONFIG.half;
  const helmSpeedMod  = G.comeAboutActive ? 1.25 : helmSpeedCfg.enemyLockMult;
  const alphaLockMod  = G.evasiveAlphaActive    ? 0.5 : 1.0;
  const picardLockMod = G.picardManoeuverActive  ? 0.0 : 1.0;
  const silentRunMod  = G.silentRunning          ? 0.6 : 1.0;
  G.enemyLockProgress = Math.min(100, G.enemyLockProgress + G.threat.lockRate * sMod * evasiveMod * tetryonMod * helmSpeedMod * alphaLockMod * picardLockMod * silentRunMod * sc);

  // Jem'Hadar ramming check
  if (cfg.canRam && !G.enemyRammingRun) {
    const hullPct = G.threat.hull / G.threat.maxHull;
    if (hullPct < 0.20 && Math.random() < 0.008 * sc * 60) initiateRammingRun(cfg);
  }

  // Manoeuvre — fixed threshold
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

  // Borg escalating damage milestones
  if (cfg.adaptiveShields) {
    const fullyAdapted = Object.entries(G.enemyAdaptiveResist).filter(([k, v]) => v >= 0.65);
    const newLevel = Math.min(3, Math.floor(fullyAdapted.length / 2));
    if (newLevel > G.borgEscalationLevel) {
      G.borgEscalationLevel = newLevel;
      postLogEvent(`BORG: Cutting beam power increased — ${Math.round(newLevel * 10)}% more damage.`, 'crit');
    }
    if (fullyAdapted.length === 1 && Math.random() < 0.01 * sc * 60)
      postLogEvent(`BORG: "Your ${fullyAdapted[0][0].replace(/_/g,' ')} weapons are irrelevant. Adaptation complete."`, 'crit');
    if (fullyAdapted.length >= 3 && Math.random() < 0.005 * sc * 60)
      postLogEvent('BORG: "Resistance is futile. Your offensive capability has been neutralised."', 'crit');
    if (fullyAdapted.length >= 5 && Math.random() < 0.003 * sc * 60)
      postTacticalAdvisory("All primary weapons fully adapted — target subsystems or use photon torpedoes!");
  }

  // General advisories
  const hullPct = G.threat.hull / G.threat.maxHull;
  if (hullPct < 0.30 && Math.random() < 0.001 * sc * 60) {
    const advisories = [
      "Enemy hull critical — maintain pressure, don't let them repair.",
      "Target their weapons systems to prevent further return fire.",
      "Enemy shields failing — concentrate fire on weakest sector.",
    ];
    postTacticalAdvisory(advisories[Math.floor(Math.random() * advisories.length)]);
  }

  // Hull regen advisory
  if (G.lastPlayerFireTime > 0 && (performance.now() - G.lastPlayerFireTime) > 10000) {
    const enemyHullPct = G.threat.hull / G.threat.maxHull;
    if (enemyHullPct < 0.9 && Math.random() < 0.003 * sc * 60) {
      postTacticalAdvisory(`Enemy registering hull repairs — maintain fire! Hull at ${Math.round(enemyHullPct*100)}%.`);
      G.lastPlayerFireTime = performance.now() - 7000;
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

// ── Enemy fire ────────────────────────────────────────────────
function executeThreatCounterVolley() {
  if (!G.running || G.dead) return;
  const cfg  = ENEMY_CONFIGS[G.enemyArchetype];
  const diff = DIFFICULTY[currentDifficulty];

  if (G.enemyCloaked && G.enemyCloakVulnTimer <= 0) return;
  if (G.enemyRammingRun) return;
  if (G.picardManoeuverActive) { postLogEvent("Enemy fire disrupted — Picard Manoeuvre confusion window.", 'good'); return; }

  const wpns = Object.entries(G.enemySystems).filter(([k, s]) => s.isWeapon && s.health > 0);
  if (wpns.length === 0) { postLogEvent("All enemy weapons offline.", 'good'); return; }

  if (G.cloaked && G.cloakVulnTimer <= 0) {
    postLogEvent("Enemy fires blind — missed cloaked vessel.", 'info');
    return;
  }

  let chosenKey, chosenSys, dmgMin, dmgMax, targetSector;

  if (G.enemyManeuverState === 'torpedocharge') {
    const torps = wpns.find(([k, s]) => s.isTorpedo);
    if (torps) {
      const isCfgPlasma = cfg.plasmaReloadTime && torps[1].label.includes('Plasma');
      if (isCfgPlasma && !G.plasmaTorpedoReady) {
        const nonTorp = wpns.filter(([k, s]) => !s.isTorpedo);
        if (nonTorp.length === 0) return;
        [chosenKey, chosenSys] = nonTorp[Math.floor(Math.random() * nonTorp.length)];
        dmgMin = chosenSys.dmgMin; dmgMax = chosenSys.dmgMax;
        const arc = chosenSys.firingArc.length ? chosenSys.firingArc : ['fore','port','starboard','aft'];
        targetSector = arc[Math.floor(Math.random() * arc.length)] || 'fore';
        if (!G.comeAboutActive && Math.random() < 0.65) targetSector = G.helmAttackVector;
        G.enemyLockProgress = 0; G.enemyManeuverState = 'neutral';
      } else {
        [chosenKey, chosenSys] = torps;
        dmgMin = chosenSys.dmgMin; dmgMax = chosenSys.dmgMax;
        targetSector = ['fore','port','starboard','aft'].reduce((w, s) => G.player.shields[s] < G.player.shields[w] ? s : w, 'fore');
        G.enemyLockProgress = 0; G.enemyManeuverState = 'neutral';
        const sl = document.getElementById('lbl-enemy-state-left');
        if (sl) { sl.textContent = 'Holding attack vector'; sl.style.color = '#aabbcc'; }
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
    let candidateWpns = wpns;
    if (cfg.prefersCloseRange && G.enemyRangeBracket === 'close') {
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
    if (!G.comeAboutActive && Math.random() < 0.65) targetSector = G.helmAttackVector;
  }

  let rawDmg = (Math.random() * (dmgMax - dmgMin) + dmgMin) * (chosenSys.health / 100) * diff.enemyDmgMult;
  if (G.weaponsDisrupted)              rawDmg *= 0.5;
  if (G.activePanel === 'engineering') rawDmg *= 0.85;
  if (G.attackPatternOmegaActive)      rawDmg *= 1.20;

  if (cfg.prefersCloseRange && G.enemyRangeBracket === 'close' && chosenSys.systemTargetKey === 'disruptors')
    rawDmg *= (cfg.closeRangeDmgBonus || 1.4);

  if (cfg.adaptiveShields && G.borgEscalationLevel > 0)
    rawDmg *= (1 + Math.min(G.borgEscalationLevel, 2) * 0.10);

  let hitPlayerSystem = null;
  if (diff.targetsSystems && Math.random() < diff.systemTargetChance) {
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

  let shieldPenMult = 1.0; let hullPassthrough = 0;
  if (chosenSys.isPolaron) { shieldPenMult = 0.7; hullPassthrough = rawDmg * 0.3; }

  if (G.shieldFreqActive) {
    const freqMatch = (G.shieldFreqWeaponType === 'disruptors' && chosenSys.systemTargetKey === 'disruptors') ||
                      (G.shieldFreqWeaponType === 'phasers'    && chosenSys.systemTargetKey === 'phasers')    ||
                      (G.shieldFreqWeaponType === 'polaron'    && chosenSys.isPolaron)                        ||
                      (G.shieldFreqWeaponType === 'plasma'     && chosenSys.isTorpedo && chosenSys.label.includes('Plasma'));
    if (freqMatch) rawDmg *= 0.75;
  }

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
    G.shieldHitFlash.player  = { sector: targetSector, timer: 350 };
    postLogEvent(`${chosenSys.label} — ${targetSector.toUpperCase()} −${Math.round(rawDmg * shieldPenMult)}MW.${chosenSys.isPolaron ? ' [POLARON]' : ''}`, 'warn');
    crewReportShieldHit(targetSector, rawDmg * shieldPenMult);
  } else {
    const leak     = (rawDmg * shieldPenMult - shieldAbsorb) + hullPassthrough;
    G.player.shields[targetSector] = 0;
    G.shieldUnderAttackTimer = 3000;
    G.shieldHitFlash.player  = { sector: targetSector, timer: 600 };
    const residual = applyAblativeArmour(leak);
    G.player.hull  = Math.max(0, G.player.hull - residual);
    G.score.hullBreaches++;
    const ablaticNote = (leak - residual) > 1 ? ` Ablative absorbed ${Math.round(leak - residual)}.` : '';
    postLogEvent(`BREACH — ${targetSector.toUpperCase()} down! Hull −${Math.round(residual)}.${ablaticNote}`, 'crit');
    G.damageParticles.push(...spawnParticles('player', 10, C.red));
    crewReportHullBreach(residual);

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
    const medEff = getMedicalEfficiency();
    const casualtyThreshold = 35 * medEff;
    if (leak > casualtyThreshold) inflictCrewCasualty();
  }

  if (G.player.hull <= 0) concludeSimulationRun(false, "Vessel destroyed.", false);
}

// ── Auto-delegation ───────────────────────────────────────────
function processAutomatedDelegation(dt) {
  const isCaptain  = G.playerChosenStation === 'captain';
  const runAutoEng = G.playerChosenStation === 'tactical' || G.playerChosenStation === 'helm' || isCaptain;
  const runAutoTac = G.playerChosenStation === 'engineering' || G.playerChosenStation === 'helm' || isCaptain;

  if (runAutoEng) {
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
    const damaged = Object.keys(G.systems)
      .filter(k => (G.systems[k].health < 70 || G.systems[k].tripped) && !G.repairTeams.some(t => t.sysKey === k))
      .sort((a, b) => G.systems[a].health - G.systems[b].health);
    G.repairTeams.forEach((team, idx) => {
      if (!team.sysKey && damaged.length > idx) {
        const target = damaged[idx];
        const sys    = G.systems[target];
        const damage = Math.max(1, 100 - sys.health + (sys.tripped ? 20 : 0));
        const repairTime = Math.max(5000, (damage / 10) * 5000);
        team.sysKey = target; team.label = sys.label; team.totalTime = repairTime; team.remaining = repairTime;
        postLogEvent(`Computer: repair team dispatched to [${sys.label}].`, 'info');
      }
    });

    if (isCaptain) {
      if (G.systems.warp_core.tripped && !G.batteryActive && G.batteryCharge > 20) {
        G.batteryActive = true;
        postLogEvent("O'Brien: Emergency battery online — warp core offline.", 'good');
        crewReportWarpCoreTrip();
      }
      if (!G.cloaked && !G.shieldTransferInProgress) {
        const max = G.player.shields.maxSectorValue;
        const sectors = ['fore','port','starboard','aft'];
        const critSector = sectors.find(s => G.player.shields[s] < max * 0.15);
        const totalShields = sectors.reduce((sum, s) => sum + G.player.shields[s], 0);
        if (critSector && totalShields > max * 0.5 && Math.random() < 0.01 * (dt / 1000) * 60) {
          rebalanceShieldArrays();
          postLogEvent(`O'Brien: Auto-equalising — ${critSector.toUpperCase()} shields critical.`, 'warn');
        }
      }
    }
  }

  if (runAutoTac && !G.holdFire) {
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
            if (Math.random() < 0.25 * ce && G.player.torpedoes > 3)       fireSelectedArray('torpedo_quantum');
            if (Math.random() < 0.20 * ce && G.player.photonTorpedoes > 0) fireSelectedArray('torpedo_photon');
          }
        }
      }
    }
    if (isCaptain) {
      if (G.burstFireReady && G.lockProgress >= 55 && !G.cloaked &&
          G.threat.hull / G.threat.maxHull > 0.10 &&
          Math.random() < 0.015 * (dt / 1000) * 60) {
        executeBurstFireSalvo();
        postLogEvent("Worf: Initiating burst salvo.", 'info');
      }
      if (G.enemyLockProgress > 88 && !G.evasiveActive && G.evasiveCooldown === 0 &&
          G.systems.engines.health >= 20 && Math.random() < 0.02 * (dt / 1000) * 60) {
        executeEvasivePattern();
        postCrewReport('worf', "Captain — enemy lock critical. Evasive manoeuvres engaged.", 'alert');
      }
      if (G.shieldUnderAttackTimer > 1500 && G.shieldFreqCooldown === 0 && !G.shieldFreqActive &&
          Math.random() < 0.008 * (dt / 1000) * 60) {
        rotateShieldFrequency();
        postCrewReport('worf', "Detecting sustained fire pattern — rotating shield frequencies, Captain.", 'status');
      }
    }
  }

  if (isCaptain) {
    if (!G.comeAboutActive && G.comeAboutCooldown === 0 && !G.autoShieldTrack) {
      const currentFacing = G.helmAttackVector;
      const max = G.player.shields.maxSectorValue;
      if (G.player.shields[currentFacing] < max * 0.10) {
        const strongest = ['fore','port','starboard','aft'].reduce(
          (best, s) => G.player.shields[s] > G.player.shields[best] ? s : best, 'fore');
        if (strongest !== currentFacing) {
          G.helmAttackVector = strongest;
          postCrewReport('nog', `${currentFacing.toUpperCase()} shields failing — presenting ${strongest.toUpperCase()} to enemy, Captain.`, 'alert');
          postLogEvent(`Nog: Auto-presenting ${strongest.toUpperCase()} shields.`, 'warn');
        }
      }
    }
    if (!G.attackRunActive && G.attackRunCooldown === 0 && !G.comeAboutActive &&
        G.systems.engines.health >= 25 && G.threat.hull / G.threat.maxHull > 0.40 &&
        G.lockProgress > 30 && Math.random() < 0.003 * (dt / 1000) * 60) {
      executeAttackRun();
      postCrewReport('nog', "Initiating attack run on your behalf, Captain.", 'status');
    }
  }
}
