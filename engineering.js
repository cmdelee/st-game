'use strict';

// ============================================================
// WARP CORE TRIP
// ============================================================
function handleWarpCoreTrip() {
  _invalidatePowerCache();
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

  // EPS backwash — stress spike to directly-fed systems
  const cascadeStress = { engines: 35, shields: 22, sensors: 15 };
  const trippedByCascade = [];
  Object.entries(cascadeStress).forEach(([key, spike]) => {
    const sys = G.systems[key];
    sys.stress = Math.min(100, sys.stress + spike);
    if (sys.stress >= 100 && !sys.tripped) {
      sys.tripped = true;
      trippedByCascade.push(sys.label);
      postLogEvent(`EPS SURGE: ${sys.label} overloaded by power backwash!`, 'crit');
      checkSystemDegradationThresholds(key);
    }
  });
  if (trippedByCascade.length > 0) {
    postLogEvent(`CASCADE FAILURE — ${trippedByCascade.join(', ')} offline!`, 'crit');
    crewReportSystemTripped(trippedByCascade[0]);
  } else {
    postLogEvent("EPS backwash stressed engines, shields, and sensor grid.", 'warn');
  }

  rebuildEngineeringMatrixInterface();
  refreshEngineeringPanelGraphics();
}

// ============================================================
// EMERGENCY BATTERY
// ============================================================
function activateEmergencyBattery() {
  _invalidatePowerCache();
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
      // Do NOT call handleWarpCoreTrip here — it already fired when the core first tripped,
      // and calling it again would re-apply the EPS cascade stress spike to engines/shields/sensors
      if (G.systems.warp_core.tripped) postLogEvent("Warp core remains offline — repair required.", 'warn');
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
  if (!(G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).hasAblativeArmour) return;
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
  // Enterprise-E has no ablative armour — full damage passes through
  if (!(G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).hasAblativeArmour) return rawHullDmg;
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
  const regenBonus = (G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).shieldRegenBonus || 1.0;
  // Defiant: 28MW → ~3.1/s, 60MW → ~6.7/s; Enterprise-E ×1.4 bonus (regenerative shielding)
  G.shieldRegenRate = Math.max(0.5, (sp / 9) * sh * regenBonus);
  if (G.weaponSurgeActive) G.shieldRegenRate *= 0.5;   // Weapons Power Surge runs shields lean
  // Dirty flag: only touch the DOM when the displayed value actually changes.
  const _disp = G.shieldRegenRate.toFixed(1);
  if (_disp === G._lastRegenDisp) return;
  G._lastRegenDisp = _disp;
  const rl = document.getElementById('lbl-shield-regen');
  if (rl && !G.cloaked) { rl.textContent = `↑+${_disp}/s`; rl.style.color = 'var(--green)'; }
  const rr = document.getElementById('txt-shield-regen-rate');
  if (rr) rr.textContent = G.cloaked ? 'OFFLINE' : `+${_disp}/s`;
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
  const eta      = Math.ceil(repairTime / 1000 / (DIFFICULTY[currentDifficulty].repairSpeedMult * getCrewEfficiency('engineering')));
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
  const teamIdx = freeIdx >= 0 ? freeIdx : (G.repairTeams[0].remaining < G.repairTeams[1].remaining ? 0 : 1);
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
  // Re-prime eng row cache after innerHTML rebuild (called from _rebuildEngCache after this returns)
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
        const p      = team.totalTime > 0 ? Math.round((1 - team.remaining / team.totalTime) * 100) : 0;
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
  _invalidatePowerCache();
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
  _invalidatePowerCache();
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
  const _shipCfg  = G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant;
  const _isEnt    = G.playerShipKey === 'enterprise_e';

  // Show/hide ablative armour section
  const ablSection = document.getElementById('eng-ablative-section');
  if (ablSection) ablSection.style.display = _isEnt ? 'none' : '';

  // Cloak / Saucer separation section
  const cloakSection = document.getElementById('eng-cloak-section');
  const cloakTitle   = document.getElementById('lbl-eng-cloak-title');
  if (cloakTitle) cloakTitle.textContent = _isEnt ? 'TACTICAL DEFLECTOR' : 'CLOAKING DEVICE';
  const cs = document.getElementById('lbl-cloak-eng-status');
  if (_isEnt) {
    // Show antiproton tactical deflector status (cloak_dev system repurposed)
    if (cloakSection) cloakSection.style.display = '';  // keep visible, repurposed
    if (cs) {
      const dh = G.systems.cloak_dev.health;
      if (dh < 20) cs.textContent = `OFFLINE (${Math.round(dh)}%)`;
      else if (G.deflectorActive) cs.textContent = 'ENGAGED — dmg −35%, lock −50%';
      else cs.textContent = `Ready (${Math.round(dh)}%)`;
    }
    const bce = document.getElementById('btn-cloak-eng');
    if (bce) {
      bce.textContent = G.deflectorActive ? '◈ Disengage' : '◈ Deflector';
      bce.style.background = G.deflectorActive ? 'rgba(68,119,255,0.35)' : '';
      bce.onclick = toggleSaucerSeparation;
    }
  } else {
    if (cloakSection) cloakSection.style.display = '';
    if (cs) {
      const dh = G.systems.cloak_dev.health;
      if (dh < 20) cs.textContent = `DESTROYED (${Math.round(dh)}%)`;
      else if (G.cloaked) cs.textContent = `ACTIVE — PWR:${Math.round(G.cloakPowerReserve)}%`;
      else if (G.cloakCooldown > 0) cs.textContent = `Recharging ${Math.ceil(G.cloakCooldown / 1000)}s`;
      else cs.textContent = `Ready (${Math.round(dh)}%)`;
    }
    const bce = document.getElementById('btn-cloak-eng');
    if (bce) { bce.textContent = G.cloaked ? '◉ Decloak' : '◉ Cloak'; bce.style.background = G.cloaked ? 'rgba(153,102,204,0.4)' : ''; bce.onclick = toggleCloakingDevice; }
  }
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
      const p = team.totalTime > 0 ? Math.round((1 - team.remaining / team.totalTime) * 100) : 0;
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
    const _isEntEng = G.playerShipKey === 'enterprise_e';
    const _healthKeys = _isEntEng
      ? ['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam']
      : ['cannon_pu','cannon_pl','cannon_su','cannon_sl'];
    const healthy = _healthKeys.filter(k => !G.systems[k].tripped && G.systems[k].health >= 15).length;
    const torpsOk = !G.systems.torpedoes.tripped && G.systems.torpedoes.health >= 15 && (G.player.torpedoes > 0 || G.player.photonTorpedoes > 0);
    const teamA   = G.repairTeams[0].sysKey ? `A:${G.repairTeams[0].label.split(' ').slice(-1)[0]}` : 'A:idle';
    const teamB   = G.repairTeams[1].sysKey ? `B:${G.repairTeams[1].label.split(' ').slice(-1)[0]}` : 'B:idle';
    const specStatus = _isEntEng ? (G.saucerSepActive ? '[SEPARATED]' : 'Firing.') : (G.cloaked ? '[CLOAKED]' : 'Firing.');
    as.textContent = `${healthy}/${_healthKeys.length} arrays · Torps:${torpsOk ? 'RDY' : 'NO'} · ${teamA} · ${teamB} · ${specStatus}`;
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
    abl.innerHTML = `${layerStr} <span style="color:#aabbcc;font-size:9px;">${ab.layers}/6 layers</span>`;
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
    // Capacitor charging — reduced by EPS heat; weapon caps recharge slower while
    // the antiproton tactical deflector is drawing EPS priority (Enterprise-E).
    if (sys.cap < 100 || (key === 'torpedoes' && sys.aftCap !== undefined && sys.aftCap < 100)) {
      const deflectorPenalty = G.deflectorActive ? 0.55 : 1.0;
      // Weapons Power Surge dumps EPS into weapon capacitors → much faster recharge.
      const surgeBoost = (G.weaponSurgeActive && sys.isWeapon) ? 1.8 : 1.0;
      const ls = (sys.allocatedPower * 0.6) * (sys.health / 100) * heatPenalty * deflectorPenalty * surgeBoost;
      if (sys.cap < 100) sys.cap = Math.min(100, sys.cap + ls * sc);
      if (key === 'torpedoes' && sys.aftCap !== undefined && sys.aftCap < 100)
        sys.aftCap = Math.min(100, sys.aftCap + ls * sc);
    }
  });

  // Cloak power drain + shield zero while cloaked
  if (G.cloaked) {
    G.cloakPowerReserve = Math.max(0, G.cloakPowerReserve - G.cloakPowerDrainRate * sc);
    SHIELD_SECTORS.forEach(s => { G.player.shields[s] = 0; });
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

  // Enemy shield regen moved to processEnemyAI() in enemy-ai.js — it belongs with the
  // other enemy state updates, not in the player's EPS conduit tick (this misplacement
  // was the root cause of the shields_sys key bug, #92/#93/#126).

  processBattery(dt);
  processAblativeArmour(dt);
}

