'use strict';

// ============================================================
// SMOKETEST.JS — headless invariant + behaviour smoke tests
// Drives the real per-frame subsystem ticks (no requestAnimationFrame) and the
// real ability functions across every ship × station × enemy, then asserts:
//   • no exception thrown
//   • hull / shields / lock / system values stay finite and in-range
//   • behaviour is correct (firing deals damage; repairs heal; warp-core trip
//     scales power; emergency warp / ramming end the game)
// Catches the regression class behind bugs like the shields_sys key error
// (#92/#93/#126) that no test previously covered.
//
// Run modes:
//   • Append ?test=1 (or ?smoketest=1) → auto-runs ~1.2s after boot.
//   • Or call runSmokeTests() from the console.
// Results print to the console AND are published to window.__SMOKE_RESULT,
// with window.__SMOKE_DONE=true set when the auto-run finishes (consumed by
// the Playwright CI runner in tests/run-smoke.mjs). Failures use console.error.
// ============================================================

// Mirror of masterSimulationCoreLoop's core subsystem calls, minus RAF and
// canvas rendering. Kept deliberately close to the real loop body.
function _smokeAdvance(dt) {
  G.lastFrameTimestamp += dt;
  if (G.shieldHitFlash.player.timer > 0) G.shieldHitFlash.player.timer = Math.max(0, G.shieldHitFlash.player.timer - dt);
  if (G.shieldHitFlash.enemy.timer  > 0) G.shieldHitFlash.enemy.timer  = Math.max(0, G.shieldHitFlash.enemy.timer  - dt);

  if (G.cloakVulnTimer > 0) G.cloakVulnTimer = Math.max(0, G.cloakVulnTimer - dt);
  if (G.cloakCooldown  > 0) G.cloakCooldown  = Math.max(0, G.cloakCooldown  - dt);
  if (G.saucerSepReconnecting) {
    G.saucerSepReconnectTimer = Math.max(0, G.saucerSepReconnectTimer - dt);
    if (G.saucerSepReconnectTimer === 0) { G.saucerSepActive = false; G.saucerSepReconnecting = false; G.saucerSepCooldown = 60000; }
  }
  if (G.saucerSepCooldown > 0) G.saucerSepCooldown = Math.max(0, G.saucerSepCooldown - dt);

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
    if (s.aftCap !== undefined && (!fin(s.aftCap) || s.aftCap < -0.01 || s.aftCap > 100.01)) errs.push(`sys.${k}.aftCap=${s.aftCap}`);
  });
  if (!fin(G.epsHeat) || G.epsHeat < -0.01 || G.epsHeat > 100.01) errs.push(`epsHeat=${G.epsHeat}`);
  if (!fin(G.shieldRegenRate) || G.shieldRegenRate < -0.01)       errs.push(`regen=${G.shieldRegenRate}`);
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
  G.preBattleActive = false;        // skip the briefing overlay/timer
  G.running = true;
  G.lastFrameTimestamp = performance.now();
  initEncounterPhases();
}

// Ability specs to exercise. Format: 'fnName' or 'fnName:arg'. Each self-guards
// on cooldown/health/station, so calling out of context simply no-ops.
const _ABILITY_SPECS = {
  common: [
    'executeEvasivePattern', 'rotateShieldFrequency', 'startDeepScan',
    'executeAttackRun', 'executeComeAbout', 'executePicardManoeuver',
    'executeAttackPatternOmega', 'executeEvasivePatternAlpha', 'executeEmergencyPowerDump',
    'setHelmSpeed:full', 'setHelmSpeed:half', 'setHelmAttackVector:aft', 'setHelmAttackVector:fore',
    'setPlayerRangeBracket:close', 'setPlayerRangeBracket:long',
    'pumpShieldSector:fore', 'rebalanceShieldArrays', 'applyPowerPreset:attack',
    'fireEnergyWeapons', 'fireTorpedoBanks', 'fireAllWeapons', 'executeAlphaSalvoFire',
  ],
  defiant: ['toggleCloakingDevice', 'executeCannonOvercharge', 'executeUnstableTorpedo', 'executeMaximumPulseBurst'],
  enterprise_e: ['toggleSaucerSeparation', 'executeMaxPhaserOutput', 'executeTricobalWarhead', 'executeConcentratedPhaserFire'],
};

