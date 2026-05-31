'use strict';

// ============================================================
// WARP CORE TRIP
// ============================================================
function handleWarpCoreTrip() {
  postLogEvent("WARP CORE OFFLINE — switching to impulse power. All systems reduced!", 'crit');
  crewReportWarpCoreTrip();
  const impulseMax = WARP_CORE.impulseOutput;
  const total = getTotalAllocatedPower();
  if (total > impulseMax) {
    const scale = impulseMax / total;
    Object.keys(G.systems).forEach(k => {
      G.systems[k].allocatedPower = Math.floor(G.systems[k].allocatedPower * scale);
    });
    postLogEvent(`Systems scaled to ${impulseMax}MW impulse budget.`, 'warn');
  }
  if (G.batteryCharge > 0) postLogEvent("Emergency battery available — activate in engineering panel.", 'warn');
  rebuildEngineeringMatrixInterface();
  refreshEngineeringPanelGraphics();
}

// ============================================================
// EMERGENCY BATTERY
// ============================================================
function activateEmergencyBattery() {
  if (G.playerChosenStation !== 'engineering' && G.playerChosenStation !== 'captain') { postLogEvent("Battery control requires Engineering station.", 'warn'); return; }
  if (G.batteryCharge < 10) { postLogEvent("Emergency battery depleted.", 'crit'); return; }
  if (!G.systems.warp_core.tripped && G.systems.warp_core.health > 20) {
    postLogEvent("Battery reserve not needed — warp core is online.", 'info'); return;
  }
  G.batteryActive = true;
  G.batteryUses++;
  postLogEvent(`Emergency battery ACTIVE — ${Math.round(G.batteryCharge)}% remaining. ~${Math.round(G.batteryCharge / G.batteryDrainRate)}s duration.`, 'warn');
}

function processBattery(dt) {
  const sc = dt / 1000;
  if (G.batteryActive) {
    G.batteryCharge = Math.max(0, G.batteryCharge - G.batteryDrainRate * sc);
    if (G.batteryCharge <= 0) {
      G.batteryActive = false;
      postLogEvent("Emergency battery exhausted!", 'crit');
      if (G.systems.warp_core.tripped) handleWarpCoreTrip();
    }
  } else if (!G.systems.warp_core.tripped) {
    G.batteryCharge = Math.min(100, G.batteryCharge + G.batteryRechargeRate * sc);
  }
  const bar = document.getElementById('bar-battery-charge'); if (bar) { bar.style.width = `${G.batteryCharge}%`; bar.style.color = G.batteryActive ? C.warn : G.batteryCharge < 20 ? C.red : C.o; }
  const txt = document.getElementById('txt-battery-charge'); if (txt) txt.textContent = `${Math.round(G.batteryCharge)}%`;
  const lbl = document.getElementById('lbl-battery-status');
  if (lbl) {
    if (G.batteryActive) lbl.textContent = `ACTIVE — ${Math.round(G.batteryCharge)}% (${Math.round(G.batteryCharge / G.batteryDrainRate)}s)`;
    else if (G.systems.warp_core.tripped) lbl.textContent = G.batteryCharge > 5 ? 'Available — core offline' : 'DEPLETED';
    else lbl.textContent = `Standby — ${Math.round(G.batteryCharge)}%`;
  }
}

// ============================================================
// ABLATIVE ARMOUR — Defiant-class unique system
// Intercepts hull damage before it reaches the pressure hull.
// Each layer absorbs ABLATIVE_ARMOUR.layerAbsorption of incoming
// hull damage. Once a layer's health reaches 0 it is "consumed"
// and begins a slow regeneration after a cooldown period.
// ============================================================
function processAblativeArmour(dt) {
  const ab = G.ablative;
  for (let i = 0; i < ABLATIVE_ARMOUR.maxLayers; i++) {
    if (ab.layerHealth[i] <= 0) {
      // Consumed — waiting for cooldown then regen
      if (ab.regenTimers[i] > 0) {
        ab.regenTimers[i] = Math.max(0, ab.regenTimers[i] - dt);
      } else {
        // Actively regenerating
        ab.regenProgress[i] = Math.min(ABLATIVE_ARMOUR.regenTime, ab.regenProgress[i] + dt);
        if (ab.regenProgress[i] >= ABLATIVE_ARMOUR.regenTime) {
          ab.layerHealth[i] = 100;
          ab.regenProgress[i] = 0;
          ab.layers = ab.layerHealth.filter(h => h > 0).length;
          postLogEvent(`Ablative armour: Layer ${i + 1} regenerated.`, 'good');
        }
      }
    }
  }
}

/**
 * Apply incoming hull damage through the ablative armour stack.
 * Returns the residual damage that reaches the pressure hull.
 * Degrades the outermost intact layer.
 */
