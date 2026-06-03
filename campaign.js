'use strict';

// ============================================================
// CAMPAIGN.JS — Campaign run mode (9 levels, easiest → hardest)
// Depends on: config.js (CAMPAIGN_ORDER), state.js, ui.js
//             (calculateFinalScore, _cleanupPostBattleOverlays),
//             main.js (initiateVesselSimulation, selectPlayerShip, returnToSetup)
// All cross-file calls resolve at runtime — load order only requires
// this file load before main.js calls startCampaign().
// ============================================================

function startCampaign(station) {
  G.campaignMode         = true;
  G.campaignStation      = station;
  G.campaignShipKey      = G.playerShipKey;   // persist ship across all 9 levels
  G.campaignLevel        = 0;
  G.campaignScore        = 0;
  G.campaignLevelResults = [];
  _launchCampaignLevel();
}

function _launchCampaignLevel() {
  const entry = CAMPAIGN_ORDER[G.campaignLevel];

  // Save campaign state — initiateVesselSimulation will reset many G fields
  const savedMode    = G.campaignMode;
  const savedStation = G.campaignStation;
  const savedShipKey = G.campaignShipKey || G.playerShipKey;
  const savedLevel   = G.campaignLevel;
  const savedScore   = G.campaignScore;
  const savedResults = [...(G.campaignLevelResults || [])];

  // Set the correct archetype and difficulty BEFORE init so the pre-battle
  // briefing is built for the right enemy and stats are correct from the start
  G.enemyArchetype = entry.archetype;
  selectPlayerShip(savedShipKey);
  setDifficulty(entry.diff);

  // Init vessel — uses G.enemyArchetype correctly; ends by showing pre-battle briefing
  initiateVesselSimulation(savedStation);

  // Restore campaign state (initiateVesselSimulation resets score/dead/etc)
  G.campaignMode         = savedMode;
  G.campaignStation      = savedStation;
  G.campaignShipKey      = savedShipKey;
  G.campaignLevel        = savedLevel;
  G.campaignScore        = savedScore;
  G.campaignLevelResults = savedResults;

  // G.running and initEncounterPhases() are handled by startCombat() when the
  // player engages from the pre-battle briefing — do not force them here

  _updateCampaignHUD();
}

function _updateCampaignHUD() {
  const hud = document.getElementById('campaign-hud');
  if (!hud) return;
  const entry = CAMPAIGN_ORDER[G.campaignLevel];
  if (!entry || !G.campaignMode) { hud.style.display = 'none'; return; }
  hud.style.display = 'flex';
  const diffCol = { normal: 'var(--green)', hard: 'var(--warn)', elite: 'var(--red)' }[entry.diff] || 'var(--b)';
  hud.innerHTML = `<span style="color:${diffCol};font-weight:bold;">${entry.label}</span><span style="color:#aabbcc;margin:0 8px;">▸</span><span style="color:#fff;">${entry.title}</span><span style="color:#6688aa;margin-left:8px;font-size:10px;">[${G.campaignLevel+1}/9]</span><span style="color:var(--o);margin-left:auto;">CAMPAIGN  +${G.campaignScore}</span>`;
}

