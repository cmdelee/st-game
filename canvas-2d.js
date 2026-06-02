'use strict';

// ============================================================
// 2D CANVAS DISPLAYS
// Enemy schematic, hull schematic, power distribution.
// Also owns canvas refs, STARS, and the DPI resize handler.
// Depends on: state.js (G, C, ENEMY_CONFIGS, WARP_CORE, ABLATIVE_ARMOUR)
//             canvas-three.js (resizeThreeRenderer)
// ============================================================

let spatialCanvas, spatialCtx, hullCanvas, hullCtx, enemyCanvas, enemyCtx, powerCanvas, powerCtx;
const STARS = [];

function handleHighDpiCanvasResizing() {
  const dpr = window.devicePixelRatio || 1;
  // 2D canvases (engineering views)
  [[hullCanvas, hullCtx],[enemyCanvas, enemyCtx],[powerCanvas, powerCtx]].forEach(([c, ctx]) => {
    if (!c || !c.parentElement) return;
    const bb = c.parentElement.getBoundingClientRect();
    if (bb.width === 0 || bb.height === 0) return;
    c.width  = bb.width  * dpr;
    c.height = bb.height * dpr;
    c.style.width  = `${bb.width}px`;
    c.style.height = `${bb.height}px`;
    if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr); }
  });
  // Three.js resize (defined in canvas-three.js)
  resizeThreeRenderer();
}