function applyAblativeArmour(rawHullDmg) {
  const ab = G.ablative;
  // Find the outermost intact layer (highest index with health > 0)
  let layerIdx = -1;
  for (let i = ABLATIVE_ARMOUR.maxLayers - 1; i >= 0; i--) {
    if (ab.layerHealth[i] > 0) { layerIdx = i; break; }
  }
  if (layerIdx < 0) return rawHullDmg; // All layers consumed — full damage through

  const absorbed = rawHullDmg * ABLATIVE_ARMOUR.layerAbsorption;
  const residual = rawHullDmg - absorbed;

  // Reduced layer cost — Defiant's reinforced hull means layers withstand more hits
  // Old: (absorbed/30)*20. New: (absorbed/40)*20 — layers last ~33% longer
  const layerCost = (absorbed / 40) * 20;
  ab.layerHealth[layerIdx] = Math.max(0, ab.layerHealth[layerIdx] - layerCost);

  if (ab.layerHealth[layerIdx] <= 0) {
    ab.regenTimers[layerIdx] = ABLATIVE_ARMOUR.regenCooldown;
    ab.regenProgress[layerIdx] = 0;
    ab.layers = ab.layerHealth.filter(h => h > 0).length;
    postLogEvent(`Ablative armour: Layer ${layerIdx + 1} consumed! ${ab.layers} remaining.`, 'crit');
  }

  return residual;
}

// ============================================================
// SHIELD REGEN RATE — called whenever power changes
// ============================================================
function recalculateShieldRegenRate() {
  if (G.cloaked) { G.shieldRegenRate = 0; return; }
  const wc = G.systems.warp_core;
  if (wc.tripped && !G.batteryActive) { G.shieldRegenRate = 0; return; }
  const sp = G.systems.shields.allocatedPower;
  const sh = G.systems.shields.health / 100;
  // Defiant regenerative shields: 28MW base → ~3/s, 60MW → ~6.5/s
  // Uses a slightly more generous base multiplier to match the stronger shield pool
  G.shieldRegenRate = Math.max(0.5, (sp / 9) * sh);
  const rl = document.getElementById('lbl-shield-regen');
  if (rl && !G.cloaked) { rl.textContent = `↑+${G.shieldRegenRate.toFixed(1)}/s`; rl.style.color = 'var(--green)'; }
  const rr = document.getElementById('txt-shield-regen-rate');
  if (rr) rr.textContent = G.cloaked ? 'OFFLINE' : `+${G.shieldRegenRate.toFixed(1)}/s`;
}

// ============================================================
// REPAIR TEAMS — 2 independent teams, manually assigned (feature 7)
// O'Brien dispatches specific teams to specific locations, per DS9 canon
// ============================================================
function assignRepairTeam(sysKey, teamIdx) {
  if (G.playerChosenStation !== 'engineering') { postLogEvent("Repair requires Engineering station.", 'warn'); return; }
  const sys = G.systems[sysKey]; if (!sys) return;
  if (sys.health >= 100 && !sys.tripped) { postLogEvent(`${sys.label} at full integrity.`, 'info'); return; }

  const team = G.repairTeams[teamIdx];
  // Check the other team isn't already on this system
  const otherTeam = G.repairTeams[1 - teamIdx];
  if (otherTeam.sysKey === sysKey) { postLogEvent(`Team ${2 - teamIdx} already repairing ${sys.label}.`, 'warn'); return; }

  const damage    = Math.max(1, 100 - sys.health + (sys.tripped ? 20 : 0));
  const repairTime = Math.max(5000, (damage / 10) * 5000);
  const wasOn     = team.sysKey;
  team.sysKey     = sysKey;
  team.label      = sys.label;
  team.totalTime  = repairTime;
  team.remaining  = repairTime;

  const teamName = teamIdx === 0 ? "Alpha Team" : "Beta Team";
  const eta      = Math.ceil(repairTime / 1000 / DIFFICULTY[currentDifficulty].repairSpeedMult);
  if (wasOn) postLogEvent(`${teamName} redirected from ${wasOn} → ${sys.label}. ETA ${eta}s.`, 'warn');
  else       postLogEvent(`${teamName} dispatched to ${sys.label}. ETA ${eta}s.`, 'good');
  refreshEngineeringPanelGraphics();
}

function recallRepairTeam(teamIdx) {
  if (G.playerChosenStation !== 'engineering') { postLogEvent("Repair requires Engineering station.", 'warn'); return; }
  const team = G.repairTeams[teamIdx];
  if (!team.sysKey) { postLogEvent(`${teamIdx === 0 ? 'Alpha' : 'Beta'} Team already on standby.`, 'info'); return; }
  const teamName = teamIdx === 0 ? 'Alpha' : 'Beta';
  postLogEvent(`${teamName} Team recalled from ${team.label}.`, 'warn');
  team.sysKey = null; team.label = ''; team.totalTime = 0; team.remaining = 0;
  refreshEngineeringPanelGraphics();
}
// Legacy wrapper — used by auto-delegation (tactical player)
function queueSystemRepair(sysKey) {
  if (G.playerChosenStation !== 'engineering') { return; }
  // Auto-assign to whichever team is free, else team with most progress
  const freeIdx = G.repairTeams.findIndex(t => !t.sysKey);
  const teamIdx = freeIdx >= 0 ? freeIdx : (G.repairTeams[0].remaining > G.repairTeams[1].remaining ? 1 : 0);
  assignRepairTeam(sysKey, teamIdx);
}

