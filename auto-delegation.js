'use strict';

// ============================================================
// AUTO-DELEGATION — computer management of uncrewed stations
// Runs when player is at tactical, helm, engineering, or captain.
// Depends on: state.js, engineering.js, crew.js, tactical.js,
//             helm.js, command.js (postCrewReport — runtime only)
// ============================================================

function processAutomatedDelegation(dt) {
  const isCaptain  = G.playerChosenStation === 'captain';
  const runAutoEng = G.playerChosenStation === 'tactical' || G.playerChosenStation === 'helm' || isCaptain;
  const runAutoTac = G.playerChosenStation === 'engineering' || G.playerChosenStation === 'helm' || isCaptain;

  // ── Auto-engineering: relay resets + repair dispatch ─────────
  if (runAutoEng) {
    const ce = getCrewEfficiency('engineering');
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
  // Fire at Will: lower interval, lower lock threshold, more torpedo use, auto deep scan
  const _fireClock  = G.fireAtWill ? 1400 : 2400;
  const _lockMin    = G.fireAtWill ? 0    : 8;
  const _torpChance = G.fireAtWill ? 0.65 : 0.35;

  if (runAutoTac && !G.holdFire) {
    G.autoTacticalFireClock += dt;
    if (G.autoTacticalFireClock > _fireClock) {
      G.autoTacticalFireClock = 0;
      if (!G.cloaked && G.cloakVulnTimer === 0 && G.lockProgress >= _lockMin) {
        const ce = getCrewEfficiency('tactical');
        if (Math.random() < ce) {
          const warpOnline = !G.systems.warp_core.tripped || G.batteryActive;
          if (warpOnline) {
            fireEnergyWeapons();
            if (Math.random() < _torpChance * ce) fireTorpedoBanks();
          }
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
