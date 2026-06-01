'use strict';

// ============================================================
// ENCOUNTER PHASES — faction-specific dramatic arcs
// Depends on: config.js, state.js
// ============================================================

function _getFactionKey(cfg) {
  const f = (cfg.faction || '').toLowerCase();
  if (f === 'klingon')    return 'klingon';
  if (f === 'romulan')    return 'romulan';
  if (f === 'cardassian') return 'cardassian';
  if (f === 'dominion')   return 'dominion';
  if (f === 'borg')       return 'borg';
  return null;
}

function initEncounterPhases() {
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  const key = _getFactionKey(cfg);
  const phases = key ? ENCOUNTER_PHASES[key] : null;
  if (!phases || !phases.length) {
    G.enemyPhase = 'combat'; G.enemyPhaseIndex = 0;
    G.enemyPhaseFireMult = 1.0; G.enemyPhaseLockMult = 1.0;
    return;
  }
  G.enemyPhaseIndex = 0;
  G.enemyPhaseTimer = 0;
  _applyPhase(phases[0]);
  postLogEvent(`[PHASE] ${cfg.faction}: ${phases[0].note}`, 'info');
}

function _applyPhase(phase) {
  G.enemyPhase         = phase.name;
  G.enemyPhaseFireMult = phase.fireRateMult;
  G.enemyPhaseLockMult = phase.lockRateMult;
  G.score.enemyPhaseReached = phase.name;
  const lbl = document.getElementById('lbl-enemy-phase-left');
  if (lbl) {
    lbl.style.display = 'block';
    lbl.textContent   = `PHASE: ${phase.name.toUpperCase()}`;
  }
}

function processEncounterPhase(dt) {
  if (!G.running) return;
  const cfg    = ENEMY_CONFIGS[G.enemyArchetype];
  const key    = _getFactionKey(cfg);
  const phases = key ? ENCOUNTER_PHASES[key] : null;
  if (!phases || !phases.length) return;

  const phase = phases[G.enemyPhaseIndex];
  if (!phase) return;

  G.enemyPhaseTimer += dt;

  // Klingon: berserk override at critical hull
  if (key === 'klingon' && G.enemyPhase !== 'berserk') {
    if (G.threat.hull / G.threat.maxHull < 0.25) {
      const berserkIdx = phases.findIndex(p => p.name === 'berserk');
      if (berserkIdx >= 0 && G.enemyPhaseIndex !== berserkIdx) {
        G.enemyPhaseIndex = berserkIdx;
        G.enemyPhaseTimer = 0;
        _applyPhase(phases[berserkIdx]);
        postLogEvent(`WORF: ${phases[berserkIdx].note}`, 'warn');
        typeof postCrewReport === 'function' &&
          postCrewReport('worf', "Captain — Klingon vessel entering berserk combat mode. Hull critical.", 'alert');
        return;
      }
    }
  }

  // Romulan: force 'strike' phase on first decloak after shadow
  if (key === 'romulan' && G.enemyPhase === 'shadow' && !G.enemyCloaked) {
    const strikeIdx = phases.findIndex(p => p.name === 'strike');
    if (strikeIdx >= 0) {
      G.enemyPhaseIndex = strikeIdx;
      G.enemyPhaseTimer = 0;
      _applyPhase(phases[strikeIdx]);
      postLogEvent(`WORF: ${phases[strikeIdx].note}`, 'warn');
      return;
    }
  }

  // Romulan: fade phase when heavily damaged
  if (key === 'romulan' && G.enemyPhase === 'strike' && G.threat.hull / G.threat.maxHull < 0.45) {
    const fadeIdx = phases.findIndex(p => p.name === 'fade');
    if (fadeIdx >= 0 && !G.enemyCloaked) {
      G.enemyPhaseIndex = fadeIdx;
      G.enemyPhaseTimer = 0;
      _applyPhase(phases[fadeIdx]);
      postLogEvent(`WORF: ${phases[fadeIdx].note}`, 'warn');
      return;
    }
  }

  // Dominion: sacrifice phase when ramming is triggered
  if (key === 'dominion' && G.enemyRammingRun && G.enemyPhase !== 'sacrifice') {
    const sacIdx = phases.findIndex(p => p.name === 'sacrifice');
    if (sacIdx >= 0) {
      G.enemyPhaseIndex = sacIdx; G.enemyPhaseTimer = 0;
      _applyPhase(phases[sacIdx]);
      return;
    }
  }

  // Borg: escalate phase based on adaptation progress
  if (key === 'borg') {
    const totalResist  = Object.values(G.enemyAdaptiveResist).reduce((s, v) => s + v, 0);
    const overwhelmIdx = phases.findIndex(p => p.name === 'overwhelm');
    const adaptIdx     = phases.findIndex(p => p.name === 'adapt');
    if (totalResist > 1.5 && G.enemyPhaseIndex < overwhelmIdx && overwhelmIdx >= 0) {
      G.enemyPhaseIndex = overwhelmIdx; G.enemyPhaseTimer = 0;
      _applyPhase(phases[overwhelmIdx]);
      postLogEvent(`WORF: ${phases[overwhelmIdx].note}`, 'crit');
      return;
    } else if (totalResist > 0.4 && G.enemyPhaseIndex < adaptIdx && adaptIdx >= 0) {
      G.enemyPhaseIndex = adaptIdx; G.enemyPhaseTimer = 0;
      _applyPhase(phases[adaptIdx]);
      postLogEvent(`WORF: ${phases[adaptIdx].note}`, 'warn');
      return;
    }
  }

  // Duration-based advance
  if (phase.duration !== null && G.enemyPhaseTimer >= phase.duration) {
    const nextIdx = G.enemyPhaseIndex + 1;
    if (nextIdx < phases.length) {
      G.enemyPhaseIndex = nextIdx;
      G.enemyPhaseTimer = 0;
      _applyPhase(phases[nextIdx]);
      postLogEvent(`WORF: ${phases[nextIdx].note}`, 'warn');
      typeof postCrewReport === 'function' &&
        postCrewReport('worf', phases[nextIdx].note, 'alert');
    }
  }
}