function processRepairQueues(dt) {
  const crewEff = getCrewEfficiency('engineering');
  const diff    = DIFFICULTY[currentDifficulty];

  // Process both repair teams independently
  G.repairTeams.forEach((team, idx) => {
    if (!team.sysKey) return;
    const sys = G.systems[team.sysKey];
    if (!sys) { team.sysKey = null; return; }

    team.remaining -= dt * crewEff * diff.repairSpeedMult;

    if (team.remaining <= 0) {
      sys.health  = Math.min(100, sys.health + (100 - sys.health) * 0.80);
      sys.tripped = false;
      sys.stress  = 0;
      postLogEvent(`${idx === 0 ? 'Alpha' : 'Beta'} Team: ${team.label} → ${Math.round(sys.health)}%.`, 'good');
      crewReportRepairComplete(team.label);
      G.score.repairsCompleted++;

      if (team.sysKey === 'warp_core') {
        G.batteryActive = false;
        postLogEvent("Warp core restart sequence initiated — power coming online over 12s.", 'warn');
        const rampSessionId = G.gameSessionId;
        const targetHealth  = sys.health;
        const startHealth   = Math.max(5, targetHealth - 60);
        sys.health = startHealth;
        let elapsed = 0;
        const rampInterval = setInterval(() => {
          if (G.dead || !G.running || G.gameSessionId !== rampSessionId) { clearInterval(rampInterval); return; }
          elapsed += 500;
          const progress = Math.min(1, elapsed / 12000);
          sys.health = Math.min(targetHealth, startHealth + (targetHealth - startHealth) * progress);
          recalculateShieldRegenRate();
          if (progress >= 1) {
            clearInterval(rampInterval);
            postLogEvent("Warp core fully online — EPS output restored.", 'good');
            updateWarpAvailability();
          }
        }, 500);
        recalculateShieldRegenRate();
        updateWarpAvailability();
      }

      team.sysKey    = null;
      team.label     = '';
      team.totalTime = 0;
      team.remaining = 0;
      refreshEngineeringPanelGraphics();
    }
  });

  // Enemy repairs — faster while cloaked
  const repSpd = G.enemyCloaked ? 1.0 : 0.3;
  G.enemyRepairQueue = G.enemyRepairQueue.filter(r => {
    r.remaining -= dt * repSpd;
    const sys = G.enemySystems[r.sysKey];
    if (r.remaining <= 0) {
      if (sys) { sys.health = Math.min(100, sys.health + 60); }
      postLogEvent(`INTEL: Enemy repaired [${sys ? sys.label : r.sysKey}].`, 'warn');
      return false;
    }
    return true;
  });
}

// ============================================================
// ENGINEERING MATRIX INTERFACE
// Only fully rebuilt on deck switch (not every tick)
// ============================================================
function rebuildEngineeringMatrixInterface() {
  const mount = document.getElementById('engineering-matrix-rows'); if (!mount) return;
  mount.innerHTML = '';
  const groups = [
    { label:'⚡ Power Core', keys:['warp_core'], color:'var(--o)' },
    { label:'🔫 Weapons',    keys:['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes'], color:'var(--warn)' },
    { label:'◉ Special',    keys:['cloak_dev'], color:'var(--p)' },
    { label:'🔧 Ship Systems', keys:['shields','sensors','engines'], color:'var(--b)' },
  ];
  groups.forEach(grp => {
    const hrow = document.createElement('tr');
    hrow.innerHTML = `<td colspan="6" style="font-family:'Antonio';font-size:10px;color:${grp.color};padding:4px 4px 2px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(128,128,128,0.2);">${grp.label}</td>`;
    mount.appendChild(hrow);
    grp.keys.forEach(key => {
      const sys = G.systems[key];
      const tr = document.createElement('tr'); tr.id = `eng-row-${key}`;
      tr.innerHTML = `
        <td style="text-transform:uppercase;font-weight:bold;color:var(--b);font-size:10px;">${sys.label}</td>
        <td id="eng-lbl-mw-${key}" style="font-weight:bold;color:#fff;font-size:10px;">${sys.allocatedPower}MW</td>
        <td>
          <div style="display:flex;align-items:center;gap:3px;">
            <button class="mini-btn" onclick="tuneBusAllocation('${key}',-5)">−</button>
            <div class="bar-rail" style="height:8px;margin-bottom:0;flex:1;"><div class="bar-fill" id="eng-slider-bar-${key}" style="color:var(--o);"></div></div>
            <button class="mini-btn" onclick="tuneBusAllocation('${key}',5)">+</button>
          </div>
        </td>
        <td style="text-align:right;font-size:9px;color:var(--t);" id="eng-lbl-stress-${key}">0%</td>
        <td style="text-align:right;font-size:9px;" id="eng-lbl-health-${key}"><span style="color:var(--green);">100%</span></td>
        <td style="text-align:right;" id="eng-lbl-repair-${key}"></td>`;
      mount.appendChild(tr);
    });
  });
  refreshEngineeringPanelGraphics();
}

