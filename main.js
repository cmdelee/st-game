'use strict';

// ============================================================
// SHIP SELECTION
// ============================================================
function selectPlayerShip(key) {
  const cfg = PLAYER_SHIP_CONFIGS[key];
  if (!cfg) return;
  G.playerShipKey    = key;
  G.playerShipConfig = cfg;
  G.activeWeaponArrays = cfg.weaponArrays || ARRAYS_DICTIONARY;

  // Update selection button styles
  Object.keys(PLAYER_SHIP_CONFIGS).forEach(k => {
    const btn = document.getElementById(`ship-btn-${k}`);
    if (!btn) return;
    const c = PLAYER_SHIP_CONFIGS[k];
    if (k === key) { btn.style.background = c.accentColor; btn.style.color = k === 'defiant' ? '#000' : '#fff'; }
    else           { btn.style.background = 'var(--dim2)';  btn.style.color = '#aabbcc'; }
  });
  const desc = document.getElementById('ship-desc');
  if (desc) desc.textContent = cfg.description;

  rebuildWeaponFireMatrix();
}

// Rebuild the tactical deck weapon fire and overload button grids based on active ship.
function rebuildWeaponFireMatrix() {
  const isEnt   = G.playerShipKey === 'enterprise_e';
  const fireMat = document.getElementById('weapon-fire-matrix');
  const overMat = document.getElementById('overload-fire-matrix');
  if (!fireMat) return;

  if (isEnt) {
    // Enterprise-E: full 9-array + 5-launcher tactical panel
    fireMat.innerHTML = `
      <button class="pill-action-btn" style="grid-column:span 2;" id="btn-cannons" onclick="fireAllPhaserArrays()">⚡ All Phaser Arrays ×9</button>
      <button class="pill-action-btn p-btn" id="btn-nose"    onclick="fireSelectedArray('emitter_nose')">Primary Emitter <span style="font-size:9px;">[FWD 90]</span></button>
      <button class="pill-action-btn p-btn"                  onclick="fireSelectedArray('phaser_aft_emitter')">Aft Emitter <span style="font-size:9px;">[AFT 55]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('cannon_port_upper')">Saucer Dorsal Fwd <span style="font-size:9px;">[F/P/S]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('phaser_saucer_port')">Saucer Port Array <span style="font-size:9px;">[F/P/A]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('cannon_port_lower')">Saucer Ventral Fwd <span style="font-size:9px;">[F/P/S]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('phaser_saucer_stbd')">Saucer Stbd Array <span style="font-size:9px;">[F/S/A]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('cannon_stbd_upper')">Stardrive Fwd <span style="font-size:9px;">[F/P/S]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('phaser_secondary')">Secondary Hull <span style="font-size:9px;">[F/P/S]</span></button>
      <button class="pill-action-btn"                        onclick="fireSelectedArray('cannon_stbd_lower')">Saucer Aft Arrays <span style="font-size:9px;">[A/P/S]</span></button>
      <button class="pill-action-btn red-btn" style="grid-column:span 1;" id="btn-burst-fire" onclick="executeConcentratedPhaserFire()">⚡⚡ CONCENTRATED FIRE</button>
      <button class="pill-action-btn p-btn" id="btn-quantum"     onclick="fireSelectedArray('torpedo_quantum')">Fwd Quantum A</button>
      <button class="pill-action-btn p-btn"                      onclick="fireSelectedArray('torpedo_quantum_b')">Fwd Quantum B</button>
      <button class="pill-action-btn p-btn" id="btn-photon"      onclick="fireSelectedArray('torpedo_photon')">Fwd Photon <span style="font-size:9px;">[No lock]</span></button>
      <button class="pill-action-btn p-btn" id="btn-quantum-aft" onclick="fireSelectedArray('torpedo_quantum_aft')">Aft Quantum <span style="font-size:9px;">[AFT]</span></button>
      <button class="pill-action-btn"       id="btn-photon-aft"  onclick="fireSelectedArray('torpedo_photon_aft')">Aft Photon <span style="font-size:9px;">[AFT/No lock]</span></button>
      <button class="pill-action-btn warn-btn" id="btn-cloak"    onclick="toggleSaucerSeparation()">◯ SAUCER SEP</button>
      <button class="pill-action-btn"         id="btn-shield-freq" onclick="rotateShieldFrequency()">🛡 ROTATE FREQ</button>
      <button class="pill-action-btn p-btn"   id="btn-evasive"    onclick="executeEvasivePattern()">◈ EVASIVE</button>
      <button class="pill-action-btn red-btn" id="btn-alpha"      onclick="executeAlphaSalvoFire()">ALPHA SALVO</button>
    `;
    if (overMat) overMat.innerHTML = `
      <button class="pill-action-btn red-btn" id="btn-overcharge"    onclick="executeMaxPhaserOutput()">⚡ MAX PHASER OUTPUT<br><span style="font-size:11px;">All phasers +60% · 1 salvo · CD 30s</span></button>
      <button class="pill-action-btn red-btn" id="btn-unstable-torp" onclick="executeTricobalWarhead()">☢ TRICOBALT WARHEAD<br><span style="font-size:11px;">300 yield · No lock · 1 per engagement</span></button>
      <button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-power-dump" onclick="executeEmergencyPowerDump()">⚡⚡ EMERGENCY POWER DUMP — Wpn+40% 10s · EPS spike · Shld−30% · CD 50s</button>
    `;
  } else {
    fireMat.innerHTML = `
      <button class="pill-action-btn" style="grid-column:span 2;" id="btn-cannons" onclick="firePulseCannons()">⚡ All Pulse Cannons ×4</button>
      <button class="pill-action-btn p-btn"  id="btn-nose"        onclick="fireSelectedArray('emitter_nose')">Nose Beam <span style="font-size:9px;">[FWD]</span></button>
      <button class="pill-action-btn p-btn"  id="btn-quantum"     onclick="fireSelectedArray('torpedo_quantum')">Quantum Torpedo</button>
      <button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-burst-fire" onclick="executeBurstFireSalvo()">⚡⚡ BURST SALVO — 4-CANNON BARRAGE</button>
      <button class="pill-action-btn p-btn"  id="btn-photon"      onclick="fireSelectedArray('torpedo_photon')">Photon Torp <span style="font-size:9px;">[No lock]</span></button>
      <button class="pill-action-btn p-btn"  id="btn-quantum-aft" onclick="fireSelectedArray('torpedo_quantum_aft')">Aft Quantum <span style="font-size:9px;">[AFT]</span></button>
      <button class="pill-action-btn"        id="btn-photon-aft"  onclick="fireSelectedArray('torpedo_photon_aft')">Aft Photon <span style="font-size:9px;">[AFT/No lock]</span></button>
      <button class="pill-action-btn warn-btn" id="btn-cloak"     onclick="toggleCloakingDevice()">◉ ENGAGE CLOAK</button>
      <button class="pill-action-btn"         id="btn-shield-freq" onclick="rotateShieldFrequency()">🛡 ROTATE FREQ</button>
      <button class="pill-action-btn p-btn"   id="btn-evasive"    onclick="executeEvasivePattern()">◈ EVASIVE PATTERN</button>
      <button class="pill-action-btn red-btn" style="grid-column:span 1;" id="btn-alpha" onclick="executeAlphaSalvoFire()">ALPHA SALVO — ALL IN ARC</button>
    `;
    if (overMat) overMat.innerHTML = `
      <button class="pill-action-btn red-btn" id="btn-overcharge"    onclick="executeCannonOvercharge()">⚡ OVERCHARGE<br><span style="font-size:11px;">Cannon +50% · Breaker risk · CD 30s</span></button>
      <button class="pill-action-btn red-btn" id="btn-unstable-torp" onclick="executeUnstableTorpedo()">☢ UNSTABLE TORP<br><span style="font-size:11px;">Quantum +70% · Misfire 25% · CD 35s</span></button>
      <button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-power-dump" onclick="executeEmergencyPowerDump()">⚡⚡ EMERGENCY POWER DUMP — Wpn+40% 10s · EPS spike · Shld−30% · CD 50s</button>
    `;
  }

  // Update capacitor bar labels to match active weapon dictionary
  _updateCapacitorBarLabels();
  // Update helm cloak/saucer sep button
  _updateSpecialAbilityButtons();
}

