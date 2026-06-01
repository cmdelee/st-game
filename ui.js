'use strict';

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
  if (key === 'engineering') rebuildEngineeringMatrixInterface();
  updateCloakButton();
  updateEngUtilityPanel();
  handleHighDpiCanvasResizing();
  refreshEngineeringPanelGraphics();
  synchronizeGlobalInterfaceDisplays();
}

// ============================================================
// GLOBAL UI SYNC — called every frame
// ============================================================
function synchronizeGlobalInterfaceDisplays() {
  const warpOut = getWarpOutput();
  const total   = getTotalAllocatedPower();

  // Left panel EPS
  const le = document.getElementById('lbl-left-eps'); if (le) le.textContent = `${total} / ${warpOut} MW`;

  // Alert condition — item 9: threat-based not just hull%
  const al = document.getElementById('lbl-left-alert');
  if (al) {
    const hp             = G.player.hull / G.player.maxHull;
    const shieldBreached = ['fore','port','starboard','aft'].some(s => G.player.shields[s] <= 0);
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
  const ph = document.getElementById('bar-player-hull'); if (ph) ph.style.width = `${(G.player.hull / G.player.maxHull) * 100}%`;
  const pt = document.getElementById('txt-player-hull'); if (pt) pt.textContent = `${Math.ceil(G.player.hull)}`;
  const pTB = document.getElementById('bar-player-torps'); if (pTB) pTB.style.width = `${(G.player.torpedoes / G.player.maxTorpedoes) * 100}%`;
  const pTT = document.getElementById('txt-player-torps'); if (pTT) pTT.textContent = G.player.torpedoes;
  const pPB = document.getElementById('bar-player-photons'); if (pPB) pPB.style.width = `${(G.player.photonTorpedoes / G.player.maxPhotonTorpedoes) * 100}%`;
  const pPT = document.getElementById('txt-player-photons'); if (pPT) pPT.textContent = G.player.photonTorpedoes;

  // Player shield bars + incoming hit flash
  const _hitSector = G.shieldHitFlash.player.timer > 0 ? G.shieldHitFlash.player.sector : null;
  ['fore','port','starboard','aft'].forEach(s => {
    const bar = document.getElementById(`bar-shield-${s}`);
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
    const txt = document.getElementById(`txt-shield-${s}`); if (txt) txt.textContent = G.cloaked ? 'CLK' : Math.ceil(G.player.shields[s]);
  });

  // Shield regen label
  const rl = document.getElementById('lbl-shield-regen');
  if (rl) {
    if (G.cloaked)                   { rl.textContent = 'OFFLINE';               rl.style.color = 'var(--p)';     }
    else if (G.shieldUnderAttackTimer > 0) { rl.textContent = '⚠ HIT';           rl.style.color = 'var(--red)';  }
    else                             { rl.textContent = `↑+${G.shieldRegenRate.toFixed(1)}/s`; rl.style.color = 'var(--green)'; }
  }

  // Enemy hull + shields (left panel) — sensor accuracy degrades display
  const sH            = G.systems.sensors.health;
  const sensorAccurate = sH >= 70;
  const sensorDegraded = sH < 40;
  const tHB = document.getElementById('bar-threat-hull-left'); if (tHB) tHB.style.width = `${(G.threat.hull / G.threat.maxHull) * 100}%`;
  const tHT = document.getElementById('txt-threat-hull-left');
  if (tHT) {
    if (sensorDegraded)      tHT.textContent = '???';
    else if (!sensorAccurate) tHT.textContent = `~${Math.ceil(G.threat.hull / 50) * 50}`;
    else                      tHT.textContent = `${Math.ceil(G.threat.hull)}`;
  }

  // Enemy shield sector bars (left panel) — only when game is running (shields initialised)
  if (G.running && G.threat.shields) {
    ['fore','port','starboard','aft'].forEach(s => {
      const bar = document.getElementById(`bar-enem-sh-${s}`); const txt = document.getElementById(`txt-enem-sh-${s}`);
      if (!bar || !txt) return;
      if (G.enemyCloaked) { bar.style.width = '0%'; txt.textContent = 'CLK'; bar.style.color = C.p; return; }
      const cfg  = ENEMY_CONFIGS[G.enemyArchetype]; const maxV = cfg.shields[s] || 200;
      const val  = G.threat.shields[s]; const pct = (val / maxV) * 100;
      bar.style.width = `${pct}%`; bar.style.color = pct > 50 ? C.green : pct > 20 ? C.warn : C.red;
      txt.textContent = sensorDegraded ? '?' : !sensorAccurate ? `~${Math.round(val / 20) * 20}` : `${Math.ceil(val)}`;
    });
  }

  // Our sensor lock
  const slb = document.getElementById('bar-sensor-lock-left');
  if (slb) { slb.style.width = `${G.lockProgress}%`; slb.style.color = G.lockProgress < 5 ? C.red : G.lockProgress < 50 ? C.warn : C.green; }
  const slt = document.getElementById('txt-sensor-lock-left'); if (slt) slt.textContent = `${Math.round(G.lockProgress)}%`;

  // Cloak status (left panel)
  const cl = document.getElementById('lbl-cloak-left');
  if (cl) {
    if (G.cloaked)               { cl.style.display = 'block'; cl.textContent = `◉ CLOAKED P:${Math.round(G.cloakPowerReserve)}%`; cl.style.color = 'var(--p)'; }
    else if (G.cloakVulnTimer > 0) { cl.style.display = 'block'; cl.textContent = '⚡ TRANSITION';  cl.style.color = 'var(--warn)'; }
    else if (G.cloakCooldown > 0) { cl.style.display = 'block'; cl.textContent = `◌ ${Math.ceil(G.cloakCooldown / 1000)}s`; cl.style.color = 'var(--warn)'; }
    else                          { cl.style.display = 'none'; }
  }

  // Warp core output panel (right)
  const wb = document.getElementById('bar-warp-output'); if (wb) wb.style.width = `${(total / WARP_CORE.maxOutput) * 100}%`;
  const wu = document.getElementById('txt-warp-used');   if (wu) wu.textContent = total;
  const wm = document.getElementById('txt-warp-max');    if (wm) { wm.textContent = warpOut; wm.style.color = G.systems.warp_core.tripped ? C.red : warpOut < 60 ? C.warn : C.o; }

  // Cloak / Saucer sep power bar (right)
  const _isEntUI = G.playerShipKey === 'enterprise_e';
  const cpb = document.getElementById('bar-cloak-power');
  if (cpb) cpb.style.width = _isEntUI ? `${G.saucerSepCooldown > 0 ? Math.max(0,(1-G.saucerSepCooldown/50000)*100) : G.saucerSepActive ? 100 : 100}%` : `${G.cloakPowerReserve}%`;
  const cps = document.getElementById('txt-cloak-power-status');
  if (cps) {
    if (_isEntUI) {
      if (G.saucerSepActive)       cps.textContent = `Separating: ${Math.ceil(G.saucerSepTimer/1000)}s`;
      else if (G.saucerSepCooldown > 0) cps.textContent = `Reconnect: ${Math.ceil(G.saucerSepCooldown/1000)}s`;
      else                          cps.textContent = 'Ready';
    } else {
      if (G.cloaked)                cps.textContent = `Draining: ${Math.round(G.cloakPowerReserve)}%`;
      else if (G.cloakCooldown > 0) cps.textContent = `Recharge: ${Math.ceil(G.cloakCooldown / 1000)}s`;
      else                          cps.textContent = 'Ready';
    }
  }

  // Cloak / Saucer sep status bar (tactical panel)
  const csb = document.getElementById('cloak-status-bar'); const cst = document.getElementById('cloak-status-text'); const cpd = document.getElementById('cloak-power-drain');
  if (csb) {
    if (_isEntUI) {
      if (G.saucerSepActive) { csb.style.display='flex'; if(cst)cst.textContent='◯ SAUCER SEPARATED — Enemy lock −60%'; csb.style.color='var(--green)'; csb.style.borderColor='var(--green)'; if(cpd)cpd.textContent=`${Math.ceil(G.saucerSepTimer/1000)}s`; }
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
    const cap = sys.tripped ? 0 : sys.cap;
    const b   = document.getElementById(`bar-cap-${wd.tag}`);
    if (b) { b.style.width = `${cap}%`; b.style.color = sys.tripped ? C.red : cap > 50 ? C.b : C.warn; }
    const t = document.getElementById(`txt-cap-${wd.tag}`);
    if (t) t.textContent = sys.tripped ? 'OFFLINE' : `${Math.round(cap)}%`;
  });
  const abDiv = document.getElementById('ablative-armour-strip');
  if (abDiv) {
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
  const ws = document.getElementById('weapon-health-strip');
  if (ws) {
    const _isEnt = G.playerShipKey === 'enterprise_e';
    const wk = _isEnt
      ? [{k:'cannon_pu',l:'SDO'},{k:'cannon_pl',l:'SVN'},{k:'cannon_su',l:'SFW'},{k:'cannon_sl',l:'RIM'},{k:'nose_beam',l:'EMT'},{k:'torpedoes',l:'TRP'},{k:'cloak_dev',l:'SSP'},{k:'warp_core',l:'WRP'}]
      : [{k:'cannon_pu',l:'P/U'},{k:'cannon_pl',l:'P/L'},{k:'cannon_su',l:'S/U'},{k:'cannon_sl',l:'S/L'},{k:'nose_beam',l:'NSE'},{k:'torpedoes',l:'TRP'},{k:'cloak_dev',l:'CLK'},{k:'warp_core',l:'WRP'}];
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
  const sh = document.getElementById('sys-health-display');
  if (sh) {
    const aks = ['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes','cloak_dev','warp_core','shields','sensors','engines'];
    sh.innerHTML = aks.map(key => {
      const sys = G.systems[key]; const h = Math.round(sys.health);
      const col = sys.tripped ? C.red : h > 70 ? C.green : h > 35 ? C.warn : C.red;
      const _abbrev = G.playerShipKey === 'enterprise_e'
        ? { cannon_pu:'SDO', cannon_pl:'SVN', cannon_su:'SFW', cannon_sl:'RIM', nose_beam:'EMT', torpedoes:'TRP', cloak_dev:'SSP', warp_core:'WRP', shields:'SHD', sensors:'SEN', engines:'ENG' }
        : { cannon_pu:'P/U', cannon_pl:'P/L', cannon_su:'S/U', cannon_sl:'S/L', nose_beam:'NSE', torpedoes:'TRP', cloak_dev:'CLK', warp_core:'WRP', shields:'SHD', sensors:'SEN', engines:'ENG' };
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
    const btn = document.getElementById(id); if (!btn) return;
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
    ? ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower','emitter_nose']
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
  const bfArcBtn = document.getElementById('btn-burst-fire');
  if (bfArcBtn && bfArcCount === 0) { bfArcBtn.style.opacity = '0.35'; bfArcBtn.style.pointerEvents = 'none'; }
  else if (bfArcBtn) { bfArcBtn.style.opacity = ''; bfArcBtn.style.pointerEvents = ''; }

  // Burst / Concentrated fire button state
  const bfBtn = document.getElementById('btn-burst-fire');
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
  const setup = document.getElementById('setup-controls-anchor'); if (setup) setup.style.display = 'none';
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
    G.historicalLogTracks.slice(-15).forEach(e => {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:10px;';
      d.style.color = { info:'#aabbcc', good:'#00cc66', warn:'#ffaa00', crit:'#ff4444' }[e.tier] || '#aabbcc';
      d.textContent = `[${e.ts}] ${e.msg}`;
      box.appendChild(d);
    });
    const btn = document.createElement('button');
    btn.className = 'pill-action-btn warn-btn';
    btn.style.cssText = 'width:100%;margin-top:10px;padding:10px;';
    btn.textContent = '⚡ NEW ENGAGEMENT';
    btn.onclick = returnToSetup;
    box.appendChild(btn);
  }

  showCloakVulnOverlay(false);
  const sg = document.getElementById('sensor-ghost-overlay'); if (sg) sg.style.display = 'none';
  const mv = document.querySelector('.main-viewport'); if (mv) mv.classList.remove('last-stand-flash');
}
