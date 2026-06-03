'use strict';

// ============================================================
// SENSORS.JS — Deep sensor scan, subsystem targeting
// Depends on: config.js, state.js
// ============================================================

// ── Per-enemy scan results (permanent bonuses revealed) ───────
// Each entry is an array of bonus objects the deep scan finds.
// shield_freq: permanent 25% damage reduction vs that weapon type
// hull_weakness: permanent +20% outgoing damage
// sensor_blind: permanent −40% enemy lock rate
// weapon_disrupt: permanent +30% slower enemy fire interval
const _SCAN_RESULTS = {
  ktinga:              [ { type:'shield_freq',   weaponType:'disruptors', label:'Disruptor freq locked'  },
                         { type:'hull_weakness',  label:'Structural weak points mapped'                  } ],
  vor_cha:             [ { type:'shield_freq',   weaponType:'disruptors', label:'Wing disruptor freq locked' },
                         { type:'weapon_disrupt', label:'Fire control disrupted'                          } ],
  romulan_bop:         [ { type:'shield_freq',   weaponType:'plasma',    label:'Plasma torpedo freq locked' },
                         { type:'sensor_blind',   label:'Sensor masking identified'                       } ],
  romulan_warbird:     [ { type:'shield_freq',   weaponType:'plasma',    label:'Plasma torpedo freq locked' },
                         { type:'hull_weakness',  label:'D\'Deridex stress fractures mapped'              } ],
  cardassian_scout:    [ { type:'weapon_disrupt', label:'Fire control jammed'                             },
                         { type:'sensor_blind',   label:'Sensor frequency identified'                     } ],
  galor_class:         [ { type:'hull_weakness',  label:'Galor hull stress points mapped'                 },
                         { type:'weapon_disrupt', label:'Targeting subroutines disrupted'                 } ],
  jem_hadar_fighter:   [ { type:'shield_freq',   weaponType:'polaron',   label:'Polaron freq partially locked' },
                         { type:'sensor_blind',   label:'Dominion sensor pattern identified'              } ],
  jem_hadar_battleship:[ { type:'hull_weakness',  label:'Battle cruiser stress fractures mapped'          },
                         { type:'shield_freq',   weaponType:'polaron',   label:'Polaron freq partially locked' } ],
  borg_probe:          [ { type:'shield_freq',   weaponType:'phasers',   label:'Borg freq (temporary)'   },
                         { type:'hull_weakness',  label:'Borg hull gap identified (temporary)'            },
                         { type:'sensor_blind',   label:'Borg sensor frequency (temporary)'              },
                         { type:'weapon_disrupt', label:'Borg targeting disrupted (temporary)'            } ],
};

// ── Deep sensor scan ──────────────────────────────────────────
function startDeepScan() {
  if (!G.running || G.dead) return;
  if (G.deepScanActive) { postLogEvent("Deep scan already in progress.", 'info'); return; }
  if (G.deepScanCooldown > 0) {
    postLogEvent(`Sensor array recharging — ${Math.ceil(G.deepScanCooldown/1000)}s.`, 'warn'); return;
  }
  if (G.systems.sensors.tripped || G.systems.sensors.health < 15) {
    postLogEvent("Sensors too damaged for deep analysis.", 'crit'); return;
  }
  G.deepScanActive   = true;
  G.deepScanProgress = 0;
  postLogEvent("DEEP SENSOR SCAN initiated — analysing enemy frequencies...", 'info');
  _updateDeepScanButton();
}

// Called each frame from masterSimulationCoreLoop
function processDeepScan(dt) {
  if (G.deepScanCooldown > 0) {
    G.deepScanCooldown = Math.max(0, G.deepScanCooldown - dt);
    if (G.deepScanCooldown === 0) _updateDeepScanButton();
  }
  if (!G.deepScanActive) return;

  const sH = G.systems.sensors.health;
  const sP = G.systems.sensors.allocatedPower;
  const rate = 0.012 * (sH / 100) * (0.5 + (sP / 20) * 0.5);
  G.deepScanProgress = Math.min(100, G.deepScanProgress + rate * dt);

  const bar = document.getElementById('bar-scan-analysis');
  if (bar) bar.style.width = `${G.deepScanProgress}%`;
  _updateDeepScanButton();

  if (G.deepScanProgress >= 100) {
    G.deepScanActive = false;
    _commitDeepScan();
  }
}

function _commitDeepScan() {
  const cfg     = ENEMY_CONFIGS[G.enemyArchetype];
  const results = _SCAN_RESULTS[G.enemyArchetype] || [{ type:'hull_weakness', label:'Hull stress points mapped' }];
  const isBorg  = cfg.faction === 'Borg';

  G.permanentScanBonuses = {};
  const _borgLevelAtScan = isBorg ? (G.borgEscalationLevel || 0) : -1;

  results.forEach(r => {
    G.permanentScanBonuses[r.type] = {
      weaponType:     r.weaponType || null,
      label:          r.label,
      borgScanLevel:  _borgLevelAtScan,   // −1 for non-Borg (never expires)
    };
  });

  // weapon_disrupt bonus is applied automatically via getEffectiveFireInterval()
  if (G.permanentScanBonuses.weapon_disrupt) {
    postLogEvent("DEEP SCAN: Fire control disrupted — enemy fire rate −23%.", 'good');
  }

  G.deepScanCooldown = isBorg ? 10000 : 60000;  // Borg: 10s (adapt fast); others: 60s

  postLogEvent(`DEEP SCAN COMPLETE — ${results.length} frequency lock${results.length>1?'s':''} established.`, 'good');
  if (isBorg) postLogEvent("WARNING: Borg frequencies adapt — rescan every time they escalate (10s cooldown).", 'warn');

  _updateDeepScanButton();
  _renderScanResults();
}