// ============================================================
// HULL MILESTONE EVENTS — faction reactions at 75/50/25/10%
// ============================================================

const _MILESTONE_DATA = {
  75: {
    klingon:    { msg:"TACTICAL: Klingon vessel taking hull damage — watch for increased aggression.", tier:'warn',  crew:'worf', crewMsg:"Klingon hull at seventy-five percent, Captain. Still fully combat-capable." },
    romulan:    { msg:"TACTICAL: Romulan hull breached. Enemy may attempt evasive cloaking.", tier:'warn',          crew:'worf', crewMsg:"Romulan vessel registering hull damage. Expect a cloaking manoeuvre, Captain." },
    cardassian: { msg:"CARDASSIAN VESSEL: 'Your weapons are noted, Defiant. Cardassia does not yield easily.'", tier:'warn', crew:null },
    dominion:   { msg:"TACTICAL: Jem'Hadar at 75% hull — no defensive posture. They are accelerating.", tier:'warn', crew:'worf', crewMsg:"Jem'Hadar are taking damage and speeding up, Captain. No signs of retreat." },
    borg:       { msg:"BORG: 'Your offensive capabilities are noted. Adaptation is in progress.'", tier:'warn',     crew:null },
  },
  50: {
    klingon:    { msg:"TACTICAL: Klingon hull at 50% — entering maximum aggression threshold!", tier:'warn',        crew:'worf', crewMsg:"Captain — Klingon hull at fifty percent. Fire rate is increasing. Stay focused." },
    romulan:    { msg:"TACTICAL: Romulan hull at 50% — enemy will attempt fade and repair under cloak.", tier:'warn', crew:'worf', crewMsg:"Romulan vessel at fifty percent hull, Captain. Anticipate emergency cloaking." },
    cardassian: { msg:"CARDASSIAN VESSEL: 'You fight well for a Starfleet crew. This engagement is not over.'", tier:'warn', crew:null },
    dominion:   { msg:"JEM'HADAR: 'Victory is life. We do not retreat — we accelerate!' Fire rate escalating.", tier:'crit', crew:'worf', crewMsg:"Jem'Hadar vessel at fifty percent hull and increasing fire rate. They never stop, Captain." },
    borg:       { msg:"BORG: 'We are the Borg. Your crew will be assimilated. Your biological distinctiveness will be added to our own.'", tier:'crit', crew:null },
  },
  25: {
    klingon:    { msg:"TACTICAL: KLINGON HULL CRITICAL — BERSERK STATE! 'TODAY IS A GOOD DAY TO DIE!'", tier:'crit', crew:'worf', crewMsg:"Klingon vessel at critical hull, Captain. They will fight to absolute destruction!" },
    romulan:    { msg:"TACTICAL: Romulan hull critical — emergency cloak imminent. They will not surrender.", tier:'crit', crew:'worf', crewMsg:"Romulan vessel severely damaged, Captain. They are cloaking for emergency repairs." },
    cardassian: { msg:"CARDASSIAN VESSEL: 'Shields failing... structural integrity compromised... Cardassia Prime will hear of this.'", tier:'crit', crew:null },
    dominion:   { msg:"JEM'HADAR: 'We are already dead. The Founders will be avenged!' Ramming protocol approaching!", tier:'crit', crew:'worf', crewMsg:"Jem'Hadar at twenty-five percent hull. Ramming run is imminent, Captain — fore shields!" },
    borg:       { msg:"BORG: 'Your resistance has been... inefficient. Assimilation will now proceed. Prepare yourself.'", tier:'crit', crew:null },
  },
  10: {
    klingon:    { msg:"KLINGON VESSEL CRITICAL — FIRING DEATH SALVO! 'Qa'pla! Hegh'bat! Glory to the Empire!'", tier:'crit', crew:'worf', crewMsg:"EVASIVE! Klingon death salvo incoming — all hands brace for impact!" },
    romulan:    { msg:"TACTICAL: Romulan hull at 10% — they will self-destruct before surrender.", tier:'crit', crew:'worf', crewMsg:"Romulan vessel at ten percent hull, Captain. Their honour code forbids capture." },
    cardassian: { msg:"CARDASSIAN VESSEL: 'Power failing... life support critical... *static*... Garak was right about you.'", tier:'crit', crew:null },
    dominion:   { msg:"JEM'HADAR: 'FOR THE FOUNDERS! VICTORY IS LIFE!' Maximum ramming velocity!", tier:'crit', crew:'worf', crewMsg:"BRACE! Jem'Hadar at ten percent — ramming run confirmed! All power to fore shields!" },
    borg:       { msg:"BORG: 'Your crew will service us well. Resistance is — ' [HULL BREACH DETECTED]", tier:'crit', crew:null },
  },
};

