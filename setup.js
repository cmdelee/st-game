'use strict';

// ============================================================
// SETUP.JS — Setup wizard, ship selection, weapon-matrix builders, splash
// Split out of main.js. Builds the tactical fire/overload button grids and
// capacitor-bar layout per active ship; drives the pre-game setup wizard.
// Calls into main.js (initiateVesselSimulation) and campaign.js (startCampaign)
// at runtime, so relative load order with those is flexible.
// ============================================================

// ============================================================
// SETUP WIZARD STATE
// _wizardMode: 'single' | 'campaign'
// _wizardStation: 'tactical' | 'engineering' | 'helm' | 'captain'
// ============================================================
window._wizardMode    = 'single';
window._wizardStation = 'tactical';

const _STATION_LABELS = { tactical:'TACTICAL', engineering:'ENGINEERING', helm:'HELM', captain:"CAPTAIN'S CHAIR" };

function showInstructions() {
  const el = document.getElementById('instructions-overlay');
  if (el) el.style.display = 'block';
}

function hideInstructions() {
  const el = document.getElementById('instructions-overlay');
  if (el) el.style.display = 'none';
}

function _setupGoMode(mode) {
  window._wizardMode = mode;
  document.getElementById('setup-step-mode').style.display      = 'none';
  document.getElementById('setup-step-configure').style.display = '';
  const badge = document.getElementById('setup-mode-badge');
  if (badge) badge.textContent = mode === 'campaign' ? '🏆 CAMPAIGN RUN' : '⚔ SINGLE ENGAGEMENT';
}

function _setupPickStation(station) {
  window._wizardStation = station;
  document.getElementById('setup-step-configure').style.display = 'none';
  if (window._wizardMode === 'campaign') {
    document.getElementById('setup-step-campaign').style.display = '';
    const badge = document.getElementById('setup-campaign-badge');
    if (badge) badge.textContent = `${_STATION_LABELS[station]} · ${(G.playerShipConfig||PLAYER_SHIP_CONFIGS.defiant).label}`;
  } else {
    document.getElementById('setup-step-single').style.display = '';
    const badge = document.getElementById('setup-single-badge');
    if (badge) badge.textContent = `${_STATION_LABELS[station]} · ${(G.playerShipConfig||PLAYER_SHIP_CONFIGS.defiant).label}`;
    setDifficulty(currentDifficulty); // refresh diff buttons
  }
}

function _setupBack(targetStep) {
  document.getElementById('setup-step-configure').style.display = 'none';
  document.getElementById('setup-step-single').style.display    = 'none';
  document.getElementById('setup-step-campaign').style.display  = 'none';
  document.getElementById('setup-step-mode').style.display      = 'none';
  document.getElementById(`setup-step-${targetStep}`).style.display = '';
}

function _setupReset() {
  document.getElementById('setup-step-mode').style.display      = '';
  document.getElementById('setup-step-configure').style.display = 'none';
  document.getElementById('setup-step-single').style.display    = 'none';
  document.getElementById('setup-step-campaign').style.display  = 'none';
}

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
  if (typeof _rebuildCapBarCache === 'function') _rebuildCapBarCache();
}

