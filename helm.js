'use strict';

// ============================================================
// HELM — TIMER PROCESSING (called from processNewMechanicsTimers)
// ============================================================
function processHelmTimers(dt) {
  // Attack run active timer
  if (G.attackRunActive) {
    G.attackRunTimer = Math.max(0, G.attackRunTimer - dt);
    if (G.attackRunTimer <= 0) {
      G.attackRunActive = false;
      G.playerRangeBracket = 'medium'; // return to neutral range after run
      postLogEvent("Attack run complete — range returned to medium. CD 20s.", 'good');
    }
    if (G.activePanel === 'helm') updateHelmPanel();
  } else if (G.attackRunCooldown > 0) {
    G.attackRunCooldown = Math.max(0, G.attackRunCooldown - dt);
    if (G.attackRunCooldown <= 0 && G.activePanel === 'helm') updateHelmPanel();
  }

  // Come about rotation timer
  if (G.comeAboutActive) {
    G.comeAboutTimer = Math.max(0, G.comeAboutTimer - dt);
    if (G.comeAboutTimer <= 0) {
      G.comeAboutActive   = false;
      const strongest = ['fore','port','starboard','aft'].reduce((best, s) =>
        G.player.shields[s] > G.player.shields[best] ? s : best, 'fore');
      G.helmAttackVector = strongest;
      postLogEvent(`Come-about complete — ${strongest.toUpperCase()} shields presented (${Math.round(G.player.shields[strongest])}MW).`, 'good');
    }
    if (G.activePanel === 'helm') updateHelmPanel();
  } else if (G.comeAboutCooldown > 0) {
    G.comeAboutCooldown = Math.max(0, G.comeAboutCooldown - dt);
    if (G.comeAboutCooldown <= 0 && G.activePanel === 'helm') updateHelmPanel();
  }
}