// BUG FIX: refreshEngineeringPanelGraphics only updates *values* in existing cells.
// It never rebuilds innerHTML of the table body, so repair buttons survive clicks.
function refreshEngineeringPanelGraphics() {
  const warpOut = getWarpOutput();
  const maxPerSystem = Math.min(warpOut > 0 ? warpOut : 1, 60);

  Object.keys(G.systems).forEach(key => {
    const sys = G.systems[key];
    const ml  = document.getElementById(`eng-lbl-mw-${key}`);
    const sb  = document.getElementById(`eng-slider-bar-${key}`);
    const sl  = document.getElementById(`eng-lbl-stress-${key}`);
    const hl  = document.getElementById(`eng-lbl-health-${key}`);
    const rl  = document.getElementById(`eng-lbl-repair-${key}`);
    const row = document.getElementById(`eng-row-${key}`);

    if (ml) ml.textContent = `${sys.allocatedPower}MW`;
    if (sb) sb.style.width = `${(sys.allocatedPower / maxPerSystem) * 100}%`;
    if (sl) { sl.textContent = `${Math.round(sys.stress)}%`; sl.style.color = sys.stress > 70 ? 'var(--red)' : sys.stress > 40 ? 'var(--warn)' : 'var(--t)'; }
    if (hl) { const h = Math.round(sys.health); const c = h > 70 ? 'var(--green)' : h > 35 ? 'var(--warn)' : 'var(--red)'; hl.innerHTML = `<span style="color:${c};font-weight:bold;">${h}%</span>`; }

    // Repair cell — show team assignment state
    if (rl) {
      const teamA = G.repairTeams[0].sysKey === key;
      const teamB = G.repairTeams[1].sysKey === key;
      if (teamA || teamB) {
        const team   = teamA ? G.repairTeams[0] : G.repairTeams[1];
        const p      = Math.round((1 - team.remaining / team.totalTime) * 100);
        const label  = teamA ? '🔧A' : '🔧B';
        const newContent = `<span style="color:var(--warn);font-size:8px;">${label}${p}%</span>`;
        if (rl.dataset.mode !== 'progress' || parseInt(rl.dataset.pct) !== p || rl.dataset.team !== (teamA?'A':'B')) {
          rl.innerHTML = newContent;
          rl.dataset.mode = 'progress';
          rl.dataset.pct  = p;
          rl.dataset.team = teamA ? 'A' : 'B';
        }
      } else if (sys.health < 100 || sys.tripped) {
        // Show assign buttons — A and B team
        const aFree = !G.repairTeams[0].sysKey;
        const bFree = !G.repairTeams[1].sysKey;
        const btnStyle = 'font-size:7px;padding:1px 3px;border-radius:2px;cursor:pointer;border:none;font-weight:bold;';
        const aStyle   = `${btnStyle}background:${aFree ? 'rgba(68,119,255,0.3)' : 'rgba(255,170,0,0.2)'};color:${aFree ? '#88aaff' : '#ffaa00'};`;
        const bStyle   = `${btnStyle}background:${bFree ? 'rgba(68,119,255,0.3)' : 'rgba(255,170,0,0.2)'};color:${bFree ? '#88aaff' : '#ffaa00'};`;
        const newContent = `<span style="display:flex;gap:2px;">
          <button onclick="assignRepairTeam('${key}',0)" style="${aStyle}" title="${aFree ? 'Alpha Team free' : 'Redirect Alpha Team'}">A</button>
          <button onclick="assignRepairTeam('${key}',1)" style="${bStyle}" title="${bFree ? 'Beta Team free' : 'Redirect Beta Team'}">B</button>
        </span>`;
        const sig = `btn-${aFree}-${bFree}`;
        if (rl.dataset.mode !== 'btn' || rl.dataset.sig !== sig) {
          rl.innerHTML = newContent;
          rl.dataset.mode = 'btn';
          rl.dataset.sig  = sig;
        }
      } else {
        if (rl.dataset.mode !== 'ok') { rl.innerHTML = ''; rl.dataset.mode = 'ok'; }
      }
    }

    if (row) {
      if (sys.tripped) row.style.background = 'rgba(255,51,51,0.1)';
      else if (sys.health < 35) row.style.background = 'rgba(255,170,0,0.05)';
      else row.style.background = '';
    }
  });

  // Breaker grid — only rebuild when trip state has changed (not every frame)
  const bg = document.getElementById('breaker-grid-mount'); if (!bg) return;
  const currentTripSig = Object.keys(G.systems).map(k => G.systems[k].tripped ? '1' : '0').join('');
  if (bg.dataset.tripSig !== currentTripSig) {
    bg.dataset.tripSig = currentTripSig;
    bg.innerHTML = '';
    Object.keys(G.systems).forEach(key => {
      const sys = G.systems[key];
      const hc  = sys.health > 70 ? '#00cc66' : sys.health > 35 ? '#ffaa00' : '#ff3333';
      const btn = document.createElement('button');
      btn.className = `pill-action-btn ${sys.tripped ? 'tripped-relay-alert' : ''}`;
      btn.style.cssText = 'font-size:9px;padding:3px 4px;';
      if (sys.tripped) {
        btn.innerHTML = `🛑 ${sys.label} — OFFLINE`;
        btn.onclick = () => {
          if (G.playerChosenStation === 'tactical') return;
          if (key === 'warp_core' && sys.health < 25) { postLogEvent("Warp core too damaged to reset — repair first.", 'crit'); return; }
          sys.tripped = false; sys.stress = 0;
          postLogEvent(key === 'warp_core' ? "Warp core relay reset. Power restoring." : `Breaker re-latched: ${sys.label}.`, 'good');
          recalculateShieldRegenRate();
          refreshEngineeringPanelGraphics();
        };
      } else {
        btn.innerHTML = `<span style="color:${hc};">●</span> ${sys.label} <span style="font-size:8px;color:${hc};">${Math.round(sys.health)}%</span>`;
        btn.onclick = () => {};
      }
      bg.appendChild(btn);
    });
  } else {
    // Just update health percentages in-place without rebuild
    Object.keys(G.systems).forEach(key => {
      const sys = G.systems[key];
      const hc  = sys.health > 70 ? '#00cc66' : sys.health > 35 ? '#ffaa00' : '#ff3333';
      const btn = bg.children[Object.keys(G.systems).indexOf(key)];
      if (btn && !sys.tripped) {
        btn.innerHTML = `<span style="color:${hc};">●</span> ${sys.label} <span style="font-size:8px;color:${hc};">${Math.round(sys.health)}%</span>`;
      }
    });
  }
}

