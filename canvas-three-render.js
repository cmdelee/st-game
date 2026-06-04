'use strict';

// ============================================================
// CANVAS-THREE-RENDER.JS — Three.js per-frame spatial render loop
// Split out of canvas-three.js. Loaded immediately after it.
// Shares its module-level state (THREE_scene, mesh_defiant, beam_lines,
// shield_player/enemy, engine glows, particle system, etc.) via the global
// lexical environment that classic scripts share — so canvas-three.js MUST
// load first. Geometry builders + scene init live in canvas-three.js.
// ============================================================

// ── Ship facing ──────────────────────────────────────────────
// Player faces +X (enemy lies at +X); port = +Z, starboard = -Z.
// To present a given sector toward the enemy we yaw the ship so that
// sector's outward normal points at +X. fore=nose, aft=stern, port=+Z, stbd=-Z.
const _VECTOR_YAW = { fore: 0, aft: Math.PI, port: Math.PI / 2, starboard: -Math.PI / 2 };

// Shortest signed angular distance from a to b, wrapped to (-π, π].
function _angleWrap(d) { d = (d + Math.PI) % (2 * Math.PI); if (d < 0) d += 2 * Math.PI; return d - Math.PI; }

// ── Hull damage spark pool ────────────────────────────────────
let _hullSparks = [];            // { mesh, vel, life, maxLife }
let _hullSparkTimer = 0;         // accumulator — emit sparks at intervals
let _picardPrev = false;         // rising/falling-edge tracking for Picard Manoeuvre

function _emitHullSparks(origin, count, col) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.06 + Math.random()*0.06, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: col || 0xff6600 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      origin.x + (Math.random()-0.5)*3,
      origin.y + (Math.random()-0.5)*2,
      origin.z + (Math.random()-0.5)*3
    );
    THREE_scene.add(mesh);
    _hullSparks.push({
      mesh,
      vel: new THREE.Vector3((Math.random()-0.5)*4, Math.random()*3+1, (Math.random()-0.5)*4),
      life: 0, maxLife: 0.4 + Math.random()*0.5,
    });
  }
}

function _tickHullSparks(dt) {
  _hullSparks = _hullSparks.filter(s => {
    s.life += dt;
    const t = s.life / s.maxLife;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.vel.y -= 8 * dt; // gravity
    s.mesh.material.opacity = Math.max(0, 1 - t * t);
    s.mesh.material.transparent = true;
    if (s.life >= s.maxLife) { THREE_scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); return false; }
    return true;
  });
}