// ============================================================
// ENEMY SCHEMATIC CANVAS (tactical view)
// ============================================================
function renderEnemySchematicCanvas() {
  if (!enemyCanvas || !enemyCtx) return;
  const bb = enemyCanvas.parentElement.getBoundingClientRect();
  const w = bb.width, h = bb.height; if (w <= 0 || h <= 0) return;
  const ctx = enemyCtx;
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  ctx.fillStyle = '#000205'; ctx.fillRect(0,0,w,h);

  ctx.fillStyle = G.enemyCloaked ? C.p : C.o; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${cfg.label}${G.enemyCloaked ? ' [CLOAKED]' : ''}${G.enemyTractorActive ? ' [TRACTOR]' : ''}`, 8, 8);
  if (cfg.era) { ctx.fillStyle = '#5566aa'; ctx.font = '9px Roboto Mono'; ctx.fillText(`${cfg.faction} — ${cfg.era}`, 8, 22); }

  const cx = w * 0.35, cy = h * 0.52;
  const hPct = G.threat.hull / G.threat.maxHull;
  const hCol = hPct > 0.65 ? C.green : hPct > 0.35 ? C.warn : C.red;

  // Hull silhouette
  ctx.strokeStyle = G.enemyCloaked ? 'rgba(153,102,204,0.3)' : hCol; ctx.lineWidth = 2;
  ctx.fillStyle   = `rgba(51,10,10,${G.enemyCloaked ? 0.1 : 0.3})`;
  ctx.beginPath();
  switch (G.enemyArchetype) {
    case 'ktinga':              ctx.moveTo(cx-8,cy-18);ctx.lineTo(cx+8,cy);ctx.lineTo(cx-8,cy+18);ctx.lineTo(cx-22,cy+10);ctx.lineTo(cx-16,cy);ctx.lineTo(cx-22,cy-10);break;
    case 'vor_cha':             ctx.moveTo(cx-10,cy-22);ctx.lineTo(cx+10,cy);ctx.lineTo(cx-10,cy+22);ctx.lineTo(cx-24,cy+12);ctx.lineTo(cx-18,cy);ctx.lineTo(cx-24,cy-12);break;
    case 'romulan_bop':         ctx.moveTo(cx+12,cy);ctx.lineTo(cx-10,cy-22);ctx.lineTo(cx-18,cy);ctx.lineTo(cx-10,cy+22);break;
    case 'romulan_warbird':     ctx.moveTo(cx+16,cy);ctx.lineTo(cx-8,cy-26);ctx.lineTo(cx-22,cy);ctx.lineTo(cx-8,cy+26);break;
    case 'galor_class':         ctx.moveTo(cx-10,cy-14);ctx.lineTo(cx+12,cy);ctx.lineTo(cx-10,cy+14);ctx.lineTo(cx-18,cy+8);ctx.lineTo(cx-14,cy);ctx.lineTo(cx-18,cy-8);break;
    case 'borg_probe':          ctx.rect(cx-16,cy-16,32,32);break;
    case 'jem_hadar_battleship':ctx.moveTo(cx-10,cy-18);ctx.lineTo(cx+12,cy);ctx.lineTo(cx-10,cy+18);ctx.lineTo(cx-20,cy+12);ctx.lineTo(cx-15,cy);ctx.lineTo(cx-20,cy-12);break;
    default:                    ctx.moveTo(cx-8,cy-10);ctx.lineTo(cx+8,cy);ctx.lineTo(cx-8,cy+10);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // System node positions
  const ePos = {
    ktinga:              { disruptors_fwd:{x:0,y:-15}, disruptors_aft:{x:-8,y:14}, torpedoes_fwd:{x:8,y:0}, cloak_device:{x:-16,y:0}, shields_sys:{x:-12,y:-8}, engines:{x:-20,y:0}, sensors:{x:-4,y:8}, warp_core:{x:-14,y:8} },
    vor_cha:             { disruptors_fwd:{x:0,y:-16}, disruptors_wing:{x:-14,y:0}, torpedoes_fwd:{x:10,y:0}, cloak_device:{x:-18,y:0}, shields_sys:{x:-12,y:-10}, engines:{x:-22,y:0}, sensors:{x:-4,y:8}, warp_core:{x:-16,y:8} },
    romulan_bop:         { plasma_fwd:{x:12,y:0}, phasers_fwd:{x:-4,y:-12}, phasers_aft:{x:-14,y:0}, cloak_device:{x:-4,y:12}, shields_sys:{x:-10,y:-8}, engines:{x:-16,y:0}, sensors:{x:-4,y:4}, warp_core:{x:-14,y:8} },
    romulan_warbird:     { disruptors_fwd:{x:4,y:-14}, disruptors_aft:{x:-8,y:12}, plasma_torp:{x:16,y:0}, cloak_device:{x:-6,y:14}, shields_sys:{x:-12,y:-8}, engines:{x:-20,y:0}, sensors:{x:-4,y:4}, warp_core:{x:-16,y:10} },
    cardassian_scout:    { phasers_fwd:{x:4,y:0}, phasers_aft:{x:-6,y:0}, shields_sys:{x:0,y:-8}, engines:{x:-6,y:6}, sensors:{x:0,y:4}, warp_core:{x:-8,y:8} },
    galor_class:         { phasers_fwd:{x:4,y:-8}, phasers_aft:{x:-8,y:8}, torpedoes_fwd:{x:10,y:0}, shields_sys:{x:-10,y:-6}, engines:{x:-16,y:0}, sensors:{x:0,y:6}, warp_core:{x:-14,y:6} },
    jem_hadar_fighter:   { polaron_fwd:{x:4,y:0}, polaron_aft:{x:-5,y:0}, torpedoes:{x:6,y:-4}, shields_sys:{x:0,y:-8}, engines:{x:-6,y:6}, sensors:{x:0,y:4}, warp_core:{x:-8,y:8} },
    jem_hadar_battleship:{ polaron_fwd:{x:4,y:-10}, polaron_aft:{x:-8,y:8}, torpedoes_fwd:{x:10,y:0}, shields_sys:{x:-10,y:-6}, engines:{x:-18,y:0}, sensors:{x:0,y:6}, warp_core:{x:-16,y:6} },
    borg_probe:          { cutting_beam:{x:0,y:0}, tractor_beam:{x:12,y:0}, shields_sys:{x:0,y:-14}, engines:{x:0,y:14}, sensors:{x:-14,y:0}, warp_core:{x:14,y:14} },
  };
  const pos = ePos[G.enemyArchetype] || {};
  const sH  = G.systems.sensors.health;

  Object.keys(G.enemySystems).forEach(key => {
    const sys = G.enemySystems[key]; const p = pos[key]; if (!p) return;
    const h2       = sys.health;
    const isTarget = G.targetedSubsystemType === key;
    const col      = h2 <= 0 ? C.red : h2 > 70 ? C.green : h2 > 35 ? C.warn : C.red;
    const r        = isTarget ? 8 : 4;
    ctx.fillStyle  = col; ctx.beginPath(); ctx.arc(cx+p.x, cy+p.y, r, 0, Math.PI*2); ctx.fill();
    if (isTarget) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx+p.x, cy+p.y, r+3, 0, Math.PI*2); ctx.stroke(); }
    if (G.enemyRepairQueue.find(rr => rr.sysKey === key)) {
      ctx.fillStyle = C.warn; ctx.font = '9px Antonio'; ctx.textAlign = 'center'; ctx.fillText('🔧', cx+p.x, cy+p.y-12);
    }
  });

  // Shield arcs
  const shArc = [
    {key:'fore',      s:Math.PI*1.2, e:Math.PI*1.8},
    {key:'port',      s:Math.PI*0.6, e:Math.PI*1.2},
    {key:'starboard', s:Math.PI*1.8, e:Math.PI*2.4},
    {key:'aft',       s:Math.PI*0.2, e:Math.PI*0.6},
  ];
  ctx.lineWidth = 2;
  shArc.forEach(sa => {
    const val  = G.threat.shields[sa.key]; const maxV = cfg.shields[sa.key] || 1; const pct = val / maxV;
    ctx.strokeStyle = G.enemyCloaked ? 'rgba(153,102,204,0.2)' : val > maxV*0.5 ? C.green : val > maxV*0.2 ? C.warn : C.red;
    ctx.globalAlpha = 0.3 + pct * 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, 72, sa.s, sa.e); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Text readouts panel (right side)
  const rx = w * 0.60; let ry = 30; const lH = 12;
  function dRow(lbl, val, col, bg) {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(rx-2, ry-1, w-rx-4, lH+2); }
    ctx.fillStyle = '#6688aa'; ctx.font = '8px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(lbl, rx, ry);
    ctx.fillStyle = col || '#fff'; ctx.font = 'bold 8px Roboto Mono'; ctx.textAlign = 'right'; ctx.fillText(val, w-6, ry);
    ry += lH;
  }
  function dHdr(t, c) {
    ctx.fillStyle = c || C.red; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, rx, ry);
    ry += 3; ctx.strokeStyle = 'rgba(255,51,51,0.2)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(rx, ry+8); ctx.lineTo(w-6, ry+8); ctx.stroke();
    ry += lH;
  }

  dHdr('ENEMY STATUS');
  if (sH < 40)       dRow('Hull', 'SENSORS DEGRADED', C.warn);
  else if (sH < 70)  dRow('Hull', `~${Math.ceil(G.threat.hull/50)*50}/${G.threat.maxHull}`, hCol);
  else               dRow('Hull', `${Math.ceil(G.threat.hull)}/${G.threat.maxHull}`, hCol);
  dRow('Faction', cfg.faction, '#aabbcc');
  const cloakSys = G.enemySystems.cloak_device;
  dRow('Cloak', cfg.hasCloakDevice ? (G.enemyCloaked ? `ACTIVE PWR:${Math.round(G.enemyCloakPower)}%` : cloakSys && cloakSys.health > 0 ? G.enemyCloakCooldown > 0 ? `CD:${Math.ceil(G.enemyCloakCooldown/1000)}s` : 'READY' : 'DESTROYED') : 'NONE', G.enemyCloaked ? C.p : C.green);
  if (cfg.polaronWeapons)  dRow('Polaron',  'BYPASS 30% SHIELDS', C.warn);
  if (cfg.adaptiveShields) {
    dRow('Adaptive', `Hits:${G.enemyAdaptiveHits}`, C.green);
    const resistKeys = Object.entries(G.enemyAdaptiveResist).filter(([k,v]) => v > 0.05);
    resistKeys.forEach(([k, v]) => {
      const lbl = { cannon_pu:'P/U Cannon', cannon_pl:'P/L Cannon', cannon_su:'S/U Cannon', cannon_sl:'S/L Cannon', nose_beam:'Nose Beam', torpedoes:'Torpedoes' }[k] || k;
      dRow(`  ${lbl}`, `${Math.round(v*100)}% resist`, v > 0.5 ? C.red : C.warn);
    });
  }
  if (cfg.prefersCloseRange) {
    const rngCol = G.enemyRangeBracket === 'close' ? C.red : G.enemyRangeBracket === 'medium' ? C.warn : C.green;
    dRow('Range', G.enemyRangeBracket.toUpperCase(), rngCol);
  }
  if (cfg.plasmaReloadTime) dRow('Plasma', G.plasmaTorpedoReady ? 'CHARGED' : `RELOAD ${Math.ceil(G.plasmaTorpedoReloadTimer/1000)}s`, G.plasmaTorpedoReady ? C.red : C.green);
  if (cfg.canRam)           dRow('Ram Run', G.enemyRammingRun ? `INCOMING ${Math.ceil(G.enemyRammingTimer/1000)}s` : 'Possible <20%', G.enemyRammingRun ? C.red : '#aabbcc');
  if (G.sensorGhostActive)  dRow('GHOST', 'FALSE CONTACT', C.warn);
  ry += 3; dHdr('SHIELDS');
  SHIELD_SECTORS.forEach(s => {
    const v = G.threat.shields[s]; const mx = cfg.shields[s]; const c = v > mx*0.5 ? C.green : v > mx*0.2 ? C.warn : C.red;
    const dispV = sH < 40 ? '?' : sH < 70 ? `~${Math.round(v/10)*10}` : `${Math.ceil(v)}/${mx}`;
    dRow(s.toUpperCase(), dispV, c);
  });
  ry += 3;
  if (ry < h - 60) {
    dHdr('SYSTEMS');
    Object.keys(G.enemySystems).forEach(k => {
      const sys = G.enemySystems[k]; const h2 = Math.round(sys.health);
      const col    = h2 <= 0 ? C.red : h2 > 70 ? C.green : h2 > 35 ? C.warn : C.red;
      const rp     = G.enemyRepairQueue.find(r => r.sysKey === k);
      const active = G.targetedSubsystemType === k;
      dRow((active ? '▶ ' : '') + sys.label.substring(0,14), h2 <= 0 ? 'OFFLINE' : rp ? `${h2}% 🔧` : `${h2}%`, col, active ? 'rgba(255,170,0,0.06)' : null);
    });
  }
}

// ============================================================
// HULL SCHEMATIC CANVAS (engineering)
// ============================================================
function renderHullSchematicCanvas() {
  if (!hullCanvas || !hullCtx) return;
  if (G.playerShipKey === 'enterprise_e') { _renderEnterpriseESchematic(); return; }
  _renderDefiantSchematic();
}

function _renderDefiantSchematic() {
  const bb = hullCanvas.parentElement.getBoundingClientRect();
  const w = bb.width, h = bb.height; if (w <= 0 || h <= 0) return;
  const ctx = hullCtx;
  ctx.fillStyle = '#000207'; ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = C.o; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('USS DEFIANT NX-74205 — STRUCTURAL', 8, 8);

  const cx = w * 0.35, cy = h * 0.52;
  const hullPct  = G.player.hull / G.player.maxHull;
  const hullColor = hullPct > 0.65 ? C.green : hullPct > 0.35 ? C.warn : C.red;

  // Defiant hull outline
  ctx.strokeStyle = hullColor; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx,cy-62); ctx.quadraticCurveTo(cx+52,cy-30,cx+56,cy+12); ctx.lineTo(cx+36,cy+18);
  ctx.lineTo(cx+42,cy+58); ctx.lineTo(cx+26,cy+58); ctx.lineTo(cx,cy+46); ctx.lineTo(cx-26,cy+58);
  ctx.lineTo(cx-42,cy+58); ctx.lineTo(cx-36,cy+18); ctx.quadraticCurveTo(cx-52,cy-30,cx,cy-62); ctx.closePath();
  ctx.fillStyle = `rgba(26,38,64,${0.15 + hullPct * 0.35})`; ctx.fill();
  if (hullPct < 0.5) { ctx.fillStyle = `rgba(255,51,51,${(0.5-hullPct) * 0.2})`; ctx.fill(); }
  ctx.stroke();

  // Ablative armour overlay — concentric rings showing layers
  const ab = G.ablative;
  ab.layerHealth.forEach((lh, i) => {
    if (lh <= 0 && ab.regenTimers[i] <= 0 && ab.regenProgress[i] <= 0) return;
    const layerR = 68 + i * 4;
    const pct    = lh > 0 ? lh / 100 : ab.regenProgress[i] / ABLATIVE_ARMOUR.regenTime;
    const col    = lh > 0 ? `rgba(0,204,102,${0.08 + (lh/100)*0.15})` : `rgba(255,170,0,${0.05 + pct*0.1})`;
    ctx.strokeStyle = lh > 0 ? `rgba(0,204,102,${0.2 + (lh/100)*0.3})` : `rgba(255,170,0,${0.1 + pct*0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, layerR, 0, Math.PI*2 * pct); ctx.stroke();
  });

  // Cloak overlay
  if (G.cloaked || G.cloakVulnTimer > 0) {
    const s = G.cloakVulnTimer > 0 ? (0.6 + Math.sin(performance.now()*0.03)*0.4) : (0.25 + Math.sin(performance.now()*0.005)*0.18);
    ctx.strokeStyle = `rgba(153,102,204,${s})`; ctx.lineWidth = G.cloakVulnTimer > 0 ? 4 : 2.5; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(cx, cy, 90, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }

  // System nodes
  const sPos = [
    {k:'cannon_pu',x:-22,y:-26},{k:'cannon_pl',x:-22,y:-10},{k:'cannon_su',x:22,y:-26},{k:'cannon_sl',x:22,y:-10},
    {k:'nose_beam',x:0,y:-50},{k:'torpedoes',x:0,y:-38},{k:'engines',x:0,y:40},
    {k:'sensors',x:34,y:6},{k:'shields',x:-34,y:6},{k:'cloak_dev',x:0,y:22},{k:'warp_core',x:0,y:8}
  ];
  sPos.forEach(sp => {
    const sys = G.systems[sp.k]; if (!sys) return;
    const h2  = sys.health;
    const col = sys.tripped ? 'rgba(255,51,51,1)' : h2 > 70 ? 'rgba(0,204,102,0.9)' : h2 > 35 ? 'rgba(255,170,0,0.9)' : 'rgba(255,51,51,1)';
    const r   = sys.tripped ? 7 : 4;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r, 0, Math.PI*2); ctx.fill();
    if (h2 < 70 || sys.tripped) { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r+3, 0, Math.PI*2); ctx.stroke(); }
    if (G.repairTeams.some(t => t.sysKey === sp.k)) {
      ctx.fillStyle = C.warn; ctx.font = '8px Antonio'; ctx.textAlign = 'center'; ctx.fillText('🔧', cx+sp.x, cy+sp.y-10);
    }
  });

  // Shield arcs
  const shArc = [{k:'fore',s:Math.PI*1.2,e:Math.PI*1.8},{k:'port',s:Math.PI*0.6,e:Math.PI*1.2},{k:'starboard',s:Math.PI*1.8,e:Math.PI*2.4},{k:'aft',s:Math.PI*0.2,e:Math.PI*0.6}];
  ctx.lineWidth = 2;
  shArc.forEach(sa => {
    const val = G.cloaked ? 0 : G.player.shields[sa.k]; const pct = val / G.player.shields.maxSectorValue;
    ctx.strokeStyle = G.cloaked ? 'rgba(153,102,204,0.2)' : val > 100 ? C.green : val > 40 ? C.warn : C.red;
    ctx.globalAlpha = G.cloaked ? 0.15 : (0.35 + pct * 0.65);
    ctx.beginPath(); ctx.arc(cx, cy, 74, sa.s, sa.e); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Right-side readout panel
  const rx = w * 0.60; let ry = 24; const lH = 13;
  function dRow(lbl, val, col, bg) {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(rx-2, ry-1, w-rx-4, lH+2); }
    ctx.fillStyle = '#6688aa'; ctx.font = '9px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(lbl, rx, ry);
    ctx.fillStyle = col || '#fff'; ctx.font = 'bold 9px Roboto Mono'; ctx.textAlign = 'right'; ctx.fillText(val, w-6, ry);
    ry += lH;
  }
  function dHdr(t) {
    ctx.fillStyle = C.b; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, rx, ry);
    ry += 3; ctx.strokeStyle = 'rgba(68,119,255,0.25)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(rx, ry+8); ctx.lineTo(w-6, ry+8); ctx.stroke();
    ry += lH;
  }

  dHdr('DEFIANT HULL');
  dRow('Integrity', `${Math.ceil(G.player.hull)}/${G.player.maxHull}`, hullColor);
  dRow('Status',    hullPct > 0.65 ? 'NOMINAL' : hullPct > 0.35 ? 'DAMAGED' : 'CRITICAL', hullColor);
  dRow('Warp Core', G.systems.warp_core.tripped ? 'OFFLINE' : `${Math.round(G.systems.warp_core.health)}%`, G.systems.warp_core.tripped ? C.red : G.systems.warp_core.health > 50 ? C.green : C.warn);
  dRow('EPS Output', `${getTotalAllocatedPower()}/${getWarpOutput()}MW`, G.systems.warp_core.tripped ? C.red : C.o);

  // Ablative armour summary
  ry += 3; dHdr('ABLATIVE ARMOUR');
  const ablStr = ab.layerHealth.map((h, i) => {
    if (h > 0) return '▊';
    if (ab.regenTimers[i] > 0) return `(${Math.ceil(ab.regenTimers[i]/1000)}s)`;
    return `↑${Math.round((ab.regenProgress[i]/ABLATIVE_ARMOUR.regenTime)*100)}%`;
  }).join(' ');
  dRow('Layers', `${ab.layers}/6`, ab.layers > 3 ? C.green : ab.layers > 1 ? C.warn : C.red);
  ctx.fillStyle = '#6688aa'; ctx.font = '8px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(ablStr, rx, ry); ry += lH;

  ry += 3; dHdr('SHIELDS');
  if (G.cloaked) {
    dRow('ALL SECTORS', 'OFFLINE — CLOAKED', C.p);
  } else {
    SHIELD_SECTORS.forEach(s => {
      const sv = Math.ceil(G.player.shields[s]); const c = sv > 100 ? C.green : sv > 40 ? C.warn : C.red;
      dRow(s.toUpperCase(), `${sv}/${G.player.shields.maxSectorValue}`, c);
    });
  }
  ry += 3;
  if (ry < h - 70) {
    dHdr('KEY SYSTEMS');
    [{k:'cloak_dev',l:'CLOAK'},{k:'sensors',l:'SENSORS'},{k:'engines',l:'ENGINES'}].forEach(sd => {
      const sys = G.systems[sd.k]; const sh = Math.round(sys.health); const c = sh > 70 ? C.green : sh > 35 ? C.warn : C.red;
      const rp  = G.repairTeams.some(t => t.sysKey === sd.k);
      dRow(sd.l, sys.tripped ? 'OFFLINE' : rp ? `${sh}% 🔧` : `${sh}%`, sys.tripped ? C.red : c, sys.tripped ? 'rgba(255,51,51,0.08)' : null);
    });
  }
  if (G.batteryActive) {
    ctx.fillStyle = 'rgba(255,170,0,0.15)'; ctx.fillRect(rx-2, h-20, w-rx, 18);
    ctx.fillStyle = C.warn; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`⚡ BATTERY ACTIVE — ${Math.round(G.batteryCharge)}%`, rx, h-11);
  } else if (G.cloaked) {
    ctx.fillStyle = 'rgba(153,102,204,0.15)'; ctx.fillRect(rx-2, h-16, w-rx, 14);
    ctx.fillStyle = C.p; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`◉ CLOAKED  PWR:${Math.round(G.cloakPowerReserve)}%`, rx, h-9);
  }
}