function checkEnemyHullMilestones() {
  if (!G.running || G.dead) return;
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  const key = _getFactionKey(cfg);
  const pct = G.threat.hull / G.threat.maxHull;

  [75, 50, 25, 10].forEach(threshold => {
    if (pct <= threshold / 100 && !G.enemyHullMilestones[threshold]) {
      G.enemyHullMilestones[threshold] = true;
      const data = key ? _MILESTONE_DATA[threshold][key] : null;
      if (data) {
        postLogEvent(data.msg, data.tier);
        if (data.crew && typeof postCrewReport === 'function') {
          postCrewReport(data.crew, data.crewMsg, 'alert');
        }
      }
      if (threshold === 10 && key === 'klingon') _triggerKlingonDeathSalvo();
      if (threshold === 25 && key === 'romulan' && !G.enemyCloaked) triggerEnemyCloak(cfg);
      if (threshold === 25 && key === 'dominion') {
        G.enemyPhaseFireMult = Math.min(G.enemyPhaseFireMult, 0.60);
      }
    }
  });
}

function _triggerKlingonDeathSalvo() {
  postLogEvent("KLINGON DEATH SALVO — MAXIMUM WEAPONS DISCHARGE!", 'crit');
  [300, 700, 1100].forEach(delay => {
    setTimeout(() => {
      if (!G.dead && G.running) executeThreatCounterVolley();
    }, delay);
  });
}
