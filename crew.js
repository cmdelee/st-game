'use strict';

// ============================================================
// CREW.JS — Crew casualties, efficiency, warp availability
// Depends on: config.js, state.js
// ============================================================

function postTacticalAdvisory(msg) {
  postLogEvent(`WORF: ${msg}`, 'info');
}

// ── Crew casualties ───────────────────────────────────────────
function inflictCrewCasualty() {
  const stations = Object.keys(CREW_STATIONS);
  const station  = stations[Math.floor(Math.random() * stations.length)];
  const crew     = CREW_STATIONS[station];
  if (crew.status === 'nominal')       { crew.status = 'wounded';       crew.casualties++; postLogEvent(`CASUALTY: ${crew.name} (${crew.role}) wounded.`, 'crit'); }
  else if (crew.status === 'wounded')  { crew.status = 'incapacitated'; crew.casualties++; postLogEvent(`CREW LOSS: ${crew.name} incapacitated.`, 'crit'); }
  updateCrewStatusDisplay();
  if (crew.status === 'incapacitated') {
    if (station === 'medical')     postLogEvent("Dr. Bashir incapacitated — crew casualty rate will increase.", 'crit');
    if (station === 'helm')        postLogEvent("Ensign Nog incapacitated — evasive pattern effectiveness reduced.", 'crit');
    if (station === 'tactical')    postLogEvent("Lt. Cmdr Worf incapacitated — targeting accuracy severely degraded.", 'crit');
    if (station === 'engineering') postLogEvent("Chief O'Brien incapacitated — repair speed critically reduced.", 'crit');
  }
}

function getCrewEfficiency(station) {
  const c = CREW_STATIONS[station]; if (!c) return 1.0;
  return c.status === 'nominal' ? 1.0 : c.status === 'wounded' ? 0.65 : 0.30;
}

function getMedicalEfficiency() {
  const med = CREW_STATIONS.medical;
  return med.status === 'nominal' ? 1.0 : med.status === 'wounded' ? 0.7 : 0.4;
}

function getHelmEvasiveModifier() {
  const helm = CREW_STATIONS.helm;
  if (helm.status === 'nominal') return 0.40;
  if (helm.status === 'wounded') return 0.60;
  return 0.80;
}

function updateCrewStatusDisplay() {
  const div = document.getElementById('crew-casualties-display'); if (!div) return;
  div.innerHTML = Object.values(CREW_STATIONS).map(c => {
    const col  = c.status === 'nominal' ? C.green : c.status === 'wounded' ? C.warn : C.red;
    const icon = c.status === 'nominal' ? '●' : c.status === 'wounded' ? '⚠' : '✕';
    return `<div class="casualty-line"><div class="casualty-dot" style="background:${col};"></div><span style="color:${col};font-size:9px;">${icon} ${c.name} — ${c.role}</span></div>`;
  }).join('');
}

// ── Emergency warp ────────────────────────────────────────────
function attemptEmergencyWarp() {
  if (!G.running || G.dead) return;
  const wc = G.systems.warp_core;
  if (wc.health < 25 || wc.tripped) { postLogEvent("WARP IMPOSSIBLE: Warp core offline or critically damaged.", 'crit'); return; }
  if (G.player.hull / G.player.maxHull > 0.35) { postLogEvent("Emergency warp denied: hull above 35%.", 'warn'); return; }
  if (G.cloaked) { G.cloaked = false; G.cloakCooldown = 0; }
  const cost = Math.floor(G.player.torpedoes / 2);
  G.player.torpedoes -= cost;
  G.score.warpedOut = true;
  postLogEvent(`EMERGENCY WARP — ${cost} torpedoes as field initiators. Disengaging.`, 'good');
  const _shipLbl = (G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).label;
  concludeSimulationRun(false, `${_shipLbl} escaped via emergency warp. Enemy vessel still active.`, true);
}

function updateWarpAvailability() {
  const lbl = document.getElementById('lbl-warp-avail'); if (!lbl) return;
  const wc  = G.systems.warp_core;
  const hp  = G.player.hull / G.player.maxHull;
  if (wc.health < 25 || wc.tripped) { lbl.textContent = '⊗ WARP OFFLINE'; lbl.style.color = 'var(--red)'; }
  else if (hp > 0.35)               { lbl.textContent = 'WARP STANDBY';  lbl.style.color = 'var(--warn)'; }
  else                              { lbl.textContent = '⚡ WARP READY';  lbl.style.color = 'var(--green)'; }
}
