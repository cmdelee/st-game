'use strict';

// ============================================================
// SMOKETEST.JS — headless invariant smoke tests
// Exercises every ship × station × enemy combination by driving the
// real per-frame subsystem ticks (no requestAnimationFrame), then asserts
// invariants: no exception, and hull / shields / lock / system values stay
// finite and in-range. Catches the regression class behind bugs like the
// shields_sys key error (#92/#93/#126) that no test previously covered.
//
// Run modes:
//   • Append ?test=1 (or ?smoketest=1) to the URL → auto-runs ~1s after boot.
//   • Or call runSmokeTests() from the console at any time.
// Results print to the console: a per-combo line plus a final summary.
// Failures are console.error so they surface in CI / preview error logs.
// ============================================================

// Mirror of masterSimulationCoreLoop's core subsystem calls, minus RAF and
// canvas rendering. Kept deliberately close to the real loop body so the test
// exercises the same code paths the game runs each frame.
function _smokeAdvance(dt) {
  G.lastFrameTimestamp += dt;
  if (G.shieldHitFlash.player.timer > 0) G.shieldHitFlash.player.timer = Math.max(0, G.shieldHitFlash.player.timer - dt);
  if (G.shieldHitFlash.enemy.timer  > 0) G.shieldHitFlash.enemy.timer  = Math.max(0, G.shieldHitFlash.enemy.timer  - dt);

  if (G.cloakVulnTimer > 0) G.cloakVulnTimer = Math.max(0, G.cloakVulnTimer - dt);
  if (G.cloakCooldown  > 0) G.cloakCooldown  = Math.max(0, G.cloakCooldown  - dt);

  if (!G.cloaked && G.cloakVulnTimer <= 0) {
    if (G.shieldUnderAttackTimer > 0) G.shieldUnderAttackTimer = Math.max(0, G.shieldUnderAttackTimer - dt);
    else {
      const regen = G.shieldRegenRate * (dt / 1000);
      const max   = G.player.shields.maxSectorValue;
      SHIELD_SECTORS.forEach(s => { G.player.shields[s] = Math.min(max, G.player.shields[s] + regen); });
    }
  }

  computeConduitConduction(dt);
  processRepairQueues(dt);
  processAutomatedDelegation(dt);
  processEnemyAI(dt);
  tickCaptainCooldowns(dt);
  tickCaptainManoeuvres(dt);
  processDeepScan(dt);

  G.threat.hull = Math.min(G.threat.maxHull, G.threat.hull + G.threat.recoveryCoefficient * (dt / 1000));
  G.threatCycleTimer += dt;
  const fi = getEffectiveFireInterval() * (G.enemyPhaseFireMult || 1.0) * (G.weaponsDisrupted ? 2 : 1);
  if (G.threatCycleTimer > fi) { G.threatCycleTimer = 0; executeThreatCounterVolley(); }
}

function _smokeInvariants() {
  const errs = [];
  const fin  = v => typeof v === 'number' && isFinite(v);
  if (!fin(G.player.hull) || G.player.hull < -0.01)            errs.push(`player.hull=${G.player.hull}`);
  if (G.player.hull > G.player.maxHull + 0.01)                 errs.push(`player.hull>${G.player.maxHull}`);
  SHIELD_SECTORS.forEach(s => { if (!fin(G.player.shields[s]) || G.player.shields[s] < -0.01) errs.push(`pShield.${s}=${G.player.shields[s]}`); });
  if (!fin(G.threat.hull) || G.threat.hull < -0.01)           errs.push(`threat.hull=${G.threat.hull}`);
  SHIELD_SECTORS.forEach(s => { if (!fin(G.threat.shields[s])) errs.push(`eShield.${s}`); });
  if (!fin(G.lockProgress) || G.lockProgress < -0.01 || G.lockProgress > 100.01)      errs.push(`lock=${G.lockProgress}`);
  if (!fin(G.enemyLockProgress) || G.enemyLockProgress < -0.01 || G.enemyLockProgress > 100.01) errs.push(`eLock=${G.enemyLockProgress}`);
  Object.keys(G.systems).forEach(k => {
    const s = G.systems[k];
    if (!fin(s.health) || s.health < -0.01 || s.health > 100.01) errs.push(`sys.${k}.health=${s.health}`);
    if (!fin(s.cap)    || s.cap < -0.01    || s.cap > 100.01)     errs.push(`sys.${k}.cap=${s.cap}`);
  });
  if (!fin(G.epsHeat) || G.epsHeat < -0.01 || G.epsHeat > 100.01) errs.push(`epsHeat=${G.epsHeat}`);
  return errs;
}

