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
  resizeThreeRenderer();
}

// ── Shared drawing helpers ────────────────────────────────────
// LCARS-style filled section header
function _lcarsHdr(ctx, t, x, y, w, col) {
  ctx.fillStyle = col || '#cc2233';
  ctx.fillRect(x - 2, y, w + 2, 14);
  // left accent pip
  ctx.fillStyle = '#000';
  ctx.font = 'bold 9px Antonio';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(t, x + 2, y + 3);
  return y + 17;
}

// Row with optional mini-bar (pct 0–1, pass null to skip bar)
function _row(ctx, lbl, val, pct, col, rx, ry, w, lH) {
  const barX = rx + 60, barW = w - rx - 60 - 38;
  ctx.fillStyle = '#44607a';
  ctx.font = '8px Roboto Mono';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(lbl, rx, ry + 1);
  if (pct !== null && barW > 10) {
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(barX, ry + 2, barW, lH - 4);
    ctx.fillStyle = col || '#aabbcc';
    ctx.fillRect(barX, ry + 2, barW * Math.max(0, Math.min(1, pct)), lH - 4);
  }
  ctx.fillStyle = col || '#aabbcc';
  ctx.font = 'bold 8px Roboto Mono';
  ctx.textAlign = 'right';
  ctx.fillText(val, w - 4, ry + 1);
  return ry + lH;
}

