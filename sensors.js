'use strict';

// ============================================================
// SENSORS.JS — Scan profiles, subsystem targeting, active sensors
// Depends on: config.js, state.js
// ============================================================

// ── Scan profiles ─────────────────────────────────────────────
function activateScanProfile(type) {
  G.activeScanProfile = type;
  G.scanAnalysisProgress = 0;
  document.querySelectorAll('.scan-profile-btn').forEach(b => b.classList.remove('active-scan'));
  const btn = document.getElementById(`scan-btn-${type}`); if (btn) btn.classList.add('active-scan');
  postLogEvent(`Sensor sweep: [${type.toUpperCase()}] profile selected.`, 'info');
}

function commitScanProfile() {
  if (!G.activeScanProfile || G.scanAnalysisProgress < 100) { postLogEvent("Analysis incomplete — hold profile longer.", 'warn'); return; }
  const bonuses = {
    shields: { type:'shields', value:1.25, duration:25000, msg:"+25% weapon yield vs shields for 25s." },
    hull:    { type:'hull',    value:1.35, duration:20000, msg:"+35% all damage for 20s." },
    weapons: { type:'weapons', value:1.0,  duration:30000, msg:"Enemy weapons disrupted for 30s." },
    tetryon: { type:'tetryon', value:0.3,  duration:15000, msg:"Tetryon pulse — false warp signature. Enemy lock rate −70% for 15s." },
  };
  const b = bonuses[G.activeScanProfile];
  G.scanBonus = { type:b.type, value:b.value, expiry:performance.now() + b.duration };
  if (b.type === 'weapons') {
    G.weaponsDisrupted = true;
    G.weaponsDisruptedTimer = b.duration;
  }
  postLogEvent(b.msg, 'good');
  crewReportScanCommitted(G.activeScanProfile);
  if (b.type === 'weapons') crewReportWeaponsDisrupted();
  G.activeScanProfile = null;
  G.scanAnalysisProgress = 0;
  document.querySelectorAll('.scan-profile-btn').forEach(btn => btn.classList.remove('active-scan'));
  const bl = document.getElementById('lbl-scan-bonus');
  if (bl) { bl.textContent = `ACTIVE: ${b.type.toUpperCase()}`; bl.style.cssText = 'background:rgba(0,204,102,0.15);color:var(--green);border:1px solid var(--green);font-size:9px'; }
}

function toggleActiveSensorSystems() {
  G.activeScanningProfile = !G.activeScanningProfile;
  ['btn-active-scanner-toggle','btn-active-scanner-toggle-tac'].forEach(id => {
    const btn = document.getElementById(id); if (!btn) return;
    btn.textContent = G.activeScanningProfile ? "ACTIVE SWEEP ON" : "Passive Scan";
    if (G.activeScanningProfile) btn.classList.add('red-btn'); else btn.classList.remove('red-btn');
  });
  if (G.activeScanningProfile) {
    G.threat.fireInterval = Math.round(G.threat.fireInterval * 0.85);
    postLogEvent("Active scanning on — enemy also benefits from better targeting.", 'warn');
  } else {
    G.threat.fireInterval = Math.round(ENEMY_CONFIGS[G.enemyArchetype].fireInterval * DIFFICULTY[currentDifficulty].enemyFireMult);
    postLogEvent("Passive tracking restored.", 'info');
  }
}

// ── Enemy subsystem targeting ─────────────────────────────────
function buildEnemySubsystemTargetGrid() {
  const grid = document.getElementById('enemy-subsystem-target-grid'); if (!grid) return;
  grid.innerHTML = '';
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  const targets = [
    { key:'hull',    label:'Hull',    arc:'All' },
    { key:'shields', label:'Shields', arc:'All' },
    ...Object.keys(cfg.systems).map(k => ({
      key: k,
      label: cfg.systems[k].label.split(' ').slice(-1)[0],
      arc: cfg.systems[k].firingArc.length ? cfg.systems[k].firingArc.join('/') : 'passive'
    }))
  ];
  targets.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'pill-action-btn warn-btn';
    btn.style.cssText = 'font-size:9px;padding:3px 4px;border-radius:6px;';
    btn.id = `enemy-tgt-btn-${t.key}`;
    btn.textContent = t.label;
    btn.onclick = () => setEnemyTarget(t.key, t.label, t.arc);
    grid.appendChild(btn);
  });
  setEnemyTarget('hull', 'Hull', 'All');
}

function setEnemyTarget(key, label, arc) {
  G.targetedSubsystemType = key;
  if (G.activeScanProfile && G.scanAnalysisProgress > 20) {
    postLogEvent(`Scan analysis interrupted — switching target resets sensor focus. Progress lost.`, 'warn');
  }
  G.lockProgress = Math.max(0, G.lockProgress - 30);
  G.scanAnalysisProgress = 0;
  document.querySelectorAll('[id^="enemy-tgt-btn-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`enemy-tgt-btn-${key}`); if (btn) btn.classList.add('active');
  const t = document.getElementById('txt-current-target'); if (t) t.textContent = label.toUpperCase();
  const a = document.getElementById('txt-firing-arc');     if (a) a.textContent = `Arc: ${arc}`;
  postLogEvent(`Target: [${label.toUpperCase()}]. Lock partially reset.`, 'info');
}