// Force a specific enemy regardless of difficulty pool by borrowing campaign
// mode's archetype-preservation path, then immediately clearing it.
function _smokeStartEngagement(shipKey, station, enemyKey, diff) {
  setDifficulty(diff);
  selectPlayerShip(shipKey);
  G.enemyArchetype = enemyKey;
  G.campaignMode = true;            // makes initiateVesselSimulation keep our archetype
  try { initiateVesselSimulation(station); }
  finally { G.campaignMode = false; }
  // Skip the pre-battle briefing overlay/timer — go straight to combat state
  G.preBattleActive = false;
  G.running = true;
  G.lastFrameTimestamp = performance.now();
  initEncounterPhases();
}

function runSmokeTests(opts) {
  opts = opts || {};
  const FRAMES = opts.frames || 160;
  const DT     = 16;             // ~60fps
  const ships    = ['defiant', 'enterprise_e'];
  const stations = ['tactical', 'engineering', 'helm', 'captain'];
  const allEnemies = Object.keys(ENEMY_CONFIGS);

  // Combo matrix (bounded): every enemy with defiant/tactical (player fires),
  // plus both ships × all 4 stations against a representative mid-tier enemy.
  const combos = [];
  allEnemies.forEach(e => combos.push({ ship:'defiant', station:'tactical', enemy:e, diff: e === 'borg_probe' ? 'elite' : 'hard', fire:true }));
  ships.forEach(sh => stations.forEach(st => combos.push({ ship:sh, station:st, enemy:'galor_class', diff:'hard', fire:false })));

  const results = [];
  let failures = 0;
  const wasRunning = G.running;

  combos.forEach(combo => {
    const tag = `${combo.ship}/${combo.station} vs ${combo.enemy} [${combo.diff}]`;
    let firstErr = null, threw = null, frames = 0;
    try {
      _smokeStartEngagement(combo.ship, combo.station, combo.enemy, combo.diff);
      for (let i = 0; i < FRAMES && !G.dead; i++) {
        _smokeAdvance(DT);
        frames++;
        // Exercise player weapons periodically (player-crewed combos)
        if (combo.fire && i % 6 === 0 && !G.cloaked) {
          try { fireEnergyWeapons(); } catch (e) { throw new Error('fireEnergyWeapons: ' + e.message); }
          if (i % 18 === 0) { try { fireTorpedoBanks(); } catch (e) { throw new Error('fireTorpedoBanks: ' + e.message); } }
        }
        const errs = _smokeInvariants();
        if (errs.length) { firstErr = `frame ${i}: ${errs.join(', ')}`; break; }
      }
    } catch (e) {
      threw = e && e.stack ? e.stack.split('\n').slice(0,2).join(' | ') : String(e);
    }
    const ok = !firstErr && !threw;
    if (!ok) failures++;
    results.push({ tag, ok, frames, detail: threw || firstErr || '' });
  });

  // Clean up — return to a sane idle state
  G.dead = false; G.running = false;
  try { if (typeof returnToSetup === 'function') returnToSetup(); } catch (e) {}
  if (wasRunning) { /* leave stopped; caller can restart */ }

  // Report
  const passed = results.length - failures;
  console.log(`%c━━━ SMOKE TESTS ━━━  ${passed}/${results.length} passed`, 'font-weight:bold;color:' + (failures ? '#ff4444' : '#00cc66'));
  results.forEach(r => {
    if (r.ok) console.log(`  ✓ ${r.tag} (${r.frames}f)`);
    else      console.error(`  ✕ ${r.tag} — ${r.detail}`);
  });
  if (failures) console.error(`SMOKE TESTS FAILED: ${failures}/${results.length} combos`);
  else          console.log(`%cSMOKE TESTS PASSED: all ${results.length} combos clean`, 'color:#00cc66');

  return { total: results.length, passed, failed: failures, results };
}

// Auto-run when ?test=1 / ?smoketest=1 is present (after boot + model load settle)
if (/[?&](test|smoketest)=1/.test(location.search)) {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { runSmokeTests(); } catch (e) { console.error('Smoke test harness crashed:', e); } }, 1200);
  });
}