// Update the capacitor bar labels in the tactical deck to match active weapon names.
function _updateCapacitorBarLabels() {
  const arrays = G.activeWeaponArrays;
  if (!arrays) return;
  const tagToKey = { cpu:'cannon_port_upper', cpl:'cannon_port_lower', csu:'cannon_stbd_upper', csl:'cannon_stbd_lower', emn:'emitter_nose', tff:'torpedo_quantum', tph:'torpedo_photon', tqa:'torpedo_quantum_aft', tpa:'torpedo_photon_aft' };
  Object.entries(tagToKey).forEach(([tag, key]) => {
    const weapon = arrays[key]; if (!weapon) return;
    const bar = document.getElementById(`bar-cap-${tag}`); if (!bar) return;
    const row = bar.closest('.bar-row');
    if (row) { const lbl = row.querySelector('.bar-label'); if (lbl) lbl.textContent = weapon.label; }
  });
}

// Update ship-specific buttons across decks (helm cloak/saucer sep, captain label).
function _updateSpecialAbilityButtons() {
  const isEnt = G.playerShipKey === 'enterprise_e';
  // Helm deck
  const helmCloak = document.getElementById('btn-helm-cloak');
  const helmSub   = document.getElementById('btn-helm-cloak-sub');
  if (helmCloak) {
    if (isEnt) { helmCloak.innerHTML = '◯ SAUCER SEP<br><span style="font-size:11px; color:#cc99ff;" id="btn-helm-cloak-sub">Engines ≥20% · CD 50s</span>'; helmCloak.onclick = toggleSaucerSeparation; }
    else       { helmCloak.innerHTML = '◉ ENGAGE CLOAK<br><span style="font-size:11px; color:#cc99ff;" id="btn-helm-cloak-sub">Health ≥20% · CD 25s</span>'; helmCloak.onclick = toggleCloakingDevice; }
  }
  // Captain deck cloak label
  const capCloak = document.getElementById('cap-cloak-label');
  if (capCloak) capCloak.textContent = isEnt ? '◯ Saucer Sep' : '◉ Cloak';
  // Captain chair header
  const capHeader = document.getElementById('captain-chair-header');
  if (capHeader && G.playerShipConfig) capHeader.textContent = `⭐ Captain's Chair — ${G.playerShipConfig.label} ${G.playerShipConfig.registry}`;
  // Captain mini-panel headers (crew names)
  const panelLabels = G.playerShipConfig?.captainPanelLabels || PLAYER_SHIP_CONFIGS.defiant.captainPanelLabels;
  const tacHdr  = document.getElementById('cap-panel-tac-header');  if (tacHdr)  tacHdr.textContent  = panelLabels?.tactical    || '⚡ TACTICAL — WORF';
  const engHdr  = document.getElementById('cap-panel-eng-header');  if (engHdr)  engHdr.textContent  = panelLabels?.engineering || "⚙ ENGINEERING — O'BRIEN";
  const helmHdr = document.getElementById('cap-panel-helm-header'); if (helmHdr) helmHdr.textContent = panelLabels?.helm        || '🚀 HELM — NOG';
  // Apply ship crew stations to CREW_STATIONS (updates casualty tracking names)
  if (G.playerShipConfig?.crewStations) {
    Object.keys(G.playerShipConfig.crewStations).forEach(k => {
      if (CREW_STATIONS[k]) CREW_STATIONS[k].name = G.playerShipConfig.crewStations[k].name;
    });
  }
  // Engineering utility panel ablative and cloak sections
  const ablSection  = document.getElementById('eng-ablative-section');
  const cloakSection = document.getElementById('eng-cloak-section');
  if (ablSection)   ablSection.style.display   = isEnt ? 'none' : '';
  if (cloakSection) cloakSection.style.display = isEnt ? 'none' : '';
  // Ablative armour strip in tactical deck
  const ablStrip = document.getElementById('ablative-armour-strip');
  if (ablStrip) ablStrip.style.display = isEnt ? 'none' : '';
  // Cloak status bar
  const cloakBar = document.getElementById('cloak-status-bar');
  if (cloakBar) cloakBar.style.display = isEnt ? 'none' : '';
  // Right panel cloak power footer label
  const cloakFooterLbl = document.getElementById('lbl-cloak-footer');
  if (cloakFooterLbl) cloakFooterLbl.textContent = isEnt ? 'Saucer Sep Power' : 'Cloak Power';
  // Enterprise-E extra capacitor bars — show/hide
  ['capbar-scp','capbar-scs','capbar-phs','capbar-pae','capbar-tfb'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isEnt ? '' : 'none';
  });
}