// Rebuild the tactical deck weapon fire and overload button grids based on active ship.
function rebuildWeaponFireMatrix() {
  const isEnt   = G.playerShipKey === 'enterprise_e';
  const fireMat = document.getElementById('weapon-fire-matrix');
  const overMat = document.getElementById('overload-fire-matrix');
  if (!fireMat) return;

  const energyLabel = isEnt ? '⚡ FIRE PHASERS' : '⚡ FIRE CANNONS';
  const burstBtn    = isEnt
    ? `<button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-burst-fire" onclick="executeConcentratedPhaserFire()">⚡⚡ CONCENTRATED FIRE</button>`
    : `<button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-burst-fire" onclick="executeBurstFireSalvo()">⚡⚡ BURST SALVO</button>`;
  const specialBtn  = isEnt
    ? `<button class="pill-action-btn warn-btn" id="btn-cloak" onclick="toggleSaucerSeparation()">◯ SAUCER SEP</button>`
    : `<button class="pill-action-btn warn-btn" id="btn-cloak" onclick="toggleCloakingDevice()">◉ CLOAK</button>`;

  fireMat.innerHTML = `
    <button class="pill-action-btn" id="btn-cannons"  onclick="fireEnergyWeapons()">${energyLabel}</button>
    <button class="pill-action-btn p-btn"              onclick="fireTorpedoBanks()">⬟ FIRE TORPEDOES</button>
    <button class="pill-action-btn green-btn" style="grid-column:span 2;" id="btn-alpha" onclick="fireAllWeapons()">⚡⚡ FIRE ALL — ENERGY + TORPS IN ARC</button>
    ${burstBtn}
    ${specialBtn}
    <button class="pill-action-btn p-btn" id="btn-evasive" onclick="executeEvasivePattern()">◈ EVASIVE</button>
  `;

  if (overMat) {
    if (isEnt) {
      overMat.innerHTML = `
        <button class="pill-action-btn red-btn" id="btn-overcharge"    onclick="executeMaxPhaserOutput()">⚡ MAX PHASER OUTPUT<br><span style="font-size:11px;">All phasers +60% · 1 salvo · CD 30s</span></button>
        <button class="pill-action-btn red-btn" id="btn-unstable-torp" onclick="executeTricobalWarhead()">☢ TRICOBALT WARHEAD<br><span style="font-size:11px;">300 yield · No lock · 1 per engagement</span></button>
        <button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-power-dump" onclick="executeEmergencyPowerDump()">⚡⚡ EMERGENCY POWER DUMP — Wpn+40% 10s · EPS spike · Shld−30% · CD 50s</button>
      `;
    } else {
      overMat.innerHTML = `
        <button class="pill-action-btn red-btn" id="btn-overcharge"    onclick="executeCannonOvercharge()">⚡ OVERCHARGE<br><span style="font-size:11px;">Cannon +50% · Breaker risk · CD 30s</span></button>
        <button class="pill-action-btn red-btn" id="btn-unstable-torp" onclick="executeUnstableTorpedo()">☢ UNSTABLE TORP<br><span style="font-size:11px;">Quantum +70% · Misfire 25% · CD 35s</span></button>
        <button class="pill-action-btn red-btn" id="btn-max-pulse-burst" onclick="executeMaximumPulseBurst()" style="border:2px solid var(--warn);">⚡⚡⚡ MAX PULSE BURST<br><span style="font-size:11px;color:#ffcc00;">4-cannon 3-volley · +80% · Arc-free · 1/engagement</span></button>
        <button class="pill-action-btn red-btn" style="grid-column:span 2;" id="btn-power-dump" onclick="executeEmergencyPowerDump()">⚡⚡ EMERGENCY POWER DUMP — Wpn+40% 10s · EPS spike · Shld−30% · CD 50s</button>
      `;
    }
  }

  // Rebuild capacitor bar grid layout for active ship
  _rebuildCapBarGrid();
  if (typeof _rebuildCapBarCache === 'function') _rebuildCapBarCache();
  // Update capacitor bar labels to match active weapon dictionary
  _updateCapacitorBarLabels();
  // Update helm cloak/saucer sep button
  _updateSpecialAbilityButtons();
}

