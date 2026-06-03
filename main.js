'use strict';

// ============================================================
// SETUP WIZARD / SHIP SELECTION / SPLASH — moved to setup.js
// ============================================================

// ============================================================
// CAMPAIGN MODE — moved to campaign.js
// ============================================================

function returnToSetup() {
  // Kill any active pre-battle briefing timer
  G.preBattleActive = false;
  G.gameSessionId   = (G.gameSessionId || 0) + 1;
  const pbOverlay = document.getElementById('pre-battle-overlay');
  if (pbOverlay) pbOverlay.style.display = 'none';

  // Reset campaign + game state
  G.campaignMode = false; G.campaignLevel = 0; G.campaignScore = 0; G.campaignLevelResults = [];
  G.dead = false; G.running = false;

  // Hide all end-game / campaign panels
  const scoreDiv  = document.getElementById('score-display');           if (scoreDiv)  scoreDiv.style.display  = 'none';
  const box       = document.getElementById('terminal-transcript-box'); if (box)  { box.style.display = 'none'; box.innerHTML = ''; box.style.height = ''; box.style.maxHeight = ''; }
  const actionsEl = document.getElementById('end-game-actions');        if (actionsEl) actionsEl.style.display = 'none';
  const campDiv   = document.getElementById('campaign-level-summary');  if (campDiv)   campDiv.style.display   = 'none';
  const actDiv    = document.getElementById('campaign-action-btns');    if (actDiv)    actDiv.style.display    = 'none';
  const hud       = document.getElementById('campaign-hud');            if (hud)       hud.style.display       = 'none';

  // Reset wizard to step 1
  _setupReset();
  setDifficulty(currentDifficulty);

  // Clear lingering overlays
  const mv = document.querySelector('.main-viewport'); if (mv) mv.classList.remove('last-stand-flash');
  showCloakVulnOverlay(false);
  const sg = document.getElementById('sensor-ghost-overlay'); if (sg) sg.style.display = 'none';

  const overlay = document.getElementById('overlay'); if (overlay) overlay.style.display = 'flex';
  // Scroll modal back to top so wizard step 1 is visible (score may have pushed it down)
  const modalBox = document.querySelector('.modal-frame-box');
  if (modalBox) modalBox.scrollTop = 0;
  // Re-apply ship selection button states (ship-desc, button highlights)
  selectPlayerShip(G.playerShipKey || 'defiant');
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
function masterSimulationCoreLoop(ts) {
  if (!G.running || G.dead) return; // loop re-entered by startCombat() when game begins
  if (G.lastFrameTimestamp === 0) G.lastFrameTimestamp = ts;
  const dt = Math.min(ts - G.lastFrameTimestamp, 100);
  G.lastFrameTimestamp = ts;
  G.score.timeSurvived += dt / 1000;

  // Shield hit flash timers — must decrement or flash persists forever
  if (G.shieldHitFlash.player.timer > 0) G.shieldHitFlash.player.timer = Math.max(0, G.shieldHitFlash.player.timer - dt);
  if (G.shieldHitFlash.enemy.timer  > 0) G.shieldHitFlash.enemy.timer  = Math.max(0, G.shieldHitFlash.enemy.timer  - dt);

  // Saucer separation timers (Enterprise-E)
  if (G.saucerSepReconnecting) {
    G.saucerSepReconnectTimer = Math.max(0, G.saucerSepReconnectTimer - dt);
    if (G.saucerSepReconnectTimer === 0) {
      // Docking complete — restore saucer systems, start cooldown
      G.saucerSepActive       = false;
      G.saucerSepReconnecting = false;
      G.saucerSepCooldown     = 60000;  // 60s — major structural operation
      postLogEvent("Saucer section reconnected. All phaser arrays restored. 60s recharge.", 'good');
      postCrewReport('nog', "Docking complete, Captain. All sections secured.", 'good');
      if (typeof updateSaucerSepButton === 'function') updateSaucerSepButton();
    } else {
      if (typeof updateSaucerSepButton === 'function') updateSaucerSepButton();
    }
  }
  if (G.saucerSepCooldown > 0) {
    G.saucerSepCooldown = Math.max(0, G.saucerSepCooldown - dt);
    if (G.saucerSepCooldown === 0 && typeof updateSaucerSepButton === 'function') updateSaucerSepButton();
  }

  // Saucer section autonomous fire — active while separated (not during docking sequence)
  if (G.saucerSepActive && !G.saucerSepReconnecting && G.running) {
    G.saucerAutoFireTimer -= dt;
    if (G.saucerAutoFireTimer <= 0) {
      G.saucerAutoFireTimer = 9000 + Math.random() * 4000;  // 9–13s between shots
      if (typeof fireSaucerAutomatic === 'function') fireSaucerAutomatic();
    }
  } else if (!G.saucerSepActive) {
    G.saucerAutoFireTimer = 10000;  // reset when not separated
  }

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
      SHIELD_SECTORS.forEach(s => {
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
  tickCaptainCooldowns(dt);
  tickCaptainPeriodicReports(dt);
  tickCaptainManoeuvres(dt);

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

  // Deep scan progress + Borg scan expiry
  processDeepScan(dt);

  // Enemy hull slow natural recovery
  G.threat.hull = Math.min(G.threat.maxHull, G.threat.hull + G.threat.recoveryCoefficient * (dt / 1000));

  // Enemy fire cycle — phase multiplier adjusts fire rate per faction arc
  G.threatCycleTimer += dt;
  // Jem'Hadar fury: fire rate scales INVERSELY with hull — they get faster as they die
  const _cfg = ENEMY_CONFIGS[G.enemyArchetype];
  const _jemFury = (_cfg && _cfg.faction === 'Dominion')
    ? Math.max(0.50, 1.0 - (1.0 - G.threat.hull / G.threat.maxHull) * 0.55)
    : 1.0;
  const fi = getEffectiveFireInterval() * (G.enemyPhaseFireMult || 1.0) * (G.weaponsDisrupted ? 2 : 1) * _jemFury;
  if (G.threatCycleTimer > fi) { G.threatCycleTimer = 0; executeThreatCounterVolley(); }


  updateWarpAvailability();
  checkLastStandCondition();
  synchronizeGlobalInterfaceDisplays();

  // Canvas rendering — helm and captain share the tactical monitor pair
  if (G.activePanel === 'tactical' || G.activePanel === 'helm' || G.activePanel === 'captain') {
    renderSpatialViewCanvas();
    renderEnemySchematicCanvas();
  } else {
    renderHullSchematicCanvas();
    renderPowerDistributionCanvas();
  }

  // Low hull advisory for captain
  if (G.playerChosenStation === 'captain' && !G._captainLowHullReported &&
      G.player.hull / G.player.maxHull <= 0.35) {
    G._captainLowHullReported = true;
    crewReportLowHull();
  }
  if (G.player.hull / G.player.maxHull > 0.40) G._captainLowHullReported = false;

  requestAnimationFrame(masterSimulationCoreLoop);
}

// ============================================================
// SIMULATION INIT
// ============================================================
function initiateVesselSimulation(station) {
  G.playerChosenStation = station;
  const diff = DIFFICULTY[currentDifficulty];

  // Campaign mode: archetype was set by _launchCampaignLevel before this call — preserve it
  if (!G.campaignMode) {
    // Enemy pool by difficulty
    // Normal: lighter threats only — Vor'Cha excluded (1050 hull + cloak is too punishing for newcomers)
    const normalPool = ['ktinga','romulan_bop','cardassian_scout','galor_class','jem_hadar_fighter'];
    // Hard: full roster including heavyweights; calibrated for experienced players
    const hardPool   = ['ktinga','vor_cha','romulan_bop','romulan_warbird','galor_class','jem_hadar_fighter','jem_hadar_battleship'];
    // Elite: Borg probe ONLY — the adaptation encounter is its own unique challenge tier
    const elitePool  = ['borg_probe'];
    const pool = currentDifficulty === 'elite' ? elitePool : currentDifficulty === 'hard' ? hardPool : normalPool;
    G.enemyArchetype = pool[Math.floor(Math.random() * pool.length)];
  }

  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // Deep-copy enemy systems
  G.enemySystems = {};
  Object.keys(cfg.systems).forEach(k => { G.enemySystems[k] = Object.assign({}, cfg.systems[k]); });

  // Apply difficulty multipliers
  G.threat.hull         = Math.round(cfg.hull * diff.enemyHullMult);
  G.threat.maxHull      = G.threat.hull;
  G.threat.shields      = Object.assign({}, cfg.shields);
  G.threat.recoveryCoefficient = cfg.recoveryCoefficient;
  // G.threat.fireInterval removed — use getEffectiveFireInterval() (derived from config × difficulty × modifiers)
  G.threat.lockRate     = cfg.lockRate * diff.enemyLockMult;
  const shipCfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  G.player.hull         = Math.round(shipCfg.hull * diff.playerHullMult);
  G.player.maxHull      = G.player.hull;
  // Reset shields and torpedoes from ship config
  G.player.torpedoes          = shipCfg.torpedoes;
  G.player.maxTorpedoes       = shipCfg.torpedoes;
  G.player.photonTorpedoes    = shipCfg.photonTorpedoes;
  G.player.maxPhotonTorpedoes = shipCfg.photonTorpedoes;
  G.player.shields = Object.assign({}, shipCfg.shields);

  // Reset ablative armour — 6 layers
  G.ablative = { layers:6, layerHealth:[100,100,100,100,100,100], regenTimers:[0,0,0,0,0,0], regenProgress:[0,0,0,0,0,0] };

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
  G.helmSpeed                = 'half';
  G.helmAttackVector         = 'fore';
  G.playerRangeBracket       = 'long';
  G.attackRunActive          = false;
  G.attackRunTimer           = 0;
  G.attackRunCooldown        = 0;
  G.comeAboutActive          = false;
  G.comeAboutTimer           = 0;
  G.comeAboutCooldown        = 0;
  G.picardManoeuverActive    = false;
  G.picardManoeuverTimer     = 0;
  G.picardManoeuverCooldown  = 0;
  G.attackPatternOmegaActive = false;
  G.attackPatternOmegaTimer  = 0;
  G.attackPatternOmegaCooldown = 0;
  G.evasiveAlphaActive       = false;
  G.evasiveAlphaTimer        = 0;
  G.evasiveAlphaCooldown     = 0;
  G.evasiveActive            = false;
  G.evasiveCooldown          = 0;
  G.enemyPhase               = '';
  G.enemyPhaseIndex          = 0;
  G.enemyPhaseTimer          = 0;
  G.enemyPhaseFireMult       = 1.0;
  G.enemyPhaseLockMult       = 1.0;
  G.holdFire                 = false;
  G.holdFireTimer            = 0;
  G.autoShieldTrack          = false;
  G.autoShieldTrackTimer     = 0;
  G.silentRunning            = false;
  G.silentRunningTimer       = 0;
  G.epsHeat                  = 0;
  G.shieldTransferInProgress = false;
  G.lastPlayerFireTime       = 0;
  G.overchargeReady          = true;
  G.overchargeCooldown       = 0;
  G.unstableTorpReady        = true;
  G.unstableTorpCooldown     = 0;
  G.powerDumpActive          = false;
  G.powerDumpTimer           = 0;
  G.powerDumpReady           = true;
  G.powerDumpCooldown        = 0;
  G.enemyAdaptiveResist      = { cannon_pu:0, cannon_pl:0, cannon_su:0, cannon_sl:0, nose_beam:0, torpedoes:0, photon:0 };
  G.enemyAdaptiveHits        = 0;
  G.borgEscalationLevel      = 0;

  // Item 1 — Full state reset between games (crew, score, queues, timers, misc)
  // Apply ship-specific crew names before resetting status
  const _crewCfg = (G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).crewStations || {};
  Object.keys(CREW_STATIONS).forEach(k => {
    if (_crewCfg[k]) CREW_STATIONS[k].name = _crewCfg[k].name;
    CREW_STATIONS[k].status = 'nominal';
    CREW_STATIONS[k].casualties = 0;
  });
  G.score              = { totalDmgDealt:0, volleysFired:0, hullBreaches:0, systemsDestroyed:0, repairsCompleted:0, timeSurvived:0, warpedOut:false,
                           weaponsFired:{ cannons:0, nose:0, quantum:0, photon:0 },
                           sectorBreaches:{ fore:0, port:0, starboard:0, aft:0 },
                           peakHullHit:0, systemsTripped:[], enemyPhaseReached:'' };
  G.lastStandActive         = false;
  G.lastStandReported       = false;
  G.enemyHullMilestones     = {};
  G.crewReports             = [];
  G._captainLowHullReported = false;
  G.cloakEngagedAt          = 0;
  G.enemyCloakEngagedAt     = 0;
  G.frozenShields           = { fore:0, port:0, starboard:0, aft:0 };
  G.enemyFrozenShields      = { fore:0, port:0, starboard:0, aft:0 };
  G.repairQueue        = [];
  G.enemyRepairQueue   = [];  // clear stale entries from previous game
  G.repairTeams        = [
    { sysKey:null, label:'', totalTime:0, remaining:0 },
    { sysKey:null, label:'', totalTime:0, remaining:0 },
  ];
  G.batteryCharge      = 100;
  G.batteryActive      = false;
  G.inFlightTorpedoes  = [];
  G.renderedBeamsVector = [];
  G.shieldHitFlash     = { player:{ sector:null, timer:0 }, enemy:{ sector:null, timer:0 } };
  G.damageParticles    = [];
  G.lockProgress       = 0;
  G.enemyLockProgress  = 0;
  G.weaponsDisrupted   = false;
  G.weaponsDisruptedTimer = 0;
  G.scanBonus             = null;
  G.activeScanProfile     = null;
  G.scanAnalysisProgress  = 0;
  G.permanentScanBonuses  = {};
  G.deepScanActive        = false;
  G.deepScanProgress      = 0;
  G.deepScanCooldown      = 0;
  G.fireAtWill            = false;
  G.activeScanningProfile = false;   // active scanner toggle — not reset elsewhere
  G.captainOrderCooldowns = {};      // stale CDs persist between games otherwise
  // Refresh scan UI so results/button from previous game are cleared
  if (typeof _updateDeepScanButton === 'function') _updateDeepScanButton();
  if (typeof _renderScanResults    === 'function') _renderScanResults();
  G.sensorGhostActive  = false;
  G.sensorGhostTimer   = 0;
  G.enemyTractorActive = false;
  G.cloaked            = false;
  G.cloakCooldown      = 0;
  G.cloakVulnTimer     = 0;
  G.cloakPowerReserve  = 100;
  G.enemyCloaked       = false;
  G.enemyCloakCooldown = 0;
  G.enemyCloakVulnTimer = 0;
  G.enemyCloakPower    = 100;
  G.enemyManeuverState = 'neutral';
  G.enemyManeuverTimer = 0;
  G.enemyManeuverThreshold = 9000;
  G.enemyPreferredSector = 'fore';
  G.threatCycleTimer   = 0;
  G.shieldUnderAttackTimer = 0;
  G.historicalLogTracks = [];
  // Reset all player systems to full health
  Object.keys(G.systems).forEach(k => {
    G.systems[k].health = 100;
    G.systems[k].stress = 0;
    G.systems[k].tripped = false;
    G.systems[k].cap = 100;
    if (G.systems[k].aftCap !== undefined) G.systems[k].aftCap = 100;
  });
  // Apply ship-specific system labels and default EPS allocations
  const _shipCfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  Object.entries(_shipCfg.systemLabels).forEach(([k, label]) => { if (G.systems[k]) G.systems[k].label = label; });
  Object.entries(_shipCfg.defaultPower).forEach(([k, pwr])   => { if (G.systems[k]) G.systems[k].allocatedPower = pwr; });
  // Reset saucer separation and tricobalt
  G.saucerSepActive         = false;
  G.saucerSepReconnecting   = false;
  G.saucerSepReconnectTimer = 0;
  G.saucerSepCooldown       = 0;
  G.saucerAutoFireTimer     = 10000;
  G.tricobalReady        = true;
  G.maxPulseBurstReady   = true;   // Defiant 1/engagement special ability

  G.dead               = false;   // latent fix: ensures G.dead cleared if play-again ever added
  G.running            = false;   // will be set true after overlay hidden
  G.lastFrameTimestamp = 0;
  G.autoTacticalFireClock = 0;
  G.gameSessionId      = (G.gameSessionId || 0) + 1; // guards async intervals from prior game

  // Bug 4: clear transcript box for fresh game
  const txBox = document.getElementById('terminal-transcript-box');
  if (txBox) { txBox.innerHTML = ''; txBox.style.display = 'none'; }
  // Also restore score display visibility for future games
  const scoreDiv = document.getElementById('score-display');
  if (scoreDiv) scoreDiv.style.display = 'none';

  // Hide the startup overlay
  document.getElementById('overlay').style.display = 'none';

  // G.running is set true by startCombat() after the pre-battle briefing

  // Item 1: Generate stardate and mission context
  G.stardate = 50000 + Math.floor(Math.random() * 5000) + parseFloat(Math.random().toFixed(1));
  const missionContexts = {
    ktinga:               ["K'Tinga battle cruiser challenging the Bajoran corridor.", "Klingon patrol contesting approach to DS9.", "K'Tinga intercepted on disputed border patrol.", "Klingon vessel denying access to Federation outpost."],
    vor_cha:              ["Vor'Cha attack cruiser blocking supply route to Bajor.", "Klingon warship pursuing a damaged freighter.", "Vor'Cha intercepted near Cardassian border.", "Klingon cruiser challenging DS9 defence perimeter."],
    romulan_bop:          ["Romulan Bird-of-Prey in Federation space — intentions hostile.", "Romulan vessel decloaking near Bajoran wormhole.", "Bird-of-Prey intercepted on intelligence-gathering mission.", "Romulan scout challenging Defiant's patrol route."],
    romulan_warbird:      ["D'Deridex warbird enforcing contested Romulan border claim.", "Romulan warbird interdicting Federation supply convoy.", "D'Deridex on show-of-force mission near Cardassian space.", "Romulan warbird decloaking — diplomatic contact failed."],
    cardassian_scout:     ["Cardassian scout harassing Bajoran civilian traffic.", "Cardassian vessel in restricted Bajoran space — refuses to withdraw.", "Scout ship challenging Defiant's approach to DS9.", "Cardassian patrol contesting wormhole access rights."],
    galor_class:          ["Galor-class warship blockading a Bajoran colony.", "Cardassian warship intercepted running weapons to dissidents.", "Galor pursuing a Federation runabout into hostile space.", "Cardassian warship contesting the demilitarised zone."],
    jem_hadar_fighter:    ["Jem'Hadar attack ship engaging Defiant on patrol.", "Dominion fighter challenging DS9 approach vector.", "Jem'Hadar intercepted near the wormhole — Dominion provocation.", "Dominion attack ship pursuing a Bajoran transport."],
    jem_hadar_battleship: ["Jem'Hadar battle cruiser engaging Defiant in the Gamma Quadrant.", "Dominion warship interdicting Federation access to the wormhole.", "Jem'Hadar battle cruiser on punitive mission — Dominion retaliation.", "Elite Dominion warship — Founders' direct orders to destroy DS9."],
    borg_probe:           ["Borg probe on intercept course — assimilation imminent.", "Borg vessel scanning DS9 for tactical data.", "Borg probe detected in Bajoran space — resistance is not futile.", "Borg probe intercepted before it reaches DS9 — time critical."],
  };
  const contexts = missionContexts[G.enemyArchetype] || [`${cfg.label} intercepted in Federation space.`];
  G.missionContext = contexts[Math.floor(Math.random() * contexts.length)];

  // Update header stardate display
  const sdEl = document.getElementById('lbl-stardate'); if (sdEl) sdEl.textContent = `STARDATE ${G.stardate.toFixed(1)}`;
  const mcEl = document.getElementById('lbl-mission-context'); if (mcEl) mcEl.textContent = G.missionContext;

  // Enemy label
  const aiLbl = document.getElementById('lbl-ai-archetype'); if (aiLbl) aiLbl.textContent = cfg.label;
  // Rebuild Three.js enemy mesh for new archetype
  rebuildEnemyMesh();
  rebuildPlayerMesh();    // swap Defiant ↔ Sovereign-class mesh

  // Boot log
  const _sc = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  postLogEvent(`[${currentDifficulty.toUpperCase()}] ${cfg.label} (${cfg.faction}) — engaging.`, 'warn');
  postLogEvent(`Vessel: ${_sc.label} ${_sc.registry} (${_sc.shipClass}).`, 'good');
  if (cfg.hasCloakDevice)    postLogEvent("WARNING: Enemy has cloaking capability.", 'crit');
  if (cfg.polaronWeapons)    postLogEvent("WARNING: Polaron weapons detected — bypass 30% of shields.", 'crit');
  if (cfg.adaptiveShields)   postLogEvent("WARNING: Borg adaptive shielding — switch weapons frequently.", 'crit');
  if (cfg.hasSensorGhosts)   postLogEvent("Romulan vessel detected — expect false sensor contacts.", 'warn');
  if (cfg.prefersCloseRange) postLogEvent("WARNING: Klingon vessel closing range — disruptors intensify at close quarters.", 'warn');
  if (cfg.plasmaReloadTime)  postLogEvent(`WARNING: Romulan plasma torpedoes — catastrophic damage, ${cfg.plasmaReloadTime/1000}s reload.`, 'warn');
  if (cfg.canRam)            postLogEvent("WARNING: Jem'Hadar may attempt ramming at low hull — monitor enemy status!", 'crit');
  if (diff.targetsSystems)   postLogEvent(`[${currentDifficulty.toUpperCase()}] Enemy AI targeting player subsystems.`, 'crit');
  if (_sc.hasAblativeArmour)      postLogEvent("Ablative armour online — 6 layers protecting pressure hull.", 'good');
  if (_sc.hasRegenerativeShields) postLogEvent("Regenerative shielding online — shields recover 40% faster.", 'good');
  if (_sc.hasSaucerSep)           postLogEvent("Saucer separation ready. Saucer section stands by — stardrive fights independently until you order reconnect.", 'good');
  postLogEvent(`Quantum torpedoes ×${_sc.torpedoes} and photon torpedoes ×${_sc.photonTorpedoes} loaded.`, 'info');
  postLogEvent(`${_sc.hasCloakDevice ? 'Burst salvo, cloak, shield frequency rotation' : _sc.hasSaucerSep ? 'Concentrated phaser fire, saucer separation, shield frequency' : 'Burst salvo, shield frequency rotation'} and evasive pattern available.`, 'info');
  if (station === 'helm')    postLogEvent("Helm: half impulse — fore attack vector — long engagement range. Auto-tactical and auto-engineering active.", 'info');
  if (station === 'captain') postLogEvent("Captain's Chair: all stations operating under computer delegation. Issue orders via command interface.", 'info');

  toggleActiveDeck(station);
  rebuildWeaponFireMatrix();     // ship-specific weapon buttons + capacitor labels
  _buildELCache();               // prime DOM element cache for hot paths
  _rebuildCapBarCache();         // cache newly-built cap bar elements
  _updateSpecialAbilityButtons(); // helm/captain cloak↔saucer-sep labels
  buildEnemySubsystemTargetGrid();
  updateCrewStatusDisplay();
  updateWarpAvailability();
  recalculateShieldRegenRate();
  if (station === 'captain') initCaptainStation();

  // Show pre-battle briefing before starting combat
  showPreBattleBriefing();
}

// ============================================================
// PRE-BATTLE BRIEFING — moved to briefing.js
// ============================================================

// ============================================================
// VIEWPORT RESIZE — handles window resize + orientation change
// ============================================================
function _onViewportResize() {
  handleHighDpiCanvasResizing();
  resizeThreeRenderer();
  // On mobile, close any open slide panels so they reposition correctly
  if (window.innerWidth > 768) {
    closeMobilePanels();
  }
}

// ============================================================
// BOOT SEQUENCE
// ============================================================
function runMasterBootSequence() {
  // Three.js spatial view replaces the old 2D canvas-spatial-view
  initThreeScene();

  // 2D canvases for engineering views only
  hullCanvas    = document.getElementById('canvas-hull-schematic'); hullCtx    = hullCanvas    ? hullCanvas.getContext('2d')    : null;
  enemyCanvas   = document.getElementById('canvas-enemy-schematic');enemyCtx   = enemyCanvas   ? enemyCanvas.getContext('2d')   : null;
  powerCanvas   = document.getElementById('canvas-power-dist');     powerCtx   = powerCanvas   ? powerCanvas.getContext('2d')   : null;

  window.addEventListener('resize', _onViewportResize);
  window.addEventListener('orientationchange', () => { setTimeout(_onViewportResize, 200); });

  // Populate star field
  for (let i = 0; i < 90; i++) {
    STARS.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, d: Math.random() * 1.5 + 0.5, o: Math.random() });
  }

  // Initialize ship selection (Defiant default)
  selectPlayerShip('defiant');
  setDifficulty('normal');
  rebuildEngineeringMatrixInterface();
  recalculateShieldRegenRate();

  setTimeout(() => {
    refreshEngineeringPanelGraphics();
    synchronizeGlobalInterfaceDisplays();
    handleHighDpiCanvasResizing();
  }, 100);
  // Loop is re-entered by startCombat() when combat begins — no need to prime it here
}

window.addEventListener('DOMContentLoaded', runMasterBootSequence);
