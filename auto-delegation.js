'use strict';

// ============================================================
// AUTO-DELEGATION — computer management of uncrewed stations
// Runs when player is at tactical, helm, engineering, or captain.
// Depends on: state.js, engineering.js, crew.js, tactical.js,
//             helm.js, command.js (postCrewReport — runtime only)
// ============================================================

// ── Smart auto-tactical fire ──────────────────────────────────
// A competent delegated tactical officer: focus-fires wolfpack swarms, and vs
// Borg adaptive shielding it collapses the Regenerative Matrix first, rotates
// weapon types to outpace adaptation, and spends overload/burst tools. Without
// this the auto-crew just dumped every weapon at the hull — which can't solve
// the Borg puzzle or the pack, leaving L8/L9 unwinnable from non-tactical stations.
function _autoTacticalFire(ce, torpChance) {
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // Wolfpack: the active member is burned down then promotion advances to the
  // next (in pack.js). We deliberately do NOT auto-swap targets here — each
  // selectPackTarget resets the lock, which would starve the lock-gated torpedoes
  // and lower DPS. Just keep firing the active member to death.

  const isEnt = G.playerShipKey === 'enterprise_e';
  // The delegated crew leverages ready overload power on every engagement (these
  // self-guard on cooldown/ship and only run for non-tactical stations, so they
  // never conflict with manual tactical play).
  if (G.overchargeReady) (isEnt ? executeMaxPhaserOutput : executeCannonOvercharge)();

  if (cfg && cfg.adaptiveShields) {
    // Borg: collapse the regen matrix (its health drives shield regen), then hull,
    // and rotate weapon types so no single one caps its adaptation resistance.
    const sm   = G.enemySystems.shields_sys;
    const want = (sm && sm.health > 35) ? 'shields_sys' : 'hull';
    if (G.targetedSubsystemType !== want && typeof setEnemyTarget === 'function')
      setEnemyTarget(want, want === 'hull' ? 'Hull' : 'Regenerative Matrix', 'All');
    if (G.maxPulseBurstReady && !isEnt) executeMaximumPulseBurst();   // one-shot heavy burst
    if (G.tricobalReady && isEnt)       executeTricobalWarhead();
    _autoRotateFire();
  } else {
    // Conventional fight: salvo + burst (all cannons / concentrated arrays) + torps.
    if (G.burstFireReady && G.lockProgress >= 20 && !G.cloaked && !G.enemyTractorActive)
      (isEnt ? executeConcentratedPhaserFire : executeBurstFireSalvo)();
    fireEnergyWeapons();
    // Torpedoes are limited ordnance — only spend them with a real lock. Fire
    // Coordination (engineering) commits them aggressively to speed kills.
    const torpGate = G.fireCoordination ? 5 : 25;
    if (G.lockProgress >= torpGate && Math.random() < torpChance * ce) fireTorpedoBanks();
  }
}

// Fire the 3 lowest-adaptation-resistance in-arc weapons (vs adaptive shields)
// so no single weapon type caps its resistance.
function _autoRotateFire() {
  const aw = G.activeWeaponArrays || ARRAYS_DICTIONARY;
  const list = Object.keys(aw).map(k => ({ k, w: aw[k], adapt: aw[k].isPhoton ? 'photon' : aw[k].parentSystem }))
    .filter(({ w }) => {
      const ps = G.systems[w.parentSystem];
      if (!ps || ps.tripped || ps.health < 10) return false;
      const aft = w.arc.includes('aft') && !w.arc.includes('fore');
      const cap = (aft && ps.aftCap !== undefined) ? ps.aftCap : ps.cap;
      if (cap < w.cost) return false;
      if (w.isQuantum && G.player.torpedoes <= 0) return false;
      if (w.isPhoton && G.player.photonTorpedoes <= 0) return false;
      if (!w.isPhoton && G.lockProgress < 5) return false;
      return weaponInArc(w);
    });
  list.sort((a, b) => (G.enemyAdaptiveResist[a.adapt] || 0) - (G.enemyAdaptiveResist[b.adapt] || 0));
  list.slice(0, 3).forEach(({ k }) => fireSelectedArray(k));
}

