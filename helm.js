'use strict';

// ============================================================
// HELM — TIMER PROCESSING (called from processNewMechanicsTimers)
// ============================================================
// Shared active/cooldown tick for a helm manoeuvre. `onExpire` runs once when the
// active window ends (it owns any deferred cooldown assignment, e.g. Omega).
function _tickManoeuvre(dt, m) {
  if (G[m.active]) {
    G[m.timer] = Math.max(0, G[m.timer] - dt);
    if (G[m.timer] <= 0) { G[m.active] = false; m.onExpire(); }
    if (G.activePanel === 'helm') updateHelmPanel();
  } else if (G[m.cd] > 0) {
    G[m.cd] = Math.max(0, G[m.cd] - dt);
    if (G[m.cd] <= 0 && G.activePanel === 'helm') updateHelmPanel();
  }
}

const _HELM_MANOEUVRES = [
  { active:'attackRunActive', timer:'attackRunTimer', cd:'attackRunCooldown',
    onExpire() { G.playerRangeBracket = 'medium'; postLogEvent("Attack run complete — range returned to medium. CD 20s.", 'good'); crewReportAttackRunComplete(); } },
  { active:'picardManoeuverActive', timer:'picardManoeuverTimer', cd:'picardManoeuverCooldown',
    onExpire() { postLogEvent("Picard Manoeuvre window closed — enemy targeting restored.", 'warn'); } },
  { active:'attackPatternOmegaActive', timer:'attackPatternOmegaTimer', cd:'attackPatternOmegaCooldown',
    onExpire() { G.attackPatternOmegaCooldown = 45000; postLogEvent("Attack Pattern Omega complete — defensive posture restored.", 'good'); } },
  { active:'evasiveAlphaActive', timer:'evasiveAlphaTimer', cd:'evasiveAlphaCooldown',
    onExpire() { postLogEvent("Evasive Pattern Alpha complete.", 'info'); } },
  { active:'comeAboutActive', timer:'comeAboutTimer', cd:'comeAboutCooldown',
    onExpire() { const s = getStrongestShieldSector(); G.helmAttackVector = s; postLogEvent(`Come-about complete — ${s.toUpperCase()} shields presented (${Math.round(G.player.shields[s])}MW).`, 'good'); crewReportComeAboutComplete(s); } },
];