// Plain text row (no bar)
function _trow(ctx, lbl, val, col, bg, rx, ry, w, lH) {
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(rx - 2, ry - 1, w - rx + 2, lH + 1); }
  ctx.fillStyle = '#44607a';
  ctx.font = '8px Roboto Mono';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(lbl, rx, ry + 1);
  ctx.fillStyle = col || '#aabbcc';
  ctx.font = 'bold 8px Roboto Mono';
  ctx.textAlign = 'right';
  ctx.fillText(val, w - 4, ry + 1);
  return ry + lH;
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

  // Background with subtle grid
  ctx.fillStyle = '#000205'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(20,40,80,0.4)'; ctx.lineWidth = 0.5;
  for (let gx = 0; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 0; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

  // Title bar
  const titleCol = G.enemyCloaked ? C.p : C.red;
  ctx.fillStyle = 'rgba(0,2,5,0.85)'; ctx.fillRect(0, 0, w * 0.57, 32);
  ctx.strokeStyle = titleCol; ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, w * 0.57, 32);
  ctx.fillStyle = titleCol; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${cfg.label}${G.enemyCloaked ? ' [CLOAKED]' : ''}${G.enemyTractorActive ? ' [TRACTOR]' : ''}`, 6, 5);
  if (cfg.era) { ctx.fillStyle = '#5577aa'; ctx.font = '8px Roboto Mono'; ctx.fillText(`${cfg.faction}  ·  ${cfg.era}`, 6, 19); }

  // Divider line between schematic and readout zones
  const divX = w * 0.57;
  ctx.strokeStyle = 'rgba(40,80,160,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, h); ctx.stroke();

  const cx = w * 0.29, cy = h * 0.50;
  const hPct = G.running ? G.threat.hull / G.threat.maxHull : 1;
  const hCol = hPct > 0.65 ? C.green : hPct > 0.35 ? C.warn : C.red;

  // Hull silhouette — slightly larger, filled with hull-damage tint
  ctx.lineWidth = 2;
  ctx.fillStyle = `rgba(51,10,10,${G.enemyCloaked ? 0.05 : 0.25 + (1-hPct)*0.2})`;
  ctx.strokeStyle = G.enemyCloaked ? 'rgba(153,102,204,0.3)' : hCol;
  ctx.beginPath();
  switch (G.enemyArchetype) {
    case 'ktinga':               ctx.moveTo(cx-9,cy-20);ctx.lineTo(cx+9,cy);ctx.lineTo(cx-9,cy+20);ctx.lineTo(cx-26,cy+12);ctx.lineTo(cx-18,cy);ctx.lineTo(cx-26,cy-12);break;
    case 'vor_cha':              ctx.moveTo(cx-11,cy-24);ctx.lineTo(cx+11,cy);ctx.lineTo(cx-11,cy+24);ctx.lineTo(cx-28,cy+14);ctx.lineTo(cx-20,cy);ctx.lineTo(cx-28,cy-14);break;
    case 'romulan_bop':          ctx.moveTo(cx+14,cy);ctx.lineTo(cx-11,cy-24);ctx.lineTo(cx-20,cy);ctx.lineTo(cx-11,cy+24);break;
    case 'romulan_warbird':      ctx.moveTo(cx+18,cy);ctx.lineTo(cx-9,cy-28);ctx.lineTo(cx-24,cy);ctx.lineTo(cx-9,cy+28);break;
    case 'galor_class':          ctx.moveTo(cx-11,cy-16);ctx.lineTo(cx+14,cy);ctx.lineTo(cx-11,cy+16);ctx.lineTo(cx-20,cy+9);ctx.lineTo(cx-16,cy);ctx.lineTo(cx-20,cy-9);break;
    case 'borg_probe':           ctx.rect(cx-18,cy-18,36,36);break;
    case 'jem_hadar_battleship': ctx.moveTo(cx-11,cy-20);ctx.lineTo(cx+14,cy);ctx.lineTo(cx-11,cy+20);ctx.lineTo(cx-22,cy+14);ctx.lineTo(cx-17,cy);ctx.lineTo(cx-22,cy-14);break;
    default:                     ctx.moveTo(cx-9,cy-12);ctx.lineTo(cx+9,cy);ctx.lineTo(cx-9,cy+12);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Hull damage pulse at low integrity
  if (hPct < 0.35 && !G.enemyCloaked) {
    const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.3;
    ctx.fillStyle = `rgba(255,51,51,${pulse * 0.15})`;
    ctx.fill();
  }

  // System node positions (relative to cx/cy)
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
    const h2 = sys.health;
    const isTarget = G.targetedSubsystemType === key;
    const col = h2 <= 0 ? C.red : h2 > 70 ? C.green : h2 > 35 ? C.warn : C.red;
    const r   = isTarget ? 7 : 4;
    // Glow ring behind dot
    if (h2 > 0) {
      const grd = ctx.createRadialGradient(cx+p.x, cy+p.y, 0, cx+p.x, cy+p.y, r+6);
      grd.addColorStop(0, col.replace(')', ',0.3)').replace('rgb', 'rgba'));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx+p.x, cy+p.y, r+6, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = h2 <= 0 ? 'rgba(255,51,51,0.5)' : col;
    ctx.beginPath(); ctx.arc(cx+p.x, cy+p.y, r, 0, Math.PI*2); ctx.fill();
    if (isTarget) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx+p.x, cy+p.y, r+4, 0, Math.PI*2); ctx.stroke();
      // Crosshair lines
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx+p.x-12, cy+p.y); ctx.lineTo(cx+p.x+12, cy+p.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+p.x, cy+p.y-12); ctx.lineTo(cx+p.x, cy+p.y+12); ctx.stroke();
    }
    if (G.enemyRepairQueue.find(rr => rr.sysKey === key)) {
      ctx.fillStyle = C.warn; ctx.font = '9px Antonio'; ctx.textAlign = 'center';
      ctx.fillText('🔧', cx+p.x, cy+p.y-12);
    }
  });

  // Shield arcs (thicker, multi-layer look)
  const shArc = [
    {key:'fore',      s:Math.PI*1.2, e:Math.PI*1.8},
    {key:'port',      s:Math.PI*0.6, e:Math.PI*1.2},
    {key:'starboard', s:Math.PI*1.8, e:Math.PI*2.4},
    {key:'aft',       s:Math.PI*0.2, e:Math.PI*0.6},
  ];
  shArc.forEach(sa => {
    const val  = G.running ? (G.threat.shields[sa.key] || 0) : 0;
    const maxV = cfg.shields[sa.key] || 1;
    const pct  = val / maxV;
    const col  = G.enemyCloaked ? 'rgba(153,102,204,0.2)' : val > maxV*0.5 ? C.green : val > maxV*0.2 ? C.warn : C.red;
    // Outer glow arc
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.globalAlpha = 0.08 + pct * 0.1;
    ctx.beginPath(); ctx.arc(cx, cy, 76, sa.s, sa.e); ctx.stroke();
    // Main arc
    ctx.lineWidth = 2; ctx.globalAlpha = 0.3 + pct * 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, 72, sa.s, sa.e); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Lock-on targeting reticle (if actively locking)
  if (G.lockProgress > 5 && !G.enemyCloaked) {
    const lockAngle = (G.lockProgress / 100) * Math.PI * 2 - Math.PI/2;
    ctx.strokeStyle = `rgba(255,200,0,${0.4 + G.lockProgress/200})`;
    ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, 60, -Math.PI/2, lockAngle); ctx.stroke();
    ctx.setLineDash([]);
    // Corner brackets
    if (G.lockProgress > 50) {
      ctx.strokeStyle = 'rgba(255,200,0,0.7)'; ctx.lineWidth = 1.5;
      const bSz = 8;
      [[-28,-28],[28,-28],[28,28],[-28,28]].forEach(([bx,by]) => {
        ctx.beginPath();
        ctx.moveTo(cx+bx, cy+by + (by<0?bSz:-bSz)); ctx.lineTo(cx+bx, cy+by); ctx.lineTo(cx+bx + (bx<0?bSz:-bSz), cy+by);
        ctx.stroke();
      });
    }
  }

  // ── Right panel readout ───────────────────────────────────────
  const rx = w * 0.59; let ry = 4; const lH = 11;

  // Lock progress bar (always visible at top of panel)
  ry = _lcarsHdr(ctx, 'TARGETING', rx, ry, w - rx, '#334455');
  const lkPct = G.lockProgress / 100;
  const lkCol = lkPct > 0.7 ? C.warn : lkPct > 0.4 ? '#88aaff' : '#5577aa';
  ry = _row(ctx, 'LOCK', `${Math.round(G.lockProgress)}%`, lkPct, lkCol, rx, ry, w, lH);
  if (G.targetedSubsystemType && G.targetedSubsystemType !== 'hull') {
    const tSys = G.enemySystems[G.targetedSubsystemType];
    ry = _trow(ctx, 'TARGET', (tSys?.label || G.targetedSubsystemType).substring(0,12).toUpperCase(), C.warn, null, rx, ry, w, lH);
  } else {
    ry = _trow(ctx, 'TARGET', 'HULL', '#aabbcc', null, rx, ry, w, lH);
  }

  // Hull + status
  ry += 2; ry = _lcarsHdr(ctx, 'ENEMY STATUS', rx, ry, w - rx, '#551122');
  if (sH < 40)      ry = _trow(ctx, 'HULL', 'SENSORS DEGRADED', C.warn, null, rx, ry, w, lH);
  else if (sH < 70) ry = _row(ctx, 'HULL', `~${Math.ceil(G.threat.hull/50)*50}`, hPct, hCol, rx, ry, w, lH);
  else              ry = _row(ctx, 'HULL', `${Math.ceil(G.threat.hull)}/${G.threat.maxHull}`, hPct, hCol, rx, ry, w, lH);
  ry = _trow(ctx, 'FACTION', cfg.faction.toUpperCase(), '#8899bb', null, rx, ry, w, lH);

  // Cloak status
  const cloakSys = G.enemySystems.cloak_device;
  if (cfg.hasCloakDevice) {
    const cVal = G.enemyCloaked ? `PWR:${Math.round(G.enemyCloakPower)}%` : cloakSys && cloakSys.health > 0 ? G.enemyCloakCooldown > 0 ? `CD:${Math.ceil(G.enemyCloakCooldown/1000)}s` : 'READY' : 'DESTROYED';
    ry = _trow(ctx, 'CLOAK', cVal, G.enemyCloaked ? C.p : C.green, G.enemyCloaked ? 'rgba(153,102,204,0.08)' : null, rx, ry, w, lH);
  }

  // Faction-specific warnings
  if (cfg.polaronWeapons)  ry = _trow(ctx, 'POLARON', 'BYPASS 30% SHD', C.warn, 'rgba(255,170,0,0.06)', rx, ry, w, lH);
  if (cfg.prefersCloseRange) {
    const rngCol = G.enemyRangeBracket === 'close' ? C.red : G.enemyRangeBracket === 'medium' ? C.warn : C.green;
    ry = _trow(ctx, 'RANGE', G.enemyRangeBracket.toUpperCase(), rngCol, null, rx, ry, w, lH);
  }
  if (cfg.plasmaReloadTime) {
    const plCol = G.plasmaTorpedoReady ? C.red : C.green;
    ry = _trow(ctx, 'PLASMA', G.plasmaTorpedoReady ? 'CHARGED' : `RELOAD ${Math.ceil(G.plasmaTorpedoReloadTimer/1000)}s`, plCol, G.plasmaTorpedoReady ? 'rgba(255,51,51,0.08)' : null, rx, ry, w, lH);
  }
  if (cfg.canRam)          ry = _trow(ctx, 'RAM RUN', G.enemyRammingRun ? `INCOMING ${Math.ceil(G.enemyRammingTimer/1000)}s` : '<20% HULL', G.enemyRammingRun ? C.red : '#8899aa', G.enemyRammingRun ? 'rgba(255,0,0,0.12)' : null, rx, ry, w, lH);
  if (G.sensorGhostActive) ry = _trow(ctx, 'GHOST', 'FALSE CONTACT', C.warn, 'rgba(255,170,0,0.08)', rx, ry, w, lH);

  // Adaptive resistance (Borg)
  if (cfg.adaptiveShields) {
    ry += 2; ry = _lcarsHdr(ctx, 'ADAPTATION', rx, ry, w - rx, '#002211');
    const resistKeys = Object.entries(G.enemyAdaptiveResist).filter(([k,v]) => v > 0.04);
    if (resistKeys.length === 0) {
      ry = _trow(ctx, 'STATUS', 'LEARNING...', C.green, null, rx, ry, w, lH);
    } else {
      const lblMap = { cannon_pu:'P/U', cannon_pl:'P/L', cannon_su:'S/U', cannon_sl:'S/L', nose_beam:'BEAM', torpedoes:'TORPS', photon:'PHOTON' };
      resistKeys.forEach(([k, v]) => {
        ry = _row(ctx, lblMap[k] || k.substring(0,5).toUpperCase(), `${Math.round(v*100)}%`, v, v > 0.5 ? C.red : C.warn, rx, ry, w, lH);
      });
    }
  }

  // Scan bonuses
  const sb = G.permanentScanBonuses;
  const hasBonuses = sb && (sb.shield_freq || sb.hull_weakness || sb.sensor_blind || sb.weapon_disrupt);
  if (hasBonuses) {
    ry += 2; ry = _lcarsHdr(ctx, 'SCAN DATA', rx, ry, w - rx, '#003322');
    if (sb.shield_freq)   ry = _trow(ctx, 'SHD FREQ', '−25% DMGN', C.green, 'rgba(0,204,102,0.06)', rx, ry, w, lH);
    if (sb.hull_weakness) ry = _trow(ctx, 'FISSURE', '+20% YIELD', C.green, 'rgba(0,204,102,0.06)', rx, ry, w, lH);
    if (sb.sensor_blind)  ry = _trow(ctx, 'SEN BLIND', '−40% LOCK', C.green, 'rgba(0,204,102,0.06)', rx, ry, w, lH);
    if (sb.weapon_disrupt)ry = _trow(ctx, 'WPN DISRP', '+30% INTV', C.green, 'rgba(0,204,102,0.06)', rx, ry, w, lH);
  }

  // Shield sectors
  ry += 2; ry = _lcarsHdr(ctx, 'SHIELDS', rx, ry, w - rx, '#111133');
  SHIELD_SECTORS.forEach(s => {
    const val  = G.running ? (G.threat.shields[s] || 0) : 0;
    const maxV = cfg.shields[s] || 1;
    const pct  = val / maxV;
    const col  = pct > 0.5 ? C.green : pct > 0.2 ? C.warn : C.red;
    const disp = sH < 40 ? '?' : sH < 70 ? `~${Math.round(val/10)*10}` : `${Math.ceil(val)}`;
    ry = _row(ctx, s.substring(0,4).toUpperCase(), disp, pct, col, rx, ry, w, lH);
  });

  // Enemy systems (only if space)
  if (ry < h - (Object.keys(G.enemySystems).length * lH + 20)) {
    ry += 2; ry = _lcarsHdr(ctx, 'SYSTEMS', rx, ry, w - rx, '#221100');
    Object.keys(G.enemySystems).forEach(k => {
      const sys = G.enemySystems[k]; const h2 = Math.round(sys.health);
      const pct = h2 / 100;
      const col = h2 <= 0 ? C.red : h2 > 70 ? C.green : h2 > 35 ? C.warn : C.red;
      const rp  = G.enemyRepairQueue.find(r => r.sysKey === k);
      const isActive = G.targetedSubsystemType === k;
      const label = sys.label.substring(0, 9);
      ry = _row(ctx, (isActive ? '▶' : ' ') + label, h2 <= 0 ? 'OFFLINE' : rp ? `${h2}%🔧` : `${h2}%`, h2 <= 0 ? 0 : pct, col, rx, ry, w, lH);
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

  // Background
  ctx.fillStyle = '#000207'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(20,40,80,0.3)'; ctx.lineWidth = 0.5;
  for (let gx = 0; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 0; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

  // Title
  ctx.fillStyle = 'rgba(0,2,7,0.9)'; ctx.fillRect(0, 0, w * 0.57, 30);
  ctx.strokeStyle = C.o; ctx.lineWidth = 1; ctx.strokeRect(0, 0, w * 0.57, 30);
  ctx.fillStyle = C.o; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('USS DEFIANT NX-74205', 6, 5);
  ctx.fillStyle = '#5566aa'; ctx.font = '8px Roboto Mono';
  ctx.fillText('Defiant-class · Escort · Ablative armour', 6, 18);

  // Divider
  const divX = w * 0.57;
  ctx.strokeStyle = 'rgba(40,80,160,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, h); ctx.stroke();

  const cx = w * 0.29, cy = h * 0.50;
  const hullPct  = G.player.hull / G.player.maxHull;
  const hullColor = hullPct > 0.65 ? C.green : hullPct > 0.35 ? C.warn : C.red;

  // Hull outline
  ctx.strokeStyle = hullColor; ctx.lineWidth = 2;
  ctx.fillStyle = `rgba(26,38,64,${0.15 + hullPct * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(cx,cy-62); ctx.quadraticCurveTo(cx+52,cy-30,cx+56,cy+12); ctx.lineTo(cx+36,cy+18);
  ctx.lineTo(cx+42,cy+58); ctx.lineTo(cx+26,cy+58); ctx.lineTo(cx,cy+46); ctx.lineTo(cx-26,cy+58);
  ctx.lineTo(cx-42,cy+58); ctx.lineTo(cx-36,cy+18); ctx.quadraticCurveTo(cx-52,cy-30,cx,cy-62); ctx.closePath();
  ctx.fill();
  if (hullPct < 0.5) { ctx.fillStyle = `rgba(255,51,51,${(0.5-hullPct)*0.25})`; ctx.fill(); }
  ctx.stroke();

  // Ablative armour rings
  const ab = G.ablative;
  ab.layerHealth.forEach((lh, i) => {
    if (lh <= 0 && ab.regenTimers[i] <= 0 && ab.regenProgress[i] <= 0) return;
    const layerR = 68 + i * 4;
    const pct    = lh > 0 ? lh / 100 : ab.regenProgress[i] / ABLATIVE_ARMOUR.regenTime;
    ctx.strokeStyle = lh > 0 ? `rgba(0,204,102,${0.2 + (lh/100)*0.3})` : `rgba(255,170,0,${0.1 + pct*0.2})`;
    ctx.lineWidth = lh > 0 ? 2 : 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, layerR, 0, Math.PI * 2 * pct); ctx.stroke();
  });

  // Cloak overlay
  if (G.cloaked || G.cloakVulnTimer > 0) {
    const s = G.cloakVulnTimer > 0 ? (0.6 + Math.sin(performance.now()*0.03)*0.4) : (0.25 + Math.sin(performance.now()*0.005)*0.18);
    ctx.strokeStyle = `rgba(153,102,204,${s})`; ctx.lineWidth = G.cloakVulnTimer > 0 ? 4 : 2.5; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(cx, cy, 90, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }

  // System nodes with glow
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
    if (!sys.tripped && h2 > 0) {
      const grd = ctx.createRadialGradient(cx+sp.x, cy+sp.y, 0, cx+sp.x, cy+sp.y, r+5);
      grd.addColorStop(0, col.replace('0.9)', '0.2)'));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r+5, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r, 0, Math.PI*2); ctx.fill();
    if (h2 < 70 || sys.tripped) { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r+3, 0, Math.PI*2); ctx.stroke(); }
    if (G.repairTeams.some(t => t.sysKey === sp.k)) {
      ctx.fillStyle = C.warn; ctx.font = '9px Antonio'; ctx.textAlign = 'center'; ctx.fillText('🔧', cx+sp.x, cy+sp.y-10);
    }
  });

  // Shield arcs
  const shArc = [{k:'fore',s:Math.PI*1.2,e:Math.PI*1.8},{k:'port',s:Math.PI*0.6,e:Math.PI*1.2},{k:'starboard',s:Math.PI*1.8,e:Math.PI*2.4},{k:'aft',s:Math.PI*0.2,e:Math.PI*0.6}];
  shArc.forEach(sa => {
    const val = G.cloaked ? 0 : G.player.shields[sa.k]; const pct = val / G.player.shields.maxSectorValue;
    const col = G.cloaked ? 'rgba(153,102,204,0.2)' : val > 100 ? C.green : val > 40 ? C.warn : C.red;
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.globalAlpha = 0.06 + pct * 0.08;
    ctx.beginPath(); ctx.arc(cx, cy, 77, sa.s, sa.e); ctx.stroke();
    ctx.lineWidth = 2; ctx.globalAlpha = G.cloaked ? 0.15 : (0.35 + pct * 0.65);
    ctx.beginPath(); ctx.arc(cx, cy, 74, sa.s, sa.e); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // ── Right panel ───────────────────────────────────────────────
  const rx = w * 0.59; let ry = 4; const lH = 11;

  // Hull integrity
  ry = _lcarsHdr(ctx, 'DEFIANT HULL', rx, ry, w - rx, '#884400');
  ry = _row(ctx, 'INTEGRITY', `${Math.ceil(G.player.hull)}/${G.player.maxHull}`, hullPct, hullColor, rx, ry, w, lH);
  ry = _trow(ctx, 'STATUS', hullPct > 0.65 ? 'NOMINAL' : hullPct > 0.35 ? 'DAMAGED' : 'CRITICAL', hullColor, hullPct < 0.35 ? 'rgba(255,51,51,0.08)' : null, rx, ry, w, lH);
  const wcH = G.systems.warp_core.health;
  ry = _row(ctx, 'WARP CORE', G.systems.warp_core.tripped ? 'OFFLINE' : `${Math.round(wcH)}%`, wcH/100, G.systems.warp_core.tripped ? C.red : wcH > 50 ? C.green : C.warn, rx, ry, w, lH);
  ry = _trow(ctx, 'EPS', `${getTotalAllocatedPower()}/${getWarpOutput()}MW`, G.systems.warp_core.tripped ? C.red : C.o, null, rx, ry, w, lH);

  // EPS heat
  if (G.epsHeat > 10) {
    const heatCol = G.epsHeat > 70 ? C.red : G.epsHeat > 40 ? C.warn : C.green;
    ry = _row(ctx, 'EPS HEAT', `${Math.round(G.epsHeat)}%`, G.epsHeat/100, heatCol, rx, ry, w, lH);
  }

  // Ablative armour
  ry += 2; ry = _lcarsHdr(ctx, 'ABLATIVE ARMOUR', rx, ry, w - rx, '#005522');
  ry = _row(ctx, 'LAYERS', `${ab.layers}/6`, ab.layers/6, ab.layers > 3 ? C.green : ab.layers > 1 ? C.warn : C.red, rx, ry, w, lH);
  // Layer state strip
  const ablStr = ab.layerHealth.map((lh, i) => {
    if (lh > 0) return '█';
    if (ab.regenTimers[i] > 0) return `${Math.ceil(ab.regenTimers[i]/1000)}s`;
    return `↑${Math.round((ab.regenProgress[i]/ABLATIVE_ARMOUR.regenTime)*100)}%`;
  }).join(' ');
  ctx.fillStyle = '#44607a'; ctx.font = '7px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(ablStr, rx, ry); ry += lH;

  // Shields
  ry += 2; ry = _lcarsHdr(ctx, 'SHIELDS', rx, ry, w - rx, '#112244');
  if (G.cloaked) {
    ry = _trow(ctx, 'ALL', 'OFFLINE — CLOAKED', C.p, 'rgba(153,102,204,0.08)', rx, ry, w, lH);
  } else {
    const regenRate = G.shieldRegenRate || 0;
    SHIELD_SECTORS.forEach(s => {
      const sv = Math.ceil(G.player.shields[s]); const max = G.player.shields.maxSectorValue;
      const c = sv > max * 0.66 ? C.green : sv > max * 0.33 ? C.warn : C.red;
      ry = _row(ctx, s.substring(0,4).toUpperCase(), `${sv}/${max}`, sv / max, c, rx, ry, w, lH);
    });
    ry = _trow(ctx, 'REGEN', `+${regenRate.toFixed(1)}/s`, '#6688aa', null, rx, ry, w, lH);
  }

  // Key systems
  ry += 2; ry = _lcarsHdr(ctx, 'KEY SYSTEMS', rx, ry, w - rx, '#221133');
  [{k:'cloak_dev',l:'CLOAK'},{k:'sensors',l:'SENSORS'},{k:'engines',l:'ENGINES'}].forEach(sd => {
    const sys = G.systems[sd.k]; const sh = Math.round(sys.health);
    const c   = sh > 70 ? C.green : sh > 35 ? C.warn : C.red;
    const rp  = G.repairTeams.some(t => t.sysKey === sd.k);
    ry = _row(ctx, sd.l, sys.tripped ? 'OFFLINE' : rp ? `${sh}%🔧` : `${sh}%`, sh/100, sys.tripped ? C.red : c, rx, ry, w, lH);
  });

  // Torpedo count
  ry += 2; ry = _lcarsHdr(ctx, 'ORDNANCE', rx, ry, w - rx, '#332200');
  ry = _row(ctx, 'QUANTUM', `${G.player.torpedoes}/${G.player.maxTorpedoes}`, G.player.torpedoes/G.player.maxTorpedoes, C.t, rx, ry, w, lH);
  ry = _row(ctx, 'PHOTON',  `${G.player.photonTorpedoes}/${G.player.maxPhotonTorpedoes}`, G.player.photonTorpedoes/G.player.maxPhotonTorpedoes, C.b, rx, ry, w, lH);

  // Footer status
  if (G.batteryActive) {
    ctx.fillStyle = 'rgba(255,170,0,0.2)'; ctx.fillRect(rx-2, h-20, w-rx+2, 20);
    ctx.fillStyle = C.warn; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`⚡ BATTERY  ${Math.round(G.batteryCharge)}%`, rx, h-10);
  } else if (G.cloaked) {
    ctx.fillStyle = 'rgba(153,102,204,0.2)'; ctx.fillRect(rx-2, h-20, w-rx+2, 20);
    ctx.fillStyle = C.p; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`◉ CLOAKED  PWR:${Math.round(G.cloakPowerReserve)}%`, rx, h-10);
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
  ctx.strokeStyle = 'rgba(20,40,80,0.3)'; ctx.lineWidth = 0.5;
  for (let gx = 0; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 0; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

  // Title
  ctx.fillStyle = 'rgba(0,2,7,0.9)'; ctx.fillRect(0, 0, w * 0.57, 30);
  ctx.strokeStyle = C.b; ctx.lineWidth = 1; ctx.strokeRect(0, 0, w * 0.57, 30);
  ctx.fillStyle = C.b; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('USS ENTERPRISE NCC-1701-E', 6, 5);
  ctx.fillStyle = '#5566aa'; ctx.font = '8px Roboto Mono';
  ctx.fillText('Sovereign-class · 685m · Regen shielding', 6, 18);

  const divX = w * 0.57;
  ctx.strokeStyle = 'rgba(40,80,160,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, h); ctx.stroke();

  const cx = w * 0.29, cy = h * 0.48;
  const hullPct   = G.player.hull / G.player.maxHull;
  const hullColor = hullPct > 0.65 ? C.green : hullPct > 0.35 ? C.warn : C.red;
  const sc = 1.0;

  // Saucer
  const sauc_rx = 52 * sc, sauc_ry = 42 * sc;
  ctx.strokeStyle = hullColor; ctx.lineWidth = 2;
  ctx.fillStyle = `rgba(10,20,60,${0.15 + hullPct * 0.35})`;
  ctx.beginPath(); ctx.ellipse(cx, cy - 30 * sc, sauc_rx, sauc_ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Stardrive hull
  ctx.fillStyle = `rgba(5,15,45,${0.15 + hullPct * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(cx - 16*sc, cy + 8*sc); ctx.lineTo(cx + 16*sc, cy + 8*sc);
  ctx.lineTo(cx + 14*sc, cy + 72*sc); ctx.lineTo(cx, cy + 82*sc);
  ctx.lineTo(cx - 14*sc, cy + 72*sc); ctx.closePath(); ctx.fill(); ctx.stroke();

  // Nacelle pylons
  ctx.strokeStyle = `rgba(${hullPct > 0.5 ? '68,119,255' : '255,170,0'},0.6)`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx-20*sc, cy+20*sc); ctx.lineTo(cx-60*sc, cy+30*sc); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+20*sc, cy+20*sc); ctx.lineTo(cx+60*sc, cy+30*sc); ctx.stroke();

  // Nacelles
  ctx.strokeStyle = hullColor; ctx.lineWidth = 2;
  [[-60,30],[60,30]].forEach(([nx,ny]) => {
    ctx.fillStyle = `rgba(10,30,80,${0.15 + hullPct*0.3})`;
    ctx.beginPath(); ctx.ellipse(cx+nx*sc, cy+ny*sc, 12*sc, 6*sc, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    const bx = cx + (nx - (nx>0?11:-11))*sc, by = cy+ny*sc;
    const grd = ctx.createRadialGradient(bx, by, 1, bx, by, 8);
    grd.addColorStop(0, 'rgba(255,100,50,0.6)'); grd.addColorStop(1, 'rgba(255,100,50,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(bx, by, 8*sc, 0, Math.PI*2); ctx.fill();
  });

  // Saucer separation overlay
  if (G.saucerSepActive) {
    const col  = G.saucerSepReconnecting ? '255,170,0' : '0,204,102';
    const lbl  = G.saucerSepReconnecting ? 'DOCKING...' : 'SEPARATED';
    const drift = G.saucerSepReconnecting ? 12*(G.saucerSepReconnectTimer/6000) : 12 + Math.sin(performance.now()*0.002)*4;
    ctx.strokeStyle = `rgba(${col},${0.5+Math.sin(performance.now()*0.008)*0.25})`; ctx.lineWidth = 1.5; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.ellipse(cx, cy-30*sc-drift, sauc_rx, sauc_ry, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    if (G.saucerSepReconnecting) {
      ctx.strokeStyle = `rgba(${col},0.4)`; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(cx, cy-30*sc-drift+sauc_ry); ctx.lineTo(cx, cy-8); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = `rgba(${col},0.9)`; ctx.font = 'bold 8px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, cx, cy-30*sc-drift);
  }

  // System nodes
  const sPos = [
    {k:'cannon_pu',x:-32,y:-38},{k:'cannon_pl',x:-32,y:-18},
    {k:'cannon_su',x:32, y:-38},{k:'cannon_sl',x:32, y:-18},
    {k:'nose_beam',x:0,  y:55}, {k:'torpedoes',x:0,  y:-60},
    {k:'engines',  x:0,  y:75}, {k:'sensors',  x:44, y:-26},
    {k:'shields',  x:-44,y:-26},{k:'cloak_dev', x:0,  y:20},
    {k:'warp_core',x:0,  y:40}
  ];
  sPos.forEach(sp => {
    const sys = G.systems[sp.k]; if (!sys) return;
    const h2  = sys.health;
    const col = sys.tripped ? 'rgba(255,51,51,1)' : h2 > 70 ? 'rgba(68,119,255,0.9)' : h2 > 35 ? 'rgba(255,170,0,0.9)' : 'rgba(255,51,51,1)';
    const r   = sys.tripped ? 7 : 4;
    if (!sys.tripped && h2 > 0) {
      const grd = ctx.createRadialGradient(cx+sp.x, cy+sp.y, 0, cx+sp.x, cy+sp.y, r+5);
      grd.addColorStop(0, col.replace('0.9)', '0.2)')); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r+5, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r, 0, Math.PI*2); ctx.fill();
    if (h2 < 70 || sys.tripped) { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx+sp.x, cy+sp.y, r+3, 0, Math.PI*2); ctx.stroke(); }
    if (G.repairTeams.some(t => t.sysKey === sp.k)) {
      ctx.fillStyle = C.warn; ctx.font = '9px Antonio'; ctx.textAlign = 'center'; ctx.fillText('🔧', cx+sp.x, cy+sp.y-10);
    }
  });

  // Shield arcs
  const shArc = [{k:'fore',s:Math.PI*1.2,e:Math.PI*1.8},{k:'port',s:Math.PI*0.6,e:Math.PI*1.2},{k:'starboard',s:Math.PI*1.8,e:Math.PI*2.4},{k:'aft',s:Math.PI*0.2,e:Math.PI*0.6}];
  shArc.forEach(sa => {
    const val = G.player.shields[sa.k]; const pct = val / G.player.shields.maxSectorValue;
    const col = val > 200 ? C.b : val > 80 ? C.warn : C.red;
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.globalAlpha = 0.06 + pct*0.08;
    ctx.beginPath(); ctx.arc(cx, cy-30, 65, sa.s, sa.e); ctx.stroke();
    ctx.lineWidth = 2; ctx.globalAlpha = 0.35 + pct*0.65;
    ctx.beginPath(); ctx.arc(cx, cy-30, 62, sa.s, sa.e); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // ── Right panel ───────────────────────────────────────────────
  const rx = w * 0.59; let ry = 4; const lH = 11;

  ry = _lcarsHdr(ctx, 'ENTERPRISE HULL', rx, ry, w - rx, '#002255');
  ry = _row(ctx, 'INTEGRITY', `${Math.ceil(G.player.hull)}/${G.player.maxHull}`, hullPct, hullColor, rx, ry, w, lH);
  ry = _trow(ctx, 'STATUS', hullPct > 0.65 ? 'NOMINAL' : hullPct > 0.35 ? 'DAMAGED' : 'CRITICAL', hullColor, hullPct < 0.35 ? 'rgba(255,51,51,0.08)' : null, rx, ry, w, lH);
  const wcH = G.systems.warp_core.health;
  ry = _row(ctx, 'WARP CORE', G.systems.warp_core.tripped ? 'OFFLINE' : `${Math.round(wcH)}%`, wcH/100, G.systems.warp_core.tripped ? C.red : C.green, rx, ry, w, lH);
  ry = _trow(ctx, 'EPS', `${getTotalAllocatedPower()}/${getWarpOutput()}MW`, G.systems.warp_core.tripped ? C.red : C.b, null, rx, ry, w, lH);

  if (G.epsHeat > 10) {
    const heatCol = G.epsHeat > 70 ? C.red : G.epsHeat > 40 ? C.warn : C.green;
    ry = _row(ctx, 'EPS HEAT', `${Math.round(G.epsHeat)}%`, G.epsHeat/100, heatCol, rx, ry, w, lH);
  }

  // Regen shields
  ry += 2; ry = _lcarsHdr(ctx, 'REGEN SHIELDS ×1.4', rx, ry, w - rx, '#112244');
  const regenRate = G.shieldRegenRate || 0;
  SHIELD_SECTORS.forEach(s => {
    const sv = Math.ceil(G.player.shields[s]); const max = G.player.shields.maxSectorValue;
    const c = sv > max*0.66 ? C.b : sv > max*0.33 ? C.warn : C.red;
    ry = _row(ctx, s.substring(0,4).toUpperCase(), `${sv}/${max}`, sv/max, c, rx, ry, w, lH);
  });
  ry = _trow(ctx, 'REGEN', `+${regenRate.toFixed(1)}/s`, '#6688aa', null, rx, ry, w, lH);

  // Saucer sep
  ry += 2; ry = _lcarsHdr(ctx, 'SAUCER SEP', rx, ry, w - rx, '#223300');
  if (G.saucerSepReconnecting) {
    ry = _trow(ctx, 'STATUS', `DOCKING ${Math.ceil(G.saucerSepReconnectTimer/1000)}s`, C.warn, 'rgba(255,170,0,0.08)', rx, ry, w, lH);
  } else if (G.saucerSepActive) {
    ry = _trow(ctx, 'STATUS', 'SEPARATED', C.green, 'rgba(0,204,102,0.08)', rx, ry, w, lH);
  } else if (G.saucerSepCooldown > 0) {
    ry = _trow(ctx, 'STATUS', `CD ${Math.ceil(G.saucerSepCooldown/1000)}s`, C.warn, null, rx, ry, w, lH);
  } else {
    ry = _trow(ctx, 'STATUS', 'READY', C.green, null, rx, ry, w, lH);
  }
  ry = _trow(ctx, 'EFFECT', '−60% LOCK RATE', '#8899aa', null, rx, ry, w, lH);

  // Ordnance
  ry += 2; ry = _lcarsHdr(ctx, 'ORDNANCE', rx, ry, w - rx, '#332200');
  ry = _row(ctx, 'QUANTUM', `${G.player.torpedoes}/${G.player.maxTorpedoes}`, G.player.torpedoes/G.player.maxTorpedoes, C.t, rx, ry, w, lH);
  ry = _row(ctx, 'PHOTON',  `${G.player.photonTorpedoes}/${G.player.maxPhotonTorpedoes}`, G.player.photonTorpedoes/G.player.maxPhotonTorpedoes, C.b, rx, ry, w, lH);
  ry = _trow(ctx, 'TRICOB', G.tricobalReady ? 'ARMED' : 'EXPENDED', G.tricobalReady ? C.green : C.red, G.tricobalReady ? 'rgba(0,204,102,0.06)' : null, rx, ry, w, lH);

  if (G.batteryActive) {
    ctx.fillStyle = 'rgba(255,170,0,0.2)'; ctx.fillRect(rx-2, h-20, w-rx+2, 20);
    ctx.fillStyle = C.warn; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`⚡ BATTERY  ${Math.round(G.batteryCharge)}%`, rx, h-10);
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

  ctx.fillStyle = '#000205'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(20,40,80,0.3)'; ctx.lineWidth = 0.5;
  for (let gx = 0; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 0; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

  const warpOut    = getWarpOutput();
  const total      = getTotalAllocatedPower();
  const headroom   = warpOut - total;
  const warpHealth = Math.round(G.systems.warp_core.health);

  // Title bar
  ctx.fillStyle = 'rgba(0,2,5,0.9)'; ctx.fillRect(0, 0, w, 24);
  ctx.strokeStyle = C.o; ctx.lineWidth = 1; ctx.strokeRect(0, 0, w, 24);
  ctx.fillStyle = C.o; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('EPS POWER DISTRIBUTION', 8, 12);
  ctx.fillStyle = G.systems.warp_core.tripped ? C.red : C.o;
  ctx.font = 'bold 9px Roboto Mono'; ctx.textAlign = 'right';
  ctx.fillText(G.systems.warp_core.tripped ? (G.batteryActive ? `BATTERY ${Math.round(G.batteryCharge)}%` : 'WARP CORE OFFLINE') : `CORE: ${warpHealth}% — ${warpOut}MW`, w-8, 12);

  // Total used bar
  const barX = 10, barY = 30, barW = w-20, barH = 16;
  ctx.fillStyle = '#030810'; ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = G.systems.warp_core.tripped ? C.red : '#1a3060'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
  const usedW    = Math.min(barW, (total / WARP_CORE.maxOutput) * barW);
  const usedColor = total > warpOut ? C.red : total > warpOut*0.85 ? C.warn : C.green;
  // Gradient fill
  const grd = ctx.createLinearGradient(barX, 0, barX + usedW, 0);
  grd.addColorStop(0, usedColor + '88'); grd.addColorStop(1, usedColor);
  ctx.fillStyle = grd; ctx.fillRect(barX, barY, usedW, barH);
  // Limit line
  const limitX = barX + (warpOut / WARP_CORE.maxOutput) * barW;
  ctx.strokeStyle = C.o; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(limitX, barY-2); ctx.lineTo(limitX, barY+barH+2); ctx.stroke();
  ctx.fillStyle = C.o; ctx.font = '7px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`MAX ${warpOut}MW`, limitX, barY-2);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Roboto Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${total}MW / ${warpOut}MW  [${headroom >= 0 ? '+' : ''}${headroom}MW headroom]`, w/2, barY+barH/2);

  // Per-system rows
  const groups = [
    { label:'WEAPONS', keys:['cannon_pu','cannon_pl','cannon_su','cannon_sl','nose_beam','torpedoes'], color:C.warn },
    { label:'SPECIAL', keys:['cloak_dev'], color:C.p },
    { label:'SYSTEMS', keys:['shields','sensors','engines','warp_core'], color:C.b },
  ];
  let yOff = barY + barH + 8;
  const rowH = 13, labelW = 80, pBarW = w - labelW - 44 - 16;

  const shortLabels = {cannon_pu:'P.Cnn P/U',cannon_pl:'P.Cnn P/L',cannon_su:'P.Cnn S/U',cannon_sl:'P.Cnn S/L',nose_beam:'Nose Beam',torpedoes:'Torpedoes',cloak_dev:'Cloak Dev',shields:'Shields',sensors:'Sensors',engines:'Engines',warp_core:'Warp Core'};
  // Enterprise-E weapon labels
  const entLabels = {cannon_pu:'Sauc Drs',cannon_pl:'Sauc Vnt',cannon_su:'Strdv Fwd',cannon_sl:'Sauc Aft',nose_beam:'Strdv Emt',torpedoes:'Torpedo'};
  const isEnt = G.playerShipKey === 'enterprise_e';

  groups.forEach(grp => {
    // Section label
    ctx.fillStyle = grp.color + 'cc'; ctx.font = 'bold 8px Antonio'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillRect(6, yOff, 60, 11);
    ctx.fillStyle = '#000';
    ctx.fillText(grp.label, 8, yOff + 2);
    yOff += 13;

    grp.keys.forEach(key => {
      const sys    = G.systems[key];
      const pw     = sys.allocatedPower; const maxPw = Math.min(60, Math.max(1, warpOut));
      const pct    = (pw / maxPw);
      const isOver = pw > 40;
      const col    = sys.tripped ? C.red : isOver ? C.red : pw > 30 ? C.warn : grp.color;
      const lbl    = (isEnt && entLabels[key]) || shortLabels[key] || key;

      // Label
      ctx.fillStyle = sys.tripped ? C.red : '#8899bb'; ctx.font = '8px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, 8, yOff + rowH/2 - 1);

      // Power bar rail
      ctx.fillStyle = '#030810'; ctx.fillRect(labelW, yOff, pBarW, rowH-3);
      if (!sys.tripped && pw > 0) {
        const bGrd = ctx.createLinearGradient(labelW, 0, labelW + pBarW * Math.min(pct, 1), 0);
        bGrd.addColorStop(0, col + '88'); bGrd.addColorStop(1, col);
        ctx.fillStyle = bGrd; ctx.fillRect(labelW, yOff, Math.min(pBarW, pct*pBarW), rowH-3);
      }

      // System stress overlay (right side of bar, red fill)
      if (sys.stress > 0 && !sys.tripped) {
        const stressW = (sys.stress / 100) * (pBarW * 0.35);
        ctx.fillStyle = `rgba(255,51,51,${0.25 + sys.stress/200})`;
        ctx.fillRect(labelW + pBarW - stressW, yOff, stressW, rowH-3);
      }

      // 40MW threshold line
      const thresh40X = labelW + (40 / maxPw) * pBarW;
      if (thresh40X < labelW + pBarW) {
        ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2,2]);
        ctx.beginPath(); ctx.moveTo(thresh40X, yOff-1); ctx.lineTo(thresh40X, yOff+rowH-2); ctx.stroke(); ctx.setLineDash([]);
      }

      // Cap % indicator (small bar below power bar)
      const capPct = sys.cap ? sys.cap / 100 : 0;
      if (sys.cap !== undefined) {
        const capCol = capPct > 0.7 ? '#00aa44' : capPct > 0.3 ? '#886600' : '#553300';
        ctx.fillStyle = capCol; ctx.fillRect(labelW, yOff + rowH-3, pBarW * capPct, 2);
      }

      // MW value
      ctx.fillStyle = sys.tripped ? C.red : col; ctx.font = 'bold 8px Roboto Mono'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(sys.tripped ? 'OFFL' : `${pw}MW`, w-6, yOff + rowH/2 - 1);
      yOff += rowH;
    });
    yOff += 3;
  });

  // EPS heat meter
  if (G.epsHeat > 5) {
    const heatCol = G.epsHeat > 70 ? C.red : G.epsHeat > 40 ? C.warn : '#446644';
    ctx.fillStyle = '#44607a'; ctx.font = '8px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('EPS HEAT', 8, yOff);
    ctx.fillStyle = '#030810'; ctx.fillRect(labelW, yOff, pBarW, 6);
    ctx.fillStyle = heatCol; ctx.fillRect(labelW, yOff, pBarW * (G.epsHeat/100), 6);
    ctx.fillStyle = heatCol; ctx.font = 'bold 8px Roboto Mono'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(G.epsHeat)}%`, w-6, yOff);
    yOff += 10;
  }

  // Footer headroom status
  const footerY = h - 22;
  if (yOff < footerY) {
    ctx.fillStyle = headroom < 0 ? 'rgba(255,51,51,0.12)' : headroom < 15 ? 'rgba(255,170,0,0.08)' : 'rgba(0,204,102,0.06)';
    ctx.fillRect(6, footerY, w-12, 18);
    ctx.strokeStyle = headroom < 0 ? C.red : headroom < 15 ? C.warn : C.green; ctx.lineWidth = 1;
    ctx.strokeRect(6, footerY, w-12, 18);
    ctx.fillStyle = headroom < 0 ? C.red : headroom < 15 ? C.warn : C.green;
    ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(headroom < 0 ? `⚠ OVERLOADED BY ${Math.abs(headroom)}MW — BREAKER RISK` : headroom < 15 ? `⚠ LOW HEADROOM: ${headroom}MW` : `✔ ${headroom}MW AVAILABLE`, w/2, footerY+9);
  }
}