// Shared entry point for cloak/saucer-sep from helm panel button.
function activateShipSpecialAbility() {
  if (G.playerShipKey === 'enterprise_e') toggleSaucerSeparation();
  else toggleCloakingDevice();
}

// ============================================================
// SPLASH SCREEN
// ============================================================
function dismissSplash() {
  const splash = document.getElementById('splash-screen');
  const overlay = document.getElementById('overlay');
  splash.classList.add('splash-exit');
  setTimeout(() => {
    splash.style.display = 'none';
    overlay.style.display = 'flex';
  }, 700);
}

// ============================================================
// CAMPAIGN MODE
// ============================================================
function startCampaign(station) {
  G.campaignMode         = true;
  G.campaignStation      = station;
  G.campaignShipKey      = G.playerShipKey;   // persist ship across all 9 levels
  G.campaignLevel        = 0;
  G.campaignScore        = 0;
  G.campaignLevelResults = [];
  _launchCampaignLevel();
}

function _launchCampaignLevel() {
  const entry = CAMPAIGN_ORDER[G.campaignLevel];
  // Save campaign state before initiateVesselSimulation resets G fields
  const savedMode    = G.campaignMode;
  const savedStation = G.campaignStation;
  const savedShipKey = G.campaignShipKey || G.playerShipKey;
  const savedLevel   = G.campaignLevel;
  const savedScore   = G.campaignScore;
  const savedResults = [...(G.campaignLevelResults || [])];

  // Ensure ship selection is correct before init
  selectPlayerShip(savedShipKey);
  setDifficulty(entry.diff);
  initiateVesselSimulation(savedStation);

  // Restore campaign state (initiateVesselSimulation resets score/dead/etc)
  G.campaignMode         = savedMode;
  G.campaignStation      = savedStation;
  G.campaignShipKey      = savedShipKey;
  G.campaignLevel        = savedLevel;
  G.campaignScore        = savedScore;
  G.campaignLevelResults = savedResults;

  // Force the specific archetype and scaled stats for this level
  G.enemyArchetype = entry.archetype;
  const cfg  = ENEMY_CONFIGS[entry.archetype];
  const diff = DIFFICULTY[entry.diff];
  G.enemySystems = {};
  Object.keys(cfg.systems).forEach(k => { G.enemySystems[k] = Object.assign({}, cfg.systems[k]); });
  G.threat.hull              = Math.round(cfg.hull * diff.enemyHullMult);
  G.threat.maxHull           = G.threat.hull;
  G.threat.shields           = Object.assign({}, cfg.shields);
  G.threat.recoveryCoefficient = cfg.recoveryCoefficient;
  G.threat.fireInterval      = Math.round(cfg.fireInterval * diff.enemyFireMult);
  G.threat.lockRate          = cfg.lockRate * diff.enemyLockMult;

  G.running = true; // initiateVesselSimulation leaves G.running = false
  initEncounterPhases();
  _updateCampaignHUD();
}