// ============================================================
// HELM — SPEED CONTROL
// ============================================================
function setHelmSpeed(speed) {
  if (!HELM_SPEED_CONFIG[speed]) return;
  G.helmSpeed = speed;
  const cfg = HELM_SPEED_CONFIG[speed];
  if (speed === 'full') {
    G.systems.engines.stress = Math.min(100, G.systems.engines.stress + 15);
    postLogEvent(`HELM: FULL IMPULSE — enemy lock −${Math.round((1 - cfg.enemyLockMult) * 100)}% | Engine stress +15%.`, 'warn');
  } else if (speed === 'stop') {
    postLogEvent(`HELM: ALL STOP — stable platform. Weapon yield +10% | Enemy lock rate +35%.`, 'info');
  } else {
    const lockStr  = cfg.enemyLockMult > 1 ? `+${Math.round((cfg.enemyLockMult-1)*100)}%` : `−${Math.round((1-cfg.enemyLockMult)*100)}%`;
    const yieldStr = cfg.yieldMult   >= 1 ? `+${Math.round((cfg.yieldMult-1)*100)}%`  : `−${Math.round((1-cfg.yieldMult)*100)}%`;
    postLogEvent(`HELM: ${cfg.label} — enemy lock ${lockStr} | yield ${yieldStr}.`, 'info');
  }
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — ATTACK VECTOR
// ============================================================
function setHelmAttackVector(sector) {
  if (!['fore','port','starboard','aft'].includes(sector)) return;
  if (G.comeAboutActive) { postLogEvent("Cannot change vector during come-about manoeuvre.", 'warn'); return; }
  G.helmAttackVector = sector;
  const hp = G.running ? Math.round(G.player.shields[sector]) : '—';
  postLogEvent(`HELM: Attack vector ${sector.toUpperCase()} — ${hp}MW shields presented (65% hit probability on that sector).`, 'info');
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — ENGAGEMENT RANGE
// ============================================================
function setPlayerRangeBracket(range) {
  if (!['long','medium','close'].includes(range)) return;
  if (G.attackRunActive) { postLogEvent("Range locked during attack run.", 'warn'); return; }
  G.playerRangeBracket = range;
  const msgs = {
    long:   'Long range — torpedo +15%, cannon −10%.',
    medium: 'Medium range — balanced engagement.',
    close:  'Close quarters — cannon +20%, torpedo −10%.',
  };
  postLogEvent(`HELM: ${msgs[range]}`, 'info');
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  if (range === 'close' && cfg.prefersCloseRange) postTacticalAdvisory("Klingon close range — their disruptors intensify!");
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — ATTACK RUN
// ============================================================
function executeAttackRun() {
  if (!G.running || G.dead) return;
  if (G.attackRunActive)       { postLogEvent("Attack run already in progress.", 'info'); return; }
  if (G.attackRunCooldown > 0) { postLogEvent(`Attack run recharging — ${Math.ceil(G.attackRunCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.engines.health < 25 || G.systems.engines.tripped) { postLogEvent("Engines too damaged for attack run.", 'crit'); return; }
  G.attackRunActive     = true;
  G.attackRunTimer      = 8000;
  G.attackRunCooldown   = 20000;   // starts counting once attackRunActive → false
  G.playerRangeBracket  = 'close';
  G.systems.engines.stress = Math.min(100, G.systems.engines.stress + 35);
  postLogEvent("ATTACK RUN — closing to combat range. Cannon yield +20% for 8s. Engine stress +35%.", 'crit');
  postTacticalAdvisory("Attack run — maximum cannon effectiveness window!");
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — COME ABOUT
// ============================================================
function executeComeAbout() {
  if (!G.running || G.dead) return;
  if (G.comeAboutActive)       { postLogEvent("Come-about already in progress.", 'info'); return; }
  if (G.comeAboutCooldown > 0) { postLogEvent(`Come-about recharging — ${Math.ceil(G.comeAboutCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.engines.health < 20 || G.systems.engines.tripped) { postLogEvent("Engines too damaged for come-about.", 'crit'); return; }
  G.comeAboutActive   = true;
  G.comeAboutTimer    = 3000;
  G.comeAboutCooldown = 18000;
  postLogEvent("COME ABOUT — 3s rotation. All sectors exposed! Will auto-present strongest shields.", 'warn');
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — PANEL UI UPDATE
// ============================================================
function updateHelmPanel() {
  // Speed buttons — white glow on active
  ['stop','maneuvering','half','full'].forEach(s => {
    const btn = document.getElementById(`btn-helm-speed-${s}`); if (!btn) return;
    if (G.helmSpeed === s) {
      btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
    } else {
      btn.style.background = ''; btn.style.color = ''; btn.style.boxShadow = '';
    }
  });

  // Vector buttons — live shield HP + white/blue glow on active
  ['fore','port','starboard','aft'].forEach(s => {
    const btn = document.getElementById(`btn-helm-vector-${s}`); if (!btn) return;
    const hp    = G.running ? Math.ceil(G.player.shields[s]) : '—';
    const pct   = G.running ? (G.player.shields[s] / G.player.shields.maxSectorValue) * 100 : 100;
    const hpCol = pct > 66 ? '#00ff88' : pct > 33 ? '#ffaa00' : '#ff4444';
    const arrow = { fore:'▲', aft:'▼', port:'◄', starboard:'►' }[s];
    btn.innerHTML = `${arrow} ${s.toUpperCase()}<br><span style="font-size:8px;color:${hpCol};font-weight:bold;">${hp} MW</span>`;
    if (G.comeAboutActive) {
      btn.style.background = '#ff3333'; btn.style.color = '#fff'; btn.style.boxShadow = '0 0 8px rgba(255,50,50,0.6)';
    } else if (G.helmAttackVector === s) {
      btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 10px rgba(68,119,255,0.8)';
    } else {
      btn.style.background = ''; btn.style.color = ''; btn.style.boxShadow = '';
    }
  });

  // Range buttons — white/orange glow on active
  ['long','medium','close'].forEach(r => {
    const btn = document.getElementById(`btn-helm-range-${r}`); if (!btn) return;
    if (G.playerRangeBracket === r && !G.attackRunActive) {
      btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 10px rgba(255,153,0,0.6)';
    } else if (G.attackRunActive && r === 'close') {
      btn.style.background = '#ff3333'; btn.style.color = '#fff'; btn.style.boxShadow = '0 0 8px rgba(255,50,50,0.6)';
    } else {
      btn.style.background = ''; btn.style.color = ''; btn.style.boxShadow = '';
    }
  });

  // Attack run button
  const arBtn = document.getElementById('btn-helm-attack-run');
  if (arBtn) {
    if (G.attackRunActive)            { arBtn.textContent = `◈ ATTACK RUN ${Math.ceil(G.attackRunTimer/1000)}s`; arBtn.style.background='#ff3333'; arBtn.style.color='#fff'; arBtn.style.boxShadow='0 0 12px rgba(255,50,50,0.7)'; }
    else if (G.attackRunCooldown > 0) { arBtn.textContent = `◈ ATK RUN CD ${Math.ceil(G.attackRunCooldown/1000)}s`; arBtn.style.background='var(--dim2)'; arBtn.style.color='#556677'; arBtn.style.boxShadow=''; }
    else                              { arBtn.textContent = '◈ ATTACK RUN'; arBtn.style.background=''; arBtn.style.color=''; arBtn.style.boxShadow=''; }
  }

  // Come about button
  const caBtn = document.getElementById('btn-helm-come-about');
  if (caBtn) {
    if (G.comeAboutActive)            { caBtn.textContent = `↺ ROTATING ${Math.ceil(G.comeAboutTimer/1000)}s`; caBtn.style.background='#ff3333'; caBtn.style.color='#fff'; caBtn.style.boxShadow='0 0 12px rgba(255,50,50,0.7)'; }
    else if (G.comeAboutCooldown > 0) { caBtn.textContent = `↺ COME ABOUT CD ${Math.ceil(G.comeAboutCooldown/1000)}s`; caBtn.style.background='var(--dim2)'; caBtn.style.color='#556677'; caBtn.style.boxShadow=''; }
    else                              { caBtn.textContent = '↺ COME ABOUT'; caBtn.style.background=''; caBtn.style.color=''; caBtn.style.boxShadow=''; }
  }

  // Evasive button (mirrored from tactical deck)
  const evBtn = document.getElementById('btn-evasive-helm');
  if (evBtn) {
    if (G.evasiveActive)            { evBtn.textContent=`◈ EVADING ${Math.ceil(G.evasiveCooldown/1000)}s`; evBtn.style.background='#00ff88'; evBtn.style.color='#000'; evBtn.style.boxShadow='0 0 10px rgba(0,255,136,0.6)'; }
    else if (G.evasiveCooldown > 0) { evBtn.textContent=`◈ EVASIVE CD ${Math.ceil(G.evasiveCooldown/1000)}s`; evBtn.style.background='var(--dim2)'; evBtn.style.color='#556677'; evBtn.style.boxShadow=''; }
    else                            { evBtn.textContent='◈ EVASIVE DELTA'; evBtn.style.background=''; evBtn.style.color=''; evBtn.style.boxShadow=''; }
  }

  // Live status line — speed effects, vector, range
  const rl = document.getElementById('lbl-helm-range-status');
  if (rl) {
    const sc       = HELM_SPEED_CONFIG[G.helmSpeed];
    const lockStr  = sc.enemyLockMult > 1 ? `+${Math.round((sc.enemyLockMult-1)*100)}%` : `−${Math.round((1-sc.enemyLockMult)*100)}%`;
    const yieldStr = sc.yieldMult >= 1 ? `+${Math.round((sc.yieldMult-1)*100)}%` : `−${Math.round((1-sc.yieldMult)*100)}%`;
    const effRange = G.attackRunActive ? 'CLOSE★' : G.playerRangeBracket.toUpperCase();
    rl.innerHTML = G.comeAboutActive
      ? `<span style="color:#ff4444;font-weight:bold;">⚠ ROTATING — ALL SECTORS EXPOSED (${Math.ceil(G.comeAboutTimer/1000)}s)</span>`
      : `Speed: <b style="color:#fff;">${sc.label}</b> | Lock <b style="color:${sc.enemyLockMult>1?'#ff6666':'#00cc66'};">${lockStr}</b> | Yield <b style="color:${sc.yieldMult>=1?'#00cc66':'#ffaa00'};">${yieldStr}</b> | Vec: <b style="color:#88aaff;">${G.helmAttackVector.toUpperCase()}</b> | Range: <b style="color:#ffaa00;">${effRange}</b>`;
  }

  // Auto-tactical summary
  const at = document.getElementById('lbl-helm-autotac');
  if (at) {
    const healthy = ['cannon_pu','cannon_pl','cannon_su','cannon_sl'].filter(k => !G.systems[k].tripped && G.systems[k].health >= 15).length;
    const torpsOk = !G.systems.torpedoes.tripped && G.player.torpedoes > 0;
    const lockCol = G.lockProgress >= 60 ? '#00cc66' : G.lockProgress >= 20 ? '#ffaa00' : '#ff4444';
    at.innerHTML = `${healthy}/4 cannons · Torps: <b style="color:${torpsOk?'#00cc66':'#ff4444'};">${torpsOk?'RDY':'LOW'}</b> · Lock: <b style="color:${lockCol};">${Math.round(G.lockProgress)}%</b> · ${G.cloaked ? '<span style="color:#9966cc;">[CLOAKED]</span>' : '<span style="color:#00cc66;">FIRING</span>'}`;
  }

  // Auto-engineering summary
  const ae = document.getElementById('lbl-helm-autoeng');
  if (ae) {
    const teamA  = G.repairTeams[0].sysKey ? `<b style="color:#ffaa00;">A→${G.repairTeams[0].label.split(' ').slice(-1)[0]}</b>` : '<span style="color:#556677;">A:idle</span>';
    const teamB  = G.repairTeams[1].sysKey ? `<b style="color:#ffaa00;">B→${G.repairTeams[1].label.split(' ').slice(-1)[0]}</b>` : '<span style="color:#556677;">B:idle</span>';
    const heatCol = G.epsHeat > 70 ? '#ff4444' : G.epsHeat > 40 ? '#ffaa00' : '#00cc66';
    ae.innerHTML = `${teamA} · ${teamB} · EPS: <b style="color:#fff;">${getTotalAllocatedPower()}/${getWarpOutput()}MW</b> · Heat: <b style="color:${heatCol};">${Math.round(G.epsHeat)}%</b>`;
  }
}