// ============================================================
// SYSTEM DEGRADATION THRESHOLDS
// ============================================================
function checkSystemDegradationThresholds(key) {
  const sys = G.systems[key]; if (!sys) return;
  if (sys.tripped && G.score && !G.score.systemsTripped.includes(key)) G.score.systemsTripped.push(key);
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
  SHIELD_SECTORS.forEach(s => { G.player.shields[s] *= 0.80; });
  postLogEvent("Shield equalisation in progress — EPS conduits switching (2s).", 'info');
  setTimeout(() => {
    if (G.dead || G.gameSessionId !== transferSessionId) { G.shieldTransferInProgress = false; return; }
    SHIELD_SECTORS.forEach(s => { G.player.shields[s] = Math.min(G.player.shields.maxSectorValue, even); });
    G.shieldTransferInProgress = false;
    postLogEvent("Shields equalised.", 'good');
  }, 2000);
}

// --- Battle reset (called by initiateVesselSimulation) ---
// Owns player hull/shields/ordnance, all 11 systems, EPS/thermal, battery,
// repair teams and ablative armour.
// ============================================================
// ENGINEERING COMBAT TOOLKIT — active combat agency for the engineering station
// (offense surge, target coordination, defensive forcefields). All route their
// effects through existing damage/cap/regen paths so they help the auto-crew the
// engineer is supporting (and the player at any station).
// ============================================================

