'use strict';

// ============================================================
// DOM ELEMENT CACHE — built at game start, re-built on ship select
// Eliminates ~60 getElementById calls per frame from hot paths.
// Only caches elements that are always in the DOM (never rebuilt).
// ============================================================
const _EL = {};

function _buildELCache() {
  const ids = [
    // Left panel
    'lbl-left-eps','lbl-left-alert','lbl-ai-archetype',
    'bar-threat-hull-left','txt-threat-hull-left',
    'bar-enemy-lock-left','txt-enemy-lock-left',
    'bar-enem-sh-fore','txt-enem-sh-fore',
    'bar-enem-sh-port','txt-enem-sh-port',
    'bar-enem-sh-starboard','txt-enem-sh-starboard',
    'bar-enem-sh-aft','txt-enem-sh-aft',
    'lbl-enemy-phase-left','lbl-enemy-state-left','lbl-cloak-left',
    'bar-sensor-lock-left','txt-sensor-lock-left',
    // Right telemetry tower
    'bar-player-hull','txt-player-hull',
    'bar-player-torps','txt-player-torps',
    'bar-player-photons','txt-player-photons',
    'bar-shield-fore','txt-shield-fore',
    'bar-shield-port','txt-shield-port',
    'bar-shield-starboard','txt-shield-starboard',
    'bar-shield-aft','txt-shield-aft',
    'lbl-shield-regen','lbl-automation-status',
    'bar-warp-output','txt-warp-used','txt-warp-max',
    'lbl-cloak-footer','bar-cloak-power','txt-cloak-power-status',
    // Tactical deck
    'weapon-health-strip','sys-health-display',
    'ablative-armour-strip',
    'cloak-status-bar','cloak-status-text','cloak-power-drain',
    'txt-current-target','txt-firing-arc',
    'scan-results-display','bar-scan-analysis',
    'lbl-warp-avail',
    'btn-cannons','btn-nose','btn-quantum','btn-photon','btn-quantum-aft','btn-photon-aft','btn-alpha',
    // Engineering utility panel
    'bar-battery-charge','txt-battery-charge','lbl-battery-status',
    'lbl-eng-cloak-title','lbl-cloak-eng-status','btn-cloak-eng',
    'txt-shield-regen-rate',
    'lbl-repair-queue','lbl-autotac-summary',
    // Helm deck
    'btn-helm-speed-stop','btn-helm-speed-maneuvering','btn-helm-speed-half','btn-helm-speed-full',
    'btn-helm-vector-fore','btn-helm-vector-port','btn-helm-vector-starboard','btn-helm-vector-aft',
    'btn-helm-range-long','btn-helm-range-medium','btn-helm-range-close',
    'btn-helm-attack-run','btn-helm-come-about','btn-helm-picard',
    'btn-helm-omega','btn-helm-evasive-alpha','btn-evasive-helm','btn-helm-cloak',
    'lbl-helm-range-status','lbl-helm-autotac','lbl-helm-autoeng',
    // Captain deck
    'cap-hull-bar','cap-hull-val',
    'cap-tac-lock-bar','cap-tac-lock','cap-tac-enemy-bar','cap-tac-enemy-hull','cap-tac-shld-bar','cap-tac-fore-shld',
    'cap-eng-power-bar','cap-eng-power','cap-eng-regen','cap-eng-repair',
    'cap-helm-speed','cap-helm-range','cap-helm-vector','cap-helm-maneuver',
    'cap-panel-tac-header','cap-panel-eng-header','cap-panel-helm-header',
    'cap-panel-eng-orders-header',
    // Mobile
    'mob-lock','mob-enemy-hull','mob-hull','mob-fore-shld','mob-phase',
    // Header
    'lbl-stardate','lbl-mission-context',
    // Enemy subsystem grid
    'enemy-subsystem-target-grid',
  ];
  ids.forEach(id => { _EL[id] = document.getElementById(id); });
}

// Re-cache the cap-bar elements after _rebuildCapBarGrid() rebuilds them
function _rebuildCapBarCache() {
  ['cpu','cpl','csu','csl','emn','tff','tph','tqa','tpa','scp','scs','phs','pae','tfb'].forEach(k => {
    _EL[`bar-cap-${k}`] = document.getElementById(`bar-cap-${k}`);
    _EL[`txt-cap-${k}`] = document.getElementById(`txt-cap-${k}`);
  });
}

// Re-cache engineering matrix rows after rebuildEngineeringMatrixInterface()
function _rebuildEngCache() {
  Object.keys(G.systems).forEach(key => {
    ['eng-lbl-mw','eng-slider-bar','eng-lbl-stress','eng-lbl-health','eng-lbl-repair','eng-row'].forEach(prefix => {
      const id = `${prefix}-${key}`;
      _EL[id] = document.getElementById(id);
    });
  });
  // Also cache cap-ord buttons for captain panel
  if (typeof _CAP_CD !== 'undefined') {
    Object.keys(_CAP_CD).forEach(k => { _EL[`cap-ord-${k}`] = document.getElementById(`cap-ord-${k}`); });
  }
}