// ============================================================
// POWER ALLOCATION
// ============================================================
function tuneBusAllocation(key, amount) {
  if (G.playerChosenStation === 'tactical') { postLogEvent("Power locked to automation.", 'warn'); return; }
  const sys = G.systems[key]; if (!sys) return;
  const projected     = sys.allocatedPower + amount;
  const warpOut       = getWarpOutput();
  const totalNow      = getTotalAllocatedPower();
  const totalProjected = totalNow + amount;
  if (totalProjected > warpOut) { postLogEvent(`EPS limit: warp core producing ${warpOut}MW. Cannot allocate more.`, 'warn'); return; }
  if (projected < 0) return;
  if (projected > 60) { postLogEvent("Single system maximum is 60MW.", 'warn'); return; }
  sys.allocatedPower = projected;
  recalculateShieldRegenRate();
  refreshEngineeringPanelGraphics();
}

const POWER_PRESETS = {
  attack: {
    label: 'ATTACK MODE',
    log:   'Attack mode — weapons prioritised, shields reduced.',
    alloc: { cannon_pu:12, cannon_pl:12, cannon_su:12, cannon_sl:12, nose_beam:18, torpedoes:16, shields:16, sensors:10, engines:10, cloak_dev:0, warp_core:8 },
  },
  silent: {
    label: 'SILENT RUNNING',
    log:   'Silent running — power signature minimised for cloaking operations.',
    alloc: { cannon_pu:0,  cannon_pl:0,  cannon_su:0,  cannon_sl:0,  nose_beam:0,  torpedoes:0,  shields:20, sensors:20, engines:8,  cloak_dev:30, warp_core:12 },
  },
  evasive: {
    label: 'EVASIVE',
    log:   'Evasive configuration — engines and shields maximised.',
    alloc: { cannon_pu:4,  cannon_pl:4,  cannon_su:4,  cannon_sl:4,  nose_beam:6,  torpedoes:6,  shields:35, sensors:14, engines:30, cloak_dev:0,  warp_core:10 },
  },
  damage_control: {
    label: 'DAMAGE CONTROL',
    log:   'Damage control — shields and sensors at maximum for repairs.',
    alloc: { cannon_pu:4,  cannon_pl:4,  cannon_su:4,  cannon_sl:4,  nose_beam:4,  torpedoes:4,  shields:40, sensors:24, engines:12, cloak_dev:0,  warp_core:10 },
  },
};

