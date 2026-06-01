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
    Object.keys(G.systems).forEach(key => {
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
    G.repairTeams.forEach((team, idx) => {
      if (!team.sysKey && damaged.length > idx) {
        const target     = damaged[idx];
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
        crewReportWarpCoreTrip();
      }
      if (!G.cloaked && !G.shieldTransferInProgress) {
        const max        = G.player.shields.maxSectorValue;
        const sectors    = ['fore','port','starboard','aft'];
        const critSector = sectors.find(s => G.player.shields[s] < max * 0.15);
        const totalShields = sectors.reduce((sum, s) => sum + G.player.shields[s], 0);
        if (critSector && totalShields > max * 0.5 && Math.random() < 0.01 * (dt / 1000) * 60) {
          rebalanceShieldArrays();
          postLogEvent(`O'Brien: Auto-equalising — ${critSector.toUpperCase()} shields critical.`, 'warn');
        }
      }
    }
  }

  // ── Auto-tactical: weapons + worf special abilities ──────────
  if (runAutoTac && !G.holdFire) {
    G.autoTacticalFireClock += dt;
    if (G.autoTacticalFireClock > 2400) {
      G.autoTacticalFireClock = 0;
      if (!G.cloaked && G.cloakVulnTimer === 0 && G.lockProgress >= 8) {
        const ce = getCrewEfficiency('tactical');
        if (Math.random() < ce) {
          const warpOnline = !G.systems.warp_core.tripped || G.batteryActive;
          if (warpOnline) {
            const _aw = G.activeWeaponArrays || ARRAYS_DICTIONARY;
            const pk  = ['cannon_port_upper','cannon_port_lower','cannon_stbd_upper','cannon_stbd_lower'];
            pk.filter(k => {
              if (!_aw[k]) return false;
              const s = G.systems[_aw[k].parentSystem];
              return !s.tripped && s.health >= 15 && s.cap >= _aw[k].cost;
            }).forEach(k => fireSelectedArray(k));
            if (Math.random() < 0.5 * ce)  fireSelectedArray('emitter_nose');
            if (Math.random() < 0.25 * ce && G.player.torpedoes > 3)       fireSelectedArray('torpedo_quantum');
            if (Math.random() < 0.20 * ce && G.player.photonTorpedoes > 0) fireSelectedArray('torpedo_photon');
          }
        }
      }
    }

    // Captain-only Worf autonomous abilities
    if (isCaptain) {
      if (G.burstFireReady && G.lockProgress >= 55 && !G.cloaked &&
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
        const strongest = ['fore','port','starboard','aft'].reduce(
          (best, s) => G.player.shields[s] > G.player.shields[best] ? s : best, 'fore');
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
