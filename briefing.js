'use strict';

// ============================================================
// BRIEFING.JS — Pre-battle intel briefing + combat engagement
// Depends on: config.js (ENEMY_CONFIGS, DIFFICULTY, MISSION_INTEL),
//             state.js, encounter-phases.js (initEncounterPhases),
//             main.js (masterSimulationCoreLoop)
// Cross-file calls resolve at runtime — load order only requires
// this file load before initiateVesselSimulation() calls showPreBattleBriefing().
// ============================================================

// Draw an enemy ship outline on the pre-battle briefing canvas silhouette
function _drawBriefingSilhouette(canvas, archetype, hullPct) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5, cy = h * 0.52;
  const sc = Math.min(w, h) / 120; // scale to fit

  const col = hullPct > 0.65 ? '#00cc66' : hullPct > 0.35 ? '#ffaa00' : '#ff4444';
  ctx.strokeStyle = col; ctx.lineWidth = 1.8;
  ctx.fillStyle = `rgba(20,40,80,0.3)`;
  ctx.shadowColor = col; ctx.shadowBlur = 8;
  ctx.beginPath();
  switch (archetype) {
    case 'ktinga': case 'vor_cha':
      ctx.moveTo(cx+22*sc,cy); ctx.lineTo(cx-8*sc,cy-22*sc); ctx.lineTo(cx-26*sc,cy-14*sc);
      ctx.lineTo(cx-20*sc,cy); ctx.lineTo(cx-26*sc,cy+14*sc); ctx.lineTo(cx-8*sc,cy+22*sc); break;
    case 'romulan_bop':
      ctx.moveTo(cx+20*sc,cy); ctx.lineTo(cx-12*sc,cy-26*sc); ctx.lineTo(cx-22*sc,cy);
      ctx.lineTo(cx-12*sc,cy+26*sc); break;
    case 'romulan_warbird':
      ctx.moveTo(cx+24*sc,cy); ctx.lineTo(cx-10*sc,cy-30*sc); ctx.lineTo(cx-28*sc,cy);
      ctx.lineTo(cx-10*sc,cy+30*sc); break;
    case 'galor_class': case 'cardassian_scout':
      ctx.moveTo(cx+18*sc,cy); ctx.lineTo(cx-12*sc,cy-18*sc); ctx.lineTo(cx-22*sc,cy-10*sc);
      ctx.lineTo(cx-18*sc,cy); ctx.lineTo(cx-22*sc,cy+10*sc); ctx.lineTo(cx-12*sc,cy+18*sc); break;
    case 'borg_probe':
      ctx.rect(cx-22*sc,cy-22*sc,44*sc,44*sc); break;
    case 'jem_hadar_fighter': case 'jem_hadar_battleship':
      ctx.moveTo(cx+18*sc,cy); ctx.lineTo(cx-12*sc,cy-20*sc); ctx.lineTo(cx-24*sc,cy-14*sc);
      ctx.lineTo(cx-18*sc,cy); ctx.lineTo(cx-24*sc,cy+14*sc); ctx.lineTo(cx-12*sc,cy+20*sc); break;
    default:
      ctx.moveTo(cx+16*sc,cy); ctx.lineTo(cx-12*sc,cy-14*sc); ctx.lineTo(cx-12*sc,cy+14*sc);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // Shield arc hint
  ctx.strokeStyle = `rgba(68,119,255,0.4)`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 36*sc, 0, Math.PI*2); ctx.stroke();
}