function renderSpatialViewCanvas() {
  if (!THREE_ready || !THREE_renderer) return;
  const dt  = Math.min(THREE_clock.getDelta(), 0.05);
  const now = THREE_clock.getElapsedTime();
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // Camera orbit + shake
  _camOrbitAngle += dt * 0.06;
  _camOrbitY     += dt * 0.04;
  _camShake = Math.max(0, _camShake - dt * 4);
  const _orbitR  = G.attackRunActive ? 38 : 52;
  const _orbitH  = 22 + Math.sin(_camOrbitY) * 4;
  const _shakeX  = _camShake * (Math.random()-0.5) * 2;
  const _shakeY  = _camShake * (Math.random()-0.5) * 2;
  const desiredCam = new THREE.Vector3(
    mesh_defiant.position.x - _orbitR * Math.cos(_camOrbitAngle * 0.25) + _shakeX,
    mesh_defiant.position.y + _orbitH + _shakeY,
    mesh_defiant.position.z + _orbitR * Math.sin(_camOrbitAngle * 0.18)
  );
  THREE_camera.position.lerp(desiredCam, G.attackRunActive ? 0.06 : 0.03);
  // Track the midpoint of the engagement in all three axes so both ships stay
  // framed as they climb, dive and slip laterally through 3D space.
  THREE_camera.lookAt(_camLookAtTarget.set(
    mesh_enemyGroup.position.x*0.45 + mesh_defiant.position.x*0.55,
    (mesh_enemyGroup.position.y + mesh_defiant.position.y) * 0.5,
    (mesh_enemyGroup.position.z + mesh_defiant.position.z) * 0.5
  ));

  // Defiant drift — space has no fixed plane, so the ship climbs, dives and
  // slips laterally as well as pitching. Amplitude scales with helm speed.
  const _speedDrift = { stop:0.2, maneuvering:0.5, half:1.0, full:1.8 }[G.helmSpeed] ?? 1.0;
  // Helm Climb/Level/Dive sets the player's vertical posture; drift rides on top.
  const _pitchTarget = { climb:+11, level:0, dive:-11 }[G.helmPitch] ?? 0;
  const _driftY = (Math.sin(now*0.4)*0.6 + Math.sin(now*0.17+0.9)*1.4) * _speedDrift;
  mesh_defiant.position.y = THREE.MathUtils.lerp(mesh_defiant.position.y, _pitchTarget + _driftY, 0.07);
  mesh_defiant.position.z = (Math.sin(now*0.25)*0.8 + Math.sin(now*0.11+0.3)*1.6) * _speedDrift;
  // Pitch into the vertical motion + climb/dive attitude (nose up when climbing)
  mesh_defiant.rotation.x = Math.cos(now*0.17+0.9)*1.4*0.17*_speedDrift*0.4
    + ({ climb:-0.16, level:0, dive:+0.16 }[G.helmPitch] ?? 0);
  // Yaw the ship to present the chosen attack-vector sector toward the enemy.
  // The hull physically turns, so the exposed side faces incoming fire — you
  // can't be hit on the aft while presenting your bow.
  const _vecYaw = _VECTOR_YAW[G.helmAttackVector] ?? 0;
  const _yStep  = _angleWrap(_vecYaw - mesh_defiant.rotation.y) * 0.05;
  mesh_defiant.rotation.y += _yStep;
  // Bank into the turn, plus idle roll
  mesh_defiant.rotation.z = Math.sin(now*0.3)*0.03*_speedDrift - _yStep * 6;

  // ── Manoeuvre choreography — make helm orders visibly read on the hull ──
  if (G.comeAboutActive) {
    // Hard 180° sweep — spin the hull through the rotation, all sectors exposed
    mesh_defiant.rotation.y += dt * (Math.PI * 2 / 3);
    mesh_defiant.rotation.z = Math.sin(now * 6) * 0.25;
  }
  if (G.evasiveActive || G.evasiveAlphaActive) {
    // Jinking barrel-roll — fast, hard, unpredictable corkscrew
    mesh_defiant.rotation.z += Math.sin(now * 9) * 0.40;
    mesh_defiant.rotation.x += Math.sin(now * 7 + 1) * 0.20;
    mesh_defiant.position.y += Math.sin(now * 8) * 2.4;
    mesh_defiant.position.z += Math.cos(now * 6.5) * 2.8;
  }
  if (G.attackPatternOmegaActive) {
    // Aggressive nose-down attack attitude
    mesh_defiant.rotation.x += Math.sin(now * 4) * 0.08 - 0.07;
  }
  // Picard Manoeuvre — micro-warp jump renders as a flickering double-image
  if (G.picardManoeuverActive) {
    const flick = Math.sin(now * 40) > 0 ? 1.0 : 0.22;
    mesh_defiant.traverse(c => { if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = flick; } });
    if (!_picardPrev) {
      // Rising edge — warp streaks "appearing in two places" + shake
      _camShake = Math.min(3.5, _camShake + 2.0);
      const p = mesh_defiant.position;
      [-6, +6].forEach(zoff => {
        const a = p.clone().add(new THREE.Vector3(-11, 0, zoff));
        const b = p.clone().add(new THREE.Vector3(+15, 0, zoff));
        const streak = _makeTubeMesh(a, b, 0.5, 0x66ccff, 0.85);
        if (streak) { streak._bornAt = now; streak._duration = 0.5; streak._isGlow = false; THREE_scene.add(streak); beam_lines.push(streak); }
      });
      spawnThreeParticles(p.x, p.y, p.z, 0.5, 0.8, 1.0, 30);
    }
  } else if (_picardPrev) {
    // Falling edge — restore opacity
    mesh_defiant.traverse(c => { if (c.isMesh && c.material) { c.material.opacity = 1; c.material.transparent = false; } });
  }
  _picardPrev = G.picardManoeuverActive;

  // Hull damage colouring — works on both loaded models and procedural geometry
  const hullPct = G.player.hull / G.player.maxHull;
  _applyHullDamageColour(mesh_defiant, hullPct, true);

  // Engine glow — intensity tied to helm speed setting
  const _helmGlow = { stop:0.2, maneuvering:0.7, half:1.5, full:3.2 }[G.helmSpeed] ?? 1.5;
  engine_glow_player.intensity = G.cloaked ? 0.1 : _helmGlow + Math.sin(now*3)*0.4*(G.systems.engines.health/100);
  const _nac = _NAC_OFFSET[G.playerShipKey] || _NAC_OFFSET.defiant;
  const _nacV = new THREE.Vector3(_nac.x, _nac.y, 0).applyQuaternion(mesh_defiant.quaternion);
  engine_glow_player.position.copy(mesh_defiant.position).add(_nacV);
  engine_glow_enemy.intensity  = G.enemyCloaked ? 0.1 : 1.8+Math.sin(now*2.8)*0.9;

  // ── Engine exhaust particles from nacelles ───────────────────
  if (!G.cloaked && G.running) {
    const _exhaustRate = { stop:0, maneuvering:0.12, half:0.28, full:0.55 }[G.helmSpeed] ?? 0.28;
    if (Math.random() < _exhaustRate) {
      const isEnt = G.playerShipKey === 'enterprise_e';
      const exX = isEnt ? -9.3 : -3.1;
      const exY = isEnt ? -2.4 : 0.0;
      const nacZ = isEnt ? 3.8 : 2.6;  // Defiant: outer nacelle pair spacing
      [-nacZ, nacZ].forEach(z => {
        // Local nacelle offset rotated by the ship's facing, then placed in world space
        const v = new THREE.Vector3(
          exX + (Math.random()-0.5)*0.6,
          exY + (Math.random()-0.5)*0.3,
          z + (Math.random()-0.5)*0.5
        ).applyQuaternion(mesh_defiant.quaternion).add(mesh_defiant.position);
        spawnThreeParticles(v.x, v.y, v.z, 0.25, 0.48, 1.0, 1);
      });
    }
  }

  // Cloaking — fade Defiant (only traverse when not fully opaque)
  const tOp = G.cloaked ? 0.0 : G.cloakVulnTimer>0 ? 0.3+Math.sin(now*20)*0.3 : 1.0;
  if (tOp < 1.0 || G.cloakVulnTimer > 0) {
    mesh_defiant.traverse(child => { if (child.isMesh) { child.material.transparent=tOp<1; child.material.opacity=THREE.MathUtils.lerp(child.material.opacity??1, tOp, 0.12); } });
  }

  // Player shield bubble
  shield_player.position.copy(mesh_defiant.position); shield_player.rotation.y=now*0.3;
  if (G.cloaked) { shield_player.material.opacity=0; }
  else if (G.shieldHitFlash.player.timer>0) {
    const f=G.shieldHitFlash.player.timer/600; shield_player.material.opacity=0.35*f;
    shield_player.material.emissive.setRGB(f*0.6,f*0.6,1.0); shield_player.material.color.setRGB(0.3,0.5,1.0);
  } else {
    const shAvg=['fore','port','starboard','aft'].reduce((a,s)=>a+G.player.shields[s],0)/4;
    shield_player.material.opacity=0.04+(shAvg/G.player.shields.maxSectorValue)*0.06;
    shield_player.material.emissive.setRGB(0.1,0.2,0.6);
  }

  // ── Saucer separation (Enterprise-E) — independent flight path ──
  if (G.playerShipKey === 'enterprise_e' && G.saucerSepActive) {
    if (!mesh_saucer_sep) {
      mesh_saucer_sep = buildSaucerSepGeometry();
      // Spawn at stardrive position
      mesh_saucer_sep.position.copy(mesh_defiant.position);
      mesh_saucer_sep.position.x += 6;
      THREE_scene.add(mesh_saucer_sep);
      _saucerSepAngle = now * 0.4; // start angle from current time to avoid snap from 0
    }
    _saucerSepAngle += dt * 0.42;
    // Wide sweeping arc through the combat zone — large XYZ range, independent of stardrive
    const combatCenterX = (mesh_defiant.position.x + mesh_enemyGroup.position.x) * 0.5;
    mesh_saucer_sep.position.x = combatCenterX + Math.cos(_saucerSepAngle * 0.65) * 22;
    mesh_saucer_sep.position.y = Math.sin(_saucerSepAngle * 1.15) * 14;
    mesh_saucer_sep.position.z = Math.sin(_saucerSepAngle * 0.88) * 24;
    // Bank/roll as it sweeps
    mesh_saucer_sep.rotation.y = _saucerSepAngle * 0.8;
    mesh_saucer_sep.rotation.z = Math.sin(_saucerSepAngle * 0.65) * 0.3;
    mesh_saucer_sep.rotation.x = Math.sin(_saucerSepAngle * 0.45) * 0.12;
    engine_glow_saucer.position.copy(mesh_saucer_sep.position);
    engine_glow_saucer.intensity = 1.2 + Math.sin(now * 5) * 0.4;
  } else if (mesh_saucer_sep) {
    _cleanupSaucerSep();
  }

  // Enemy movement
  if (G.running) {
    const _eDist = G.enemyRangeBracket==='close'?22:G.enemyRangeBracket==='medium'?38:55;
    const _pDist = G.playerRangeBracket==='close'?22:G.playerRangeBracket==='medium'?38:55;
    const rangeDist = Math.min(_eDist, _pDist);
    // Lateral flanking — commit the AI's chosen bearing (headless leaves this
    // 'fore'). Slide the enemy around toward that side of the player so the
    // manoeuvre reads in 3D; the gameplay effect is via effectiveEnemySector().
    G.enemyBearing = G.enemyDesiredBearing || 'fore';
    const _bearX = G.enemyBearing==='aft' ? -rangeDist*0.45
                 : (G.enemyBearing==='port'||G.enemyBearing==='starboard') ? -rangeDist*0.15 : 0;
    const _bearZ = G.enemyBearing==='port' ? +rangeDist*0.55
                 : G.enemyBearing==='starboard' ? -rangeDist*0.55 : 0;
    mesh_enemyGroup.position.x = THREE.MathUtils.lerp(mesh_enemyGroup.position.x, mesh_defiant.position.x+rangeDist+_bearX, 0.025);
    // 3D orbit — lateral weave across the player's arc, plus a DELIBERATE
    // vertical position: the enemy holds an elevation relative to the player
    // (G.enemyDesiredElevation) to deny the player's dorsal/ventral guns. The
    // player counters with the helm Climb/Dive control (they share the Y axis,
    // so matching the enemy's elevation re-opens a firing solution).
    const _orbitAmp = G.enemyRangeBracket==='close'?16:G.enemyRangeBracket==='medium'?11:7;
    const _vertAmp  = 2.4;  // gentle weave; the big vertical move is the elevation hold
    // Absolute elevation hold (not relative) so the player CAN match it by
    // climbing/diving to the same plane and re-open a firing solution.
    const _desOff = { above:+12, level:0, below:-12 }[G.enemyDesiredElevation] ?? 0;
    const _baseY = _desOff + Math.sin(now*0.16+0.4)*_vertAmp;
    const _baseZ = _bearZ + Math.sin(now*0.22+0.7)*2.2 + Math.sin(now*0.13)*_orbitAmp;

    if (G.enemyManeuverState==='angling') {
      const roll={fore:0,aft:Math.PI*0.15,port:0.25,starboard:-0.25}[G.enemyPreferredSector]||0;
      const zOff={port:9, starboard:-9, fore:0, aft:0}[G.enemyPreferredSector]||0;
      mesh_enemyGroup.rotation.y=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.y,Math.PI+roll*0.6,0.06);
      mesh_enemyGroup.rotation.z=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.z,roll*0.5,0.06);
      mesh_enemyGroup.rotation.x=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.x,0,0.05);
      mesh_enemyGroup.position.y=THREE.MathUtils.lerp(mesh_enemyGroup.position.y, _baseY, 0.04);
      mesh_enemyGroup.position.z=THREE.MathUtils.lerp(mesh_enemyGroup.position.z, _baseZ+zOff, 0.04);
    } else if (G.enemyManeuverState==='torpedocharge') {
      mesh_enemyGroup.rotation.z=Math.sin(now*12)*0.12;
      mesh_enemyGroup.rotation.x=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.x,0,0.05);
      mesh_enemyGroup.position.x=THREE.MathUtils.lerp(mesh_enemyGroup.position.x, mesh_defiant.position.x+rangeDist*0.7, 0.035);
      mesh_enemyGroup.position.y=THREE.MathUtils.lerp(mesh_enemyGroup.position.y, _baseY, 0.05);
      mesh_enemyGroup.position.z=THREE.MathUtils.lerp(mesh_enemyGroup.position.z, _baseZ, 0.05);
    } else {
      mesh_enemyGroup.rotation.y=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.y,Math.PI,0.04);
      // Bank into the lateral weave (roll) and pitch into the climb/dive
      const _latVel  = Math.cos(now*0.13)*_orbitAmp*0.13;
      const _vertVel = Math.cos(now*0.16+0.4)*_vertAmp*0.16;
      mesh_enemyGroup.rotation.z=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.z, _latVel*0.06, 0.04);
      mesh_enemyGroup.rotation.x=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.x, _vertVel*0.05, 0.04);
      mesh_enemyGroup.position.y=THREE.MathUtils.lerp(mesh_enemyGroup.position.y, _baseY, 0.03);
      mesh_enemyGroup.position.z=THREE.MathUtils.lerp(mesh_enemyGroup.position.z, _baseZ, 0.03);
    }
    // Vertical firing relationship — gates dorsal/ventral weapons. Hysteresis
    // band (enter at 7, leave at 4) prevents button flicker as the enemy weaves.
    const _dy = mesh_enemyGroup.position.y - mesh_defiant.position.y;
    const _prevElev = G.enemyElevation || 'level';
    const _enter = 7, _leave = 4;
    if (_dy > (_prevElev === 'above' ? _leave : _enter))      G.enemyElevation = 'above';
    else if (_dy < -(_prevElev === 'below' ? _leave : _enter)) G.enemyElevation = 'below';
    else G.enemyElevation = 'level';

    if (G.enemyRammingRun) {
      const rp=1-G.enemyRammingTimer/4000;
      mesh_enemyGroup.position.x=THREE.MathUtils.lerp(mesh_enemyGroup.position.x,mesh_defiant.position.x+8,rp*0.08);
    }

    // Enemy cloaking (only traverse when not fully opaque)
    const eOp=G.enemyCloaked?0.0:G.enemyCloakVulnTimer>0?0.25+Math.sin(now*18)*0.25:1.0;
    if (eOp < 1.0 || G.enemyCloakVulnTimer > 0) {
      mesh_enemyGroup.traverse(child=>{ if(child.isMesh&&child.material){child.material.transparent=eOp<1;child.material.opacity=THREE.MathUtils.lerp(child.material.opacity??1,eOp,0.10);} });
    }

    // Enemy hull damage
    const eHullPct = G.running && G.threat.hull ? G.threat.hull / G.threat.maxHull : 1;
    if (eHullPct < 0.30) _applyHullDamageColour(mesh_enemyGroup, eHullPct, false);

    // Enemy shield bubble
    shield_enemy.position.copy(mesh_enemyGroup.position); shield_enemy.rotation.y=-now*0.25;
    if (G.enemyCloaked) { shield_enemy.material.opacity=0; }
    else if (G.shieldHitFlash.enemy.timer>0) {
      const f=G.shieldHitFlash.enemy.timer/600; shield_enemy.material.opacity=0.40*f;
      shield_enemy.material.emissive.setRGB(1.0,f*0.3,f*0.1); shield_enemy.material.color.setRGB(1.0,0.3,0.1);
    } else {
      const eShAvg=G.threat.shields?['fore','port','starboard','aft'].reduce((a,s)=>a+(G.threat.shields[s]||0),0)/4:0;
      shield_enemy.material.opacity=0.04+(G.running&&cfg.shields?eShAvg/(cfg.shields.maxSectorValue||cfg.shields.fore||1):0)*0.07;
      shield_enemy.material.emissive.setRGB(0.5,0.1,0.1);
    }
    engine_glow_enemy.position.copy(mesh_enemyGroup.position); engine_glow_enemy.position.x+=10;
  }

  // ── Ramming run trajectory indicator ────────────────────────
  if (G.running && G.enemyRammingRun) {
    if (!ramming_line) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        mesh_enemyGroup.position.clone(),
        mesh_defiant.position.clone()
      ]);
      ramming_line = new THREE.Line(geo,
        new THREE.LineBasicMaterial({ color:0xff1100, transparent:true, opacity:0.9 }));
      THREE_scene.add(ramming_line);
    }
    // Update endpoints each frame
    const pos = ramming_line.geometry.attributes.position;
    pos.setXYZ(0, mesh_enemyGroup.position.x, mesh_enemyGroup.position.y, mesh_enemyGroup.position.z);
    pos.setXYZ(1, mesh_defiant.position.x, mesh_defiant.position.y, mesh_defiant.position.z);
    pos.needsUpdate = true;
    // Green when we're in an evasive posture that can dodge the run; red otherwise
    const _dodging = G.picardManoeuverActive || G.evasiveActive || G.evasiveAlphaActive
                  || G.comeAboutActive || G.helmSpeed === 'full';
    ramming_line.material.color.setHex(_dodging ? 0x33ff66 : 0xff1100);
    ramming_line.material.opacity = 0.45 + Math.sin(now * 14) * 0.45;
    // Particle bursts along the approach vector
    if (Math.random() < 0.4) {
      const t = Math.random();
      const px = mesh_enemyGroup.position.x + (mesh_defiant.position.x - mesh_enemyGroup.position.x) * t;
      const py = mesh_enemyGroup.position.y * (1-t) + mesh_defiant.position.y * t;
      const pz = mesh_enemyGroup.position.z * (1-t) + mesh_defiant.position.z * t;
      spawnThreeParticles(px, py, pz, 1.0, 0.15, 0.05, 2);
    }
  } else if (ramming_line) {
    THREE_scene.remove(ramming_line);
    ramming_line.geometry.dispose(); ramming_line.material.dispose();
    ramming_line = null;
  }

  // ── Weapon beams — 3D tube meshes with glow + core ──────────
  const elapsed = THREE_clock.getElapsedTime();
  const bCols = _PLAYER_BEAM_COL;

  G.renderedBeamsVector.forEach(b => {
    // ── Burst flash: expanding shockwave ring ──
    if (b.type === 'burst_flash' && !b._three_spawned) {
      b._three_spawned = true;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.35, 8, 32),
        new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.95 })
      );
      ring.position.copy(mesh_defiant.position);
      ring.rotation.x = Math.PI / 2;
      ring._bornAt = elapsed; ring._duration = 0.55;
      THREE_scene.add(ring);
      burst_effects.push(ring);
      // Also a second tighter ring in blue
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.2, 6, 28),
        new THREE.MeshBasicMaterial({ color:0x88ccff, transparent:true, opacity:0.75 })
      );
      ring2.position.copy(mesh_defiant.position);
      ring2.rotation.x = Math.PI / 2;
      ring2._bornAt = elapsed; ring2._duration = 0.4;
      THREE_scene.add(ring2);
      burst_effects.push(ring2);
      spawnThreeParticles(mesh_defiant.position.x, mesh_defiant.position.y, mesh_defiant.position.z, 0.6, 0.85, 1.0, 18);
      return;
    }
    if (b._three_spawned || b.type === 'burst_flash') return;
    b._three_spawned = true;

    const isEnemy = !!b.fromEnemy;

    // ── Weapon origin: use per-ship / per-faction hardpoints ──────
    let fromV, toV;
    if (isEnemy) {
      const pts = _ENEMY_HP[G.enemyArchetype] || [ [-5,0,0] ];
      const off = pts[Math.floor(Math.random() * pts.length)];
      fromV = mesh_enemyGroup.position.clone().add(
        new THREE.Vector3(off[0], off[1], off[2]).applyQuaternion(mesh_enemyGroup.quaternion));
      // Target: player hull biased toward the attacked sector, rotated by player facing
      const sOff = _PLAYER_SECTOR_HIT[b.targetSector] || [0,0,0];
      toV = mesh_defiant.position.clone().add(new THREE.Vector3(
        sOff[0] + (Math.random()-0.5)*1.5,
        sOff[1] + (Math.random()-0.5)*1.2,
        sOff[2] + (Math.random()-0.5)*1.5
      ).applyQuaternion(mesh_defiant.quaternion));
    } else {
      const shipHp = _PLAYER_HP[G.playerShipKey] || _PLAYER_HP.defiant;
      const wk = b.weaponKey || b.type;
      const off = shipHp[wk] || shipHp[b.type] || [+5, 0, 0];
      fromV = mesh_defiant.position.clone().add(
        new THREE.Vector3(off[0], off[1], off[2]).applyQuaternion(mesh_defiant.quaternion));
      // Target: enemy hull with small random scatter
      toV = mesh_enemyGroup.position.clone().add(new THREE.Vector3(
        (Math.random()-0.5)*3 - 3,
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*3
      ));
    }

    const col = isEnemy
      ? (b.isPlasma ? 0x00ff66 : (_FACTION_BEAM_COL[b.faction || ENEMY_CONFIGS[G.enemyArchetype]?.faction] || 0xff4422))
      : (bCols[b.weaponKey] || bCols[b.type] || 0xffffff);
    const dur = b.duration / 1000;

    // Outer glow tube
    const glowTube = _makeTubeMesh(fromV, toV, 0.22, col, 0.30);
    if (glowTube) {
      glowTube._bornAt = elapsed; glowTube._duration = dur; glowTube._isGlow = true;
      THREE_scene.add(glowTube); beam_lines.push(glowTube);
    }
    // Bright core tube
    const coreTube = _makeTubeMesh(fromV, toV, 0.08, 0xffffff, 0.92);
    if (coreTube) {
      coreTube._bornAt = elapsed; coreTube._duration = dur; coreTube._isGlow = false;
      THREE_scene.add(coreTube); beam_lines.push(coreTube);
    }
    // Muzzle flash particles
    const cr=((col>>16)&0xff)/255, cg=((col>>8)&0xff)/255, cb=(col&0xff)/255;
    spawnThreeParticles(fromV.x, fromV.y, fromV.z, cr, cg, cb, 8);
  });

  // Fade and remove beam tubes
  beam_lines = beam_lines.filter(m => {
    const age = elapsed - m._bornAt;
    const f = Math.max(0, 1 - age / m._duration);
    m.material.opacity = m._isGlow ? f * 0.30 : f * 0.92;
    if (f <= 0) { THREE_scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
    return true;
  });

  // Animate burst flash rings
  burst_effects = burst_effects.filter(ring => {
    const age = elapsed - ring._bornAt;
    const f = Math.max(0, 1 - age / ring._duration);
    ring.scale.setScalar(1 + (1 - f) * 7);
    ring.material.opacity = f * (ring._duration < 0.5 ? 0.75 : 0.95);
    if (f <= 0) { THREE_scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); return false; }
    return true;
  });

  // ── Torpedoes ────────────────────────────────────────────────
  G.inFlightTorpedoes.forEach(t => {
    if (t._three_mesh) return;
    let fromV, toV;
    if (t.fromEnemy) {
      // Enemy torpedo: fire from forward-facing weapons bay
      const pts = _ENEMY_HP[G.enemyArchetype] || [ [-5,0,0] ];
      const off = pts[0];  // use primary forward hardpoint for torpedoes
      fromV = mesh_enemyGroup.position.clone().add(
        new THREE.Vector3(off[0], off[1], off[2]).applyQuaternion(mesh_enemyGroup.quaternion));
      toV   = mesh_defiant.position.clone();
    } else {
      // Player torpedo: fire from correct tube
      const shipHp = _PLAYER_HP[G.playerShipKey] || _PLAYER_HP.defiant;
      const wk = t.isAft ? (t.isPhoton ? 'torpedo_photon_aft' : 'torpedo_quantum_aft') : (t.isPhoton ? 'photon' : 'torpedoes');
      const off = shipHp[wk] || [+6.5, -0.7, 0];
      fromV = mesh_defiant.position.clone().add(
        new THREE.Vector3(off[0], off[1], off[2]).applyQuaternion(mesh_defiant.quaternion));
      toV   = mesh_enemyGroup.position.clone();
    }
    // Enemy: plasma=green, other=red. Player quantum: blue-white. Player photon: orange-red.
    const col = t.fromEnemy ? (t.isPlasma ? 0x00ff66 : 0xff2200) : (t.isPhoton ? 0xff6600 : 0x99ccff);
    const geo   = new THREE.SphereGeometry(0.5, 8, 6);
    const mat   = new THREE.MeshPhongMaterial({ color:col, emissive:col, emissiveIntensity:2, transparent:true, opacity:0.9 });
    const mesh  = new THREE.Mesh(geo, mat);
    mesh.position.copy(fromV); mesh._target = toV.clone(); mesh._origin = fromV.clone(); mesh._progress = 0;
    mesh._fromEnemy = t.fromEnemy;
    THREE_scene.add(mesh); t._three_mesh = mesh; torp_meshes.push(mesh);
  });

  torp_meshes = torp_meshes.filter(m => {
    const gt = G.inFlightTorpedoes.find(t => t._three_mesh === m);
    if (!gt) {
      // Impact shockwave — expanding wireframe sphere
      const swMat = new THREE.MeshBasicMaterial({
        color: m.material.color.getHex(), transparent:true, opacity:0.75, wireframe:true
      });
      const sw = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), swMat);
      sw.position.copy(m.position);
      sw._bornAt = elapsed; sw._duration = 0.5;
      THREE_scene.add(sw); impact_effects.push(sw);
      // Solid inner flash
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 8, 6),
        new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.9 })
      );
      flash.position.copy(m.position);
      flash._bornAt = elapsed; flash._duration = 0.18;
      THREE_scene.add(flash); impact_effects.push(flash);
      // Particle burst at impact
      const c = m.material.color;
      spawnThreeParticles(m.position.x, m.position.y, m.position.z, c.r, c.g, c.b, 22);
      if (!m._fromEnemy) _camShake = Math.min(1.5, _camShake + 0.5);
      THREE_scene.remove(m); m.geometry.dispose(); m.material.dispose();
      return false;
    }
    m._progress = 1 - (gt.timeToImpact / 3500);
    m.position.lerpVectors(m._origin, m._target, Math.max(0, Math.min(1, m._progress)));
    m.position.y += Math.sin(m._progress * Math.PI) * 2;
    if (Math.random() < 0.35) {
      const c = m.material.color;
      spawnThreeParticles(m.position.x, m.position.y, m.position.z, c.r, c.g, c.b, 2);
    }
    return true;
  });

  // Animate impact shockwaves
  impact_effects = impact_effects.filter(sw => {
    const age = elapsed - sw._bornAt;
    const f = Math.max(0, 1 - age / sw._duration);
    sw.scale.setScalar(1 + (1 - f) * 9);
    sw.material.opacity = f * (sw._duration < 0.25 ? 0.9 : 0.75);
    if (f <= 0) { THREE_scene.remove(sw); sw.geometry.dispose(); sw.material.dispose(); return false; }
    return true;
  });

  // ── Particle system update ───────────────────────────────────
  let pDirty = false;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (particle_life[i] > 0) {
      particle_life[i] -= dt;
      particle_positions[i*3]   += particle_velocities[i*3]   * dt * 8;
      particle_positions[i*3+1] += particle_velocities[i*3+1] * dt * 8;
      particle_positions[i*3+2] += particle_velocities[i*3+2] * dt * 8;
      const f = Math.max(0, particle_life[i]);
      particle_colours[i*3]   *= f < 0.1 ? 0.8 : 1;
      particle_colours[i*3+1] *= f < 0.1 ? 0.8 : 1;
      particle_colours[i*3+2] *= f < 0.1 ? 0.8 : 1;
      pDirty = true;
    }
  }
  if (pDirty) {
    particle_system.geometry.attributes.position.needsUpdate = true;
    particle_system.geometry.attributes.color.needsUpdate = true;
  }

  // Consume G.damageParticles → Three.js particles + camera shake
  if (G.damageParticles.length > 0) {
    G.damageParticles.forEach(p => {
      const ox = p.target==='player' ? mesh_defiant.position.x : mesh_enemyGroup.position.x;
      const oz = p.target==='player' ? mesh_defiant.position.z : mesh_enemyGroup.position.z;
      const isRed = p.col === C.red;
      spawnThreeParticles(ox, 0, oz, isRed?1:1, isRed?0.2:0.6, isRed?0.1:0.1, 6);
      if (p.target==='player') _camShake = Math.min(3.5, _camShake + 1.2);
      else _camShake = Math.min(1.5, _camShake + 0.4);
    });
    G.damageParticles = [];
  }

  // Impulse engine glow — orange-red, scales with helm speed
  if (impulse_glow_player) {
    const _impGlow = { stop:0.2, maneuvering:0.5, half:1.0, full:2.2 }[G.helmSpeed] ?? 1.0;
    impulse_glow_player.intensity = G.cloaked ? 0 : _impGlow * (G.systems.engines.health / 100);
    impulse_glow_player.position.set(mesh_defiant.position.x + 4, mesh_defiant.position.y, mesh_defiant.position.z);
  }
  // Hull damage sparks — emit when hull below 50%, more frequent at lower hull
  _tickHullSparks(dt);
  if (G.running && !G.dead && !G.cloaked) {
    const hullPct = G.player.hull / G.player.maxHull;
    if (hullPct < 0.50) {
      _hullSparkTimer += dt;
      const sparkInterval = hullPct < 0.20 ? 0.15 : hullPct < 0.35 ? 0.35 : 0.8;
      if (_hullSparkTimer >= sparkInterval) {
        _hullSparkTimer = 0;
        const sparkCol = hullPct < 0.20 ? 0xff2200 : 0xff6600;
        _emitHullSparks(mesh_defiant.position, hullPct < 0.20 ? 6 : hullPct < 0.35 ? 3 : 2, sparkCol);
      }
    } else {
      _hullSparkTimer = 0;
    }
  }

  G.renderedBeamsVector = G.renderedBeamsVector.filter(b => performance.now() - b.trackingStartTime < b.duration);
  THREE_renderer.render(THREE_scene, THREE_camera);
}