function _smokeCallAbility(spec) {
  const [name, arg] = spec.split(':');
  const fn = window[name];
  if (typeof fn !== 'function') return `${name}: not a function`;
  try { arg !== undefined ? fn(arg) : fn(); return null; }
  catch (e) { return `${name}: ${e.message}`; }
}

function runSmokeTests(opts) {
  opts = opts || {};
  const FRAMES = opts.frames || 160;
  const DT     = 16;
  const ships    = ['defiant', 'enterprise_e'];
  const stations = ['tactical', 'engineering', 'helm', 'captain'];
  const allEnemies = Object.keys(ENEMY_CONFIGS);

  const combos = [];
  // Every enemy with defiant/tactical, player firing — asserts damage is dealt.
  allEnemies.forEach(e => combos.push({ ship:'defiant', station:'tactical', enemy:e, diff: e === 'borg_probe' ? 'elite' : 'hard', fire:true }));
  // Both ships × all stations vs a mid-tier enemy — exercises every ability.
  ships.forEach(sh => stations.forEach(st => combos.push({ ship:sh, station:st, enemy:'galor_class', diff:'hard', abilities:true })));

  const results = [];
  let failures = 0;

  combos.forEach(combo => {
    const tag = `${combo.ship}/${combo.station} vs ${combo.enemy} [${combo.diff}]${combo.abilities?' +abilities':''}`;
    let firstErr = null, threw = null, frames = 0;
    try {
      _smokeStartEngagement(combo.ship, combo.station, combo.enemy, combo.diff);
      const abilityList = combo.abilities ? _ABILITY_SPECS.common.concat(_ABILITY_SPECS[combo.ship] || []) : null;
      let abilityIdx = 0;
      for (let i = 0; i < FRAMES && !G.dead; i++) {
        _smokeAdvance(DT);
        frames++;
        if (combo.fire && i % 6 === 0 && !G.cloaked) {
          const e1 = (() => { try { fireEnergyWeapons(); return null; } catch (e) { return 'fireEnergyWeapons: ' + e.message; } })();
          if (e1) throw new Error(e1);
          if (i % 18 === 0) { try { fireTorpedoBanks(); } catch (e) { throw new Error('fireTorpedoBanks: ' + e.message); } }
        }
        // Spread ability calls across the run, ~2 per frame, checking invariants after each.
        if (abilityList) {
          for (let n = 0; n < 2 && abilityIdx < abilityList.length; n++) {
            const aerr = _smokeCallAbility(abilityList[abilityIdx++]);
            if (aerr) { firstErr = `ability ${aerr}`; break; }
            const ie = _smokeInvariants();
            if (ie.length) { firstErr = `after ${abilityList[abilityIdx-1]}: ${ie.join(', ')}`; break; }
          }
          if (firstErr) break;
        }
        const errs = _smokeInvariants();
        if (errs.length) { firstErr = `frame ${i}: ${errs.join(', ')}`; break; }
      }
      // Behaviour assertion: firing combos must actually deal damage.
      if (!firstErr && combo.fire && !(G.score.totalDmgDealt > 0)) {
        firstErr = `no damage dealt over ${frames} frames (totalDmgDealt=${G.score.totalDmgDealt})`;
      }
    } catch (e) {
      threw = e && e.stack ? e.stack.split('\n').slice(0,2).join(' | ') : String(e);
    }
    const ok = !firstErr && !threw;
    if (!ok) failures++;
    results.push({ tag, ok, frames, detail: threw || firstErr || '' });
  });

  // ── Scenario tests — specific mechanics end-to-end ─────────────
  const scenarios = [
    { tag: 'scenario: repair heals a damaged system', fn: () => {
        _smokeStartEngagement('defiant', 'engineering', 'galor_class', 'hard');
        G.systems.sensors.health = 30;
        assignRepairTeam('sensors', 0);
        // Repair time ≈ max(5000,(70/10)*5000)=35s sim; drain ~dt*crew*repairMult.
        // 1200×80ms = 96s sim — ample headroom for completion.
        for (let i = 0; i < 1200 && G.systems.sensors.health < 60; i++) _smokeAdvance(80);
        const ie = _smokeInvariants(); if (ie.length) return ie.join(', ');
        return G.systems.sensors.health > 35 ? null : `sensors not repaired (${G.systems.sensors.health}%)`;
      } },
    { tag: 'scenario: warp-core trip scales power, recovers', fn: () => {
        _smokeStartEngagement('defiant', 'engineering', 'galor_class', 'hard');
        const before = getWarpOutput();
        G.systems.warp_core.tripped = true; G.systems.warp_core.health = 60;
        handleWarpCoreTrip();
        for (let i = 0; i < 20; i++) _smokeAdvance(16);
        let ie = _smokeInvariants(); if (ie.length) return 'tripped: ' + ie.join(', ');
        const tripped = getWarpOutput();
        if (!(tripped <= before)) return `warp output did not drop (${before}->${tripped})`;
        // recover via battery
        activateEmergencyBattery();
        for (let i = 0; i < 20; i++) _smokeAdvance(16);
        ie = _smokeInvariants(); return ie.length ? 'battery: ' + ie.join(', ') : null;
      } },
    { tag: 'scenario: emergency warp ends the game (escaped)', fn: () => {
        _smokeStartEngagement('defiant', 'helm', 'galor_class', 'hard');
        G.player.hull = G.player.maxHull * 0.2;
        attemptEmergencyWarp();
        return G.dead ? null : 'emergency warp did not end the game';
      } },
    { tag: 'scenario: Jem\'Hadar ramming impact resolves', fn: () => {
        _smokeStartEngagement('defiant', 'tactical', 'jem_hadar_fighter', 'hard');
        G.threat.hull = G.threat.maxHull * 0.15;
        initiateRammingRun(ENEMY_CONFIGS[G.enemyArchetype]);
        G.enemyRammingTimer = 10;
        processNewMechanicsTimers(16);   // fires executeRammingImpact
        const ie = _smokeInvariants(); if (ie.length) return ie.join(', ');
        return G.dead ? null : 'ramming impact did not resolve the engagement';
      } },
  ];
  scenarios.forEach(sc => {
    let detail = null;
    try { detail = sc.fn(); } catch (e) { detail = (e && e.stack ? e.stack.split('\n').slice(0,2).join(' | ') : String(e)); }
    const ok = !detail;
    if (!ok) failures++;
    results.push({ tag: sc.tag, ok, frames: 0, detail: detail || '' });
  });

  // Clean up
  G.dead = false; G.running = false;
  try { if (typeof returnToSetup === 'function') returnToSetup(); } catch (e) {}

  // Report
  const passed = results.length - failures;
  console.log(`%c━━━ SMOKE TESTS ━━━  ${passed}/${results.length} passed`, 'font-weight:bold;color:' + (failures ? '#ff4444' : '#00cc66'));
  results.forEach(r => {
    if (r.ok) console.log(`  ✓ ${r.tag}${r.frames?` (${r.frames}f)`:''}`);
    else      console.error(`  ✕ ${r.tag} — ${r.detail}`);
  });
  if (failures) console.error(`SMOKE TESTS FAILED: ${failures}/${results.length}`);
  else          console.log(`%cSMOKE TESTS PASSED: all ${results.length}`, 'color:#00cc66');

  const summary = { total: results.length, passed, failed: failures, results };
  window.__SMOKE_RESULT = summary;
  return summary;
}

// Auto-run when ?test=1 / ?smoketest=1 (after boot + model load settle).
if (/[?&](test|smoketest)=1/.test(location.search)) {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      try { runSmokeTests(); }
      catch (e) { console.error('Smoke test harness crashed:', e); window.__SMOKE_RESULT = { total:0, passed:0, failed:1, results:[{ tag:'harness', ok:false, detail:String(e) }] }; }
      finally { window.__SMOKE_DONE = true; }
    }, 1200);
  });
}