function showPreBattleBriefing() {
  G.preBattleScanProgress = 0;
  G.preBattleTimer        = 0;
  G.preBattleActive       = true;

  const cfg    = ENEMY_CONFIGS[G.enemyArchetype];
  const diff   = DIFFICULTY[currentDifficulty];
  const intel  = MISSION_INTEL[G.enemyArchetype] || {};
  const overlay = document.getElementById('pre-battle-overlay');
  if (!overlay) { startCombat(); return; }

  // Populate static fields
  const sd = document.getElementById('pb-stardate');
  if (sd) sd.textContent = `STARDATE ${G.stardate.toFixed(1)} — ${G.missionContext}`;

  const threat = document.getElementById('pb-threat');
  if (threat) {
    const lvl = intel.threat || 'UNKNOWN';
    threat.textContent = `THREAT: ${lvl}`;
    if (lvl === 'CRITICAL') threat.classList.add('critical');
    else threat.classList.remove('critical');
  }

  // Silhouette — replace with canvas drawing
  const silDiv = document.getElementById('pb-silhouette');
  if (silDiv) {
    silDiv.textContent = '';
    silDiv.classList.remove('revealed');
    const silCanvas = document.createElement('canvas');
    silCanvas.width = 160; silCanvas.height = 130;
    silCanvas.style.cssText = 'width:100%;height:100%;opacity:0;transition:opacity 0.6s;';
    silDiv.appendChild(silCanvas);
    silDiv._canvas = silCanvas;
  }

  // Reset identity lines
  const faction   = document.getElementById('pb-faction');
  const shipclass = document.getElementById('pb-shipclass');
  const mission   = document.getElementById('pb-mission');
  if (faction)   { faction.textContent   = 'FACTION: [SCANNING...]'; faction.classList.add('classified'); }
  if (shipclass) { shipclass.textContent = 'CLASS: [SCANNING...]';   shipclass.classList.add('classified'); }
  if (mission)   mission.textContent = '';

  // Build intel cards — prepend auto-generated stats card, then mission intel cards
  const cardsEl = document.getElementById('pb-cards');
  if (cardsEl) {
    const hullScaled  = Math.round(cfg.hull * diff.enemyHullMult);
    const fireMs      = Math.round(cfg.fireInterval * diff.enemyFireMult);
    const specials    = [
      cfg.hasCloakDevice  ? '◉ Cloaking' : null,
      cfg.adaptiveShields ? '⬡ Adaptive shielding' : null,
      cfg.polaronWeapons  ? '⚡ Polaron bypass 30%' : null,
      cfg.canRam          ? '⚠ Ramming protocol' : null,
      cfg.hasSensorGhosts ? '👻 Sensor ghosts' : null,
    ].filter(Boolean).join(' · ') || 'Standard weapons only';

    const statsCard = `<div class="pb-card revealed" id="pb-card-stats">
      <div class="pb-card-label">TACTICAL PROFILE</div>
      <div class="pb-card-text revealed" style="font-family:'Roboto Mono';font-size:10px;line-height:1.7;">
        Hull: <b>${hullScaled}</b> · Fire interval: <b>${(fireMs/1000).toFixed(1)}s</b> · Lock rate: <b>${cfg.lockRate}/s</b><br>
        Shields: F:${cfg.shields.fore} P:${cfg.shields.port} S:${cfg.shields.starboard} A:${cfg.shields.aft}<br>
        <span style="color:var(--warn);">${specials}</span>
      </div>
    </div>`;

    cardsEl.innerHTML = statsCard + (intel.cards || []).map((c, i) => `
      <div class="pb-card" id="pb-card-${i}">
        <div class="pb-card-label">${c.label}</div>
        <div class="pb-card-text" id="pb-cardtext-${i}">
          <span class="pb-card-classified">████ CLASSIFIED ████</span>
        </div>
      </div>`).join('');
  }

  overlay.style.display = 'flex';

  // Tick the briefing each 100ms
  const sessionId = G.gameSessionId;
  const tick = setInterval(() => {
    if (G.gameSessionId !== sessionId || !G.preBattleActive) { clearInterval(tick); return; }

    G.preBattleTimer += 100;
    G.preBattleScanProgress = Math.min(100, (G.preBattleTimer / G.preBattleDuration) * 100);
    const pct = G.preBattleScanProgress;

    // Update scan bar
    const bar = document.getElementById('pb-scan-bar');
    const pctLbl = document.getElementById('pb-scan-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctLbl) pctLbl.textContent = Math.round(pct) + '%';

    // Countdown
    const secs = Math.ceil((G.preBattleDuration - G.preBattleTimer) / 1000);
    const cdLbl = document.getElementById('pb-countdown');
    if (cdLbl) cdLbl.textContent = secs > 0 ? `Auto-engaging in ${secs}s` : 'Engaging...';

    // Progressive identity reveals
    if (pct >= 25 && faction && faction.classList.contains('classified')) {
      faction.textContent = `FACTION: ${cfg.faction.toUpperCase()}`;
      faction.classList.remove('classified');
    }
    if (pct >= 50) {
      const sil = document.getElementById('pb-silhouette');
      if (sil && sil._canvas && sil._canvas.style.opacity === '0') {
        _drawBriefingSilhouette(sil._canvas, G.enemyArchetype, G.threat.hull / G.threat.maxHull);
        sil._canvas.style.opacity = '1';
        sil.classList.add('revealed');
      }
      if (shipclass && shipclass.classList.contains('classified')) {
        shipclass.textContent = `CLASS: ${cfg.label}`;
        shipclass.classList.remove('classified');
      }
      if (mission && !mission.textContent) mission.textContent = G.missionContext;
    }

    // Reveal intel cards by their threshold
    (intel.cards || []).forEach((c, i) => {
      if (pct >= c.revealAt) {
        const card = document.getElementById(`pb-card-${i}`);
        const text = document.getElementById(`pb-cardtext-${i}`);
        if (card && !card.classList.contains('revealed')) {
          card.classList.add('revealed');
          if (text) { text.innerHTML = c.text; text.classList.add('revealed'); }
        }
      }
    });

    // Auto-start at 100%
    if (pct >= 100) { clearInterval(tick); _engageCombat(); }
  }, 100);
}

function engageFromBriefing() {
  // Player clicked BATTLE STATIONS early
  G.preBattleScanProgress = 100;
  _engageCombat();
}

function _engageCombat() {
  G.preBattleActive = false;
  const overlay = document.getElementById('pre-battle-overlay');
  if (overlay) overlay.style.display = 'none';
  startCombat();
}

function startCombat() {
  G.running = true;
  G.lastFrameTimestamp = performance.now();
  initEncounterPhases();
  requestAnimationFrame(masterSimulationCoreLoop);
}
