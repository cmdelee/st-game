'use strict';

// ============================================================
// MAIN GAME LOOP
// ============================================================
function masterSimulationCoreLoop(ts) {
  if (!G.running || G.dead) { requestAnimationFrame(masterSimulationCoreLoop); return; }
  if (G.lastFrameTimestamp === 0) G.lastFrameTimestamp = ts;
  const dt = Math.min(ts - G.lastFrameTimestamp, 100);
  G.lastFrameTimestamp = ts;
  G.score.timeSurvived += dt / 1000;

  // Cloak cooldown timers
  if (G.cloakVulnTimer > 0) G.cloakVulnTimer = Math.max(0, G.cloakVulnTimer - dt);
  if (G.cloakCooldown > 0) {
    const prev = Math.floor(G.cloakCooldown / 1000);
    G.cloakCooldown = Math.max(0, G.cloakCooldown - dt);
    if (G.cloakCooldown === 0) { postLogEvent("Cloaking device recharged.", 'good'); updateCloakButton(); }
    else if (Math.floor(G.cloakCooldown / 1000) !== prev) updateCloakButton();
  }

  // Shield regeneration (suppressed while cloaked or under attack)
  if (!G.cloaked && G.cloakVulnTimer <= 0) {
    if (G.shieldUnderAttackTimer > 0) {
      G.shieldUnderAttackTimer = Math.max(0, G.shieldUnderAttackTimer - dt);
    } else {
      const regen = G.shieldRegenRate * (dt / 1000);
      const max   = G.player.shields.maxSectorValue;
      ['fore','port','starboard','aft'].forEach(s => {
        G.player.shields[s] = Math.min(max, G.player.shields[s] + regen);
      });
    }
  }

  // In-flight torpedoes (blind-fire tracking)
  G.inFlightTorpedoes = G.inFlightTorpedoes.filter(t => {
    t.timeToImpact -= dt;
    if (t.timeToImpact <= 0) {
      if (!t.fromEnemy && G.enemyCloaked) applyDamageToEnemy(t.dmg, null);
      return false;
    }
    return true;
  });

  // Core subsystems
  computeConduitConduction(dt);
  processRepairQueues(dt);
  processAutomatedDelegation(dt);
  processEnemyAI(dt);

  // Player sensor lock build-up
  if (G.cloakVulnTimer <= 0 && !G.cloaked) {
    const sP    = G.systems.sensors.allocatedPower;
    const sH    = G.systems.sensors.health;
    let sMod    = (sH / 100) * (sH < 70 ? 0.45 : 1) * Math.min(1.3, 0.6 + (sP / 20) * 0.7);
    const crewM = getCrewEfficiency('tactical');
    const speed = G.activeScanningProfile ? 0.032 : 0.010;
    G.lockProgress = Math.min(100, G.lockProgress + speed * dt * sMod * crewM);
  } else if (G.cloaked) {
    G.lockProgress = Math.max(0, G.lockProgress - 0.012 * dt);
  }

  // Scan analysis progress
  if (G.activeScanProfile) {
    const sP = G.systems.sensors.allocatedPower;
    const sH = G.systems.sensors.health;
    const r  = 0.014 * (sH / 100) * (0.5 + (sP / 20) * 0.5);
    G.scanAnalysisProgress = Math.min(100, G.scanAnalysisProgress + r * dt);
    const bar = document.getElementById('bar-scan-analysis'); if (bar) bar.style.width = `${G.scanAnalysisProgress}%`;
    const txt = document.getElementById('txt-scan-analysis'); if (txt) txt.textContent = `${Math.round(G.scanAnalysisProgress)}%`;
  }

  // Scan bonus expiry
  if (G.scanBonus && performance.now() > G.scanBonus.expiry && G.scanBonus.type !== 'weapons') {
    postLogEvent("Scan bonus expired.", 'info');
    G.scanBonus = null;
    const bl = document.getElementById('lbl-scan-bonus');
    if (bl) { bl.textContent = 'No Profile'; bl.style.cssText = 'background:rgba(255,170,0,0.1);color:var(--warn);border:1px solid var(--warn);font-size:9px'; }
  }

  // Enemy hull slow natural recovery
  G.threat.hull = Math.min(G.threat.maxHull, G.threat.hull + G.threat.recoveryCoefficient * (dt / 1000));

  // Enemy fire cycle
  G.threatCycleTimer += dt;
  const fi = G.weaponsDisrupted ? G.threat.fireInterval * 2 : G.threat.fireInterval;
  if (G.threatCycleTimer > fi) { G.threatCycleTimer = 0; executeThreatCounterVolley(); }

  updateWarpAvailability();
  synchronizeGlobalInterfaceDisplays();

  // Canvas rendering
  if (G.activePanel === 'tactical') {
    renderSpatialViewCanvas();
    renderEnemySchematicCanvas();
  } else {
    renderHullSchematicCanvas();
    renderPowerDistributionCanvas();
  }

  requestAnimationFrame(masterSimulationCoreLoop);
}