// Rebuild the capacitor bar grid section for the active ship.
// Defiant: original 2-column layout, 9 bars.
// Enterprise-E: compact 3-column layout, 6 system-level bars
//   (one per weapon system — multiple arrays sharing a system have identical cap%).
function _rebuildCapBarGrid() {
  const grid = document.getElementById('cap-bar-grid');
  if (!grid) return;
  const isEnt = G.playerShipKey === 'enterprise_e';

  if (isEnt) {
    const bar = (id, label, col) =>
      `<div class="bar-row"><span class="bar-label" style="width:82px;font-size:9px;">${label}</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-${id}" style="color:${col};"></div></div><span class="bar-val" id="txt-cap-${id}">100%</span></div>`;
    grid.style.gridTemplateColumns = '1fr 1fr 1fr';
    grid.innerHTML = `
      <div>
        ${bar('cpu','Saucer Dorsal','var(--b)')}
        ${bar('cpl','Saucer Ventral','var(--b)')}
      </div>
      <div>
        ${bar('csu','Stardrive Fwd','var(--b)')}
        ${bar('csl','Saucer Rim/Aft','var(--b)')}
      </div>
      <div>
        ${bar('emn','Emitter Banks','var(--p)')}
        ${bar('tff','Torpedo Systems','var(--t)')}
      </div>
      <div style="display:none">
        <span id="bar-cap-scp"></span><span id="txt-cap-scp"></span>
        <span id="bar-cap-scs"></span><span id="txt-cap-scs"></span>
        <span id="bar-cap-phs"></span><span id="txt-cap-phs"></span>
        <span id="bar-cap-pae"></span><span id="txt-cap-pae"></span>
        <span id="bar-cap-tfb"></span><span id="txt-cap-tfb"></span>
        <span id="bar-cap-tph"></span><span id="txt-cap-tph"></span>
        <span id="bar-cap-tqa"></span><span id="txt-cap-tqa"></span>
        <span id="bar-cap-tpa"></span><span id="txt-cap-tpa"></span>
      </div>`;
  } else {
    grid.style.gridTemplateColumns = '';
    grid.innerHTML = `
      <div>
        <div class="bar-row"><span class="bar-label">Pulse Cannon P/U</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-cpu" style="color:var(--b);"></div></div><span class="bar-val" id="txt-cap-cpu">100%</span></div>
        <div class="bar-row"><span class="bar-label">Pulse Cannon P/L</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-cpl" style="color:var(--b);"></div></div><span class="bar-val" id="txt-cap-cpl">100%</span></div>
        <div class="bar-row"><span class="bar-label">Pulse Cannon S/U</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-csu" style="color:var(--b);"></div></div><span class="bar-val" id="txt-cap-csu">100%</span></div>
      </div>
      <div>
        <div class="bar-row"><span class="bar-label">Pulse Cannon S/L</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-csl" style="color:var(--b);"></div></div><span class="bar-val" id="txt-cap-csl">100%</span></div>
        <div class="bar-row"><span class="bar-label">Nose Beam Array</span> <div class="bar-rail"><div class="bar-fill" id="bar-cap-emn" style="color:var(--p);"></div></div><span class="bar-val" id="txt-cap-emn">100%</span></div>
        <div class="bar-row"><span class="bar-label">Fwd Quantum Tube</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-tff" style="color:var(--t);"></div></div><span class="bar-val" id="txt-cap-tff">100%</span></div>
        <div class="bar-row"><span class="bar-label">Fwd Photon Tube</span> <div class="bar-rail"><div class="bar-fill" id="bar-cap-tph" style="color:var(--b);"></div></div><span class="bar-val" id="txt-cap-tph">100%</span></div>
        <div class="bar-row"><span class="bar-label">Aft Quantum Tube</span><div class="bar-rail"><div class="bar-fill" id="bar-cap-tqa" style="color:var(--t);"></div></div><span class="bar-val" id="txt-cap-tqa">100%</span></div>
        <div class="bar-row"><span class="bar-label">Aft Photon Tube</span> <div class="bar-rail"><div class="bar-fill" id="bar-cap-tpa" style="color:var(--b);"></div></div><span class="bar-val" id="txt-cap-tpa">100%</span></div>
      </div>
      <div style="display:none">
        <span id="bar-cap-scp"></span><span id="txt-cap-scp"></span>
        <span id="bar-cap-scs"></span><span id="txt-cap-scs"></span>
        <span id="bar-cap-phs"></span><span id="txt-cap-phs"></span>
        <span id="bar-cap-pae"></span><span id="txt-cap-pae"></span>
        <span id="bar-cap-tfb"></span><span id="txt-cap-tfb"></span>
      </div>`;
  }
}

// Update the capacitor bar labels in the tactical deck to match active weapon names.
// Skipped for Enterprise-E — the compact system-grid uses fixed system labels.
function _updateCapacitorBarLabels() {
  if (G.playerShipKey === 'enterprise_e') return;   // compact grid has correct labels already
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
  // cloakSection is repurposed for saucer-sep status on Enterprise-E — always keep visible;
  // updateEngUtilityPanel handles the content and labels for both ships
  if (cloakSection) cloakSection.style.display = '';
  // Ablative armour strip in tactical deck
  const ablStrip = document.getElementById('ablative-armour-strip');
  if (ablStrip) ablStrip.style.display = isEnt ? 'none' : '';
  // Cloak status bar
  const cloakBar = document.getElementById('cloak-status-bar');
  if (cloakBar) cloakBar.style.display = isEnt ? 'none' : '';
  // Right panel cloak power footer label
  const cloakFooterLbl = document.getElementById('lbl-cloak-footer');
  if (cloakFooterLbl) cloakFooterLbl.textContent = isEnt ? 'Saucer Sep Power' : 'Cloak Power';
  // Cap bar grid is fully rebuilt by _rebuildCapBarGrid() — no individual bar show/hide needed here
  // Update Max Pulse Burst button state (Defiant only — greys when expended)
  if (!isEnt) {
    const mpbBtn = document.getElementById('btn-max-pulse-burst');
    if (mpbBtn) {
      mpbBtn.style.opacity       = G.maxPulseBurstReady ? '1' : '0.4';
      mpbBtn.style.pointerEvents = G.maxPulseBurstReady ? '' : 'none';
      mpbBtn.querySelector('span').textContent = G.maxPulseBurstReady
        ? '4-cannon 3-volley · +80% · Arc-free · 1/engagement'
        : 'EXPENDED — one use per engagement';
    }
  }
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
