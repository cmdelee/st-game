'use strict';

// ============================================================
// WOLFPACK — Jem'Hadar Attack Ships fight in packs.
// G.threat / G.enemySystems hold the live ACTIVE target; the full single-target
// combat pipeline runs against it unchanged. G.pack holds full snapshots of
// every member. Inactive members harass the player on their own fire timers and
// render as extra meshes. Selecting a new target serializes the active member
// back to its slot and loads the chosen one. Victory only when ALL are dead.
// Depends on: config.js, state.js, engineering.js, crew.js, tactical.js,
//             enemy-ai.js (loaded before this file).
// ============================================================

const PACK_ARCHETYPE = 'jem_hadar_fighter';

// Fields that travel with a member when swapping active ↔ inactive.
function _packSnapshotActive() {
  const m = G.pack[G.activePackIndex];
  if (!m) return;
  m.hull       = G.threat.hull;
  m.maxHull    = G.threat.maxHull;
  m.shields    = Object.assign({}, G.threat.shields);
  m.systems    = G.enemySystems;                 // live object — hand it back
  m.lock       = G.enemyLockProgress;
  m.threatCycleTimer = G.threatCycleTimer;
  m.maneuverState    = G.enemyManeuverState;
  m.milestones = G.enemyHullMilestones;
  m.repairQueue = G.enemyRepairQueue;
}

function _packLoadMember(i) {
  const m = G.pack[i];
  if (!m) return;
  G.activePackIndex   = i;
  G.threat.hull       = m.hull;
  G.threat.maxHull    = m.maxHull;
  G.threat.shields    = Object.assign({}, m.shields);
  G.enemySystems      = m.systems;
  G.enemyLockProgress = m.lock;
  G.threatCycleTimer  = m.threatCycleTimer || 0;
  G.enemyManeuverState = m.maneuverState || 'neutral';
  G.enemyHullMilestones = m.milestones || {};
  G.enemyRepairQueue  = m.repairQueue || [];
}

// Build a fresh full Jem'Hadar fighter member (independent of G.threat).
function _buildFighterState(diff, formIdx) {
  const cfg = ENEMY_CONFIGS[PACK_ARCHETYPE];
  const systems = {};
  Object.keys(cfg.systems).forEach(k => { systems[k] = Object.assign({}, cfg.systems[k]); });
  if (typeof _assignEnemyMounts === 'function') _assignEnemyMounts(systems);
  return {
    id: formIdx, formIdx, alive: true,
    hull: Math.round(cfg.hull * diff.enemyHullMult),
    maxHull: Math.round(cfg.hull * diff.enemyHullMult),
    shields: Object.assign({}, cfg.shields),
    systems,
    lock: 0,
    fireTimer: 1200 + Math.random() * 1800,      // stagger first escort volley
    threatCycleTimer: 0,
    maneuverState: 'neutral',
    milestones: {},
    repairQueue: [],
  };
}

// Called by initiateVesselSimulation AFTER enemyResetForBattle. Slot 0 mirrors
// the just-built active member; slots 1..N-1 are fresh fighters.
function packResetForBattle(diff) {
  G.pack = []; G.packActive = false; G.packCount = 0; G.activePackIndex = 0; G.packBerserk = false;
  if (G.disablePack || G.enemyArchetype !== PACK_ARCHETYPE) return;

  const n = currentDifficulty === 'hard' ? 4 : 3;
  G.packActive = true; G.packCount = n;

  // Slot 0 = snapshot of the live active member (already in G.threat/G.enemySystems).
  G.pack.push({
    id: 0, formIdx: 0, alive: true,
    hull: G.threat.hull, maxHull: G.threat.maxHull,
    shields: Object.assign({}, G.threat.shields),
    systems: G.enemySystems,
    lock: G.enemyLockProgress, fireTimer: 0, threatCycleTimer: 0,
    maneuverState: 'neutral', milestones: G.enemyHullMilestones, repairQueue: G.enemyRepairQueue,
  });
  for (let i = 1; i < n; i++) G.pack.push(_buildFighterState(diff, i));
  G.activePackIndex = 0;
  postLogEvent(`Sensors: Jem'Hadar attack pack — ${n} ships closing! Designate targets and engage.`, 'crit');
}

function _packAliveCount() { return G.pack.filter(m => m.alive).length; }

// ── Player target selection (independently targetable peers) ──
function selectPackTarget(i) {
  if (!G.packActive || !G.running || G.dead) return;
  const m = G.pack[i];
  if (!m || !m.alive || i === G.activePackIndex) return;
  _packSnapshotActive();
  _packLoadMember(i);
  G.lockProgress = Math.max(0, G.lockProgress * 0.35);   // re-acquire on the new target
  G.targetedSubsystemType = 'hull';
  postLogEvent(`Target lock shifted to Attack Ship ${i + 1}.`, 'warn');
  if (typeof buildEnemySubsystemTargetGrid === 'function') buildEnemySubsystemTargetGrid();
  _updatePackRoster();
}

