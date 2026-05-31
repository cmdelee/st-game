'use strict';

// ============================================================
// CANVAS REFERENCES & STAR FIELD
// ============================================================
let spatialCanvas, spatialCtx, hullCanvas, hullCtx, enemyCanvas, enemyCtx, powerCanvas, powerCtx;
const STARS = [];

function handleHighDpiCanvasResizing() {
  const dpr = window.devicePixelRatio || 1;
  [[spatialCanvas, spatialCtx],[hullCanvas, hullCtx],[enemyCanvas, enemyCtx],[powerCanvas, powerCtx]].forEach(([c, ctx]) => {
    if (!c || !c.parentElement) return;
    const bb = c.parentElement.getBoundingClientRect();
    if (bb.width === 0 || bb.height === 0) return;
    c.width  = bb.width  * dpr;
    c.height = bb.height * dpr;
    c.style.width  = `${bb.width}px`;
    c.style.height = `${bb.height}px`;
    if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr); }
  });
}

// ============================================================
// SPATIAL VIEW CANVAS — fully enhanced battle display
// ============================================================
function renderSpatialViewCanvas() {
  if (!spatialCanvas || !spatialCtx) return;
  const bb = spatialCanvas.parentElement.getBoundingClientRect();
  const w = bb.width, h = bb.height; if (w <= 0 || h <= 0) return;
  const ctx = spatialCtx;
  const now = performance.now();

  // ── 5: Nebula/deep-space gradient background ──
  const grad = ctx.createRadialGradient(w*0.5, h*0.5, 10, w*0.5, h*0.5, w*0.75);
  grad.addColorStop(0,   '#000510');
  grad.addColorStop(0.4, '#000208');
  grad.addColorStop(0.75,'#050012');
  grad.addColorStop(1,   '#000000');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

  // Distant star cluster (static decorative)
  ctx.fillStyle = 'rgba(100,120,180,0.12)';
  ctx.beginPath(); ctx.arc(w*0.65, h*0.2, 40, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(80,100,160,0.06)';
  ctx.beginPath(); ctx.arc(w*0.62, h*0.22, 65, 0, Math.PI*2); ctx.fill();

  // Scrolling starfield
  STARS.forEach(s => {
    s.x -= G.velocitySpeedRating * 0.03;
    if (s.x < 0) s.x = w;
    ctx.globalAlpha = s.o;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, s.y % h, s.d, s.d);
  });
  ctx.globalAlpha = 1;

  const px = w * 0.22, py = h * 0.58;  // player lower-left
  const ex = w * 0.75, ey = h * 0.38;  // enemy upper-right
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // ── 6: Range indicator between ships ──
  if (!G.enemyCloaked) {
    const rangeY  = h * 0.88;
    const rx1     = px + 20, rx2 = ex - 20;
    // Track line
    ctx.strokeStyle = 'rgba(68,119,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4,8]);
    ctx.beginPath(); ctx.moveTo(rx1, rangeY); ctx.lineTo(rx2, rangeY); ctx.stroke(); ctx.setLineDash([]);
    // Bracket ticks
    const brackets = [
      { label:'CLOSE',  pct: 0.15, col: cfg.prefersCloseRange ? C.red   : '#446688' },
      { label:'MEDIUM', pct: 0.45, col: cfg.prefersCloseRange ? C.warn  : '#446688' },
      { label:'LONG',   pct: 0.80, col: '#446688' },
    ];
    brackets.forEach(br => {
      const bx = rx1 + (rx2 - rx1) * br.pct;
      ctx.strokeStyle = br.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, rangeY-6); ctx.lineTo(bx, rangeY+6); ctx.stroke();
      ctx.fillStyle = br.col; ctx.font = '7px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(br.label, bx, rangeY+8);
    });
    // Current position indicator
    const rangePct = G.enemyRangeBracket === 'close' ? 0.12 : G.enemyRangeBracket === 'medium' ? 0.42 : 0.78;
    const markerX  = rx1 + (rx2 - rx1) * rangePct;
    const markerCol = G.enemyRangeBracket === 'close' ? C.red : G.enemyRangeBracket === 'medium' ? C.warn : C.green;
    ctx.fillStyle = markerCol; ctx.beginPath(); ctx.arc(markerX, rangeY, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = markerCol; ctx.font = 'bold 8px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`▼ ${(G.enemyRangeBracket || 'long').toUpperCase()}`, markerX, rangeY - 6);
    // Range label (right side)
    ctx.fillStyle = '#aabbcc'; ctx.font = '8px Antonio'; ctx.textAlign = 'left';
    ctx.fillText('RANGE', rx2 + 6, rangeY - 4);
  }

  // ── 1: Weapon beams — drawn BEFORE ships so ships render on top ──
  const beamMap = {
    cannon_pu: { col:'#88ccff', width:1.5, dash:[], style:'streak' },
    cannon_pl: { col:'#88ccff', width:1.5, dash:[], style:'streak' },
    cannon_su: { col:'#88ccff', width:1.5, dash:[], style:'streak' },
    cannon_sl: { col:'#88ccff', width:1.5, dash:[], style:'streak' },
    nose_beam: { col:'#ff9900', width:2.5, dash:[], style:'beam'   },
    torpedoes: { col:'#cc66ff', width:1.5, dash:[4,3], style:'streak' },
    photon:    { col:'#4477ff', width:1.5, dash:[3,4], style:'streak' },
  };
  G.renderedBeamsVector.forEach(b => {
    if (b.type === 'burst_flash') return;
    const bDef = beamMap[b.type]; if (!bDef) return;
    const age  = now - b.trackingStartTime;
    const fade = Math.max(0, 1 - age / b.duration);
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    if (bDef.style === 'beam') {
      // Nose beam — sustained line from player to enemy
      const grad2 = ctx.createLinearGradient(px, py, ex, ey);
      grad2.addColorStop(0,   bDef.col);
      grad2.addColorStop(0.6, bDef.col);
      grad2.addColorStop(1,   'transparent');
      ctx.strokeStyle = grad2; ctx.lineWidth = bDef.width + (1-fade)*1.5;
      ctx.setLineDash(bDef.dash);
      ctx.beginPath(); ctx.moveTo(px+18, py); ctx.lineTo(ex-18, ey); ctx.stroke();
      // Glow effect
      ctx.lineWidth = bDef.width + 3; ctx.globalAlpha = fade * 0.25;
      ctx.strokeStyle = bDef.col;
      ctx.beginPath(); ctx.moveTo(px+18, py); ctx.lineTo(ex-18, ey); ctx.stroke();
    } else {
      // Pulse/streak — short animated dash travelling toward target
      const prog = Math.min(1, age / (b.duration * 0.6));
      const sx   = px + (ex - px) * (prog * 0.5);
      const sy   = py + (ey - py) * (prog * 0.5);
      const ex2  = px + (ex - px) * Math.min(1, prog * 0.5 + 0.12);
      const ey2  = py + (ey - py) * Math.min(1, prog * 0.5 + 0.12);
      ctx.strokeStyle = bDef.col; ctx.lineWidth = bDef.width;
      ctx.setLineDash(bDef.dash);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex2, ey2); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();
  });

  // ── 7: Torpedo wake trails ──
  G.inFlightTorpedoes.forEach(t => {
    const prog  = 1 - (t.timeToImpact / 3500);
    const tx    = t.fromEnemy ? ex + (px - ex) * prog : px + (ex - px) * prog;
    const ty    = t.fromEnemy ? ey + (py - ey) * prog : py + (ey - py) * prog;
    const tCol  = t.fromEnemy ? C.red : (t.isPhoton ? '#4488ff' : C.t);
    const tSize = t.fromEnemy ? 4 : 3.5;
    // Wake trail
    for (let i = 1; i <= 5; i++) {
      const trailProg = prog - i * 0.04;
      if (trailProg < 0) continue;
      const trailX = t.fromEnemy ? ex + (px - ex) * trailProg : px + (ex - px) * trailProg;
      const trailY = t.fromEnemy ? ey + (py - ey) * trailProg : py + (ey - py) * trailProg;
      ctx.globalAlpha = (1 - i * 0.18) * 0.6;
      ctx.fillStyle = tCol;
      ctx.beginPath(); ctx.arc(trailX, trailY, tSize - i * 0.4, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Torpedo body
    ctx.fillStyle = tCol;
    ctx.beginPath(); ctx.arc(tx, ty, tSize, 0, Math.PI*2); ctx.fill();
    // Bright core
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  // ── Damage particles ──
  G.damageParticles = G.damageParticles.filter(p => {
    p.life += 16;
    if (p.life > p.maxLife) return false;
    const fade = 1 - p.life / p.maxLife;
    const ox = p.target === 'player' ? px : ex;
    const oy = p.target === 'player' ? py : ey;
    const dx = ox + p.vx * p.life * 0.06;
    const dy = oy + p.vy * p.life * 0.06;
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.col;
    ctx.fillRect(dx - 1, dy - 1, 2, 2);
    ctx.globalAlpha = 1;
    return true;
  });

  // ── Player vessel ──
  if (G.cloakVulnTimer > 0) {
    const a = 0.4 + Math.sin(now * 0.02) * 0.3;
    ctx.strokeStyle = `rgba(153,102,204,${a})`; ctx.lineWidth = 2; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  } else if (G.cloaked) {
    const s = 0.15 + Math.sin(now * 0.008) * 0.1;
    ctx.strokeStyle = `rgba(153,102,204,${s+0.2})`; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(153,102,204,${s*0.4})`; ctx.fill();
    ctx.fillStyle = `rgba(153,102,204,${s+0.3})`; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('◉', px, py);
  } else {
    // ── 8: Ablative armour segmented arc (replaces text) ──
    const ab = G.ablative;
    ab.layerHealth.forEach((lh, i) => {
      const segStart = -Math.PI * 0.9 + i * (Math.PI * 1.8 / ABLATIVE_ARMOUR.maxLayers);
      const segEnd   = segStart + (Math.PI * 1.8 / ABLATIVE_ARMOUR.maxLayers) - 0.08;
      const regen    = ab.regenTimers[i] <= 0 && ab.regenProgress[i] > 0;
      ctx.strokeStyle = lh > 0 ? `rgba(0,204,102,${0.4 + (lh/100)*0.5})` :
                        regen  ? `rgba(255,170,0,0.35)` : `rgba(255,255,255,0.08)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 26, segStart, segEnd); ctx.stroke();
    });

    // ── 3: Shield sector glow rings ──
    const sectorAngles = { fore:0, starboard:Math.PI*0.5, aft:Math.PI, port:-Math.PI*0.5 };
    Object.entries(sectorAngles).forEach(([s, angle]) => {
      const sv   = G.player.shields[s] || 0;
      const pct  = sv / G.player.shields.maxSectorValue;
      const isHit = G.shieldHitFlash.player.sector === s && G.shieldHitFlash.player.timer > 0;
      if (isHit) {
        const hitAlpha = Math.min(1, G.shieldHitFlash.player.timer / 200);
        ctx.strokeStyle = `rgba(255,255,255,${hitAlpha * 0.85})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(px, py, 22 + hitAlpha*4, angle - 0.4, angle + 0.4); ctx.stroke();
      } else if (pct > 0.05) {
        ctx.strokeStyle = pct > 0.5 ? `rgba(68,200,255,${0.1 + pct*0.35})` : `rgba(255,170,0,${0.1 + pct*0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 22, angle - 0.4, angle + 0.4); ctx.stroke();
      }
    });
    if (G.shieldHitFlash.player.timer > 0) G.shieldHitFlash.player.timer -= 16;

    // ── 7: Faction engine glow — Federation blue ──
    const engHealth = G.systems.engines.health / 100;
    const engPulse  = 0.3 + Math.sin(now * 0.005) * 0.2 * engHealth;
    ctx.strokeStyle = `rgba(68,119,255,${engPulse})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px - 12, py, 8, Math.PI*0.6, Math.PI*1.4); ctx.stroke();
    ctx.fillStyle = `rgba(68,119,255,${engPulse * 0.4})`;
    ctx.beginPath(); ctx.arc(px - 14, py, 4, 0, Math.PI*2); ctx.fill();

    // Hull outline — larger (20px)
    const hullPct = G.player.hull / G.player.maxHull;
    const baseCol = G.systems.warp_core.tripped ? C.warn : C.b;
    // ── 4: Hull state colouring — darken as hull drops ──
    ctx.strokeStyle = hullPct < 0.35 ? `rgba(255,100,60,0.9)` : baseCol;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = hullPct < 0.35 ? `rgba(80,10,5,0.5)` : '#0a1224'; ctx.fill();

    // Bow nacelle detail
    ctx.strokeStyle = baseCol; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px+18,py); ctx.lineTo(px+32,py-7); ctx.lineTo(px+32,py+7); ctx.closePath(); ctx.stroke();

    // Firing arc wedges
    const arcDefs = [
      { label:'FORE', startAngle:-Math.PI*0.35, endAngle:Math.PI*0.35,  systems:['cannon_pu','cannon_su','nose_beam','torpedoes'] },
      { label:'PORT', startAngle:-Math.PI*0.90, endAngle:-Math.PI*0.35, systems:['cannon_pu','cannon_pl'] },
      { label:'STBD', startAngle: Math.PI*0.35, endAngle: Math.PI*0.85, systems:['cannon_su','cannon_sl'] },
      { label:'AFT',  startAngle: Math.PI*1.00, endAngle: Math.PI*1.40, systems:['cannon_pl','cannon_sl'] },
    ];
    arcDefs.forEach(arc => {
      const recentFire = G.renderedBeamsVector.find(b =>
        b.type !== 'burst_flash' && arc.systems.includes(b.type) && now - b.trackingStartTime < b.duration
      );
      const allOffline = arc.systems.every(k => G.systems[k] && (G.systems[k].tripped || G.systems[k].health < 10));
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.arc(px, py, 52, arc.startAngle, arc.endAngle); ctx.closePath();
      ctx.fillStyle = recentFire ? `rgba(68,119,255,0.45)` : allOffline ? `rgba(255,51,51,0.07)` : `rgba(68,119,255,0.12)`;
      ctx.fill();
      if (recentFire) { ctx.strokeStyle = C.b; ctx.lineWidth = 1.5; ctx.stroke(); }
      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      ctx.fillStyle = recentFire ? C.b : allOffline ? C.red : 'rgba(68,119,255,0.5)';
      ctx.font = 'bold 7px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(arc.label, px + Math.cos(midAngle) * 63, py + Math.sin(midAngle) * 63);
    });

    if (G.batteryActive) {
      const ba = 0.4 + Math.sin(now * 0.015) * 0.3;
      ctx.strokeStyle = `rgba(255,170,0,${ba})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 30, 0, Math.PI*2); ctx.stroke();
    }
    if (G.systems.warp_core.tripped) {
      ctx.fillStyle = 'rgba(255,170,0,0.75)'; ctx.font = 'bold 8px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(G.batteryActive ? '⚡ BATTERY' : '⊗ WARP OFFLINE', px, py - 38);
    }
  }

  // ── Enemy vessel ──
  if (G.enemyCloaked && G.enemyCloakVulnTimer === 0) {
    ctx.strokeStyle = 'rgba(153,102,204,0.1)'; ctx.lineWidth = 1; ctx.setLineDash([5,8]);
    ctx.beginPath(); ctx.arc(ex, ey, 22, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    if (G.sensorGhostActive) {
      const ga = 0.3 + Math.sin(now * 0.02) * 0.2;
      const gx = ex + Math.sin(now * 0.003) * 40, gy = ey + Math.cos(now * 0.004) * 28;
      ctx.strokeStyle = `rgba(255,170,0,${ga})`; ctx.lineWidth = 1; ctx.setLineDash([3,6]);
      ctx.beginPath(); ctx.arc(gx, gy, 14, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,170,0,${ga*0.7})`; ctx.font = 'bold 9px Antonio'; ctx.textAlign = 'center'; ctx.fillText('?', gx, gy-20);
    }
  } else {
    // ── 3: Enemy shield sector glow ──
    if (G.running && G.threat.shields) {
      const eSectorAngles = { fore:Math.PI, port:-Math.PI*0.5, starboard:Math.PI*0.5, aft:0 };
      Object.entries(eSectorAngles).forEach(([s, angle]) => {
        const sv   = G.threat.shields[s] || 0;
        const cfg2 = ENEMY_CONFIGS[G.enemyArchetype];
        const pct  = sv / (cfg2.shields[s] || 200);
        const isHit = G.shieldHitFlash.enemy.sector === s && G.shieldHitFlash.enemy.timer > 0;
        if (isHit) {
          const hitAlpha = Math.min(1, G.shieldHitFlash.enemy.timer / 200);
          ctx.strokeStyle = `rgba(255,100,80,${hitAlpha * 0.9})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(ex, ey, 26 + hitAlpha*5, angle - 0.4, angle + 0.4); ctx.stroke();
        } else if (pct > 0.05) {
          ctx.strokeStyle = pct > 0.5 ? `rgba(255,80,80,${0.12 + pct*0.3})` : `rgba(255,170,0,${0.12 + pct*0.25})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ex, ey, 26, angle - 0.4, angle + 0.4); ctx.stroke();
        }
      });
      if (G.shieldHitFlash.enemy.timer > 0) G.shieldHitFlash.enemy.timer -= 16;
    }

    // ── 7: Faction engine glow ──
    const factionGlow = { Klingon:'rgba(255,60,40,', Romulan:'rgba(100,255,100,', Cardassian:'rgba(255,200,60,', Dominion:'rgba(180,60,255,', Borg:'rgba(0,200,100,' };
    const fGlow = (factionGlow[cfg.faction] || 'rgba(200,100,100,') + `${0.3 + Math.sin(now*0.006)*0.2})`;
    ctx.strokeStyle = fGlow; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex + 14, ey, 8, Math.PI*-0.4, Math.PI*0.4); ctx.stroke();
    ctx.fillStyle = (factionGlow[cfg.faction] || 'rgba(200,100,100,') + '0.25)';
    ctx.beginPath(); ctx.arc(ex + 16, ey, 4, 0, Math.PI*2); ctx.fill();

    ctx.save(); ctx.translate(ex, ey);
    const rangeScale = (cfg.prefersCloseRange && G.enemyRangeBracket === 'close') ? 1.4 :
                       (cfg.prefersCloseRange && G.enemyRangeBracket === 'medium') ? 1.2 : 1.0;
    if (rangeScale !== 1.0) ctx.scale(rangeScale, rangeScale);
    if (G.enemyManeuverState === 'angling') {
      const am = { fore:0, aft:Math.PI, port:-Math.PI/4, starboard:Math.PI/4 };
      ctx.rotate(am[G.enemyPreferredSector] || 0);
    } else if (G.enemyManeuverState === 'torpedocharge') {
      ctx.rotate(Math.sin(now * 0.01) * 0.12);
    }

    // ── 4: Hull damage state — enemy silhouette darkens at low hull ──
    const eHullPct  = G.threat.hull / G.threat.maxHull;
    const critColor = eHullPct < 0.3;
    ctx.strokeStyle = G.enemyManeuverState === 'torpedocharge' ? '#ff2200' : critColor ? '#ff6633' : C.red;
    ctx.lineWidth   = 2.5;
    ctx.fillStyle   = critColor ? 'rgba(255,60,20,0.25)' :
                      G.enemyManeuverState === 'torpedocharge' ? 'rgba(255,0,0,0.2)' : 'rgba(230,40,40,0.08)';

    ctx.beginPath();
    switch (G.enemyArchetype) {
      case 'ktinga':              ctx.moveTo(-5,-18);ctx.lineTo(8,0);ctx.lineTo(-5,18);ctx.lineTo(-18,10);ctx.lineTo(-12,0);ctx.lineTo(-18,-10);break;
      case 'vor_cha':             ctx.moveTo(-6,-20);ctx.lineTo(10,0);ctx.lineTo(-6,20);ctx.lineTo(-20,12);ctx.lineTo(-16,0);ctx.lineTo(-20,-12);break;
      case 'romulan_bop':         ctx.moveTo(10,0);ctx.lineTo(-10,-22);ctx.lineTo(-18,0);ctx.lineTo(-10,22);break;
      case 'romulan_warbird':     ctx.moveTo(16,0);ctx.lineTo(-8,-26);ctx.lineTo(-24,0);ctx.lineTo(-8,26);break;
      case 'cardassian_scout':    ctx.moveTo(-6,-10);ctx.lineTo(7,0);ctx.lineTo(-6,10);break;
      case 'galor_class':         ctx.moveTo(-10,-15);ctx.lineTo(13,0);ctx.lineTo(-10,15);ctx.lineTo(-18,8);ctx.lineTo(-13,0);ctx.lineTo(-18,-8);break;
      case 'jem_hadar_fighter':   ctx.moveTo(-5,-12);ctx.lineTo(8,0);ctx.lineTo(-5,12);break;
      case 'jem_hadar_battleship':ctx.moveTo(-10,-18);ctx.lineTo(13,0);ctx.lineTo(-10,18);ctx.lineTo(-20,12);ctx.lineTo(-15,0);ctx.lineTo(-20,-12);break;
      case 'borg_probe':          ctx.strokeStyle=C.green;ctx.fillStyle=`rgba(0,204,102,${0.1 + (1-eHullPct)*0.2})`;ctx.rect(-14,-14,28,28);break;
      default:                    ctx.arc(0,0,12,0,Math.PI*2);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Critical hull sparks (static particles drawn in ship-local space)
    if (eHullPct < 0.3) {
      for (let i = 0; i < 3; i++) {
        const sx = (Math.sin(now * 0.003 + i * 2.1) * 10);
        const sy = (Math.cos(now * 0.004 + i * 1.7) * 8);
        const sa = 0.4 + Math.sin(now * 0.02 + i) * 0.35;
        ctx.fillStyle = `rgba(255,${140 + i*30},0,${sa})`;
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }
    ctx.restore();

    // Status overlays
    if (G.enemyTractorActive) {
      const ta = 0.4 + Math.sin(now * 0.01) * 0.3;
      ctx.strokeStyle = `rgba(0,204,102,${ta})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex-18, ey); ctx.lineTo(px+22, py); ctx.stroke();
      ctx.fillStyle = 'rgba(0,204,102,0.7)'; ctx.font = '9px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('TRACTOR', (ex+px)/2, py - 8);
    }
    if (G.enemyRepairQueue.length > 0 || G.enemyRepairQueue.length === 0 && G.repairTeams) {
      ctx.fillStyle = 'rgba(255,170,0,0.75)'; ctx.font = '9px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('🔧', ex, ey - 30);
    }
    if (G.enemyCloakVulnTimer > 0) {
      const va = 0.5 + Math.sin(now * 0.025) * 0.3;
      ctx.strokeStyle = `rgba(153,102,204,${va})`; ctx.lineWidth = 2; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(ex, ey, 32, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,170,0,0.9)`; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('⚡ FIRE NOW', ex, ey + 38);
    }
    if (G.enemyRammingRun) {
      const ra = 0.6 + Math.sin(now * 0.04) * 0.4;
      ctx.strokeStyle = `rgba(255,51,51,${ra})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ex, ey, 36, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = `rgba(255,51,51,${ra})`; ctx.font = 'bold 10px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('⚠ RAMMING RUN', ex, ey - 42);
      ctx.textBaseline = 'top';
      ctx.fillText(`IMPACT: ${Math.ceil(G.enemyRammingTimer/1000)}s`, ex, ey + 42);
      ctx.strokeStyle = `rgba(255,51,51,0.35)`; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
    }

    // Enemy ship name label
    ctx.fillStyle = `rgba(255,100,100,${eHullPct < 0.3 ? 0.9 : 0.55})`;
    ctx.font = '8px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(cfg.label, ex, ey - 36);
    ctx.fillStyle = `rgba(200,80,80,${eHullPct < 0.3 ? 0.8 : 0.4})`;
    ctx.fillText(`HULL ${Math.round(eHullPct*100)}%`, ex, ey - 27);
  }

  // ── 1: Burst salvo flash ──
  const burstFlash = G.renderedBeamsVector.find(b => b.type === 'burst_flash' && now - b.trackingStartTime < b.duration);
  if (burstFlash) {
    const age  = now - burstFlash.trackingStartTime;
    const fade = 1 - (age / burstFlash.duration);
    ctx.strokeStyle = `rgba(255,255,255,${fade * 0.9})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 36 + (1 - fade) * 14, 0, Math.PI*2); ctx.stroke();
  }

  // Clean up
  G.renderedBeamsVector = G.renderedBeamsVector.filter(b => now - b.trackingStartTime < b.duration);

  // Player ship label
  if (!G.cloaked) {
    ctx.fillStyle = 'rgba(68,119,255,0.55)'; ctx.font = '8px Antonio'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('USS DEFIANT', px, py + 24);
  }
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
    const val  = G.threat.shields[sa.key]; const maxV = cfg.shields[sa.key]; const pct = val / maxV;
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
    // Per-weapon resistance breakdown
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
  ['fore','port','starboard','aft'].forEach(s => {
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
  dRow('Layers', `${ab.layers}/5`, ab.layers > 3 ? C.green : ab.layers > 1 ? C.warn : C.red);
  ctx.fillStyle = '#6688aa'; ctx.font = '8px Roboto Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(ablStr, rx, ry); ry += lH;

  ry += 3; dHdr('SHIELDS');
  if (G.cloaked) {
    dRow('ALL SECTORS', 'OFFLINE — CLOAKED', C.p);
  } else {
    ['fore','port','starboard','aft'].forEach(s => {
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