function applyPowerPreset(name) {
  if (G.playerChosenStation === 'tactical') { postLogEvent('Power locked to automation.', 'warn'); return; }
  const preset = POWER_PRESETS[name]; if (!preset) return;
  const warpOut = getWarpOutput();
  const total   = Object.values(preset.alloc).reduce((s, v) => s + v, 0);
  if (total > warpOut) {
    // Scale proportionally to fit within current warp output
    const scale = warpOut / total;
    Object.keys(preset.alloc).forEach(k => {
      if (G.systems[k]) G.systems[k].allocatedPower = Math.floor(preset.alloc[k] * scale);
    });
    postLogEvent(`${preset.label} — scaled to ${warpOut}MW core output.`, 'warn');
  } else {
    Object.keys(preset.alloc).forEach(k => {
      if (G.systems[k]) G.systems[k].allocatedPower = preset.alloc[k];
    });
    postLogEvent(preset.log, 'info');
  }
  recalculateShieldRegenRate();
  refreshEngineeringPanelGraphics();
}

function masterConduitFlush() {
  if (G.playerChosenStation === 'tactical') return;
  Object.keys(G.systems).forEach(k => { G.systems[k].tripped = false; G.systems[k].stress = 0; });
  postLogEvent("Master flush: all conduit lines cleared.", 'warn');
  recalculateShieldRegenRate();
  refreshEngineeringPanelGraphics();
}

// ============================================================
// DAMAGE CONTROL BUTTONS
// ============================================================
function emergencyRepairWeapons() {
  if (G.batteryCharge < 30) { postLogEvent("Need 30% battery.", 'warn'); return; }
  G.batteryCharge = Math.max(0, G.batteryCharge - 30);
  ['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes'].forEach(k => {
    if (G.systems[k].health < 100) {
      G.systems[k].health  = Math.min(100, G.systems[k].health + 30);
      G.systems[k].stress  = Math.max(0, G.systems[k].stress - 20);
      G.systems[k].tripped = false;
    }
  });
  postLogEvent("Emergency weapon repair: +30% integrity.", 'good');
  refreshEngineeringPanelGraphics();
}

function emergencyRepairSystems() {
  if (G.batteryCharge < 25) { postLogEvent("Need 25% battery.", 'warn'); return; }
  G.batteryCharge = Math.max(0, G.batteryCharge - 25);
  ['shields','sensors','engines','warp_core'].forEach(k => {
    G.systems[k].health  = Math.min(100, G.systems[k].health + 30);
    G.systems[k].stress  = Math.max(0, G.systems[k].stress - 25);
    G.systems[k].tripped = false;
  });
  recalculateShieldRegenRate();
  postLogEvent("Emergency systems repair: +30% integrity.", 'good');
  refreshEngineeringPanelGraphics();
}

function repairCloakingDevice() {
  if (G.batteryCharge < 20) { postLogEvent("Need 20% battery.", 'warn'); return; }
  G.batteryCharge = Math.max(0, G.batteryCharge - 20);
  G.cloakCooldown = Math.max(0, G.cloakCooldown - 12000);
  G.systems.cloak_dev.health = Math.min(100, G.systems.cloak_dev.health + 20);
  postLogEvent("Cloak repair: −12s cooldown, +20% integrity.", 'good');
  updateCloakButton();
}

function adjustShieldRegenMode(mode) {
  const totalNow = getTotalAllocatedPower();
  const warpOut  = getWarpOutput();
  if (mode === 'boost') {
    const newPow = Math.min(60, G.systems.shields.allocatedPower + 5);
    const diff   = newPow - G.systems.shields.allocatedPower;
    if (totalNow + diff > warpOut) { postLogEvent(`EPS limit: only ${warpOut - totalNow}MW available.`, 'warn'); return; }
    G.systems.shields.allocatedPower = newPow;
  } else {
    G.systems.shields.allocatedPower = 20;
  }
  recalculateShieldRegenRate();
  refreshEngineeringPanelGraphics();
  updateEngUtilityPanel();
  postLogEvent(`Shield power: ${G.systems.shields.allocatedPower}MW — regen ${G.shieldRegenRate.toFixed(1)}/s.`, 'good');
}