// ============================================================
// DECK SWITCHING
// ============================================================
// ============================================================
// MOBILE PANEL MANAGEMENT
// ============================================================
function toggleMobilePanel(side) {
  const left  = document.getElementById('left-anchor-panel');
  const right = document.getElementById('right-telemetry-tower');
  const back  = document.getElementById('panel-backdrop');
  if (!left || !right || !back) return;

  const leftOpen  = left.classList.contains('panel-open');
  const rightOpen = right.classList.contains('panel-open');

  // Close both first
  left.classList.remove('panel-open');
  right.classList.remove('panel-open');
  back.classList.remove('active');

  // Then open the requested side (unless it was already open)
  if (side === 'left'  && !leftOpen)  { left.classList.add('panel-open');  back.classList.add('active'); }
  if (side === 'right' && !rightOpen) { right.classList.add('panel-open'); back.classList.add('active'); }
}

function closeMobilePanels() {
  document.getElementById('left-anchor-panel')?.classList.remove('panel-open');
  document.getElementById('right-telemetry-tower')?.classList.remove('panel-open');
  document.getElementById('panel-backdrop')?.classList.remove('active');
}

function mobileSwitchDeck(key) {
  closeMobilePanels();
  toggleActiveDeck(key);
  // Update mobile nav active state
  document.querySelectorAll('.mob-nav-btn[id^="mob-btn-"]').forEach(b => b.classList.remove('active'));
  const mb = document.getElementById(`mob-btn-${key}`); if (mb) mb.classList.add('active');
}

function _updateMobileStatusBar() {
  if (!G.running) return;
  const lockEl   = document.getElementById('mob-lock');
  const enemyEl  = document.getElementById('mob-enemy-hull');
  const hullEl   = document.getElementById('mob-hull');
  const foreEl   = document.getElementById('mob-fore-shld');
  const phaseEl  = document.getElementById('mob-phase');
  if (lockEl)  lockEl.textContent  = Math.round(G.lockProgress) + '%';
  if (enemyEl) enemyEl.textContent = Math.round((G.threat.hull / G.threat.maxHull) * 100) + '%';
  if (hullEl)  hullEl.textContent  = Math.round((G.player.hull / G.player.maxHull) * 100) + '%';
  if (foreEl)  foreEl.textContent  = Math.round(G.player.shields.fore);
  if (phaseEl) phaseEl.textContent = (G.enemyPhase || '—').toUpperCase().slice(0, 8);
  // Hull colour feedback
  if (hullEl) hullEl.style.color = G.player.hull/G.player.maxHull < 0.35 ? 'var(--red)' : G.player.hull/G.player.maxHull < 0.60 ? 'var(--warn)' : 'var(--green)';
}

// ============================================================
// DECK SWITCHING
// ============================================================
function toggleActiveDeck(key) {
  G.activePanel = key; G.playerChosenStation = key;
  document.querySelectorAll('.nav-pill-btn').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(`tab-${key}`); if (tab) tab.classList.add('active');
  document.querySelectorAll('.control-deck-plate').forEach(p => p.classList.remove('active-deck'));
  const deck = document.getElementById(`deck-${key}`); if (deck) deck.classList.add('active-deck');
  document.querySelectorAll('.monitor-frame').forEach(f => f.classList.remove('active-monitor'));
  document.querySelectorAll(`.view-${key}`).forEach(f => f.classList.add('active-monitor'));
  const monRow = document.querySelector('.top-monitor-row');
  if (monRow) monRow.classList.toggle('engineering-monitors', key === 'engineering');
  const eu = document.getElementById('eng-utility-panel');
  if (eu) eu.style.display = key === 'engineering' ? 'flex' : 'none';
  const gs = document.getElementById('lbl-automation-status');
  if (gs) gs.textContent = key === 'tactical' ? 'TACTICAL ROLE' : key === 'helm' ? 'HELM ROLE' : key === 'captain' ? 'COMMAND ROLE' : 'ENGINEERING ROLE';
  // Captain uses the same tactical monitors as helm
  if (key === 'captain') {
    document.querySelectorAll('.monitor-frame').forEach(f => f.classList.remove('active-monitor'));
    document.querySelectorAll('.view-tactical').forEach(f => f.classList.add('active-monitor'));
  }
  if (key === 'engineering') { rebuildEngineeringMatrixInterface(); _rebuildEngCache(); }
  updateCloakButton();
  updateEngUtilityPanel();
  handleHighDpiCanvasResizing();
  refreshEngineeringPanelGraphics();
  synchronizeGlobalInterfaceDisplays();
}

function _cleanupPostBattleOverlays() {
  showCloakVulnOverlay(false);
  const sg = document.getElementById('sensor-ghost-overlay'); if (sg) sg.style.display = 'none';
  const mv = document.querySelector('.main-viewport'); if (mv) mv.classList.remove('last-stand-flash');
}