function _updateCampaignHUD() {
  const hud = document.getElementById('campaign-hud');
  if (!hud) return;
  const entry = CAMPAIGN_ORDER[G.campaignLevel];
  if (!entry || !G.campaignMode) { hud.style.display = 'none'; return; }
  hud.style.display = 'flex';
  const diffCol = { normal: 'var(--green)', hard: 'var(--warn)', elite: 'var(--red)' }[entry.diff] || 'var(--b)';
  hud.innerHTML = `<span style="color:${diffCol};font-weight:bold;">${entry.label}</span><span style="color:#aabbcc;margin:0 8px;">▸</span><span style="color:#fff;">${entry.title}</span><span style="color:#6688aa;margin-left:8px;font-size:10px;">[${G.campaignLevel+1}/9]</span><span style="color:var(--o);margin-left:auto;">CAMPAIGN  +${G.campaignScore}</span>`;
}

function concludeCampaignLevel(victory, escaped) {
  const entry = CAMPAIGN_ORDER[G.campaignLevel];
  const levelScore = calculateFinalScore(victory, escaped).total;
  G.campaignScore += levelScore;
  G.campaignLevelResults.push({
    level:   entry.level,
    title:   entry.title,
    score:   levelScore,
    hullPct: Math.round(G.player.hull / G.player.maxHull * 100),
    time:    Math.round(G.score.timeSurvived),
    won:     victory && !escaped,
    escaped,
  });

  G.dead = true; G.running = false;
  const overlay = document.getElementById('overlay'); overlay.style.display = 'flex';
  const setup   = document.getElementById('setup-controls-anchor'); if (setup) setup.style.display = 'none';
  const diffSec = document.getElementById('campaign-diff-section'); if (diffSec) diffSec.style.display = 'none';
  const scoreDiv = document.getElementById('score-display'); if (scoreDiv) scoreDiv.style.display = 'none';
  const box = document.getElementById('terminal-transcript-box'); if (box) box.style.display = 'none';

  const isLast = G.campaignLevel >= CAMPAIGN_ORDER.length - 1;
  const isLoss = !victory && !escaped;

  const title = document.getElementById('modal-title');
  const desc  = document.getElementById('modal-desc');
  if (title) {
  const _sLabel = (G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).label;
    if (isLoss)       { title.textContent = `${entry.label} — ${_sLabel.toUpperCase()} DESTROYED`; title.style.color = 'var(--red)'; }
    else if (isLast)  { title.textContent = 'CAMPAIGN COMPLETE — SECTOR SECURED'; title.style.color = '#00ffaa'; }
    else if (escaped) { title.textContent = `${entry.label} — DISENGAGED`; title.style.color = 'var(--warn)'; }
    else              { title.textContent = `${entry.label} — ${entry.title.toUpperCase()} DESTROYED`; title.style.color = 'var(--green)'; }
  }
  if (desc) desc.textContent = isLast ? `The Borg threat has been neutralised. ${_sLabel} mission complete.` : isLoss ? `Campaign ended. ${_sLabel} has been destroyed.` : `Enemy vessel destroyed. Preparing for next engagement.`;

  // Show campaign level summary
  const campDiv = document.getElementById('campaign-level-summary');
  if (campDiv) {
    const hullCol = G.player.hull/G.player.maxHull > 0.7 ? 'var(--green)' : G.player.hull/G.player.maxHull > 0.35 ? 'var(--warn)' : 'var(--red)';
    const nextEntry = CAMPAIGN_ORDER[G.campaignLevel + 1];
    campDiv.style.display = 'block';
    campDiv.innerHTML = `
      <div style="font-size:11px;color:#aabbcc;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>This level</span><span style="color:var(--green);font-weight:bold;">+${levelScore}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Hull remaining</span><span style="color:${hullCol};font-weight:bold;">${Math.round(G.player.hull)}/${G.player.maxHull} (${Math.round(G.player.hull/G.player.maxHull*100)}%)</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;border-top:1px solid var(--dim2);margin-top:4px;padding-top:4px;"><span>Campaign total</span><span style="color:var(--o);font-weight:bold;">${G.campaignScore}</span></div>
        ${G.campaignLevelResults.map(r=>`<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:10px;"><span style="color:#6688aa;">L${r.level} ${r.title}</span><span style="color:${r.won?'var(--green)':'var(--warn)'};">${r.won?'✓':r.escaped?'⚡':'✕'} +${r.score}</span></div>`).join('')}
      </div>
      ${!isLoss && !isLast ? `<div style="font-size:11px;color:#aabbcc;margin-top:8px;padding:6px;background:#060c18;border:1px solid var(--dim2);border-radius:4px;">
        <span style="color:var(--o);font-weight:bold;">NEXT: ${nextEntry?.label}</span> — ${nextEntry?.title}<br>
        <span style="font-size:10px;color:#6688aa;">${nextEntry?.subtitle}</span>
      </div>` : ''}
    `;
  }

  // Action buttons
  const actDiv = document.getElementById('campaign-action-btns');
  if (actDiv) {
    actDiv.style.display = 'block';
    if (isLoss) {
      actDiv.innerHTML = `<button class="pill-action-btn warn-btn" style="width:100%;margin-top:8px;padding:10px;" onclick="returnToSetup()">RETURN TO BRIDGE</button>`;
    } else if (isLast) {
      actDiv.innerHTML = `
        <button class="pill-action-btn" style="width:100%;margin-top:8px;padding:10px;background:var(--green);color:#000;" onclick="_restartCampaign()">⭐ RUN CAMPAIGN AGAIN</button>
        <button class="pill-action-btn warn-btn" style="width:100%;margin-top:6px;padding:8px;" onclick="returnToSetup()">RETURN TO BRIDGE</button>
      `;
    } else {
      actDiv.innerHTML = `
        <button class="pill-action-btn" style="width:100%;margin-top:8px;padding:10px;background:var(--o);color:#000;" onclick="_nextCampaignLevel()">⚡ NEXT ENGAGEMENT →</button>
        <button class="pill-action-btn warn-btn" style="width:100%;margin-top:6px;padding:6px;font-size:11px;" onclick="returnToSetup()">ABANDON CAMPAIGN</button>
      `;
    }
  }
  showCloakVulnOverlay(false);
  const sg = document.getElementById('sensor-ghost-overlay'); if (sg) sg.style.display = 'none';
  const mv = document.querySelector('.main-viewport'); if (mv) mv.classList.remove('last-stand-flash');
  const hud = document.getElementById('campaign-hud'); if (hud) hud.style.display = 'none';
}

function _nextCampaignLevel() {
  G.campaignLevel++;
  const campDiv = document.getElementById('campaign-level-summary'); if (campDiv) campDiv.style.display = 'none';
  const actDiv  = document.getElementById('campaign-action-btns');   if (actDiv)  actDiv.style.display  = 'none';
  _launchCampaignLevel(); // handles save/restore of campaign state internally
}

function _restartCampaign() {
  const station = G.campaignStation;
  const campDiv = document.getElementById('campaign-level-summary'); if (campDiv) campDiv.style.display = 'none';
  const actDiv  = document.getElementById('campaign-action-btns');   if (actDiv)  actDiv.style.display  = 'none';
  startCampaign(station);
}

function returnToSetup() {
  // Reset campaign state
  G.campaignMode = false; G.campaignLevel = 0; G.campaignScore = 0; G.campaignLevelResults = [];
  G.dead = false; G.running = false;

  // Hide all end-game / campaign panels
  const scoreDiv = document.getElementById('score-display');          if (scoreDiv) scoreDiv.style.display = 'none';
  const box      = document.getElementById('terminal-transcript-box'); if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  const campDiv  = document.getElementById('campaign-level-summary'); if (campDiv)  campDiv.style.display  = 'none';
  const actDiv   = document.getElementById('campaign-action-btns');   if (actDiv)   actDiv.style.display   = 'none';
  const hud      = document.getElementById('campaign-hud');           if (hud)      hud.style.display      = 'none';

  // Restore overlay to setup state
  const title = document.getElementById('modal-title');
  if (title) { title.textContent = 'STATION DELEGATION ARCHITECTURE'; title.style.color = ''; }
  const desc = document.getElementById('modal-desc');
  if (desc) { desc.textContent = 'Select your operational assignment. The alternative deck matrix will automatically delegate tasks to computer subroutines.'; }
  const setup    = document.getElementById('setup-controls-anchor');  if (setup)    setup.style.display    = '';
  const diffSec  = document.getElementById('campaign-diff-section');  if (diffSec)  diffSec.style.display  = '';

  // Clear lingering overlays
  const mv = document.querySelector('.main-viewport'); if (mv) mv.classList.remove('last-stand-flash');
  showCloakVulnOverlay(false);
  const sg = document.getElementById('sensor-ghost-overlay'); if (sg) sg.style.display = 'none';

  const overlay = document.getElementById('overlay'); if (overlay) overlay.style.display = 'flex';
  setDifficulty(currentDifficulty);
  // Re-apply ship selection button states
  selectPlayerShip(G.playerShipKey || 'defiant');
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
function masterSimulationCoreLoop(ts) {
  if (!G.running || G.dead) { requestAnimationFrame(masterSimulationCoreLoop); return; }
  if (G.lastFrameTimestamp === 0) G.lastFrameTimestamp = ts;
  const dt = Math.min(ts - G.lastFrameTimestamp, 100);
  G.lastFrameTimestamp = ts;
  G.score.timeSurvived += dt / 1000;

  // Shield hit flash timers — must decrement or flash persists forever
  if (G.shieldHitFlash.player.timer > 0) G.shieldHitFlash.player.timer = Math.max(0, G.shieldHitFlash.player.timer - dt);
  if (G.shieldHitFlash.enemy.timer  > 0) G.shieldHitFlash.enemy.timer  = Math.max(0, G.shieldHitFlash.enemy.timer  - dt);

  // Saucer separation timers (Enterprise-E)
  if (G.saucerSepActive) {
    G.saucerSepTimer = Math.max(0, G.saucerSepTimer - dt);
    if (G.saucerSepTimer === 0) {
      G.saucerSepActive = false;
      postLogEvent("Saucer section reconnected — hull sections redocked.", 'good');
      if (typeof updateSaucerSepButton === 'function') updateSaucerSepButton();
    }
  }
  if (G.saucerSepCooldown > 0) {
    G.saucerSepCooldown = Math.max(0, G.saucerSepCooldown - dt);
    if (typeof updateSaucerSepButton === 'function') updateSaucerSepButton();
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

  // Enemy fire cycle — phase multiplier adjusts fire rate per faction arc
  G.threatCycleTimer += dt;
  // Jem'Hadar fury: fire rate scales INVERSELY with hull — they get faster as they die
  const _cfg = ENEMY_CONFIGS[G.enemyArchetype];
  const _jemFury = (_cfg && _cfg.faction === 'Dominion')
    ? Math.max(0.50, 1.0 - (1.0 - G.threat.hull / G.threat.maxHull) * 0.55)
    : 1.0;
  const fi = G.threat.fireInterval * (G.enemyPhaseFireMult || 1.0) * (G.weaponsDisrupted ? 2 : 1) * _jemFury;
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

  // Enemy pool by difficulty
  // Normal: lighter threats only — Vor'Cha excluded (1050 hull + cloak is too punishing for newcomers)
  const normalPool = ['ktinga','romulan_bop','cardassian_scout','galor_class','jem_hadar_fighter'];
  // Hard: full roster including heavyweights; calibrated for experienced players
  const hardPool   = ['ktinga','vor_cha','romulan_bop','romulan_warbird','galor_class','jem_hadar_fighter','jem_hadar_battleship'];
  // Elite: Borg probe ONLY — the adaptation encounter is its own unique challenge tier
  const elitePool  = ['borg_probe'];
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
  G.scanBonus          = null;
  G.activeScanProfile  = null;
  G.scanAnalysisProgress = 0;
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
  });
  // Apply ship-specific system labels and default EPS allocations
  const _shipCfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  Object.entries(_shipCfg.systemLabels).forEach(([k, label]) => { if (G.systems[k]) G.systems[k].label = label; });
  Object.entries(_shipCfg.defaultPower).forEach(([k, pwr])   => { if (G.systems[k]) G.systems[k].allocatedPower = pwr; });
  // Reset saucer separation and tricobalt
  G.saucerSepActive   = false;
  G.saucerSepTimer    = 0;
  G.saucerSepCooldown = 0;
  G.tricobalReady     = true;

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
  G.stardate = 50000 + Math.floor(Math.random() * 5000) + Math.random().toFixed(1) * 1;
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
  if (_sc.hasSaucerSep)           postLogEvent("Saucer separation system ready. Lock rate −60% for 15s — 50s recharge.", 'good');
  postLogEvent(`Quantum torpedoes ×${_sc.torpedoes} and photon torpedoes ×${_sc.photonTorpedoes} loaded.`, 'info');
  postLogEvent(`${_sc.hasCloakDevice ? 'Burst salvo, cloak, shield frequency rotation' : _sc.hasSaucerSep ? 'Concentrated phaser fire, saucer separation, shield frequency' : 'Burst salvo, shield frequency rotation'} and evasive pattern available.`, 'info');
  if (station === 'helm')    postLogEvent("Helm: half impulse — fore attack vector — long engagement range. Auto-tactical and auto-engineering active.", 'info');
  if (station === 'captain') postLogEvent("Captain's Chair: all stations operating under computer delegation. Issue orders via command interface.", 'info');

  toggleActiveDeck(station);
  rebuildWeaponFireMatrix();     // ship-specific weapon buttons + capacitor labels
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
// PRE-BATTLE BRIEFING
// ============================================================
function showPreBattleBriefing() {
  G.preBattleScanProgress = 0;
  G.preBattleTimer        = 0;
  G.preBattleActive       = true;

  const cfg    = ENEMY_CONFIGS[G.enemyArchetype];
  const intel  = MISSION_INTEL[G.enemyArchetype] || {};
  const overlay = document.getElementById('pre-battle-overlay');
  if (!overlay) { startCombat(); return; }

  // Populate static fields
  const sd = document.getElementById('pb-stardate');
  if (sd) sd.textContent = `STARDATE ${G.stardate.toFixed(1)} — ${G.missionContext}`;

  const threat = document.getElementById('pb-threat');
  if (threat) {
    const lvl = intel.threat || 'UNKNOWN';
    threat.textContent = `THREAT: ${lvl}`;
    if (lvl === 'CRITICAL') threat.classList.add('critical');
    else threat.classList.remove('critical');
  }

  const sil = document.getElementById('pb-silhouette');
  if (sil) { sil.textContent = '?'; sil.classList.remove('revealed'); }

  // Reset identity lines
  const faction   = document.getElementById('pb-faction');
  const shipclass = document.getElementById('pb-shipclass');
  const mission   = document.getElementById('pb-mission');
  if (faction)   { faction.textContent   = 'FACTION: [SCANNING...]'; faction.classList.add('classified'); }
  if (shipclass) { shipclass.textContent = 'CLASS: [SCANNING...]';   shipclass.classList.add('classified'); }
  if (mission)   mission.textContent = '';

  // Build intel cards (start all classified)
  const cardsEl = document.getElementById('pb-cards');
  if (cardsEl) {
    cardsEl.innerHTML = (intel.cards || []).map((c, i) => `
      <div class="pb-card" id="pb-card-${i}">
        <div class="pb-card-label">${c.label}</div>
        <div class="pb-card-text" id="pb-cardtext-${i}">
          <span class="pb-card-classified">████ CLASSIFIED ████</span>
        </div>
      </div>`).join('');
  }

  overlay.style.display = 'flex';

  // Tick the briefing each 100ms
  const sessionId = G.gameSessionId;
  const tick = setInterval(() => {
    if (G.gameSessionId !== sessionId || !G.preBattleActive) { clearInterval(tick); return; }

    G.preBattleTimer += 100;
    G.preBattleScanProgress = Math.min(100, (G.preBattleTimer / G.preBattleDuration) * 100);
    const pct = G.preBattleScanProgress;

    // Update scan bar
    const bar = document.getElementById('pb-scan-bar');
    const pctLbl = document.getElementById('pb-scan-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctLbl) pctLbl.textContent = Math.round(pct) + '%';

    // Countdown
    const secs = Math.ceil((G.preBattleDuration - G.preBattleTimer) / 1000);
    const cdLbl = document.getElementById('pb-countdown');
    if (cdLbl) cdLbl.textContent = secs > 0 ? `Auto-engaging in ${secs}s` : 'Engaging...';

    // Progressive identity reveals
    if (pct >= 25 && faction && faction.classList.contains('classified')) {
      faction.textContent = `FACTION: ${cfg.faction.toUpperCase()}`;
      faction.classList.remove('classified');
    }
    if (pct >= 50) {
      if (sil) { sil.textContent = intel.silhouette || '?'; sil.classList.add('revealed'); }
      if (shipclass && shipclass.classList.contains('classified')) {
        shipclass.textContent = `CLASS: ${cfg.label}`;
        shipclass.classList.remove('classified');
      }
      if (mission && !mission.textContent) mission.textContent = G.missionContext;
    }

    // Reveal intel cards by their threshold
    (intel.cards || []).forEach((c, i) => {
      if (pct >= c.revealAt) {
        const card = document.getElementById(`pb-card-${i}`);
        const text = document.getElementById(`pb-cardtext-${i}`);
        if (card && !card.classList.contains('revealed')) {
          card.classList.add('revealed');
          if (text) { text.innerHTML = c.text; text.classList.add('revealed'); }
        }
      }
    });

    // Auto-start at 100%
    if (pct >= 100) { clearInterval(tick); _engageCombat(); }
  }, 100);
}

function engageFromBriefing() {
  // Player clicked BATTLE STATIONS early
  G.preBattleScanProgress = 100;
  _engageCombat();
}

function _engageCombat() {
  G.preBattleActive = false;
  const overlay = document.getElementById('pre-battle-overlay');
  if (overlay) overlay.style.display = 'none';
  startCombat();
}

function startCombat() {
  G.running = true;
  G.lastFrameTimestamp = performance.now();
  initEncounterPhases();
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

  window.addEventListener('resize', handleHighDpiCanvasResizing);

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

  requestAnimationFrame(masterSimulationCoreLoop);
}

window.addEventListener('DOMContentLoaded', runMasterBootSequence);