// ============================================================
// ENTERPRISE-E HULL SCHEMATIC
// ============================================================
function _renderEnterpriseESchematic() {
  const bb = hullCanvas.parentElement.getBoundingClientRect();
  const w = bb.width, h = bb.height; if (w <= 0 || h <= 0) return;
  const ctx = hullCtx;
  ctx.fillStyle = '#000207'; ctx.fillRect(0, 0, w, h);

  const shipCfg = G.playerShipConfig || PLAYER_SHIP_CONFIGS.enterprise_e;
  ctx.fillStyle = C.b; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('USS ENTERPRISE NCC-1701-E — STRUCTURAL', 8, 8);
  ctx.fillStyle = '#5566aa'; ctx.font = '9px Roboto Mono';
  ctx.fillText('Sovereign-class · 685m · Regenerative shielding', 8, 20);

  const cx = w * 0.32, cy = h * 0.50;
  const hullPct   = G.player.hull / G.player.maxHull;
  const hullColor = hullPct > 0.65 ? C.green : hullPct > 0.35 ? C.warn : C.red;
  const sc        = 1.0;   // scale factor

  ctx.strokeStyle = hullColor; ctx.lineWidth = 2;
  ctx.fillStyle   = `rgba(10,20,60,${0.15 + hullPct * 0.35})`;

  // Saucer section (large ellipse, top half of ship)
  const sauc_rx = 52 * sc, sauc_ry = 42 * sc;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 30 * sc, sauc_rx, sauc_ry, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Stardrive secondary hull (smaller elongated body)
  ctx.fillStyle = `rgba(5,15,45,${0.15 + hullPct * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(cx - 16 * sc, cy + 8 * sc);
  ctx.lineTo(cx + 16 * sc, cy + 8 * sc);
  ctx.lineTo(cx + 14 * sc, cy + 72 * sc);
  ctx.lineTo(cx,           cy + 82 * sc);
  ctx.lineTo(cx - 14 * sc, cy + 72 * sc);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Nacelle pylons
  ctx.strokeStyle = `rgba(${hullPct > 0.5 ? '68,119,255' : '255,170,0'},0.6)`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - 20 * sc, cy + 20 * sc); ctx.lineTo(cx - 60 * sc, cy + 30 * sc); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 20 * sc, cy + 20 * sc); ctx.lineTo(cx + 60 * sc, cy + 30 * sc); ctx.stroke();

  // Nacelles
  ctx.strokeStyle = hullColor; ctx.lineWidth = 2;
  ctx.fillStyle = `rgba(10,30,80,${0.15 + hullPct * 0.3})`;
  [[-60, 30], [60, 30]].forEach(([nx, ny]) => {
    ctx.beginPath();
    ctx.ellipse(cx + nx * sc, cy + ny * sc, 12 * sc, 6 * sc, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Bussard collectors (reddish glow on nacelle front)
    const grad = ctx.createRadialGradient(cx + (nx - (nx > 0 ? 11 : -11)) * sc, cy + ny * sc, 1, cx + (nx - (nx > 0 ? 11 : -11)) * sc, cy + ny * sc, 8);
    grad.addColorStop(0, 'rgba(255,100,50,0.6)');
    grad.addColorStop(1, 'rgba(255,100,50,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx + (nx - (nx > 0 ? 11 : -11)) * sc, cy + ny * sc, 8 * sc, 0, Math.PI * 2); ctx.fill();
  });

  // Saucer separation overlay
  if (G.saucerSepActive) {
    const col  = G.saucerSepReconnecting ? '255,170,0' : '0,204,102';
    const lbl  = G.saucerSepReconnecting ? 'DOCKING...' : 'SAUCER SEPARATED';
    // Draw saucer section offset (drifting away / approaching)
    const drift = G.saucerSepReconnecting
      ? 12 * (G.saucerSepReconnectTimer / 6000)   // saucer approaches
      : 12 + Math.sin(performance.now() * 0.002) * 4; // saucer drifts
    ctx.strokeStyle = `rgba(${col},${0.5 + Math.sin(performance.now()*0.008)*0.25})`; ctx.lineWidth = 1.5; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.ellipse(cx, cy - 30 * sc - drift, sauc_rx, sauc_ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Show docking line when reconnecting
    if (G.saucerSepReconnecting) {
      ctx.strokeStyle = `rgba(${col},0.4)`; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(cx, cy - 30 * sc - drift + sauc_ry); ctx.lineTo(cx, cy - 8); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = `rgba(${col},0.15)`; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'center';
    ctx.fillText(lbl, cx, cy - 30 * sc - drift);
  }

  // System nodes — mapped to Sovereign layout
  const sPos = [
    {k:'cannon_pu',x:-32,y:-38,l:'DRS'},{k:'cannon_pl',x:-32,y:-18,l:'VNT'},
    {k:'cannon_su',x:32, y:-38,l:'DRS'},{k:'cannon_sl',x:32, y:-18,l:'VNT'},
    {k:'nose_beam',x:0,  y:55, l:'SDR'},{k:'torpedoes',x:0,  y:-60,l:'TRP'},
    {k:'engines',  x:0,  y:75, l:'ENG'},{k:'sensors',  x:44, y:-26,l:'SEN'},
    {k:'shields',  x:-44,y:-26,l:'SHD'},{k:'cloak_dev',x:0,  y:20, l:'SSP'},
    {k:'warp_core',x:0,  y:40, l:'WRP'}
  ];
  sPos.forEach(sp => {
    const sys = G.systems[sp.k]; if (!sys) return;
    const h2  = sys.health;
    const col = sys.tripped ? 'rgba(255,51,51,1)' : h2 > 70 ? 'rgba(68,119,255,0.9)' : h2 > 35 ? 'rgba(255,170,0,0.9)' : 'rgba(255,51,51,1)';
    const r   = sys.tripped ? 7 : 4;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + sp.x, cy + sp.y, r, 0, Math.PI * 2); ctx.fill();
    if (h2 < 70 || sys.tripped) { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx + sp.x, cy + sp.y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
    if (G.repairTeams.some(t => t.sysKey === sp.k)) {
      ctx.fillStyle = C.warn; ctx.font = '8px Antonio'; ctx.textAlign = 'center'; ctx.fillText('🔧', cx + sp.x, cy + sp.y - 10);
    }
  });

  // Shield arcs
  const shArc = [{k:'fore',s:Math.PI*1.2,e:Math.PI*1.8},{k:'port',s:Math.PI*0.6,e:Math.PI*1.2},{k:'starboard',s:Math.PI*1.8,e:Math.PI*2.4},{k:'aft',s:Math.PI*0.2,e:Math.PI*0.6}];
  ctx.lineWidth = 2;
  shArc.forEach(sa => {
    const val = G.player.shields[sa.k]; const pct = val / G.player.shields.maxSectorValue;
    ctx.strokeStyle = val > 200 ? C.b : val > 80 ? C.warn : C.red;
    ctx.globalAlpha = 0.35 + pct * 0.65;
    ctx.beginPath(); ctx.arc(cx, cy - 30, 62, sa.s, sa.e); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Right-side readout panel
  const rx = w * 0.60; let ry = 14; const lH = 13;
  function dRow(lbl, val, col, bg) {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(rx-2, ry-1, w-rx-4, lH+2); }
    ctx.fillStyle = '#6688aa'; ctx.font = '9px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(lbl, rx, ry);
    ctx.fillStyle = col || '#fff'; ctx.font = 'bold 9px Roboto Mono'; ctx.textAlign = 'right'; ctx.fillText(val, w-6, ry);
    ry += lH;
  }
  function dHdr(t) {
    ctx.fillStyle = C.b; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, rx, ry);
    ry += 3; ctx.strokeStyle = 'rgba(68,119,255,0.25)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(rx, ry+8); ctx.lineTo(w-6, ry+8); ctx.stroke();
    ry += lH;
  }

  dHdr('ENTERPRISE HULL');
  dRow('Integrity',  `${Math.ceil(G.player.hull)}/${G.player.maxHull}`, hullColor);
  dRow('Status',     hullPct > 0.65 ? 'NOMINAL' : hullPct > 0.35 ? 'DAMAGED' : 'CRITICAL', hullColor);
  dRow('Warp Core',  G.systems.warp_core.tripped ? 'OFFLINE' : `${Math.round(G.systems.warp_core.health)}%`, G.systems.warp_core.tripped ? C.red : C.green);
  dRow('EPS Output', `${getTotalAllocatedPower()}/${getWarpOutput()}MW`, G.systems.warp_core.tripped ? C.red : C.b);

  ry += 3; dHdr('REGEN SHIELDS');
  SHIELD_SECTORS.forEach(s => {
    const sv = Math.ceil(G.player.shields[s]); const c = sv > 200 ? C.b : sv > 80 ? C.warn : C.red;
    dRow(s.toUpperCase(), `${sv}/${G.player.shields.maxSectorValue}`, c);
  });

  ry += 3; dHdr('SAUCER SEPARATION');
  if (G.saucerSepReconnecting) {
    dRow('Status',    `DOCKING — ${Math.ceil(G.saucerSepReconnectTimer/1000)}s`, C.warn, 'rgba(255,170,0,0.08)');
  } else if (G.saucerSepActive) {
    dRow('Status',    'SEPARATED — stardrive independent', C.green, 'rgba(0,204,102,0.1)');
  } else if (G.saucerSepCooldown > 0) {
    dRow('Status',    `Sep CD ${Math.ceil(G.saucerSepCooldown/1000)}s`, C.warn);
  } else {
    dRow('Status',    'READY', C.green);
  }
  dRow('Lock effect', '−60% for 15s', '#aabbcc');

  ry += 3; dHdr('REGEN RATE');
  dRow('Shield regen', `+${(G.shieldRegenRate || 0).toFixed(1)}/s ×1.4`, C.b);
  dRow('Torps QM',     `${G.player.torpedoes}/${G.player.maxTorpedoes}`, C.t);
  dRow('Torps PH',     `${G.player.photonTorpedoes}/${G.player.maxPhotonTorpedoes}`, C.b);
  dRow('Tricobalt',    G.tricobalReady ? 'ARMED' : 'EXPENDED', G.tricobalReady ? C.green : C.red);

  if (G.batteryActive) {
    ctx.fillStyle = 'rgba(255,170,0,0.15)'; ctx.fillRect(rx-2, h-20, w-rx, 18);
    ctx.fillStyle = C.warn; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`⚡ BATTERY ACTIVE — ${Math.round(G.batteryCharge)}%`, rx, h-11);
  }
}

// ============================================================
// POWER DISTRIBUTION CANVAS (engineering view)
// ============================================================
function renderPowerDistributionCanvas() {
  if (!powerCanvas || !powerCtx) return;
  const bb = powerCanvas.parentElement.getBoundingClientRect();
  const w = bb.width, h = bb.height; if (w <= 0 || h <= 0) return;
  const ctx = powerCtx;
  ctx.fillStyle = '#000205'; ctx.fillRect(0,0,w,h);

  const warpOut    = getWarpOutput();
  const total      = getTotalAllocatedPower();
  const headroom   = warpOut - total;
  const warpHealth = Math.round(G.systems.warp_core.health);

  ctx.fillStyle = C.o; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('EPS POWER DISTRIBUTION', 8, 8);
  ctx.fillStyle = G.systems.warp_core.tripped ? C.red : C.o; ctx.font = 'bold 9px Roboto Mono'; ctx.textAlign = 'right';
  ctx.fillText(G.systems.warp_core.tripped ? (G.batteryActive ? `BATTERY ${Math.round(G.batteryCharge)}%` : 'WARP CORE OFFLINE') : `CORE: ${warpHealth}% — ${warpOut}MW`, w-8, 8);

  // Total used bar
  const barX = 10, barY = 26, barW = w-20, barH = 14;
  ctx.fillStyle = '#050a14'; ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = G.systems.warp_core.tripped ? C.red : '#1a3060'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
  const usedW    = Math.min(barW, (total / WARP_CORE.maxOutput) * barW);
  const usedColor = total > warpOut ? C.red : total > warpOut*0.85 ? C.warn : C.green;
  ctx.fillStyle = usedColor; ctx.fillRect(barX, barY, usedW, barH);
  const limitX = barX + (warpOut / WARP_CORE.maxOutput) * barW;
  ctx.strokeStyle = C.o; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(limitX, barY-2); ctx.lineTo(limitX, barY+barH+2); ctx.stroke();
  ctx.fillStyle = C.o; ctx.font = '8px Antonio'; ctx.textAlign = 'center'; ctx.fillText(`MAX ${warpOut}MW`, limitX, barY-4);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Roboto Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${total}MW / ${warpOut}MW  [${headroom >= 0 ? '+' : ''}${headroom}MW headroom]`, w/2, barY+barH/2);

  // Per-system rows
  const groups = [
    { label:'WEAPONS', keys:['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes'], color:C.warn },
    { label:'SPECIAL', keys:['cloak_dev'], color:C.p },
    { label:'SYSTEMS', keys:['shields','sensors','engines','warp_core'], color:C.b },
  ];
  let yOff = barY + barH + 10;
  const rowH = 12, labelW = 70, pBarW = w - labelW - 50 - 20;

  groups.forEach(grp => {
    ctx.fillStyle = grp.color; ctx.font = 'bold 8px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(grp.label, 8, yOff); yOff += 10;
    grp.keys.forEach(key => {
      const sys   = G.systems[key];
      const pw    = sys.allocatedPower; const maxPw = Math.min(60, Math.max(1, warpOut));
      const pct   = (pw / maxPw) * 100;
      const isOver = pw > 40;
      const col   = sys.tripped ? C.red : isOver ? C.red : pw > 30 ? C.warn : grp.color;
      const shortLabel = {cannon_pu:'P.Cnn P/U',cannon_pl:'P.Cnn P/L',cannon_su:'P.Cnn S/U',cannon_sl:'P.Cnn S/L',nose_beam:'Nose Beam',torpedoes:'Torpedoes',cloak_dev:'Cloak Dev',shields:'Shields',sensors:'Sensors',engines:'Engines',warp_core:'Warp Core'}[key] || key;

      ctx.fillStyle = sys.tripped ? C.red : '#8899bb'; ctx.font = '8px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(shortLabel, 8, yOff+1);
      ctx.fillStyle = '#050a14'; ctx.fillRect(labelW, yOff, pBarW, rowH-2);
      if (!sys.tripped && pw > 0) { ctx.fillStyle = col; ctx.fillRect(labelW, yOff, Math.min(pBarW, (pct/100)*pBarW), rowH-2); }
      const thresh40X = labelW + (40 / maxPw) * pBarW;
      if (thresh40X < labelW + pBarW) {
        ctx.strokeStyle = 'rgba(255,51,51,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
        ctx.beginPath(); ctx.moveTo(thresh40X, yOff-1); ctx.lineTo(thresh40X, yOff+rowH-1); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = sys.tripped ? C.red : col; ctx.font = 'bold 8px Roboto Mono'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(sys.tripped ? 'OFFLINE' : `${pw}MW`, w-8, yOff+1);
      if (sys.stress > 0 && !sys.tripped) {
        const stressW = (sys.stress / 100) * (pBarW * 0.3);
        ctx.fillStyle = `rgba(255,51,51,${0.3 + sys.stress / 200})`;
        ctx.fillRect(labelW + pBarW - stressW, yOff, stressW, rowH-2);
      }
      yOff += rowH;
    });
    yOff += 4;
  });

  if (yOff < h - 30) {
    yOff = h - 28;
    ctx.fillStyle = headroom < 0 ? C.red : headroom < 15 ? C.warn : C.green;
    ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(headroom < 0 ? `⚠ OVERLOADED BY ${Math.abs(headroom)}MW — BREAKER RISK` : headroom < 15 ? `⚠ LOW HEADROOM: ${headroom}MW` : `✔ ${headroom}MW AVAILABLE`, w/2, yOff);
    if (G.batteryActive) { ctx.fillStyle = C.warn; ctx.fillText(`⚡ BATTERY ACTIVE: ${Math.round(G.batteryCharge)}%`, w/2, yOff+12); }
  }
}