// ── Victory gate — replaces concludeSimulationRun(true, …) at enemy death ──
function _resolveEnemyDestroyed(msg) {
  if (!G.packActive) { concludeSimulationRun(true, msg, false); return true; }
  // Active member just died.
  const active = G.pack[G.activePackIndex];
  if (active) { active.alive = false; active.hull = 0; }
  G.score.enemiesDestroyed = (G.score.enemiesDestroyed || 0) + 1;
  const remaining = _packAliveCount();
  if (remaining > 0) {
    postLogEvent(`Attack Ship destroyed — ${remaining} ship${remaining > 1 ? 's' : ''} remaining.`, 'good');
    const next = G.pack.findIndex(m => m.alive);
    _packLoadMember(next);
    G.lockProgress = Math.max(0, G.lockProgress * 0.4);
    G.targetedSubsystemType = 'hull';
    // Last survivor goes berserk — "Victory is life." Fires faster and hits harder.
    if (remaining === 1 && !G.packBerserk) {
      G.packBerserk = true;
      postLogEvent("The last Jem'Hadar fighter goes berserk — \"Victory is life!\"", 'crit');
      if (typeof postTacticalAdvisory === 'function') postTacticalAdvisory("Last fighter is berserk — faster, harder fire. Finish it!");
    }
    if (typeof rebuildPackMeshes === 'function') rebuildPackMeshes();
    if (typeof buildEnemySubsystemTargetGrid === 'function') buildEnemySubsystemTargetGrid();
    _updatePackRoster();
    return false;
  }
  concludeSimulationRun(true, "Jem'Hadar attack pack destroyed — all ships eliminated.", false);
  return true;
}

// ── Escort harassment fire (full-strength polaron) ─────────────
function processPackEscorts(dt) {
  if (!G.packActive || !G.running || G.dead) return;
  const sc   = dt / 1000;
  const cfg  = ENEMY_CONFIGS[PACK_ARCHETYPE];
  const diff = DIFFICULTY[currentDifficulty];

  G.pack.forEach((m, i) => {
    if (!m.alive || i === G.activePackIndex) return;
    // Light shield regen (no repair queues for inactive members).
    const sg = m.systems.shields_sys;
    const regen = (sg ? sg.health / 100 : 1) * 1.2 * sc;
    SHIELD_SECTORS.forEach(s => {
      if (m.shields[s] < cfg.shields[s]) m.shields[s] = Math.min(cfg.shields[s], m.shields[s] + regen);
    });
    // Lock build-up (its own solution on the player).
    m.lock = Math.min(100, m.lock + cfg.lockRate * diff.enemyLockMult * 0.7 * sc);
    // Fire timer — full fighter cadence.
    m.fireTimer -= dt;
    if (m.fireTimer <= 0) {
      const fi = cfg.fireInterval * diff.enemyFireMult;
      m.fireTimer = fi + Math.random() * fi * 0.4;
      _packEscortFire(m);
      if (G.dead) return;
    }
  });
}