// Clear Borg bonuses when adaptation level increases
function checkBorgScanExpiry() {
  if (!G.permanentScanBonuses || !ENEMY_CONFIGS[G.enemyArchetype]) return;
  if (ENEMY_CONFIGS[G.enemyArchetype].faction !== 'Borg') return;
  const currentLevel = G.borgEscalationLevel || 0;
  const anyEntry = Object.values(G.permanentScanBonuses)[0];
  if (!anyEntry || anyEntry.borgScanLevel < 0) return;
  if (currentLevel > anyEntry.borgScanLevel) {
    G.permanentScanBonuses = {};
    G.deepScanCooldown     = 0;   // Borg adapted — allow immediate rescan
    // Fire interval auto-recalculated via getEffectiveFireInterval() — no mutation needed
    postLogEvent("BORG: Frequency adaptation complete — scan data expired. Rescan now!", 'crit');
    _updateDeepScanButton();
    _renderScanResults();
  }
}

function _updateDeepScanButton() {
  const btn = document.getElementById('btn-deep-scan'); if (!btn) return;
  if (G.deepScanActive) {
    btn.textContent = `🔭 SCANNING ${Math.round(G.deepScanProgress)}%`;
    btn.style.background = 'var(--p)'; btn.style.color = '#fff';
    btn.disabled = true;
  } else if (G.deepScanCooldown > 0) {
    btn.textContent = `🔭 RESCAN ${Math.ceil(G.deepScanCooldown/1000)}s`;
    btn.style.background = 'var(--dim2)'; btn.style.color = '#aabbcc';
    btn.disabled = true;
  } else {
    btn.textContent = '🔭 DEEP SCAN';
    btn.style.background = ''; btn.style.color = '';
    btn.disabled = false;
  }
}

function _renderScanResults() {
  const el = document.getElementById('scan-results-display'); if (!el) return;
  const bonuses = G.permanentScanBonuses || {};
  const keys = Object.keys(bonuses);
  if (keys.length === 0) {
    el.innerHTML = '<div style="color:#4466aa;font-size:9px;font-style:italic;">No frequency data — run deep scan</div>';
    return;
  }
  const icons = { shield_freq:'🛡', hull_weakness:'💥', sensor_blind:'〜', weapon_disrupt:'⚡' };
  const descs = { shield_freq:'−25% incoming', hull_weakness:'+20% damage', sensor_blind:'−40% lock', weapon_disrupt:'−23% fire rate' };
  el.innerHTML = keys.map(k => {
    const b = bonuses[k];
    const extra = b.weaponType ? ` [${b.weaponType}]` : '';
    return `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid #0a1828;">
      <span style="font-size:11px;">${icons[k]||'◈'}</span>
      <span style="font-size:9px;color:var(--green);flex:1;">${b.label}${extra}</span>
      <span style="font-size:9px;color:var(--o);font-weight:bold;">${descs[k]||''}</span>
    </div>`;
  }).join('');
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
  G.lockProgress = Math.max(0, G.lockProgress - 30);
  document.querySelectorAll('[id^="enemy-tgt-btn-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`enemy-tgt-btn-${key}`); if (btn) btn.classList.add('active');
  const t = document.getElementById('txt-current-target'); if (t) t.textContent = label.toUpperCase();
  const a = document.getElementById('txt-firing-arc');     if (a) a.textContent = `Arc: ${arc}`;
  postLogEvent(`Target: [${label.toUpperCase()}]. Lock partially reset.`, 'info');
}

// Expose for legacy compat (captain orders etc)
function toggleActiveSensorSystems() {
  G.activeScanningProfile = !G.activeScanningProfile;
  ['btn-active-scanner-toggle','btn-active-scanner-toggle-tac'].forEach(id => {
    const btn = document.getElementById(id); if (!btn) return;
    btn.textContent = G.activeScanningProfile ? "ACTIVE SWEEP ON" : "Passive Scan";
    if (G.activeScanningProfile) btn.classList.add('red-btn'); else btn.classList.remove('red-btn');
  });
  // Fire interval is now derived — getEffectiveFireInterval() picks up the new activeScanningProfile state automatically
  if (G.activeScanningProfile) postLogEvent("Active scanning on — enemy also benefits from better targeting.", 'warn');
  else postLogEvent("Passive tracking restored.", 'info');
}

// --- Battle reset (called by initiateVesselSimulation) ---
// Owns scan bonuses, deep-scan progress/cooldown and the active-scanner toggle.
function sensorsResetForBattle() {
  G.scanBonus             = null;
  G.activeScanProfile     = null;
  G.scanAnalysisProgress  = 0;
  G.permanentScanBonuses  = {};
  G.deepScanActive        = false;
  G.deepScanProgress      = 0;
  G.deepScanCooldown      = 0;
  G.activeScanningProfile = false;
  if (typeof _updateDeepScanButton === 'function') _updateDeepScanButton();
  if (typeof _renderScanResults    === 'function') _renderScanResults();
}