// ============================================================
// SIMULATION INIT
// ============================================================
function initiateVesselSimulation(station) {
  G.playerChosenStation = station;
  const diff = DIFFICULTY[currentDifficulty];

  // Enemy pool by difficulty
  const normalPool = ['ktinga','romulan_bop','cardassian_scout','galor_class','jem_hadar_fighter','vor_cha'];
  const hardPool   = ['ktinga','vor_cha','romulan_bop','romulan_warbird','galor_class','jem_hadar_fighter','jem_hadar_battleship'];
  const elitePool  = ['vor_cha','romulan_warbird','jem_hadar_battleship','borg_probe'];
  const pool = currentDifficulty === 'elite' ? elitePool : currentDifficulty === 'hard' ? hardPool : normalPool;
  G.enemyArchetype = pool[Math.floor(Math.random() * pool.length)];

  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // Deep-copy enemy systems
  G.enemySystems = {};
  Object.keys(cfg.systems).forEach(k => { G.enemySystems[k] = Object.assign({}, cfg.systems[k]); });

  // Apply difficulty multipliers
  G.threat.hull         = Math.round(cfg.hull * diff.enemyHullMult);
  G.threat.maxHull      = G.threat.hull;
  G.threat.shields      = Object.assign({}, cfg.shields);
  G.threat.recoveryCoefficient = cfg.recoveryCoefficient;
  G.threat.fireInterval = Math.round(cfg.fireInterval * diff.enemyFireMult);
  G.threat.lockRate     = cfg.lockRate * diff.enemyLockMult;
  G.player.hull         = Math.round(500 * diff.playerHullMult);
  G.player.maxHull      = G.player.hull;
  // Items 1+2: reset shields and torpedoes — were never reset between games
  G.player.torpedoes    = 18;
  G.player.maxTorpedoes = 18;
  G.player.shields      = { fore:320, port:260, starboard:260, aft:200, maxSectorValue:320 };

  // Reset ablative armour
  G.ablative = { layers:5, layerHealth:[100,100,100,100,100], regenTimers:[0,0,0,0,0], regenProgress:[0,0,0,0,0] };

  // Reset new mechanic states
  G.enemyRangeBracket        = 'long';
  G.enemyRangeTimer          = 0;
  G.enemyRammingRun          = false;
  G.enemyRammingTimer        = 0;
  G.plasmaTorpedoReady       = true;
  G.plasmaTorpedoReloadTimer = 0;
  G.shieldFreqActive         = false;
  G.shieldFreqTimer          = 0;
  G.shieldFreqCooldown       = 0;
  G.shieldFreqWeaponType     = null;
  G.burstFireReady           = true;
  G.burstFireCooldown        = 0;
  G.enemyAdaptiveResist      = { cannon_pu:0, cannon_pl:0, cannon_su:0, cannon_sl:0, nose_beam:0, torpedoes:0 };
  G.enemyAdaptiveHits        = 0;

  // Hide overlay
  document.getElementById('overlay').style.display = 'none';
  G.running = true;
  G.lastFrameTimestamp = performance.now();

  // Enemy label
  const aiLbl = document.getElementById('lbl-ai-archetype'); if (aiLbl) aiLbl.textContent = cfg.label;

  // Boot log
  postLogEvent(`[${currentDifficulty.toUpperCase()}] ${cfg.label} (${cfg.faction}) — engaging.`, 'warn');
  if (cfg.hasCloakDevice)    postLogEvent("WARNING: Enemy has cloaking capability.", 'crit');
  if (cfg.polaronWeapons)    postLogEvent("WARNING: Polaron weapons detected — bypass 30% of shields.", 'crit');
  if (cfg.adaptiveShields)   postLogEvent("WARNING: Borg adaptive shielding — switch weapons frequently.", 'crit');
  if (cfg.hasSensorGhosts)   postLogEvent("Romulan vessel detected — expect false sensor contacts.", 'warn');
  if (cfg.prefersCloseRange) postLogEvent("WARNING: Klingon vessel closing range — disruptors intensify at close quarters.", 'warn');
  if (cfg.plasmaReloadTime)  postLogEvent(`WARNING: Romulan plasma torpedoes — catastrophic damage, ${cfg.plasmaReloadTime/1000}s reload.`, 'warn');
  if (cfg.canRam)            postLogEvent("WARNING: Jem'Hadar may attempt ramming at low hull — monitor enemy status!", 'crit');
  if (diff.targetsSystems)   postLogEvent(`[${currentDifficulty.toUpperCase()}] Enemy AI targeting player subsystems.`, 'crit');
  postLogEvent("Ablative armour online — 5 layers protecting pressure hull.", 'good');
  postLogEvent("Burst salvo and shield frequency rotation available in tactical panel.", 'info');

  toggleActiveDeck(station);
  buildEnemySubsystemTargetGrid();
  updateCrewStatusDisplay();
  updateWarpAvailability();
  recalculateShieldRegenRate();
  // No extra rAF call needed — the boot loop in runMasterBootSequence is already running
}

// ============================================================
// BOOT SEQUENCE
// ============================================================
function runMasterBootSequence() {
  spatialCanvas = document.getElementById('canvas-spatial-view');   spatialCtx = spatialCanvas ? spatialCanvas.getContext('2d') : null;
  hullCanvas    = document.getElementById('canvas-hull-schematic'); hullCtx    = hullCanvas    ? hullCanvas.getContext('2d')    : null;
  enemyCanvas   = document.getElementById('canvas-enemy-schematic');enemyCtx   = enemyCanvas   ? enemyCanvas.getContext('2d')   : null;
  powerCanvas   = document.getElementById('canvas-power-dist');     powerCtx   = powerCanvas   ? powerCanvas.getContext('2d')   : null;

  window.addEventListener('resize', handleHighDpiCanvasResizing);

  // Populate star field
  for (let i = 0; i < 90; i++) {
    STARS.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, d: Math.random() * 1.5 + 0.5, o: Math.random() });
  }

  setDifficulty('normal');
  rebuildEngineeringMatrixInterface();
  recalculateShieldRegenRate();

  setTimeout(() => {
    refreshEngineeringPanelGraphics();
    synchronizeGlobalInterfaceDisplays();
    handleHighDpiCanvasResizing();
  }, 100);

  requestAnimationFrame(masterSimulationCoreLoop);
}

window.addEventListener('DOMContentLoaded', runMasterBootSequence);