function processHelmTimers(dt) {
  _HELM_MANOEUVRES.forEach(m => _tickManoeuvre(dt, m));
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
// HELM — ELEVATION (CLIMB / LEVEL / DIVE)
// Vertical posture vs the enemy. The enemy actively positions above/below to
// deny your dorsal/ventral arrays; match its elevation to bring guns to bear.
// ============================================================
function setHelmPitch(pitch) {
  if (!['climb','level','dive'].includes(pitch)) return;
  G.helmPitch = pitch;
  const msg = { climb: 'CLIMBING — gaining elevation on the target.',
                level: 'LEVELLING — holding the engagement plane.',
                dive:  'DIVING — dropping below the target.' }[pitch];
  postLogEvent(`HELM: ${msg}`, 'info');
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
// HELM — PICARD MANOEUVRE
// Micro-warp jump: ship appears in two places simultaneously.
// Enemy targeting collapses; 3s window where enemy cannot fire
// and all player weapons deal ×1.5 damage.
// ============================================================
function executePicardManoeuver() {
  if (!G.running || G.dead) return;
  if (G.picardManoeuverActive)       { postLogEvent("Picard Manoeuvre already active.", 'info'); return; }
  if (G.picardManoeuverCooldown > 0) { postLogEvent(`Picard Manoeuvre recharging — ${Math.ceil(G.picardManoeuverCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.warp_core.tripped || G.systems.warp_core.health < 40) { postLogEvent("Warp core insufficient for micro-jump — Picard Manoeuvre unavailable.", 'crit'); return; }
  if (G.cloaked) { postLogEvent("Cannot execute while cloaked.", 'warn'); return; }
  G.picardManoeuverActive    = true;
  G.picardManoeuverTimer     = 3000;
  G.picardManoeuverCooldown  = 60000;
  G.enemyLockProgress        = 0; // enemy tracking collapses completely
  G.systems.warp_core.stress = Math.min(100, G.systems.warp_core.stress + 30);
  postLogEvent("PICARD MANOEUVRE — micro-warp jump executed! Enemy targeting collapsed. 3s fire window!", 'crit');
  postTacticalAdvisory("All weapons — fire at will during confusion window!");
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — ATTACK PATTERN OMEGA
// Maximum sustained weapons output at the cost of defensive
// posture. All weapon yields ×1.4 for 10s; incoming damage ×1.2.
// ============================================================
function executeAttackPatternOmega() {
  if (!G.running || G.dead) return;
  if (G.attackPatternOmegaActive)       { postLogEvent("Attack Pattern Omega already active.", 'info'); return; }
  if (G.attackPatternOmegaCooldown > 0) { postLogEvent(`Attack Pattern Omega recharging — ${Math.ceil(G.attackPatternOmegaCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.engines.tripped || G.systems.engines.health < 20) { postLogEvent("Engines too damaged for Pattern Omega.", 'crit'); return; }
  G.attackPatternOmegaActive   = true;
  G.attackPatternOmegaTimer    = 10000;
  G.systems.engines.stress     = Math.min(100, G.systems.engines.stress + 20);
  postLogEvent("ATTACK PATTERN OMEGA — weapons ×1.4 for 10s. Shields compromised — incoming damage +20%.", 'crit');
  postTacticalAdvisory("Pattern Omega engaged — press the attack while it lasts!");
  if (G.activePanel === 'helm') updateHelmPanel();
}

// ============================================================
// HELM — EVASIVE PATTERN ALPHA
// Emergency lock-breaker. Instantly drops enemy lock by 70%
// then slows lock build rate ×0.5 for 5s.
// Unlike Pattern Delta (proactive), Alpha is reactive —
// use when enemy is near full lock and about to fire.
// ============================================================
function executeEvasivePatternAlpha() {
  if (!G.running || G.dead) return;
  if (G.evasiveAlphaActive)       { postLogEvent("Evasive Pattern Alpha already active.", 'info'); return; }
  if (G.evasiveAlphaCooldown > 0) { postLogEvent(`Evasive Pattern Alpha recharging — ${Math.ceil(G.evasiveAlphaCooldown/1000)}s.`, 'warn'); return; }
  if (G.systems.engines.health < 15 || G.systems.engines.tripped) { postLogEvent("Engines too damaged for Pattern Alpha.", 'crit'); return; }
  G.evasiveAlphaActive  = true;
  G.evasiveAlphaTimer   = 5000;
  G.evasiveAlphaCooldown = 15000;
  G.enemyLockProgress   = Math.max(0, G.enemyLockProgress * 0.30); // drop lock 70%
  G.systems.engines.stress = Math.min(100, G.systems.engines.stress + 15);
  postLogEvent(`EVASIVE PATTERN ALPHA — enemy lock dropped to ${Math.round(G.enemyLockProgress)}%. Lock rate −50% for 5s.`, 'good');
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
  const _g = id => (typeof _EL !== 'undefined' && _EL[id]) || document.getElementById(id);
  // Speed buttons — white glow on active
  ['stop','maneuvering','half','full'].forEach(s => {
    const btn = _g(`btn-helm-speed-${s}`); if (!btn) return;
    if (G.helmSpeed === s) {
      btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
    } else {
      btn.style.background = ''; btn.style.color = ''; btn.style.boxShadow = '';
    }
  });

  // Vector buttons — live shield HP + white/blue glow on active
  SHIELD_SECTORS.forEach(s => {
    const btn = _g(`btn-helm-vector-${s}`); if (!btn) return;
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

  // Elevation buttons — climb/level/dive
  ['climb','level','dive'].forEach(p => {
    const btn = _g(`btn-helm-pitch-${p}`); if (!btn) return;
    if ((G.helmPitch || 'level') === p) {
      btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 10px rgba(120,200,255,0.7)';
    } else {
      btn.style.background = ''; btn.style.color = ''; btn.style.boxShadow = '';
    }
  });

  // Range buttons — white/orange glow on active
  ['long','medium','close'].forEach(r => {
    const btn = _g(`btn-helm-range-${r}`); if (!btn) return;
    if (G.playerRangeBracket === r && !G.attackRunActive) {
      btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 10px rgba(255,153,0,0.6)';
    } else if (G.attackRunActive && r === 'close') {
      btn.style.background = '#ff3333'; btn.style.color = '#fff'; btn.style.boxShadow = '0 0 8px rgba(255,50,50,0.6)';
    } else {
      btn.style.background = ''; btn.style.color = ''; btn.style.boxShadow = '';
    }
  });

  // Manoeuvre buttons — active/cooldown/ready state
  function _setManoeuvreBtn(id, active, timer, cd, labels, activeCol) {
    const btn = _g(id); if (!btn) return;
    if (active)  { btn.textContent=`${labels[0]} ${Math.ceil(timer/1000)}s`; btn.style.background=activeCol; btn.style.color=activeCol==='#fff'?'#000':'#fff'; btn.style.boxShadow=`0 0 12px ${activeCol}88`; }
    else if (cd) { btn.textContent=`${labels[1]} ${Math.ceil(cd/1000)}s`;    btn.style.background='var(--dim2)'; btn.style.color='#556677'; btn.style.boxShadow=''; }
    else         { btn.textContent=labels[2];                                 btn.style.background=''; btn.style.color=''; btn.style.boxShadow=''; }
  }

  _setManoeuvreBtn('btn-helm-attack-run',    G.attackRunActive,          G.attackRunTimer,          G.attackRunCooldown,          ['◈ ATTACK RUN','◈ ATK RUN CD','◈ ATTACK RUN'],         '#ff3333');
  _setManoeuvreBtn('btn-helm-come-about',    G.comeAboutActive,          G.comeAboutTimer,          G.comeAboutCooldown,          ['↺ ROTATING','↺ COME ABOUT CD','↺ COME ABOUT'],         '#ff3333');
  _setManoeuvreBtn('btn-helm-picard',        G.picardManoeuverActive,    G.picardManoeuverTimer,    G.picardManoeuverCooldown,    ['∞ PICARD','∞ PICARD CD','∞ PICARD MANOEUVER'],          '#fff');
  _setManoeuvreBtn('btn-helm-omega',         G.attackPatternOmegaActive, G.attackPatternOmegaTimer, G.attackPatternOmegaCooldown, ['Ω PATTERN OMEGA','Ω OMEGA CD','Ω ATTACK PATTERN OMEGA'],'#ff6600');
  _setManoeuvreBtn('btn-helm-evasive-alpha', G.evasiveAlphaActive,       G.evasiveAlphaTimer,       G.evasiveAlphaCooldown,       ['◈ EVS ALPHA','◈ ALPHA CD','◈ EVASIVE ALPHA'],           '#00ff88');
  _setManoeuvreBtn('btn-evasive-helm',       G.evasiveActive,            G.evasiveCooldown,         G.evasiveActive?0:G.evasiveCooldown, ['◈ EVADING','◈ EVASIVE CD','◈ EVASIVE DELTA'],   '#00ff88');

  // Live status line — speed effects, vector, range
  const rl = document.getElementById('lbl-helm-range-status');
  if (rl) {
    const sc       = HELM_SPEED_CONFIG[G.helmSpeed];
    const lockStr  = sc.enemyLockMult > 1 ? `+${Math.round((sc.enemyLockMult-1)*100)}%` : `−${Math.round((1-sc.enemyLockMult)*100)}%`;
    const yieldStr = sc.yieldMult >= 1 ? `+${Math.round((sc.yieldMult-1)*100)}%` : `−${Math.round((1-sc.yieldMult)*100)}%`;
    const effRange = G.attackRunActive ? 'CLOSE★' : G.playerRangeBracket.toUpperCase();
    const _elev = G.enemyElevation || 'level';
    const _elevStr = _elev === 'above' ? '▲ ABOVE' : _elev === 'below' ? '▼ BELOW' : '◆ LEVEL';
    // Green only when level (best firing solution); amber when the enemy has
    // gained a vertical advantage you haven't matched.
    const _elevCol = _elev === 'level' ? '#00cc66' : '#ffaa00';
    const _pitch = G.helmPitch || 'level';
    const _pitchStr = _pitch === 'climb' ? '▲ CLIMB' : _pitch === 'dive' ? '▼ DIVE' : '◆ LEVEL';
    // Lateral flank: where the enemy bears relative to the ship's nose. Guns bear
    // best when it's dead ahead (fore); turn that way to bring the enemy forward.
    const _foe = (typeof effectiveEnemySector === 'function' ? effectiveEnemySector() : 'fore');
    const _foeArrow = { fore:'▲ FORE', port:'◄ PORT', starboard:'► STBD', aft:'▼ AFT' }[_foe] || _foe.toUpperCase();
    const _gunsBear = _foe === 'fore';
    const _foeCol = _gunsBear ? '#00cc66' : '#ff6666';
    rl.innerHTML = G.comeAboutActive
      ? `<span style="color:#ff4444;font-weight:bold;">⚠ ROTATING — ALL SECTORS EXPOSED (${Math.ceil(G.comeAboutTimer/1000)}s)</span>`
      : `Speed: <b style="color:#fff;">${sc.label}</b> | Lock <b style="color:${sc.enemyLockMult>1?'#ff6666':'#00cc66'};">${lockStr}</b> | Yield <b style="color:${sc.yieldMult>=1?'#00cc66':'#ffaa00'};">${yieldStr}</b> | Vec: <b style="color:#88aaff;">${G.helmAttackVector.toUpperCase()}</b> | Range: <b style="color:#ffaa00;">${effRange}</b> | Us: <b style="color:#88ccff;">${_pitchStr}</b> | Tgt: <b style="color:${_elevCol};">${_elevStr}</b> | Foe: <b style="color:${_foeCol};">${_foeArrow}${_gunsBear?'':' — TURN!'}</b>`;
  }

  // Auto-tactical summary
  const at = _g('lbl-helm-autotac');
  if (at) {
    const _isEnt    = G.playerShipKey === 'enterprise_e';
    const _wpnKeys  = (_isEnt ? G.playerShipConfig?.primaryWeaponKeys : null) || ['cannon_pu','cannon_pl','cannon_su','cannon_sl'];
    const _sysList  = [...new Set(_wpnKeys.map(k => (G.activeWeaponArrays||ARRAYS_DICTIONARY)[k]?.parentSystem).filter(Boolean))];
    const healthy   = _sysList.filter(k => G.systems[k] && !G.systems[k].tripped && G.systems[k].health >= 15).length;
    const _wpnLabel = _isEnt ? `arrays` : 'cannons';
    const torpsOk = !G.systems.torpedoes.tripped && (G.player.torpedoes > 0 || G.player.photonTorpedoes > 0);
    const lockCol = G.lockProgress >= 60 ? '#00cc66' : G.lockProgress >= 20 ? '#ffaa00' : '#ff4444';
    at.innerHTML = `${healthy}/${_sysList.length||4} ${_wpnLabel} · Torps: <b style="color:${torpsOk?'#00cc66':'#ff4444'};">${torpsOk?'RDY':'LOW'}</b> · Lock: <b style="color:${lockCol};">${Math.round(G.lockProgress)}%</b> · ${G.cloaked ? '<span style="color:#9966cc;">[CLOAKED]</span>' : '<span style="color:#00cc66;">FIRING</span>'}`;
  }

  // Auto-engineering summary
  const ae = _g('lbl-helm-autoeng');
  if (ae) {
    const teamA  = G.repairTeams[0].sysKey ? `<b style="color:#ffaa00;">A→${G.repairTeams[0].label.split(' ').slice(-1)[0]}</b>` : '<span style="color:#556677;">A:idle</span>';
    const teamB  = G.repairTeams[1].sysKey ? `<b style="color:#ffaa00;">B→${G.repairTeams[1].label.split(' ').slice(-1)[0]}</b>` : '<span style="color:#556677;">B:idle</span>';
    const heatCol = G.epsHeat > 70 ? '#ff4444' : G.epsHeat > 40 ? '#ffaa00' : '#00cc66';
    ae.innerHTML = `${teamA} · ${teamB} · EPS: <b style="color:#fff;">${getTotalAllocatedPower()}/${getWarpOutput()}MW</b> · Heat: <b style="color:${heatCol};">${Math.round(G.epsHeat)}%</b>`;
  }
}

// --- Battle reset (called by initiateVesselSimulation) ---
// Owns speed, attack vector, range and all helm-manoeuvre timers/cooldowns.
function helmResetForBattle() {
  G.helmSpeed                  = 'half';
  G.helmAttackVector           = 'fore';
  G.helmPitch                  = 'level';
  G.playerRangeBracket         = 'long';
  G.attackRunActive            = false;
  G.attackRunTimer             = 0;
  G.attackRunCooldown          = 0;
  G.comeAboutActive            = false;
  G.comeAboutTimer             = 0;
  G.comeAboutCooldown          = 0;
  G.picardManoeuverActive      = false;
  G.picardManoeuverTimer       = 0;
  G.picardManoeuverCooldown    = 0;
  G.attackPatternOmegaActive   = false;
  G.attackPatternOmegaTimer    = 0;
  G.attackPatternOmegaCooldown = 0;
  G.evasiveAlphaActive         = false;
  G.evasiveAlphaTimer          = 0;
  G.evasiveAlphaCooldown       = 0;
}