// ============================================================
// ENGINEERING UTILITY PANEL
// ============================================================
function updateEngUtilityPanel() {
  const cs = document.getElementById('lbl-cloak-eng-status');
  if (cs) {
    const dh = G.systems.cloak_dev.health;
    if (dh < 20) cs.textContent = `DESTROYED (${Math.round(dh)}%)`;
    else if (G.cloaked) cs.textContent = `ACTIVE — PWR:${Math.round(G.cloakPowerReserve)}%`;
    else if (G.cloakCooldown > 0) cs.textContent = `Recharging ${Math.ceil(G.cloakCooldown / 1000)}s`;
    else cs.textContent = `Ready (${Math.round(dh)}%)`;
  }
  const bce = document.getElementById('btn-cloak-eng');
  if (bce) { bce.textContent = G.cloaked ? '◉ Decloak' : '◉ Cloak'; bce.style.background = G.cloaked ? 'rgba(153,102,204,0.4)' : ''; }
  const rl = document.getElementById('txt-shield-regen-rate');
  if (rl) rl.textContent = G.cloaked ? 'OFFLINE' : `+${G.shieldRegenRate.toFixed(1)}/s`;

  // Repair team status display
  const rq = document.getElementById('lbl-repair-queue');
  if (rq) {
    const teamLines = G.repairTeams.map((team, idx) => {
      const name = idx === 0 ? 'Alpha' : 'Beta';
      if (!team.sysKey) {
        return `<div style="color:#556677;font-size:9px;">👤 ${name} Team — standby</div>`;
      }
      const p = Math.round((1 - team.remaining / team.totalTime) * 100);
      const s = Math.ceil(team.remaining / 1000);
      return `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;">
        <span style="color:var(--b);font-size:9px;min-width:38px;">👤 ${name}</span>
        <span style="color:var(--warn);font-size:9px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${team.label}</span>
        <div style="width:30px;height:5px;background:#050a14;border:1px solid #1a2640;overflow:hidden;flex-shrink:0;">
          <div style="width:${p}%;height:100%;background:var(--warn);"></div>
        </div>
        <span style="color:#aabbcc;font-size:9px;min-width:16px;flex-shrink:0;">${s}s</span>
        <button onclick="recallRepairTeam(${idx})" style="font-size:7px;padding:1px 3px;background:rgba(255,51,51,0.2);border:1px solid var(--red);color:var(--red);border-radius:2px;cursor:pointer;flex-shrink:0;">✕</button>
      </div>`;
    });
    rq.innerHTML = teamLines.join('');
  }

  // Auto-tactical summary (engineering mode only)
  const as = document.getElementById('lbl-autotac-summary');
  if (as && G.playerChosenStation === 'engineering') {
    const healthy = ['cannon_pu','cannon_pl','cannon_su','cannon_sl'].filter(k => !G.systems[k].tripped && G.systems[k].health >= 15).length;
    const torpsOk = !G.systems.torpedoes.tripped && G.systems.torpedoes.health >= 15 && G.player.torpedoes > 0;
    const teamA   = G.repairTeams[0].sysKey ? `A:${G.repairTeams[0].label.split(' ').slice(-1)[0]}` : 'A:idle';
    const teamB   = G.repairTeams[1].sysKey ? `B:${G.repairTeams[1].label.split(' ').slice(-1)[0]}` : 'B:idle';
    as.textContent = `${healthy}/4 cannons · Torps:${torpsOk ? 'RDY' : 'NO'} · ${teamA} · ${teamB} · ${G.cloaked ? '[CLOAKED]' : 'Firing.'}`;
  }

  // Ablative armour status (engineering view)
  const abl = document.getElementById('lbl-ablative-status');
  if (abl) {
    const ab = G.ablative;
    const layerStr = ab.layerHealth.map((h, i) => {
      if (h > 0) return `<span style="color:var(--green);">▊</span>`;
      if (ab.regenTimers[i] > 0) return `<span style="color:var(--t);">▒</span>`;
      return `<span style="color:var(--warn);">░</span>`;
    }).join('');
    abl.innerHTML = `${layerStr} <span style="color:#aabbcc;font-size:9px;">${ab.layers}/5 layers</span>`;
  }
}

