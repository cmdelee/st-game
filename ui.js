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
  const eu = document.getElementById('eng-utility-panel');
  if (eu) eu.style.display = key === 'engineering' ? 'flex' : 'none';
  const gs = document.getElementById('lbl-automation-status');
  if (gs) gs.textContent = key === 'tactical' ? 'TACTICAL ROLE' : key === 'helm' ? 'HELM ROLE' : 'ENGINEERING ROLE';
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

  // Player shield bars
  ['fore','port','starboard','aft'].forEach(s => {
    const bar = document.getElementById(`bar-shield-${s}`);
    if (bar) {
      const pct = G.cloaked ? 0 : (G.player.shields[s] / G.player.shields.maxSectorValue) * 100;
      bar.style.width = `${pct}%`;
      bar.style.color = G.cloaked ? C.p : pct > 66 ? C.green : pct > 33 ? C.warn : C.red;
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

  // Cloak power bar (right)
  const cpb = document.getElementById('bar-cloak-power');    if (cpb) cpb.style.width = `${G.cloakPowerReserve}%`;
  const cps = document.getElementById('txt-cloak-power-status');
  if (cps) {
    if (G.cloaked)            cps.textContent = `Draining: ${Math.round(G.cloakPowerReserve)}%`;
    else if (G.cloakCooldown > 0) cps.textContent = `Recharge: ${Math.ceil(G.cloakCooldown / 1000)}s`;
    else                      cps.textContent = 'Ready';
  }

  // Cloak status bar (tactical panel)
  const csb = document.getElementById('cloak-status-bar'); const cst = document.getElementById('cloak-status-text'); const cpd = document.getElementById('cloak-power-drain');
  if (csb) {
    if (G.cloakVulnTimer > 0)   { csb.style.display='flex'; if(cst)cst.textContent='⚡ CLOAK TRANSITION — NO SHIELDS'; csb.style.color='var(--red)'; csb.style.borderColor='var(--red)'; if(cpd)cpd.textContent=''; }
    else if (G.cloaked)          { csb.style.display='flex'; if(cst)cst.textContent='◉ CLOAKED — WEAPONS & SHIELDS OFFLINE'; csb.style.color='var(--p)'; csb.style.borderColor='var(--p)'; if(cpd)cpd.textContent=`PWR:${Math.round(G.cloakPowerReserve)}% (${G.cloakPowerDrainRate}%/s)`; }
    else if (G.cloakCooldown > 0) { csb.style.display='flex'; if(cst)cst.textContent=`◌ RECHARGING ${Math.ceil(G.cloakCooldown/1000)}s`; csb.style.color='var(--warn)'; csb.style.borderColor='var(--warn)'; if(cpd)cpd.textContent=''; }
    else                          { csb.style.display='none'; }
  }

  // Weapon capacitor bars
  Object.keys(ARRAYS_DICTIONARY).forEach(wk => {
    const wd  = ARRAYS_DICTIONARY[wk]; const sys = G.systems[wd.parentSystem];
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
    abDiv.innerHTML = `<span style="font-family:'Antonio';font-size:9px;color:#6688aa;">ABLATIVE</span> ${layerStr} <span style="font-size:9px;color:${col};">${ab.layers}/5</span>`;
  }

  // Weapon health strip
  const ws = document.getElementById('weapon-health-strip');
  if (ws) {
    const wk = [{k:'cannon_pu',l:'P/U'},{k:'cannon_pl',l:'P/L'},{k:'cannon_su',l:'S/U'},{k:'cannon_sl',l:'S/L'},{k:'nose_beam',l:'NSE'},{k:'torpedoes',l:'TRP'},{k:'cloak_dev',l:'CLK'},{k:'warp_core',l:'WRP'}];
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
      const ab  = { cannon_pu:'P/U', cannon_pl:'P/L', cannon_su:'S/U', cannon_sl:'S/L', nose_beam:'NSE', torpedoes:'TRP', cloak_dev:'CLK', warp_core:'WRP', shields:'SHD', sensors:'SEN', engines:'ENG' }[key];
      const rep = G.repairTeams.some(t => t.sysKey === key);
      return `<div style="display:flex;align-items:center;gap:3px;margin-bottom:1px;">
        <span style="width:22px;font-size:9px;color:#6688aa;font-family:'Roboto Mono';">${ab}</span>
        <div class="bar-rail" style="height:7px;flex:1;margin-bottom:0;"><div class="bar-fill" style="color:${col};width:${sys.tripped ? 0 : h}%;"></div></div>
        <span style="width:24px;font-size:9px;font-weight:bold;color:${col};text-align:right;">${sys.tripped ? 'OFF' : h + '%'}</span>
        ${sys.tripped ? '<span style="font-size:8px;color:var(--red);">⊘</span>' : rep ? '<span style="font-size:8px;color:var(--warn);">🔧</span>' : ''}
      </div>`;
    }).join('');
  }

  // Burst-fire button state
  const bfBtn = document.getElementById('btn-burst-fire');
  if (bfBtn) {
    if (!G.burstFireReady) {
      bfBtn.textContent = `⚡⚡ BURST CD ${Math.ceil(G.burstFireCooldown/1000)}s`;
      bfBtn.style.background = 'var(--dim2)'; bfBtn.style.color = '#aabbcc';
    } else {
      bfBtn.textContent = '⚡⚡ BURST SALVO — 4-CANNON BARRAGE';
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
    box.innerHTML = '<div style="color:var(--o);font-weight:bold;margin-bottom:4px;font-family:\'Antonio\'">BATTLE LOG (last 20):</div>';
    G.historicalLogTracks.slice(-20).forEach(e => {
      const d = document.createElement('div');
      d.style.color = { info:'#aabbcc', good:'#00cc66', warn:'#ffaa00', crit:'#ff4444' }[e.tier] || '#aabbcc';
      d.textContent = `[${e.ts}] ${e.msg}`;
      box.appendChild(d);
    });
    const btn = document.createElement('button');
    btn.className = 'pill-action-btn warn-btn';
    btn.style.cssText = 'width:100%;margin-top:10px;padding:10px;';
    btn.textContent = 'REBOOT SYSTEMS';
    btn.onclick = () => location.reload();
    box.appendChild(btn);
  }

  showCloakVulnOverlay(false);
  const sg = document.getElementById('sensor-ghost-overlay'); if (sg) sg.style.display = 'none';
}