function processAutomatedDelegation(dt) {
  const isCaptain  = G.playerChosenStation === 'captain';
  const runAutoEng = G.playerChosenStation === 'tactical' || G.playerChosenStation === 'helm' || isCaptain;
  const runAutoTac = G.playerChosenStation === 'engineering' || G.playerChosenStation === 'helm' || isCaptain;

  // Auto-helm — when the player isn't flying the ship, the computer counters the
  // enemy's 3D positioning so the auto-tactical guns keep bearing: match its
  // vertical plane (climb/dive) and turn to face its lateral flank.
  if (G.playerChosenStation !== 'helm') {
    const e = G.enemyElevation || 'level';
    G.helmPitch = e === 'above' ? 'climb' : e === 'below' ? 'dive' : 'level';
    // Face the enemy: setting the bow to its bearing makes effectiveEnemySector → fore
    if (!G.comeAboutActive) G.helmAttackVector = G.enemyBearing || 'fore';
  }

  // ── Auto-engineering: relay resets + repair dispatch ─────────
  if (runAutoEng) {
    const ce = getCrewEfficiency('engineering');
    // Auto-O'Brien wields the engineering combat toolkit so Helm/Captain players
    // get the same surge/forcefield support an engineer would provide.
    const _enemyUp = G.threat.hull > 0 && !(G.enemyCloaked && G.enemyCloakVulnTimer <= 0);
    // Coordinate fire (aggressive, torpedo-heavy) while engaged so the delegated
    // crew can win DPS races (the wolfpack); only auto-set for non-engineering
    // stations (runAutoEng is false when the player IS the engineer).
    if (_enemyUp && !G.fireCoordination) G.fireCoordination = true;
    if (_enemyUp && G.weaponSurgeCooldown <= 0 && !G.weaponSurgeActive && typeof divertPowerToWeapons === 'function')
      divertPowerToWeapons();
    if (G.player.hull / G.player.maxHull < 0.60 && G.forcefieldsCooldown <= 0 && !G.forcefieldsActive && typeof engageEmergencyForcefields === 'function')
      engageEmergencyForcefields();
    const anyTripped = Object.values(G.systems).some(s => s.tripped);
    if (anyTripped) Object.keys(G.systems).forEach(key => {
      const sys = G.systems[key];
      if (sys.tripped && Math.random() < 0.06 * ce * (dt / 1000)) {
        if (key === 'warp_core' && sys.health < 25) return;
        sys.tripped = false; sys.stress = 0;
        const def = (G.playerShipConfig && G.playerShipConfig.defaultPower) || {};
        sys.allocatedPower = def[key] ?? 10;
        postLogEvent(`Computer: relay restored [${sys.label}]`, 'info');
        refreshEngineeringPanelGraphics();
      }
    });

    const damaged = Object.keys(G.systems)
      .filter(k => (G.systems[k].health < 70 || G.systems[k].tripped) && !G.repairTeams.some(t => t.sysKey === k))
      .sort((a, b) => G.systems[a].health - G.systems[b].health);
    let _dIdx = 0;
    G.repairTeams.forEach(team => {
      if (!team.sysKey && _dIdx < damaged.length) {
        const target     = damaged[_dIdx++];
        const sys        = G.systems[target];
        const damage     = Math.max(1, 100 - sys.health + (sys.tripped ? 20 : 0));
        const repairTime = Math.max(5000, (damage / 10) * 5000);
        team.sysKey = target; team.label = sys.label; team.totalTime = repairTime; team.remaining = repairTime;
        postLogEvent(`Computer: repair team dispatched to [${sys.label}].`, 'info');
      }
    });

    // Captain-only engineering behaviours
    if (isCaptain) {
      if (G.systems.warp_core.tripped && !G.batteryActive && G.batteryCharge > 20) {
        G.batteryActive = true;
        postLogEvent("O'Brien: Emergency battery online — warp core offline.", 'good');
        if (typeof postCrewReport === 'function') postCrewReport('obrien', "Emergency battery active — maintaining EPS on impulse power.", 'alert');
      }
      if (!G.cloaked && !G.shieldTransferInProgress) {
        const max        = G.player.shields.maxSectorValue;
        const sectors    = ['fore','port','starboard','aft'];
        const critSector = sectors.find(s => G.player.shields[s] < max * 0.15);
        const totalShields = sectors.reduce((sum, s) => sum + G.player.shields[s], 0);
        if (critSector && totalShields > max * 1.5 && Math.random() < 0.01 * (dt / 1000) * 60) {
          rebalanceShieldArrays();
          postLogEvent(`O'Brien: Auto-equalising — ${critSector.toUpperCase()} shields critical.`, 'warn');
        }
      }
    }
  }

  // ── Auto-tactical: weapons + worf special abilities ──────────
  // Fire at Will (captain) / Fire Coordination (engineering) both make the crew
  // fire faster, at lower lock, with heavy torpedo use.
  const _aggressive = G.fireAtWill || G.fireCoordination;
  const _fireClock  = _aggressive ? 1400 : 2400;
  const _lockMin    = _aggressive ? 0    : 8;
  const _torpChance = _aggressive ? 0.85 : 0.35;

  if (runAutoTac && !G.holdFire) {
    G.autoTacticalFireClock += dt;
    if (G.autoTacticalFireClock > _fireClock) {
      G.autoTacticalFireClock = 0;
      // Don't auto-fire at a cloaked target — no firing solution, no weapons.
      // (During the brief decloak vulnerability window the enemy IS targetable.)
      const enemyFullyCloaked = G.enemyCloaked && G.enemyCloakVulnTimer <= 0;
      if (!G.cloaked && G.cloakVulnTimer === 0 && !enemyFullyCloaked && G.lockProgress >= _lockMin) {
        const ce = getCrewEfficiency('tactical');
        if (Math.random() < ce) {
          const warpOnline = !G.systems.warp_core.tripped || G.batteryActive;
          if (warpOnline) _autoTacticalFire(ce, _torpChance);
        }
      }
    }
    // Fire at Will: auto-burst + auto deep scan when ready
    if (G.fireAtWill && isCaptain) {
      if (G.burstFireReady && G.lockProgress >= 20 && !G.cloaked && !G.enemyTractorActive)
        executeBurstFireSalvo();
      if (!G.deepScanActive && G.deepScanCooldown === 0 && G.systems.sensors.health >= 15)
        startDeepScan();
    }

    // Captain-only Worf autonomous abilities
    if (isCaptain) {
      if (G.burstFireReady && G.lockProgress >= 55 && !G.cloaked && !G.enemyTractorActive &&
          G.threat.hull / G.threat.maxHull > 0.10 &&
          Math.random() < 0.015 * (dt / 1000) * 60) {
        executeBurstFireSalvo();
        postLogEvent("Worf: Initiating burst salvo.", 'info');
      }
      if (G.enemyLockProgress > 88 && !G.evasiveActive && G.evasiveCooldown === 0 &&
          G.systems.engines.health >= 20 && Math.random() < 0.02 * (dt / 1000) * 60) {
        executeEvasivePattern();
        typeof postCrewReport === 'function' &&
          postCrewReport('worf', "Captain — enemy lock critical. Evasive manoeuvres engaged.", 'alert');
      }
      if (G.shieldUnderAttackTimer > 1500 && G.shieldFreqCooldown === 0 && !G.shieldFreqActive &&
          Math.random() < 0.008 * (dt / 1000) * 60) {
        rotateShieldFrequency();
        typeof postCrewReport === 'function' &&
          postCrewReport('worf', "Detecting sustained fire pattern — rotating shield frequencies, Captain.", 'status');
      }
    }
  }

  // ── Captain-only helm behaviours (Nog) ───────────────────────
  if (isCaptain) {
    if (!G.comeAboutActive && G.comeAboutCooldown === 0 && !G.autoShieldTrack) {
      const currentFacing = G.helmAttackVector;
      const max = G.player.shields.maxSectorValue;
      if (G.player.shields[currentFacing] < max * 0.10) {
        const strongest = getStrongestShieldSector();
        if (strongest !== currentFacing) {
          G.helmAttackVector = strongest;
          typeof postCrewReport === 'function' &&
            postCrewReport('nog', `${currentFacing.toUpperCase()} shields failing — presenting ${strongest.toUpperCase()} to enemy, Captain.`, 'alert');
          postLogEvent(`Nog: Auto-presenting ${strongest.toUpperCase()} shields.`, 'warn');
        }
      }
    }
    if (!G.attackRunActive && G.attackRunCooldown === 0 && !G.comeAboutActive &&
        G.systems.engines.health >= 25 && G.threat.hull / G.threat.maxHull > 0.40 &&
        G.lockProgress > 30 && Math.random() < 0.003 * (dt / 1000) * 60) {
      executeAttackRun();
      typeof postCrewReport === 'function' &&
        postCrewReport('nog', "Initiating attack run on your behalf, Captain.", 'status');
    }
  }
}