// ⚡ Weapons Power Surge — reroute EPS to weapons: +35% weapon damage and faster
// capacitor recharge for 8s; shield regen halved while active. 28s cooldown.
function divertPowerToWeapons() {
  if (!G.running || G.dead) return;
  if (G.weaponSurgeActive) { postLogEvent("Weapons power surge already active.", 'warn'); return; }
  if (G.weaponSurgeCooldown > 0) { postLogEvent(`EPS surge capacitors recharging — ${Math.ceil(G.weaponSurgeCooldown/1000)}s.`, 'warn'); return; }
  G.weaponSurgeActive = true; G.weaponSurgeTimer = 8000; G.weaponSurgeCooldown = 28000;
  recalculateShieldRegenRate();
  postLogEvent("⚡ WEAPONS POWER SURGE — rerouting EPS to weapons: +35% yield, rapid recharge. Shields running lean.", 'crit');
  if (typeof postCrewReport === 'function') postCrewReport('obrien', "Rerouting power to the weapons grid, Captain — give 'em hell!", 'alert');
  if (typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
}

// 🎯 Fire Coordination — engineering takes target priority: the auto-crew fires
// aggressively (always launches torpedoes, lower lock gate, focus-fires the
// weakest pack member / Borg matrix). Toggle.
function toggleFireCoordination() {
  if (!G.running || G.dead) return;
  G.fireCoordination = !G.fireCoordination;
  postLogEvent(G.fireCoordination
    ? "🎯 FIRE COORDINATION ENGAGED — directing concentrated, torpedo-heavy fire."
    : "Fire coordination released — crew resumes standard fire discipline.", G.fireCoordination ? 'good' : 'info');
  if (typeof postCrewReport === 'function') postCrewReport('obrien', G.fireCoordination ? "Coordinating fire solutions for the tactical grid, aye." : "Standing down fire coordination.", 'status');
  if (typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
}

// 🛡 Emergency Forcefields — divert power to structural integrity: incoming
// damage −45% for 5s. 30s cooldown.
function engageEmergencyForcefields() {
  if (!G.running || G.dead) return;
  if (G.forcefieldsActive) { postLogEvent("Emergency forcefields already active.", 'warn'); return; }
  if (G.forcefieldsCooldown > 0) { postLogEvent(`Structural integrity field recharging — ${Math.ceil(G.forcefieldsCooldown/1000)}s.`, 'warn'); return; }
  G.forcefieldsActive = true; G.forcefieldsTimer = 5000; G.forcefieldsCooldown = 30000;
  postLogEvent("🛡 EMERGENCY FORCEFIELDS — structural integrity at maximum, incoming damage −45%.", 'good');
  if (typeof postCrewReport === 'function') postCrewReport('obrien', "Emergency forcefields up — bracing the hull, Captain!", 'alert');
  if (typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
}

// Per-frame countdown for the toolkit (called from processNewMechanicsTimers so it
// runs in both the real loop and the smoke harness).
function tickEngineeringToolkit(dt) {
  if (G.weaponSurgeActive) {
    G.weaponSurgeTimer = Math.max(0, G.weaponSurgeTimer - dt);
    if (G.weaponSurgeTimer <= 0) {
      G.weaponSurgeActive = false;
      recalculateShieldRegenRate();
      postLogEvent("Weapons power surge expired — EPS returning to normal distribution.", 'info');
      if (typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
    }
  } else if (G.weaponSurgeCooldown > 0) {
    G.weaponSurgeCooldown = Math.max(0, G.weaponSurgeCooldown - dt);
    if (G.weaponSurgeCooldown <= 0 && typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
  }
  if (G.forcefieldsActive) {
    G.forcefieldsTimer = Math.max(0, G.forcefieldsTimer - dt);
    if (G.forcefieldsTimer <= 0) {
      G.forcefieldsActive = false;
      postLogEvent("Emergency forcefields collapsed — structural field offline.", 'info');
      if (typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
    }
  } else if (G.forcefieldsCooldown > 0) {
    G.forcefieldsCooldown = Math.max(0, G.forcefieldsCooldown - dt);
    if (G.forcefieldsCooldown <= 0 && typeof _updateEngToolkitButtons === 'function') _updateEngToolkitButtons();
  }
}

// Live state for the toolkit buttons (throttled via a per-state signature).
function _updateEngToolkitButtons() {
  const _set = (id, sig, txt, cls, dis, lit) => {
    const btn = document.getElementById(id); if (!btn) return;
    if (btn._sig === sig) return; btn._sig = sig;
    const span = btn.querySelector('span');
    // Keep the small descriptor span; update the leading label text node only.
    if (span && btn.firstChild && btn.firstChild !== span) btn.firstChild.textContent = txt + ' ';
    else btn.textContent = txt;
    btn.className = 'pill-action-btn ' + cls;
    btn.disabled = dis; btn.style.opacity = dis ? '0.4' : '1';
    btn.style.boxShadow = lit ? '0 0 6px var(--warn)' : '';
  };
  // Weapons Surge
  if (G.weaponSurgeActive)        _set('btn-eng-surge', 'a'+Math.ceil(G.weaponSurgeTimer/1000), '⚡ SURGING '+Math.ceil(G.weaponSurgeTimer/1000)+'s', 'red-btn', false, true);
  else if (G.weaponSurgeCooldown>0) _set('btn-eng-surge', 'c'+Math.ceil(G.weaponSurgeCooldown/1000), '⚡ SURGE '+Math.ceil(G.weaponSurgeCooldown/1000)+'s', 'red-btn', true, false);
  else                            _set('btn-eng-surge', 'r', '⚡ WEAPONS SURGE', 'red-btn', false, false);
  // Fire Coordination (toggle)
  _set('btn-eng-firecoord', G.fireCoordination?'on':'off', '🎯 FIRE COORD'+(G.fireCoordination?' ▶':''), G.fireCoordination?'green-btn':'warn-btn', false, G.fireCoordination);
  // Forcefields
  if (G.forcefieldsActive)        _set('btn-eng-forcefields', 'a'+Math.ceil(G.forcefieldsTimer/1000), '🛡 FIELDS UP '+Math.ceil(G.forcefieldsTimer/1000)+'s', 'green-btn', false, true);
  else if (G.forcefieldsCooldown>0) _set('btn-eng-forcefields', 'c'+Math.ceil(G.forcefieldsCooldown/1000), '🛡 FIELDS '+Math.ceil(G.forcefieldsCooldown/1000)+'s', 'green-btn', true, false);
  else                            _set('btn-eng-forcefields', 'r', '🛡 FORCEFIELDS', 'green-btn', false, false);
}

function engineeringResetForBattle(shipCfg, diff) {
  G.player.hull               = Math.round(shipCfg.hull * diff.playerHullMult);
  G.player.maxHull            = G.player.hull;
  G.player.torpedoes          = shipCfg.torpedoes;
  G.player.maxTorpedoes       = shipCfg.torpedoes;
  G.player.photonTorpedoes    = shipCfg.photonTorpedoes;
  G.player.maxPhotonTorpedoes = shipCfg.photonTorpedoes;
  G.player.shields = Object.assign({}, shipCfg.shields);

  G.ablative = { layers:6, layerHealth:[100,100,100,100,100,100], regenTimers:[0,0,0,0,0,0], regenProgress:[0,0,0,0,0,0] };

  G.epsHeat                  = 0;
  G.shieldTransferInProgress = false;
  G.repairQueue              = [];
  G.repairTeams              = [
    { sysKey:null, label:'', totalTime:0, remaining:0 },
    { sysKey:null, label:'', totalTime:0, remaining:0 },
  ];
  G.batteryCharge = 100;
  G.batteryActive = false;

  // Engineering combat toolkit
  G.weaponSurgeActive = false; G.weaponSurgeTimer = 0; G.weaponSurgeCooldown = 0;
  G.fireCoordination  = false;
  G.forcefieldsActive = false; G.forcefieldsTimer = 0; G.forcefieldsCooldown = 0;

  Object.keys(G.systems).forEach(k => {
    G.systems[k].health = 100;
    G.systems[k].stress = 0;
    G.systems[k].tripped = false;
    G.systems[k].cap = 100;
    if (G.systems[k].aftCap !== undefined) G.systems[k].aftCap = 100;
  });
  Object.entries(shipCfg.systemLabels).forEach(([k, label]) => { if (G.systems[k]) G.systems[k].label = label; });
  Object.entries(shipCfg.defaultPower).forEach(([k, pwr])   => { if (G.systems[k]) G.systems[k].allocatedPower = pwr; });
}