// One escort volley against the player. Mirrors the player-damage half of
// executeThreatCounterVolley (enemy-ai.js) but self-contained on the member.
function _packEscortFire(m) {
  const cfg  = ENEMY_CONFIGS[PACK_ARCHETYPE];
  const diff = DIFFICULTY[currentDifficulty];

  // Don't fire blind at a fully-cloaked player.
  if (G.cloaked && G.cloakVulnTimer <= 0) return;
  if (G.picardManoeuverActive) return;

  // Pick a living weapon (prefer beams over torpedoes for steady harassment).
  const wpns = Object.entries(m.systems).filter(([k, s]) => s.isWeapon && s.health > 0);
  if (wpns.length === 0) return;
  const beams = wpns.filter(([k, s]) => !s.isTorpedo);
  const [, sys] = (beams.length ? beams : wpns)[Math.floor(Math.random() * (beams.length ? beams.length : wpns.length))];

  const arc = sys.firingArc && sys.firingArc.length ? sys.firingArc : ['fore','port','starboard','aft'];
  const valid = arc.filter(s => SHIELD_SECTORS.includes(s));
  // Target the player's weakest valid sector.
  let targetSector = valid.reduce((w, s) => (G.player.shields[s] < G.player.shields[w] ? s : w), valid[0] || 'fore');

  let rawDmg = (Math.random() * (sys.dmgMax - sys.dmgMin) + sys.dmgMin) * (sys.health / 100) * diff.enemyDmgMult;
  if (G.activePanel === 'engineering') rawDmg *= 0.85;
  if (G.attackPatternOmegaActive)      rawDmg *= 1.20;
  if (G.deflectorActive)               rawDmg *= 0.65;

  // Polaron: partial shield bypass with hull passthrough.
  const shieldPenMult = sys.isPolaron ? 0.78 : 1.0;
  const hullPassthrough = sys.isPolaron ? rawDmg * 0.22 : 0;

  const shieldVal = G.player.shields[targetSector] || 0;
  if (shieldVal * shieldPenMult >= rawDmg * shieldPenMult) {
    G.player.shields[targetSector] = Math.max(0, G.player.shields[targetSector] - rawDmg * shieldPenMult);
    if (hullPassthrough > 0) G.player.hull = Math.max(0, G.player.hull - applyAblativeArmour(hullPassthrough));
    G.shieldUnderAttackTimer = 3000;
    G.shieldHitFlash.player = { sector: targetSector, timer: 350 };
    postLogEvent(`Pack ${sys.label} — ${targetSector.toUpperCase()} −${Math.round(rawDmg * shieldPenMult)}MW. [POLARON]`, 'warn');
  } else {
    const leak = (rawDmg * shieldPenMult - shieldVal * shieldPenMult) + hullPassthrough;
    G.player.shields[targetSector] = 0;
    G.shieldUnderAttackTimer = 3000;
    G.shieldHitFlash.player = { sector: targetSector, timer: 600 };
    const residual = applyAblativeArmour(leak);
    G.player.hull = Math.max(0, G.player.hull - residual);
    G.score.hullBreaches++;
    G.score.sectorBreaches[targetSector] = (G.score.sectorBreaches[targetSector] || 0) + 1;
    G.score.peakHullHit = Math.max(G.score.peakHullHit, residual);
    if (typeof spawnParticles === 'function') G.damageParticles.push(...spawnParticles('player', 8, C.red));
    postLogEvent(`PACK BREACH — ${targetSector.toUpperCase()} down! Hull −${Math.round(residual)}.`, 'crit');
    const medEff = getMedicalEfficiency();
    if (leak > 35 * medEff) inflictCrewCasualty();
  }

  // Beam visual from this escort's render slot.
  const escortOrdinal = G.pack.filter((mm, idx) => mm.alive && idx !== G.activePackIndex).indexOf(m);
  G.renderedBeamsVector.push({
    fromEnemy: true, fromEscort: escortOrdinal, faction: 'Dominion',
    weaponKey: 'polaron_fwd', isTorp: false, isPlasma: false, targetSector,
    trackingStartTime: performance.now(), duration: 400,
  });

  if (G.player.hull <= 0) concludeSimulationRun(false, "Vessel destroyed by the Jem'Hadar pack.", false);
}

// ── Left-panel pack roster (target selection chips) ────────────
function _updatePackRoster() {
  const host = document.getElementById('pack-roster');
  if (!host) return;
  if (!G.packActive) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = 'block';
  const sig = G.pack.map(m => `${m.alive ? Math.round((m.hull / m.maxHull) * 100) : 'X'}`).join(',') + '|' + G.activePackIndex;
  if (host._sig === sig) return;   // skip DOM churn when unchanged
  host._sig = sig;
  const chips = G.pack.map((m, i) => {
    const pct  = Math.max(0, Math.round((m.hull / Math.max(1, m.maxHull)) * 100));
    const dead = !m.alive;
    const act  = i === G.activePackIndex && !dead;
    const bg   = dead ? 'rgba(80,80,80,0.15)' : act ? 'rgba(255,170,0,0.18)' : 'rgba(255,68,68,0.10)';
    const bd   = act ? '1px solid var(--warn)' : dead ? '1px solid #444' : '1px solid rgba(255,68,68,0.4)';
    const col  = dead ? '#666' : act ? 'var(--warn)' : 'var(--red)';
    const barCol = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--warn)' : 'var(--red)';
    return `<div onclick="selectPackTarget(${i})" title="Attack Ship ${i + 1}" style="cursor:${dead ? 'default' : 'pointer'};background:${bg};border:${bd};border-radius:4px;padding:2px 3px;display:flex;flex-direction:column;gap:1px;${dead ? 'opacity:0.5;text-decoration:line-through;' : ''}">
      <span style="font-size:8px;font-weight:bold;color:${col};letter-spacing:0.5px;">AS-${i + 1}${act ? ' ◀' : ''}</span>
      <div class="bar-rail" style="height:5px;margin:0;"><div class="bar-fill" style="width:${dead ? 0 : pct}%;color:${barCol};"></div></div>
    </div>`;
  }).join('');
  host.innerHTML = `<div class="side-static-label" style="color:var(--red);margin-top:4px;">Pack Contacts</div>
    <div style="display:grid;grid-template-columns:repeat(${G.pack.length},1fr);gap:3px;margin-top:2px;">${chips}</div>`;
}