// ============================================================
// EPS CONDUIT CONDUCTION (runs every tick)
// ============================================================
function computeConduitConduction(dt) {
  const sc = dt / 1000;
  const warpOut = getWarpOutput();

  // Item 4: EPS thermal management — cool down over time; hot conduits reduce cap recharge
  if (G.epsHeat > 0) {
    G.epsHeat = Math.max(0, G.epsHeat - G.epsHeatCoolRate * sc);
    if (G.epsHeat > 70 && Math.floor(G.epsHeat) % 10 === 0 && Math.random() < 0.02) {
      postLogEvent(`EPS conduits at ${Math.round(G.epsHeat)}% thermal — sustained fire degrading recharge rate.`, 'warn');
    }
  }
  const heatPenalty = G.epsHeat > 70 ? 1 - ((G.epsHeat - 70) / 100) : 1.0; // up to 30% cap recharge reduction

  Object.keys(G.systems).forEach(key => {
    const sys = G.systems[key];
    if (sys.tripped) {
      sys.cap = Math.max(0, sys.cap - 10 * sc);
      return;
    }
    // Stress builds above 40MW per-system
    const overloadThresh = 40;
    if (sys.allocatedPower > overloadThresh) {
      sys.stress = Math.min(100, sys.stress + (3.0 * sc * (sys.allocatedPower - overloadThresh) / 20));
      if (sys.stress >= 100 && Math.random() < 0.3 * sc) {
        sys.tripped = true; sys.allocatedPower = 0;
        postLogEvent(`EPS BREAKER BLOWN: [${sys.label}] — system OFFLINE!`, 'crit');
        crewReportSystemTripped(sys.label);
        if (key === 'warp_core') handleWarpCoreTrip();
        if (key === 'cloak_dev' && G.cloaked) { G.cloaked = false; postLogEvent("Cloak field collapsed!", 'crit'); updateCloakButton(); }
        if (G.activePanel === 'engineering') refreshEngineeringPanelGraphics();
      }
    } else if (sys.stress > 0) {
      sys.stress = Math.max(0, sys.stress - (1.8 * sc));
    }
    // Capacitor charging — reduced by EPS heat penalty
    if (sys.cap < 100) {
      const ls = (sys.allocatedPower * 0.6) * (sys.health / 100) * heatPenalty;
      sys.cap = Math.min(100, sys.cap + ls * sc);
    }
  });

  // Cloak power drain + shield zero while cloaked
  if (G.cloaked) {
    G.cloakPowerReserve = Math.max(0, G.cloakPowerReserve - G.cloakPowerDrainRate * sc);
    ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = 0; });
    if (G.cloakPowerReserve <= 0) {
      G.systems.cloak_dev.health = Math.max(0, G.systems.cloak_dev.health - 0.5 * sc);
      if (G.systems.cloak_dev.health < 20) {
        G.cloaked = false; G.cloakCooldown = 30000;
        postLogEvent("CLOAK POWER EXHAUSTED — forced decloak!", 'crit');
        updateCloakButton();
      }
    }
  }

  recalculateShieldRegenRate();

  // Enemy shield regen
  if (!G.enemyCloaked) {
    const cfg = ENEMY_CONFIGS[G.enemyArchetype];
    const eSS = G.enemySystems.shields_sys;
    let eRegen = (eSS ? eSS.health / 100 : 1) * 1.2;
    if (cfg.adaptiveShields) eRegen *= (1 + G.enemyAdaptiveHits * 0.15);
    ['fore','port','starboard','aft'].forEach(s => {
      if (G.threat.shields[s] < cfg.shields[s])
        G.threat.shields[s] = Math.min(cfg.shields[s], G.threat.shields[s] + eRegen * sc);
    });
  }

  processBattery(dt);
  processAblativeArmour(dt);
}

// ============================================================
// SYSTEM DEGRADATION THRESHOLDS
// ============================================================
function checkSystemDegradationThresholds(key) {
  const sys = G.systems[key]; if (!sys) return;
  if (key === 'sensors' && sys.health < 70) postLogEvent("Sensor array degraded — targeting accuracy reduced.", 'warn');
  if (key === 'engines' && sys.health < 50) {
    postLogEvent("Engine critical — power cap reduced!", 'crit');
    Object.keys(G.systems).forEach(k => { if (G.systems[k].allocatedPower > 40) G.systems[k].allocatedPower = 40; });
    refreshEngineeringPanelGraphics();
  }
  if (key === 'warp_core') {
    if (sys.health < 50) postLogEvent("Warp core below 50% — capability degraded.", 'crit');
    if (sys.health < 25) postLogEvent("WARNING: Warp core critical — emergency warp impossible!", 'crit');
    if (sys.tripped) handleWarpCoreTrip();
    updateWarpAvailability();
  }
  if (key === 'cloak_dev' && sys.health < 20) {
    postLogEvent("Cloaking device critically damaged!", 'crit');
    if (G.cloaked) { G.cloaked = false; postLogEvent("Cloak collapsed!", 'crit'); updateCloakButton(); }
  }
}

// ============================================================
// SHIELD MANIPULATION
// ============================================================
function pumpShieldSector(sector) {
  if (G.cloaked) { postLogEvent("Shields offline while cloaked.", 'warn'); return; }
  const others = ['fore','port','starboard','aft'].filter(s => s !== sector);
  let avail = 0;
  others.forEach(s => { const d = Math.min(20, G.player.shields[s]); avail += d; G.player.shields[s] -= d; });
  G.player.shields[sector] = Math.min(G.player.shields.maxSectorValue, G.player.shields[sector] + avail);
  postLogEvent(`Power rerouted to ${sector.toUpperCase()} shields.`, 'info');
}

function rebalanceShieldArrays() {
  if (G.cloaked) { postLogEvent("Shields offline while cloaked.", 'warn'); return; }
  if (G.shieldTransferInProgress) { postLogEvent("Shield transfer already in progress.", 'warn'); return; }
  const total = G.player.shields.fore + G.player.shields.port + G.player.shields.starboard + G.player.shields.aft;
  const even  = total / 4;
  // Bug 3 fix: capture session ID; cancel if new game starts during 2s transfer
  const transferSessionId = G.gameSessionId;
  G.shieldTransferInProgress = true;
  ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] *= 0.80; });
  postLogEvent("Shield equalisation in progress — EPS conduits switching (2s).", 'info');
  setTimeout(() => {
    if (G.dead || G.gameSessionId !== transferSessionId) { G.shieldTransferInProgress = false; return; }
    ['fore','port','starboard','aft'].forEach(s => { G.player.shields[s] = Math.min(G.player.shields.maxSectorValue, even); });
    G.shieldTransferInProgress = false;
    postLogEvent("Shields equalised.", 'good');
  }, 2000);
}