// System abbreviation labels by ship — used in weapon-health-strip and sys-health-display
const _SYS_ABBREV = {
  defiant:      { cannon_pu:'P/U', cannon_pl:'P/L', cannon_su:'S/U', cannon_sl:'S/L', nose_beam:'NSE', torpedoes:'TRP', cloak_dev:'CLK', warp_core:'WRP', shields:'SHD', sensors:'SEN', engines:'ENG' },
  enterprise_e: { cannon_pu:'SDO', cannon_pl:'SVN', cannon_su:'SFW', cannon_sl:'RIM', nose_beam:'EMT', torpedoes:'TRP', cloak_dev:'SSP', warp_core:'WRP', shields:'SHD', sensors:'SEN', engines:'ENG' },
};

// ============================================================
// GLOBAL UI SYNC — called every frame
// ============================================================
function synchronizeGlobalInterfaceDisplays() {
  const _g = id => _EL[id] || document.getElementById(id); // cache-first lookup
  _updateMobileStatusBar();
  const warpOut = getWarpOutput();
  const total   = getTotalAllocatedPower();

  // Left panel EPS
  const le = _g('lbl-left-eps'); if (le) le.textContent = `${total} / ${warpOut} MW`;

  // Alert condition — item 9: threat-based not just hull%
  const al = _g('lbl-left-alert');
  if (al) {
    const hp             = G.player.hull / G.player.maxHull;
    const shieldBreached = SHIELD_SECTORS.some(s => G.player.shields[s] <= 0);
    const torpedoInbound = G.enemyManeuverState === 'torpedocharge';
    const critHull       = hp < 0.2;
    const incomingTorp   = G.inFlightTorpedoes.some(t => t.fromEnemy);
    if (critHull || shieldBreached || torpedoInbound || incomingTorp || G.enemyRammingRun) {
      al.textContent = 'RED ALERT';      al.style.color = 'var(--red)';
    } else if (hp < 0.55 || G.enemyLockProgress > 60 || G.shieldUnderAttackTimer > 0) {
      al.textContent = 'YELLOW ALERT';   al.style.color = 'var(--warn)';
    } else {
      al.textContent = 'CONDITION GREEN'; al.style.color = 'var(--green)';
    }
  }

  // Player hull & torpedoes
  const ph = _g('bar-player-hull'); if (ph) ph.style.width = `${(G.player.hull / G.player.maxHull) * 100}%`;
  const pt = _g('txt-player-hull'); if (pt) pt.textContent = `${Math.ceil(G.player.hull)}`;
  const pTB = _g('bar-player-torps'); if (pTB) pTB.style.width = `${(G.player.torpedoes / G.player.maxTorpedoes) * 100}%`;
  const pTT = _g('txt-player-torps'); if (pTT) pTT.textContent = G.player.torpedoes;
  const pPB = _g('bar-player-photons'); if (pPB) pPB.style.width = `${(G.player.photonTorpedoes / G.player.maxPhotonTorpedoes) * 100}%`;
  const pPT = _g('txt-player-photons'); if (pPT) pPT.textContent = G.player.photonTorpedoes;

  // Player shield bars + incoming hit flash
  const _hitSector = G.shieldHitFlash.player.timer > 0 ? G.shieldHitFlash.player.sector : null;
  SHIELD_SECTORS.forEach(s => {
    const bar = _g(`bar-shield-${s}`);
    if (bar) {
      const pct = G.cloaked ? 0 : (G.player.shields[s] / G.player.shields.maxSectorValue) * 100;
      bar.style.width = `${pct}%`;
      bar.style.color = G.cloaked ? C.p : pct > 66 ? C.green : pct > 33 ? C.warn : C.red;
      const rail = bar.parentElement;
      if (rail) {
        if (s === _hitSector && !rail.classList.contains('shield-hit-flash')) {
          rail.classList.remove('shield-hit-flash');
          void rail.offsetWidth; // force reflow to restart animation
          rail.classList.add('shield-hit-flash');
        } else if (s !== _hitSector) {
          rail.classList.remove('shield-hit-flash');
        }
      }
    }
    const txt = _g(`txt-shield-${s}`); if (txt) txt.textContent = G.cloaked ? 'CLK' : Math.ceil(G.player.shields[s]);
  });

  // Shield regen label
  const rl = _g('lbl-shield-regen');
  if (rl) {
    if (G.cloaked)                   { rl.textContent = 'OFFLINE';               rl.style.color = 'var(--p)';     }
    else if (G.shieldUnderAttackTimer > 0) { rl.textContent = '⚠ HIT';           rl.style.color = 'var(--red)';  }
    else                             { rl.textContent = `↑+${(G.shieldRegenRate || 0).toFixed(1)}/s`; rl.style.color = 'var(--green)'; }
  }

  // Enemy hull + shields (left panel) — sensor accuracy degrades display
  const sH            = G.systems.sensors.health;
  const sensorAccurate = sH >= 70;
  const sensorDegraded = sH < 40;
  const tHB = _g('bar-threat-hull-left'); if (tHB) tHB.style.width = `${(G.threat.hull / G.threat.maxHull) * 100}%`;
  const tHT = _g('txt-threat-hull-left');
  if (tHT) {
    if (sensorDegraded)      tHT.textContent = '???';
    else if (!sensorAccurate) tHT.textContent = `~${Math.ceil(G.threat.hull / 50) * 50}`;
    else                      tHT.textContent = `${Math.ceil(G.threat.hull)}`;
  }

  // Enemy shield sector bars (left panel) — only when game is running (shields initialised)
  if (G.running && G.threat.shields) {
    SHIELD_SECTORS.forEach(s => {
      const bar = _g(`bar-enem-sh-${s}`); const txt = _g(`txt-enem-sh-${s}`);
      if (!bar || !txt) return;
      if (G.enemyCloaked) { bar.style.width = '0%'; txt.textContent = 'CLK'; bar.style.color = C.p; return; }
      const cfg  = ENEMY_CONFIGS[G.enemyArchetype]; const maxV = cfg.shields[s] || 200;
      const val  = G.threat.shields[s]; const pct = (val / maxV) * 100;
      bar.style.width = `${pct}%`; bar.style.color = pct > 50 ? C.green : pct > 20 ? C.warn : C.red;
      txt.textContent = sensorDegraded ? '?' : !sensorAccurate ? `~${Math.round(val / 20) * 20}` : `${Math.ceil(val)}`;
    });
  }

  // Our sensor lock
  const slb = _g('bar-sensor-lock-left');
  if (slb) { slb.style.width = `${G.lockProgress}%`; slb.style.color = G.lockProgress < 5 ? C.red : G.lockProgress < 50 ? C.warn : C.green; }
  const slt = _g('txt-sensor-lock-left'); if (slt) slt.textContent = `${Math.round(G.lockProgress)}%`;

  // Cloak status (left panel)
  const cl = _g('lbl-cloak-left');
  if (cl) {
    if (G.cloaked)               { cl.style.display = 'block'; cl.textContent = `◉ CLOAKED P:${Math.round(G.cloakPowerReserve)}%`; cl.style.color = 'var(--p)'; }
    else if (G.cloakVulnTimer > 0) { cl.style.display = 'block'; cl.textContent = '⚡ TRANSITION';  cl.style.color = 'var(--warn)'; }
    else if (G.cloakCooldown > 0) { cl.style.display = 'block'; cl.textContent = `◌ ${Math.ceil(G.cloakCooldown / 1000)}s`; cl.style.color = 'var(--warn)'; }
    else                          { cl.style.display = 'none'; }
  }

  // Warp core output panel (right)
  const wb = _g('bar-warp-output'); if (wb) wb.style.width = `${(total / WARP_CORE.maxOutput) * 100}%`;
  const wu = _g('txt-warp-used');   if (wu) wu.textContent = total;
  const wm = _g('txt-warp-max');    if (wm) { wm.textContent = warpOut; wm.style.color = G.systems.warp_core.tripped ? C.red : warpOut < 60 ? C.warn : C.o; }

  // Cloak / Saucer sep power bar (right)
  const _isEntUI = G.playerShipKey === 'enterprise_e';
  const cpb = _g('bar-cloak-power');
  if (cpb) cpb.style.width = _isEntUI ? `${G.saucerSepCooldown > 0 ? Math.max(0,(1-G.saucerSepCooldown/60000)*100) : G.saucerSepActive ? 100 : 100}%` : `${G.cloakPowerReserve}%`;
  const cps = _g('txt-cloak-power-status');
  if (cps) {
    if (_isEntUI) {
      if (G.saucerSepReconnecting)     cps.textContent = `Docking: ${Math.ceil(G.saucerSepReconnectTimer/1000)}s`;
      else if (G.saucerSepActive)      cps.textContent = 'Separated — stardrive independent';
      else if (G.saucerSepCooldown>0)  cps.textContent = `Sep CD: ${Math.ceil(G.saucerSepCooldown/1000)}s`;
      else                             cps.textContent = 'Ready';
    } else {
      if (G.cloaked)                cps.textContent = `Draining: ${Math.round(G.cloakPowerReserve)}%`;
      else if (G.cloakCooldown > 0) cps.textContent = `Recharge: ${Math.ceil(G.cloakCooldown / 1000)}s`;
      else                          cps.textContent = 'Ready';
    }
  }

  // Cloak / Saucer sep status bar (tactical panel)
  const csb = _g('cloak-status-bar'); const cst = _g('cloak-status-text'); const cpd = _g('cloak-power-drain');
  if (csb) {
    if (_isEntUI) {
      if (G.saucerSepReconnecting) { csb.style.display='flex'; if(cst)cst.textContent='◯ DOCKING — saucer on approach'; csb.style.color='var(--warn)'; csb.style.borderColor='var(--warn)'; if(cpd)cpd.textContent=`${Math.ceil(G.saucerSepReconnectTimer/1000)}s`; }
      else if (G.saucerSepActive) { csb.style.display='flex'; if(cst)cst.textContent='◯ SEPARATED — Saucer firing auto (40%) · Stardrive +20% · Lock −60%'; csb.style.color='var(--green)'; csb.style.borderColor='var(--green)'; if(cpd)cpd.textContent=''; }
      else csb.style.display='none';
    } else {
      if (G.cloakVulnTimer > 0)    { csb.style.display='flex'; if(cst)cst.textContent='⚡ CLOAK TRANSITION — NO SHIELDS'; csb.style.color='var(--red)'; csb.style.borderColor='var(--red)'; if(cpd)cpd.textContent=''; }
      else if (G.cloaked)           { csb.style.display='flex'; if(cst)cst.textContent='◉ CLOAKED — WEAPONS & SHIELDS OFFLINE'; csb.style.color='var(--p)'; csb.style.borderColor='var(--p)'; if(cpd)cpd.textContent=`PWR:${Math.round(G.cloakPowerReserve)}% (${G.cloakPowerDrainRate}%/s)`; }
      else if (G.cloakCooldown > 0) { csb.style.display='flex'; if(cst)cst.textContent=`◌ RECHARGING ${Math.ceil(G.cloakCooldown/1000)}s`; csb.style.color='var(--warn)'; csb.style.borderColor='var(--warn)'; if(cpd)cpd.textContent=''; }
      else                           { csb.style.display='none'; }
    }
  }

  // Weapon capacitor bars
  const _aw = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  Object.keys(_aw).forEach(wk => {
    const wd  = _aw[wk]; const sys = G.systems[wd.parentSystem];
    const _isAft = !!(wd.arc?.includes('aft') && !wd.arc?.includes('fore'));
    const cap = sys.tripped ? 0 : (_isAft && sys.aftCap !== undefined ? sys.aftCap : sys.cap);
    const b   = _g(`bar-cap-${wd.tag}`);
    if (b) { b.style.width = `${cap}%`; b.style.color = sys.tripped ? C.red : cap > 50 ? C.b : C.warn; }
    const t = _g(`txt-cap-${wd.tag}`);
    if (t) t.textContent = sys.tripped ? 'OFFLINE' : `${Math.round(cap)}%`;
  });
  const abDiv = _g('ablative-armour-strip');
  if (abDiv && G.playerShipConfig && G.playerShipConfig.hasAblativeArmour) {
    const ab = G.ablative;
    const col = ab.layers > 3 ? C.green : ab.layers > 1 ? C.warn : C.red;
    const layerStr = ab.layerHealth.map((lh, i) => {
      if (lh > 0) return `<span style="color:${lh > 60 ? C.green : C.warn};">▊</span>`;
      if (ab.regenTimers[i] > 0) return `<span style="color:var(--t);" title="Regen in ${Math.ceil(ab.regenTimers[i]/1000)}s">▒</span>`;
      return `<span style="color:var(--warn);" title="Regenerating">░</span>`;
    }).join('');
    abDiv.innerHTML = `<span style="font-family:'Antonio';font-size:9px;color:#6688aa;">ABLATIVE</span> ${layerStr} <span style="font-size:9px;color:${col};">${ab.layers}/6</span>`;
  }

  // Weapon health strip
  const ws = _g('weapon-health-strip');
  if (ws) {
    const _ab = _SYS_ABBREV[G.playerShipKey] || _SYS_ABBREV.defiant;
    const wk = ['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes','cloak_dev','warp_core'].map(k => ({k, l:_ab[k]}));
    ws.innerHTML = wk.map(w => {
      const sys = G.systems[w.k]; const h = Math.round(sys.health);
      const col = sys.tripped ? '#ff3333' : h > 70 ? '#00cc66' : h > 35 ? '#ffaa00' : '#ff3333';
      const bg  = sys.tripped ? 'rgba(255,51,51,0.2)' : h < 35 ? 'rgba(255,51,51,0.1)' : 'rgba(10,20,40,0.8)';
      const rep = G.repairTeams.some(t => t.sysKey === w.k);
      return `<div style="background:${bg};border:1px solid ${sys.tripped ? '#ff3333' : h < 70 ? col : '#1a2640'};border-radius:5px;padding:2px 5px;text-align:center;flex:1;min-width:36px;">
        <div style="font-family:'Antonio';font-size:8px;color:#aabbcc;">${w.l}</div>
        <div style="font-size:10px;font-weight:bold;color:${col};">${sys.tripped ? 'OFF' : h + '%'}</div>
        ${rep ? '<div style="font-size:7px;color:var(--warn);">🔧</div>' : ''}
      </div>`;
    }).join('');
  }

  // System health compact (right panel)
  const sh = _g('sys-health-display');
  if (sh) {
    const aks = ['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes','cloak_dev','warp_core','shields','sensors','engines'];
    sh.innerHTML = aks.map(key => {
      const sys = G.systems[key]; const h = Math.round(sys.health);
      const col = sys.tripped ? C.red : h > 70 ? C.green : h > 35 ? C.warn : C.red;
      const _abbrev = _SYS_ABBREV[G.playerShipKey] || _SYS_ABBREV.defiant;
      const ab  = _abbrev[key];
      const rep = G.repairTeams.some(t => t.sysKey === key);
      return `<div style="display:flex;align-items:center;gap:3px;margin-bottom:1px;">
        <span style="width:22px;font-size:9px;color:#6688aa;font-family:'Roboto Mono';">${ab}</span>
        <div class="bar-rail" style="height:7px;flex:1;margin-bottom:0;"><div class="bar-fill" style="color:${col};width:${sys.tripped ? 0 : h}%;"></div></div>
        <span style="width:24px;font-size:9px;font-weight:bold;color:${col};text-align:right;">${sys.tripped ? 'OFF' : h + '%'}</span>
        ${sys.tripped ? '<span style="font-size:8px;color:var(--red);">⊘</span>' : rep ? '<span style="font-size:8px;color:var(--warn);">🔧</span>' : ''}
      </div>`;
    }).join('');
  }

  // Weapon arc states — grey out weapons that can't bear on current attack vector
  const _vec = G.helmAttackVector;
  const _aw2 = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const _isEnt2 = G.playerShipKey === 'enterprise_e';
  const _arcGrey = (id, weaponKeys, label) => {
    const btn = _g(id); if (!btn) return;
    const anyInArc = weaponKeys.some(k => _aw2[k] && _aw2[k].arc.includes(_vec));
    const inArcCount = weaponKeys.filter(k => _aw2[k] && _aw2[k].arc.includes(_vec)).length;
    if (!anyInArc) {
      btn.style.opacity = '0.35'; btn.style.pointerEvents = 'none';
      btn.title = `Out of arc — ${_vec.toUpperCase()} vector`;
    } else {
      btn.style.opacity = ''; btn.style.pointerEvents = '';
      btn.title = '';
    }
    if (id === 'btn-cannons') {
      const shipCfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
      const maxN    = shipCfg.primaryWeaponKeys.length;
      btn.textContent = inArcCount > 0 ? `⚡ ${shipCfg.primaryLabel} ×${inArcCount}${inArcCount < maxN ? ' IN ARC' : ''}` : `⚡ ${shipCfg.primaryLabel} — OUT OF ARC`;
    }
  };
  const _primKeys = _isEnt2
    ? (G.playerShipConfig?.primaryWeaponKeys || PLAYER_SHIP_CONFIGS.enterprise_e.primaryWeaponKeys)
    : ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  _arcGrey('btn-cannons',    _primKeys, 'cannons');
  _arcGrey('btn-nose',       ['emitter_nose'],         'nose');
  _arcGrey('btn-quantum',    ['torpedo_quantum'],       'quantum');
  _arcGrey('btn-photon',     ['torpedo_photon'],        'photon');
  _arcGrey('btn-quantum-aft',['torpedo_quantum_aft'],   'quantum-aft');
  _arcGrey('btn-photon-aft', ['torpedo_photon_aft'],    'photon-aft');
  _arcGrey('btn-alpha',      ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower','emitter_nose','torpedo_quantum','torpedo_quantum_aft'], 'alpha');
  const bfPrimKeys = _isEnt2
    ? ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower','emitter_nose']
    : ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
  const bfArcCount = bfPrimKeys.filter(k => _aw2[k] && _aw2[k].arc.includes(_vec)).length;
  const bfArcBtn = _g('btn-burst-fire');
  if (bfArcBtn && bfArcCount === 0) { bfArcBtn.style.opacity = '0.35'; bfArcBtn.style.pointerEvents = 'none'; }
  else if (bfArcBtn) { bfArcBtn.style.opacity = ''; bfArcBtn.style.pointerEvents = ''; }

  // Burst / Concentrated fire button state
  const bfBtn = bfArcBtn; // same element
  if (bfBtn) {
    const _burstLabel = _isEnt2 ? 'CONCENTRATED FIRE' : 'BURST SALVO — 4-CANNON BARRAGE';
    if (!G.burstFireReady) {
      bfBtn.textContent = `⚡⚡ ${_isEnt2 ? 'CONC' : 'BURST'} CD ${Math.ceil(G.burstFireCooldown/1000)}s`;
      bfBtn.style.background = 'var(--dim2)'; bfBtn.style.color = '#aabbcc';
    } else {
      bfBtn.textContent = `⚡⚡ ${_burstLabel}`;
      bfBtn.style.background = ''; bfBtn.style.color = '';
    }
  }

  // Engineering panel refresh (only if active)
  if (G.activePanel === 'engineering') {
    refreshEngineeringPanelGraphics();
    updateEngUtilityPanel();
  }

  // Helm panel refresh — only if active and no helm timer is already driving it this frame
  if (G.activePanel === 'helm' && !G.attackRunActive && !G.comeAboutActive) updateHelmPanel();

  // Captain overview refresh
  if (G.activePanel === 'captain') updateCaptainOverview();
}

// ============================================================
// SCORING
// ============================================================
function calculateFinalScore(victory, escaped) {
  const s    = G.score;
  const diff = DIFFICULTY[currentDifficulty];
  const diffMult = currentDifficulty === 'elite' ? 2.0 : currentDifficulty === 'hard' ? 1.4 : 1.0;
  const timeBonus = Math.round(s.timeSurvived * 2 * diffMult);
  const dmgBonus  = Math.round(s.totalDmgDealt * 0.5 * diffMult);
  const sysBonus  = s.systemsDestroyed * 150 * diffMult;
  const repBonus  = s.repairsCompleted * 80;
  const hullPen   = s.hullBreaches * 30;
  const warpPen   = escaped ? 500 : 0;
  const vicBonus  = victory && !escaped ? Math.round(1500 * diffMult) : 0;
  const crewPen   = Object.values(CREW_STATIONS).reduce((a, c) => a + c.casualties * 100, 0);
  // Item 6: hull integrity bonus — rewards clean, efficient engagements
  const hullPct      = G.player.hull / G.player.maxHull;
  const integrityBonus = victory && !escaped ? Math.round(hullPct * 800 * diffMult) : 0;
  const total     = Math.max(0, Math.round(timeBonus + dmgBonus + sysBonus + repBonus + integrityBonus - hullPen - warpPen - crewPen + vicBonus));
  return {
    rows: [
      { label:`Time survived [${currentDifficulty}×${diffMult}]`, value:`${Math.round(s.timeSurvived)}s`,     score:`+${timeBonus}` },
      { label:'Damage dealt',                                        value:`${Math.round(s.totalDmgDealt)}MW`,  score:`+${dmgBonus}` },
      { label:'Enemy systems destroyed',                             value:s.systemsDestroyed,                  score:`+${Math.round(sysBonus)}` },
      { label:'Repairs completed',                                   value:s.repairsCompleted,                  score:`+${repBonus}` },
      { label:`Hull integrity [${Math.round(hullPct*100)}%]`,       value:victory&&!escaped?'YES':'N/A',        score:`+${integrityBonus}` },
      { label:'Hull breaches sustained',                             value:s.hullBreaches,                      score:`-${hullPen}` },
      { label:'Crew casualties',                                     value:Object.values(CREW_STATIONS).reduce((a,c) => a + c.casualties, 0), score:`-${crewPen}` },
      { label:'Emergency warp penalty',                              value:escaped ? 'YES' : 'NO',              score:escaped ? `-${warpPen}` : '0' },
      { label:'Victory bonus',                                       value:victory && !escaped ? 'YES' : 'NO',  score:`+${vicBonus}` },
    ],
    total
  };
}

// ============================================================
// END GAME
// ============================================================
function concludeSimulationRun(victory, msg, escaped) {
  if (G.campaignMode) { concludeCampaignLevel(victory, escaped); return; }
  G.dead = true; G.running = false;
  const overlay = document.getElementById('overlay'); overlay.style.display = 'flex';
  // Hide ALL setup / selection UI — only the battle report and one button should show
  ['setup-controls-anchor','campaign-diff-section','campaign-run-section','ship-select-section']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  const title = document.getElementById('modal-title');
  if (title) {
    let titleText, titleColor;
    if (escaped) {
      titleText = 'DISENGAGED'; titleColor = C.warn;
    } else if (victory) {
      const hullPct = G.player.hull / G.player.maxHull;
      if (hullPct >= 0.70)      { titleText = 'DECISIVE VICTORY';  titleColor = '#00ffaa'; }
      else if (hullPct >= 0.35) { titleText = 'TACTICAL VICTORY';  titleColor = C.green;   }
      else                      { titleText = 'PYRRHIC VICTORY';   titleColor = C.warn;    }
    } else {
      titleText = 'VESSEL DESTROYED'; titleColor = C.red;
    }
    title.textContent = titleText; title.style.color = titleColor;
  }
  const desc = document.getElementById('modal-desc'); if (desc) desc.textContent = msg;

  const scoreDiv = document.getElementById('score-display');
  if (scoreDiv) {
    scoreDiv.style.display = 'block';
    const result = calculateFinalScore(victory, escaped);
    const bd = document.getElementById('score-breakdown');
    if (bd) bd.innerHTML = result.rows.map(r => `<div class="score-row"><span>${r.label}: <span style="color:#fff;">${r.value}</span></span><span style="color:${r.score.startsWith('-') ? C.red : C.green};font-weight:bold;">${r.score}</span></div>`).join('');
    const tot = document.getElementById('score-total');
    if (tot) { tot.textContent = `FINAL SCORE: ${result.total}`; tot.style.color = victory && !escaped ? C.green : escaped ? C.warn : C.red; }
  }

  const box = document.getElementById('terminal-transcript-box');
  if (box) {
    box.style.display = 'block';
    const s  = G.score;
    const cfg = ENEMY_CONFIGS[G.enemyArchetype] || {};
    const hullPct  = Math.round((G.player.hull / G.player.maxHull) * 100);
    const totalWpn = s.weaponsFired.cannons + s.weaponsFired.nose + s.weaponsFired.quantum + s.weaponsFired.photon;
    const crewRows = Object.values(CREW_STATIONS).map(c => {
      const icon = c.status === 'nominal' ? '●' : c.status === 'wounded' ? '⚠' : '✕';
      const col  = c.status === 'nominal' ? '#00cc66' : c.status === 'wounded' ? '#ffaa00' : '#ff4444';
      const cas  = c.casualties > 0 ? ` (${c.casualties} casualt${c.casualties > 1 ? 'ies' : 'y'})` : '';
      return `<span style="color:${col}">${icon} ${c.name} — ${c.status}${cas}</span>`;
    }).join('&nbsp;&nbsp;');
    const sectorBreachStr = ['fore','port','starboard','aft'].map(sec => {
      const n = s.sectorBreaches[sec] || 0;
      const col = n === 0 ? '#00cc66' : n < 3 ? '#ffaa00' : '#ff4444';
      return `<span style="color:${col}">${sec.toUpperCase()}: ${n}</span>`;
    }).join('&nbsp;&nbsp;');
    const trippedStr = s.systemsTripped.length > 0
      ? s.systemsTripped.map(k => G.systems[k] ? G.systems[k].label : k).join(', ')
      : '<span style="color:#00cc66">None</span>';
    const phaseStr = s.enemyPhaseReached ? s.enemyPhaseReached.toUpperCase() : '—';
    const row = (label, val) => `<div style="display:flex;justify-content:space-between;padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="color:#6688aa">${label}</span><span style="color:#ddeeff">${val}</span></div>`;
    box.innerHTML = `
      <div style="font-family:'Antonio';font-size:12px;color:var(--o);font-weight:bold;letter-spacing:2px;margin-bottom:6px;border-bottom:1px solid var(--o);padding-bottom:4px;">TACTICAL DEBRIEF — ${(G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).label} ${(G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).registry}</div>
      <div style="font-size:10px;margin-bottom:8px;">
        ${row('Enemy vessel', `${cfg.label || G.enemyArchetype} [${cfg.faction || '—'}]`)}
        ${row('Phase reached', phaseStr)}
        ${row('Time in combat', Math.round(s.timeSurvived) + 's')}
        ${row('Hull integrity at end', hullPct + '%')}
      </div>
      <div style="font-family:'Antonio';font-size:10px;color:var(--b);letter-spacing:1px;margin:6px 0 3px;">WEAPONS FIRED</div>
      <div style="font-size:10px;margin-bottom:8px;">
        ${row(G.playerShipKey === 'enterprise_e' ? 'Phaser Arrays' : 'Pulse Cannons', s.weaponsFired.cannons)}
        ${row(G.playerShipKey === 'enterprise_e' ? 'Stardrive Arrays' : 'Nose Emitter', s.weaponsFired.nose)}
        ${row('Quantum Torpedoes', s.weaponsFired.quantum)}
        ${row('Photon Torpedoes', s.weaponsFired.photon)}
        ${row('Total volleys', totalWpn)}
        ${row('Total yield delivered', Math.round(s.totalDmgDealt) + ' MW')}
      </div>
      <div style="font-family:'Antonio';font-size:10px;color:var(--b);letter-spacing:1px;margin:6px 0 3px;">HULL BREACHES BY SECTOR</div>
      <div style="font-size:10px;margin-bottom:2px;">${sectorBreachStr}</div>
      ${s.peakHullHit > 0 ? `<div style="font-size:10px;color:#aabbcc;margin-bottom:8px;">Peak single hit: <span style="color:#ff8888">${Math.round(s.peakHullHit)} MW</span></div>` : '<div style="margin-bottom:8px;"></div>'}
      <div style="font-family:'Antonio';font-size:10px;color:var(--b);letter-spacing:1px;margin:6px 0 3px;">SYSTEMS TRIPPED</div>
      <div style="font-size:10px;margin-bottom:8px;">${trippedStr}</div>
      <div style="font-family:'Antonio';font-size:10px;color:var(--b);letter-spacing:1px;margin:6px 0 3px;">CREW STATUS</div>
      <div style="font-size:10px;margin-bottom:8px;">${crewRows}</div>
      <div style="font-family:'Antonio';font-size:10px;color:var(--o);letter-spacing:1px;margin:8px 0 3px;border-top:1px solid rgba(255,170,0,0.3);padding-top:6px;">BATTLE LOG (last 15):</div>
    `;
    // Expand transcript box to show more of the log
    box.style.height = 'auto';
    box.style.maxHeight = '280px';

    G.historicalLogTracks.slice(-15).forEach(e => {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:10px;';
      d.style.color = { info:'#aabbcc', good:'#00cc66', warn:'#ffaa00', crit:'#ff4444' }[e.tier] || '#aabbcc';
      d.textContent = `[${e.ts}] ${e.msg}`;
      box.appendChild(d);
    });
  }

  // NEW ENGAGEMENT button — prominent, outside the transcript scroll area
  const actionsDiv = document.getElementById('end-game-actions');
  if (actionsDiv) {
    actionsDiv.style.display = 'block';
    actionsDiv.innerHTML = `
      <button class="pill-action-btn"
        style="width:100%;margin-top:12px;padding:14px;font-size:15px;font-family:'Antonio',sans-serif;
               letter-spacing:2px;background:var(--o);color:#000;border-radius:8px;"
        onclick="returnToSetup()">
        ⚡ NEW ENGAGEMENT
      </button>
    `;
  }

  _cleanupPostBattleOverlays();
}