function concludeCampaignLevel(victory, escaped) {
  const entry = CAMPAIGN_ORDER[G.campaignLevel];
  const levelScore = calculateFinalScore(victory, escaped).total;
  G.campaignScore += levelScore;
  G.campaignLevelResults.push({
    level:   entry.level,
    title:   entry.title,
    score:   levelScore,
    hullPct: Math.round(G.player.hull / G.player.maxHull * 100),
    time:    Math.round(G.score.timeSurvived),
    won:     victory && !escaped,
    escaped,
  });

  G.dead = true; G.running = false;
  const overlay = document.getElementById('overlay'); overlay.style.display = 'flex';
  ['setup-controls-anchor','campaign-diff-section','campaign-run-section','ship-select-section','score-display','terminal-transcript-box','end-game-actions']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  const isLast = G.campaignLevel >= CAMPAIGN_ORDER.length - 1;
  const isLoss = !victory && !escaped;
  const _sLabel = (G.playerShipConfig || PLAYER_SHIP_CONFIGS.defiant).label;

  const title = document.getElementById('modal-title');
  const desc  = document.getElementById('modal-desc');
  if (title) {
    if (isLoss)       { title.textContent = `${entry.label} — ${_sLabel.toUpperCase()} DESTROYED`; title.style.color = 'var(--red)'; }
    else if (isLast)  { title.textContent = 'CAMPAIGN COMPLETE — SECTOR SECURED'; title.style.color = '#00ffaa'; }
    else if (escaped) { title.textContent = `${entry.label} — DISENGAGED`; title.style.color = 'var(--warn)'; }
    else              { title.textContent = `${entry.label} — ${entry.title.toUpperCase()} DESTROYED`; title.style.color = 'var(--green)'; }
  }
  if (desc) desc.textContent = isLast ? `The Borg threat has been neutralised. ${_sLabel} mission complete.` : isLoss ? `Campaign ended. ${_sLabel} has been destroyed.` : `Enemy vessel destroyed. Preparing for next engagement.`;

  // Show campaign level summary
  const campDiv = document.getElementById('campaign-level-summary');
  if (campDiv) {
    const hullCol = G.player.hull/G.player.maxHull > 0.7 ? 'var(--green)' : G.player.hull/G.player.maxHull > 0.35 ? 'var(--warn)' : 'var(--red)';
    const nextEntry = CAMPAIGN_ORDER[G.campaignLevel + 1];
    campDiv.style.display = 'block';
    campDiv.innerHTML = `
      <div style="font-size:11px;color:#aabbcc;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>This level</span><span style="color:var(--green);font-weight:bold;">+${levelScore}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Hull remaining</span><span style="color:${hullCol};font-weight:bold;">${Math.round(G.player.hull)}/${G.player.maxHull} (${Math.round(G.player.hull/G.player.maxHull*100)}%)</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;border-top:1px solid var(--dim2);margin-top:4px;padding-top:4px;"><span>Campaign total</span><span style="color:var(--o);font-weight:bold;">${G.campaignScore}</span></div>
        ${G.campaignLevelResults.map(r=>`<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:10px;"><span style="color:#6688aa;">L${r.level} ${r.title}</span><span style="color:${r.won?'var(--green)':'var(--warn)'};">${r.won?'✓':r.escaped?'⚡':'✕'} +${r.score}</span></div>`).join('')}
      </div>
      ${!isLoss && !isLast ? `<div style="font-size:11px;color:#aabbcc;margin-top:8px;padding:6px;background:#060c18;border:1px solid var(--dim2);border-radius:4px;">
        <span style="color:var(--o);font-weight:bold;">NEXT: ${nextEntry?.label}</span> — ${nextEntry?.title}<br>
        <span style="font-size:10px;color:#6688aa;">${nextEntry?.subtitle}</span>
      </div>` : ''}
    `;
  }

  // Action buttons
  const actDiv = document.getElementById('campaign-action-btns');
  if (actDiv) {
    actDiv.style.display = 'block';
    if (isLoss) {
      actDiv.innerHTML = `<button class="pill-action-btn warn-btn" style="width:100%;margin-top:8px;padding:10px;" onclick="returnToSetup()">RETURN TO BRIDGE</button>`;
    } else if (isLast) {
      actDiv.innerHTML = `
        <button class="pill-action-btn" style="width:100%;margin-top:8px;padding:10px;background:var(--green);color:#000;" onclick="_restartCampaign()">⭐ RUN CAMPAIGN AGAIN</button>
        <button class="pill-action-btn warn-btn" style="width:100%;margin-top:6px;padding:8px;" onclick="returnToSetup()">RETURN TO BRIDGE</button>
      `;
    } else {
      actDiv.innerHTML = `
        <button class="pill-action-btn" style="width:100%;margin-top:8px;padding:10px;background:var(--o);color:#000;" onclick="_nextCampaignLevel()">⚡ NEXT ENGAGEMENT →</button>
        <button class="pill-action-btn warn-btn" style="width:100%;margin-top:6px;padding:6px;font-size:11px;" onclick="returnToSetup()">ABANDON CAMPAIGN</button>
      `;
    }
  }
  _cleanupPostBattleOverlays();
  const hud = document.getElementById('campaign-hud'); if (hud) hud.style.display = 'none';
}

function _nextCampaignLevel() {
  G.campaignLevel++;
  const campDiv = document.getElementById('campaign-level-summary'); if (campDiv) campDiv.style.display = 'none';
  const actDiv  = document.getElementById('campaign-action-btns');   if (actDiv)  actDiv.style.display  = 'none';
  _launchCampaignLevel(); // handles save/restore of campaign state internally
}

function _restartCampaign() {
  const station = G.campaignStation;
  const campDiv = document.getElementById('campaign-level-summary'); if (campDiv) campDiv.style.display = 'none';
  const actDiv  = document.getElementById('campaign-action-btns');   if (actDiv)  actDiv.style.display  = 'none';
  startCampaign(station);
}
