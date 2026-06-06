'use strict';

// ============================================================
// THREE.JS 3D SPATIAL BATTLE VIEW
// Ship meshes, weapon beams, torpedoes, particles, camera.
// Depends on: state.js (G, C, ENEMY_CONFIGS, HELM_SPEED_CONFIG)
// ============================================================

// ============================================================
// REAL SHIP MODEL LOADING SYSTEM
// Loads STL/OBJ files from /models/. Falls back to procedural
// geometry instantly while the real model loads in background.
// ============================================================

// Cached loaded models (key → THREE.Group, ready to clone)
const _MODEL_CACHE = {};

// Per-ship file config
const _MODEL_CONFIG = {
  defiant:              { file:'models/defiant.stl',              format:'stl', targetSize:16 },
  enterprise_e:         { file:'models/enterprise_e.stl',         format:'stl', targetSize:20 },
  ktinga:               { file:'models/ktinga.stl',               format:'stl', targetSize:16 },
  vor_cha:              { file:'models/vor_cha.stl',              format:'stl', targetSize:18 },
  romulan_bop:          { file:'models/romulan_bop.stl',          format:'stl', targetSize:14 },
  romulan_warbird:      { file:'models/romulan_warbird.stl',      format:'stl', targetSize:22 },
  cardassian_scout:     { file:'models/cardassian_scout.stl',     format:'stl', targetSize:12 },
  galor_class:          { file:'models/galor_class.stl',          format:'stl', targetSize:16 },
  jem_hadar_fighter:    { file:'models/jem_hadar_fighter.stl',    format:'stl', targetSize:12 },
  jem_hadar_battleship: { file:'models/jem_hadar_battleship.obj', format:'obj', targetSize:18 },
  borg_probe:           { file:'models/borg_probe.stl',           format:'stl', targetSize:16 },
};

// Per-ship rotation — derived from actual STL bounding-box analysis.
// Each model's dominant (longest) axis and height axis are known;
// rotations align the ship so nose→+X and height→+Y for Three.js.
// Flip y by Math.PI if a ship appears to face backward.
const _MODEL_ROTATIONS = {
  // Long axis Z, Y-up native → rotate Z to +X
  defiant:              { x:0,            y:Math.PI/2,   z:0 },
  // Y-long/Z-up STL; nose at −Y → x:-π/2 z:+π/2 maps −Y→+X, +Z→+Y(dorsal up)
  enterprise_e:         { x:-Math.PI/2,   y:0,           z: Math.PI/2 },
  // Native long axis Y (nose), height on Z; x:π/2 + z:π/2 → nose+X, dorsal+Y.
  // (Was y:π, which left the long axis vertical — ship appeared to point up.)
  ktinga:               { x:Math.PI/2,    y:0,           z:Math.PI/2 },
  // Native long axis Y (nose), height on Z; x:π/2 + z:π/2 → nose+X, dorsal+Y.
  // (Was y:−π/2, which left the long axis vertical — ship appeared to point up.)
  vor_cha:              { x:Math.PI/2,    y:0,           z:Math.PI/2 },
  // Long axis X already = forward, height Z → x:-π/2 makes Z→Y(up)
  romulan_bop:          { x:-Math.PI/2,   y:0,           z:0 },
  // Native long axis Y (nose), tall ring on X, thin width Z; z:−π/2 maps
  // long axis → +X (nose) and ring height → +Y. (Was x:−π/2 y:π/2, which
  // left the hull broadside/vertical — ship faced sideways.)
  romulan_warbird:      { x:0,            y:0,           z:-Math.PI/2 },
  // Empirically verified: nose+up both 1.000
  cardassian_scout:     { x:Math.PI/2,    y:0,          z:-Math.PI/2 },
  // Native long axis Y (nose along Y), height on Z; x:π/2 + z:π/2 maps
  // long axis → +X (nose) and height → +Y (dorsal up). (Was y:−π/2, which
  // left the long axis vertical — the ship appeared to "point down".)
  galor_class:          { x:Math.PI/2,    y:0,           z:Math.PI/2 },
  // Empirically verified: nose+up both 1.000
  jem_hadar_fighter:    { x:Math.PI/2,    y:0,           z:Math.PI/2 },
  // OBJ; Y-up native, nose along Z; y:π/2 maps nose → +X, keeps dorsal +Y.
  // (Was x:−π/2, which tipped the long nose axis vertical — pointed up.)
  jem_hadar_battleship: { x:0,            y:Math.PI/2,   z:0 },
  // Symmetric cube — rotation irrelevant
  borg_probe:           { x:0,            y:0,           z:0 },
};

// Reusable Vector3 for camera lookAt target — avoids per-frame allocation
const _camLookAtTarget = new THREE.Vector3();

// Faction PBR materials — applied to single-colour STL geometry
// MeshStandardMaterial gives metallic hull plating with directional lighting
function _makeShipMaterial(matKey) {
  const defs = {
    player_defiant: { color:0x1e3060, metalness:0.60, roughness:0.38, emissive:0x050e22, emissiveIntensity:0.5 },
    player_ent:     { color:0x1a2850, metalness:0.60, roughness:0.32, emissive:0x050a1a, emissiveIntensity:0.5 },
    Klingon:        { color:0x2a0a08, metalness:0.65, roughness:0.52, emissive:0x0c0202, emissiveIntensity:0.4 },
    Romulan:        { color:0x0a2a0a, metalness:0.62, roughness:0.46, emissive:0x021002, emissiveIntensity:0.4 },
    Cardassian:     { color:0x2a1808, metalness:0.48, roughness:0.58, emissive:0x0e0800, emissiveIntensity:0.4 },
    Dominion:       { color:0x18082a, metalness:0.72, roughness:0.36, emissive:0x080010, emissiveIntensity:0.5 },
    Borg:           { color:0x001a10, metalness:0.82, roughness:0.24, emissive:0x002210, emissiveIntensity:0.6 },
  };
  const d = defs[matKey] || defs.Klingon;
  return new THREE.MeshStandardMaterial({
    color:             d.color,
    metalness:         d.metalness,
    roughness:         d.roughness,
    emissive:          d.emissive,
    emissiveIntensity: d.emissiveIntensity,
  });
}

// Which material key to use for each ship
const _MODEL_MAT_KEY = {
  defiant:'player_defiant', enterprise_e:'player_ent',
  ktinga:'Klingon', vor_cha:'Klingon',
  romulan_bop:'Romulan', romulan_warbird:'Romulan',
  cardassian_scout:'Cardassian', galor_class:'Cardassian',
  jem_hadar_fighter:'Dominion', jem_hadar_battleship:'Dominion',
  borg_probe:'Borg',
};

// Core load function — returns cloned group via callback, or null on failure/missing file
function _loadShipModel(key, callback) {
  // Cache hit — instant
  if (_MODEL_CACHE[key]) { callback(_cloneModel(key)); return; }

  const cfg = _MODEL_CONFIG[key];
  if (!cfg) { callback(null); return; }

  const matKey  = _MODEL_MAT_KEY[key] || 'Klingon';
  const rotCfg  = _MODEL_ROTATIONS[key] || { x:0, y:0, z:0 };

  function _processLoaded(geoOrGroup) {
    let mesh;
    if (geoOrGroup.isBufferGeometry) {
      // STL → raw BufferGeometry
      // Safety cap: 3D print models can have 500K+ triangles — skip anything over 100K
      const triCount = geoOrGroup.index
        ? geoOrGroup.index.count / 3
        : (geoOrGroup.attributes.position?.count || 0) / 3;
      if (triCount > 100000) {
        console.warn(`[Models] ${key}: ${Math.round(triCount).toLocaleString()} triangles — too heavy for web, using procedural`);
        callback(null);
        return;
      }
      geoOrGroup.computeVertexNormals();
      mesh = new THREE.Mesh(geoOrGroup, _makeShipMaterial(matKey));
    } else {
      // OBJ → Group with children
      mesh = geoOrGroup;
      mesh.traverse(c => {
        if (c.isMesh) c.material = _makeShipMaterial(matKey);
      });
    }

    // Apply orientation tuning
    mesh.rotation.set(rotCfg.x, rotCfg.y, rotCfg.z);

    // Auto-scale: fit longest bounding-box dimension to targetSize
    const box    = new THREE.Box3().setFromObject(mesh);
    const size   = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) mesh.scale.setScalar(cfg.targetSize / maxDim);

    // Centre at origin so position offsets work correctly
    box.setFromObject(mesh);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    mesh.position.sub(centre);

    // Wrap in group so external position/rotation is independent of model pivot
    const group = new THREE.Group();
    group.add(mesh);
    _MODEL_CACHE[key] = group;
    console.log(`[Models] Loaded: ${key} (${cfg.file})`);
    callback(_cloneModel(key));
  }

  function _onError(err) {
    console.warn(`[Models] Failed to load ${key} (${cfg.file}) — using procedural geometry`, err);
    callback(null);
  }

  if (cfg.format === 'stl') {
    const loader = new THREE.STLLoader();
    loader.load(cfg.file, _processLoaded, undefined, _onError);
  } else {
    const loader = new THREE.OBJLoader();
    loader.load(cfg.file, _processLoaded, undefined, _onError);
  }
}

// Deep clone a cached model (geometry is shared, materials are independent)
function _cloneModel(key) {
  const src = _MODEL_CACHE[key];
  if (!src) return null;
  const clone = src.clone(true);
  clone.traverse(c => {
    if (c.isMesh && c.material) c.material = c.material.clone();
  });
  return clone;
}

// Background preload — loads all models in size order so smallest arrive first.
// Called from initThreeScene(). Models are cached and ready before the player
// finishes selecting their station (the 15s pre-battle briefing also helps).
function _preloadAllModels() {
  const order = [
    'romulan_bop','defiant','enterprise_e',          // ~1–2 MB each
    'jem_hadar_fighter','cardassian_scout',           // ~3–5 MB
    'jem_hadar_battleship','romulan_warbird',         // ~5–6 MB
    'vor_cha','galor_class',                          // ~7–12 MB
    'ktinga','borg_probe',                            // ~23–27 MB — load last
  ];
  let i = 0;
  function next() {
    if (i >= order.length) return;
    _loadShipModel(order[i++], next);  // sequential — avoids saturating connection
  }
  setTimeout(next, 1500);  // slight delay so scene init finishes first
}

// ── Hull-damage emissive update helper (works on both model and procedural meshes)
function _applyHullDamageColour(group, hullPct, isPlayer) {
  group.traverse(child => {
    if (!child.isMesh || !child.material) return;
    if (isPlayer) {
      child.material.emissive.setRGB(
        hullPct < 0.35 ? 0.14 + (1 - hullPct) * 0.08 : 0.04,
        hullPct < 0.35 ? 0.02 : 0.06,
        hullPct < 0.35 ? 0.02 : 0.16
      );
    } else {
      if (hullPct < 0.30) child.material.emissive.setRGB(0.22 + Math.sin(Date.now()*0.004)*0.08, 0.04, 0.04);
    }
  });
}

// Faction colour palettes — engine glow (deep) vs weapon beams (bright)
const _FACTION_GLOW_COL  = { Klingon:0xff2200, Romulan:0x00cc44, Cardassian:0xffaa00, Dominion:0x8822ff, Borg:0x00cc66 };
const _FACTION_BEAM_COL  = { Klingon:0xff4422, Romulan:0x44ff44, Cardassian:0xffaa00, Dominion:0xaa44ff, Borg:0x00ff88 };
// Nacelle end offsets per ship (local space, relative to group origin)
const _NAC_OFFSET = { defiant:{ x:-3.1, y:0.0 }, enterprise_e:{ x:-9.3, y:-2.4 } };
// Player weapon beam colours — canon-accurate
// Defiant pulse cannons + Type-XII phasers: amber-orange. Nose emitter: deep orange.
// Quantum torpedoes: blue-white. Photon torpedoes: orange-red.
const _PLAYER_BEAM_COL = {
  cannon_pu: 0xff9900, cannon_pl: 0xff9900, cannon_su: 0xff9900, cannon_sl: 0xff9900,
  nose_beam: 0xff6600, torpedoes: 0x99ccff, photon: 0xff6600,
};

// ── Weapon hardpoints (world-space offsets from ship position) ──────────────
// Player ship faces +X. Port = +Z, Starboard = -Z.
// Defiant targetSize=16 → bow ≈ +8, stern ≈ -8 from centre.
// Enterprise targetSize=20 → bow ≈ +10, stern ≈ -10.
const _PLAYER_HP = {
  defiant: {
    cannon_pu:           [+5.0, +0.5, +3.5],  // Port Upper pulse cannon (outer upper nacelle flank)
    cannon_pl:           [+3.0, -0.5, +3.5],  // Port Lower pulse cannon (inner lower nacelle flank)
    cannon_su:           [+5.0, +0.5, -3.5],  // Stbd Upper pulse cannon
    cannon_sl:           [+3.0, -0.5, -3.5],  // Stbd Lower pulse cannon
    nose_beam:           [+8.0,  0.0,  0.0],  // Heavy nose emitter — bow tip
    torpedoes:           [+6.5, -0.7,  0.0],  // Forward torpedo launcher (under bow)
    photon:              [+6.5, -0.7,  0.0],
    torpedo_quantum_aft: [-6.5, -0.3,  0.0],  // Aft torpedo tube
    torpedo_photon_aft:  [-6.5, -0.3,  0.0],
  },
  enterprise_e: {
    cannon_pu:           [+8.5, +1.5,  0.0],  // Saucer Dorsal Fwd (top of saucer, forward arc)
    phaser_saucer_port:  [ 0.0, +1.0, +7.5],  // Saucer Port Array (port saucer edge)
    cannon_pl:           [+6.0, -0.3,  0.0],  // Saucer Ventral Fwd (underside forward)
    phaser_saucer_stbd:  [ 0.0, +1.0, -7.5],  // Saucer Stbd Array (stbd saucer edge)
    cannon_su:           [+4.0, -1.5,  0.0],  // Stardrive Fwd Arrays (forward stardrive hull)
    phaser_secondary:    [-1.0, -1.5,  0.0],  // Secondary Hull Arrays
    cannon_sl:           [-2.0, +0.5,  0.0],  // Saucer Aft Arrays
    nose_beam:           [+2.0, -1.5,  0.0],  // Primary Stardrive Emitter (deflector housing)
    phaser_aft_emitter:  [-9.0, -1.5,  0.0],  // Aft Stardrive Emitter
    torpedoes:           [+3.0, -1.1,  0.0],  // Fwd Quantum Tube A
    torpedo_quantum_b:   [+3.0, -1.1, +0.5],  // Fwd Quantum Tube B (offset)
    photon:              [+3.0, -1.1, -0.5],  // Fwd Photon Tube
    torpedo_quantum_aft: [-9.0, -0.5,  0.0],  // Aft Quantum Tube
    torpedo_photon_aft:  [-9.0, -0.5,  0.0],  // Aft Photon Tube
  },
};

// Enemy hardpoints — multiple points per archetype, picked randomly per shot.
// Enemy faces -X (rotation.y = π) so "forward" weapons originate from -X offset.
// Borg cube is omnidirectional — all 6 faces are valid origins.
const _ENEMY_HP = {
  ktinga:               [ [-5.0, 0.0, 0.0], [-1.5, 0.0,+4.0], [-1.5, 0.0,-4.0] ],
  vor_cha:              [ [-6.0,-0.5, 0.0], [-2.5, 0.0,+4.0], [-2.5, 0.0,-4.0] ],
  romulan_bop:          [ [-2.0,-0.5,+3.5], [-2.0,-0.5,-3.5], [-4.0,-0.5, 0.0] ],
  romulan_warbird:      [ [-8.0, 0.0, 0.0], [-3.0,+1.0,+3.0], [-3.0,+1.0,-3.0], [-3.0,-1.0, 0.0] ],
  cardassian_scout:     [ [-4.5,+0.5, 0.0], [-2.0, 0.0,+1.5], [-2.0, 0.0,-1.5] ],
  galor_class:          [ [-4.0,+0.5, 0.0], [-2.0, 0.0,+2.5], [-2.0, 0.0,-2.5] ],
  jem_hadar_fighter:    [ [-5.0,-0.5, 0.0], [-4.0,-0.5,+2.0], [-4.0,-0.5,-2.0] ],
  jem_hadar_battleship: [ [-5.0,-0.5, 0.0], [-4.0,-0.5,+2.5], [-4.0,-0.5,-2.5], [-4.0,-0.5,+4.0], [-4.0,-0.5,-4.0] ],
  borg_probe:           [ [ 0.0,+3.5, 0.0], [ 0.0,-3.5, 0.0], [-3.5, 0.0, 0.0], [+3.5, 0.0, 0.0], [ 0.0, 0.0,+3.5], [ 0.0, 0.0,-3.5] ],
};

// Sector-biased hit points on the player hull (where enemy beams land)
const _PLAYER_SECTOR_HIT = {
  fore:      [+4.5, 0.0,  0.0], aft: [-4.5, 0.0, 0.0],
  port:      [ 0.0, 0.0, +3.0], starboard: [0.0, 0.0, -3.0],
};

let THREE_scene, THREE_camera, THREE_renderer, THREE_clock;
let mesh_defiant, mesh_enemy, mesh_enemyGroup;
let mesh_escorts = [];   // wolfpack — extra fighter meshes (one per living non-active member)
let shield_player, shield_enemy;
let grid_helper;
let beam_lines = [];          // holds THREE.Mesh tube objects
let torp_meshes = [];
let burst_effects = [];       // expanding shockwave rings from burst salvo
let impact_effects = [];      // expanding spheres at torpedo impact
let ramming_line = null;      // trajectory indicator during Jem'Hadar ramming run
let mesh_saucer_sep = null;   // independent saucer section mesh (Enterprise-E)
let engine_glow_saucer = null;
let _saucerSepAngle = 0;
let particle_system, particle_positions, particle_colours, particle_velocities, particle_life;
const PARTICLE_COUNT = 800;
let engine_glow_player, engine_glow_enemy;
let impulse_glow_player;   // separate orange-red impulse engine light
let THREE_ready = false;
let _camShake = 0;
let _camOrbitAngle = 0;
let _camOrbitY = 0;

// ── Helper: build a 3D tube mesh between two points ──────────
function _makeTubeMesh(fromV, toV, radius, col, opacity) {
  const dir = new THREE.Vector3().subVectors(toV, fromV);
  const len = dir.length();
  if (len < 0.01) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, len, 5, 1);
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(fromV).add(toV).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// ── Geometry builders (buildDefiant/Ktinga/Vorcha/RomulanWarbird/Enemy/
//     SaucerSep/Sovereign Geometry) — moved to canvas-three-geometry.js ──

function buildShieldMesh(col) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(6,2),
    new THREE.MeshPhongMaterial({ color:col, emissive:col, emissiveIntensity:0.3, transparent:true, opacity:0.08, side:THREE.DoubleSide, depthWrite:false })
  );
}

function buildParticleSystem() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(PARTICLE_COUNT*3);
  const col = new Float32Array(PARTICLE_COUNT*3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col,3));
  const mat = new THREE.PointsMaterial({ size:0.4, vertexColors:true, transparent:true, opacity:0.85, sizeAttenuation:true });
  particle_positions  = pos; particle_colours    = col;
  particle_velocities = new Float32Array(PARTICLE_COUNT*3);
  particle_life       = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i++) { pos[i*3+1] = -999; particle_life[i] = 0; }
  return new THREE.Points(geo, mat);
}

function spawnThreeParticles(x, y, z, colR, colG, colB, count) {
  let spawned = 0;
  for (let i = 0; i < PARTICLE_COUNT && spawned < count; i++) {
    if (particle_life[i] <= 0) {
      particle_positions[i*3]=x; particle_positions[i*3+1]=y; particle_positions[i*3+2]=z;
      const spd=0.5+Math.random()*1.5, theta=Math.random()*Math.PI*2, phi=Math.random()*Math.PI;
      particle_velocities[i*3]=Math.sin(phi)*Math.cos(theta)*spd;
      particle_velocities[i*3+1]=Math.sin(phi)*Math.sin(theta)*spd;
      particle_velocities[i*3+2]=Math.cos(phi)*spd;
      particle_colours[i*3]=colR; particle_colours[i*3+1]=colG; particle_colours[i*3+2]=colB;
      particle_life[i]=1.0+Math.random()*0.8; spawned++;
    }
  }
}

function buildStarfield() {
  // Layer 1 — bright foreground stars (varied star types)
  const N1 = 2500;
  const pos1 = new Float32Array(N1*3), col1 = new Float32Array(N1*3);
  for (let i = 0; i < N1; i++) {
    const r = 300 + Math.random()*250, t = Math.random()*Math.PI*2, p = Math.random()*Math.PI;
    pos1[i*3]   = r*Math.sin(p)*Math.cos(t);
    pos1[i*3+1] = r*Math.sin(p)*Math.sin(t);
    pos1[i*3+2] = r*Math.cos(p);
    const br   = 0.55 + Math.random()*0.45;
    const type = Math.random(); // 0-0.5=white, 0.5-0.7=blue-white, 0.7-0.85=yellow, 0.85-1=orange
    if (type < 0.50) { col1[i*3]=br;        col1[i*3+1]=br;        col1[i*3+2]=br; }
    else if (type < 0.70) { col1[i*3]=br*0.8; col1[i*3+1]=br*0.9; col1[i*3+2]=br; }
    else if (type < 0.85) { col1[i*3]=br;    col1[i*3+1]=br*0.9;  col1[i*3+2]=br*0.6; }
    else                   { col1[i*3]=br;    col1[i*3+1]=br*0.7;  col1[i*3+2]=br*0.4; }
  }
  const geo1 = new THREE.BufferGeometry();
  geo1.setAttribute('position', new THREE.BufferAttribute(pos1, 3));
  geo1.setAttribute('color',    new THREE.BufferAttribute(col1, 3));
  const stars1 = new THREE.Points(geo1, new THREE.PointsMaterial({ size:1.0, vertexColors:true, sizeAttenuation:true }));

  // Layer 2 — faint distant background star haze
  const N2 = 4000;
  const pos2 = new Float32Array(N2*3), col2 = new Float32Array(N2*3);
  for (let i = 0; i < N2; i++) {
    const r = 550 + Math.random()*150, t = Math.random()*Math.PI*2, p = Math.random()*Math.PI;
    pos2[i*3]   = r*Math.sin(p)*Math.cos(t);
    pos2[i*3+1] = r*Math.sin(p)*Math.sin(t);
    pos2[i*3+2] = r*Math.cos(p);
    const br = 0.15 + Math.random()*0.25;
    col2[i*3] = br; col2[i*3+1] = br*0.95; col2[i*3+2] = br*1.1;
  }
  const geo2 = new THREE.BufferGeometry();
  geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  geo2.setAttribute('color',    new THREE.BufferAttribute(col2, 3));
  const stars2 = new THREE.Points(geo2, new THREE.PointsMaterial({ size:0.5, vertexColors:true, sizeAttenuation:true }));

  const group = new THREE.Group();
  group.add(stars1, stars2);
  return group;
}

// Rich nebula background — DS9 Bajoran sector aesthetic
function buildNebula() {
  const group = new THREE.Group();
  const nebulaData = [
    // [hex colour, opacity, width, height, x, y, z, rotX, rotY]
    [0x3a0a00, 0.55, 180, 90,   20, -10, -150,  0.05, 0.2 ],  // deep orange-red gas cloud (aft)
    [0x1a0030, 0.45, 150, 70,  -60,  20, -120, -0.08, -0.3],  // purple nebula (port side)
    [0x001828, 0.40, 120, 60,   80, -15, -100,  0.12, 0.4 ],  // teal nebula (starboard)
    [0x200010, 0.30, 200, 80,    0,  40, -200,  0.2,  0.0 ],  // large dark nebula far back
    [0x0a0020, 0.35, 100, 50, -100,  30, -90,  -0.05, 0.5 ],  // small purple wisp
    [0x300800, 0.25, 90,  40,  120, -25, -80,   0.1, -0.2 ],  // orange filament
  ];
  nebulaData.forEach(([col, op, w, h, x, y, z, rx, ry]) => {
    const mat = new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx; mesh.rotation.y = ry;
    group.add(mesh);
  });
  return group;
}

function initThreeScene() {
  const mount = document.getElementById('spatial-3d-mount');
  if (!mount || typeof THREE === 'undefined') { console.warn('Three.js not available'); return; }
  const w = mount.clientWidth || 500, h = mount.clientHeight || 300;

  THREE_scene  = new THREE.Scene();
  THREE_scene.background = new THREE.Color(0x000004);
  THREE_scene.fog        = new THREE.FogExp2(0x000008, 0.0012);
  THREE_clock  = new THREE.Clock();

  THREE_camera = new THREE.PerspectiveCamera(52, w/h, 0.1, 1200);
  THREE_camera.position.set(-52, 24, 0);
  THREE_camera.lookAt(20, 0, 0);

  THREE_renderer = new THREE.WebGLRenderer({ antialias:true });
  THREE_renderer.setPixelRatio(window.devicePixelRatio || 1);
  THREE_renderer.setSize(w, h);
  THREE_renderer.shadowMap.enabled = true;
  mount.appendChild(THREE_renderer.domElement);
  THREE_renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';

  // Lighting — star system sun + blue rim + combat ambience
  THREE_scene.add(new THREE.AmbientLight(0x080c18, 1.0));
  // Key light — angled "sun" for dramatic hull shading
  const keyL = new THREE.DirectionalLight(0xfff5e0, 1.4); keyL.position.set(120, 80, 40); keyL.castShadow = true; THREE_scene.add(keyL);
  // Blue rim from opposite side — deep space fill
  const rimL = new THREE.DirectionalLight(0x1033aa, 0.5); rimL.position.set(-60, -20, -10); THREE_scene.add(rimL);
  // Warm orange combat zone light — centred on engagement area
  const combatL = new THREE.PointLight(0xff4400, 0.8, 120); combatL.position.set(0, 8, 0); THREE_scene.add(combatL);

  // Saucer separation point light — starts inactive
  engine_glow_saucer = new THREE.PointLight(0xffa040, 0, 30);
  THREE_scene.add(engine_glow_saucer);

  // Static scene — NO grid (space has no grid)
  THREE_scene.add(buildStarfield());
  THREE_scene.add(buildNebula());

  // Player — warp nacelle glow (blue) + impulse engine glow (orange-red, separate)
  mesh_defiant = buildDefiantGeometry();
  mesh_defiant.position.set(-28, 0, 0);
  THREE_scene.add(mesh_defiant);
  engine_glow_player  = new THREE.PointLight(0x4488ff, 2.2, 22); engine_glow_player.position.set(-33, 0, 0); THREE_scene.add(engine_glow_player);
  impulse_glow_player = new THREE.PointLight(0xff4400, 0.8, 14); impulse_glow_player.position.set(-24, 0, 0); THREE_scene.add(impulse_glow_player);
  shield_player = buildShieldMesh(0x4477ff); shield_player.position.copy(mesh_defiant.position); THREE_scene.add(shield_player);

  // Enemy (placeholder — rebuilt on game start)
  mesh_enemyGroup = new THREE.Group();
  mesh_enemy = buildEnemyGeometry('ktinga');
  mesh_enemyGroup.add(mesh_enemy);
  mesh_enemyGroup.position.set(35,0,0); mesh_enemyGroup.rotation.y=Math.PI;
  THREE_scene.add(mesh_enemyGroup);
  engine_glow_enemy = new THREE.PointLight(0xff2200, 2.0, 18); engine_glow_enemy.position.set(42,0,0); THREE_scene.add(engine_glow_enemy);
  shield_enemy = buildShieldMesh(0xff3333); shield_enemy.position.copy(mesh_enemyGroup.position); THREE_scene.add(shield_enemy);

  // Particles
  particle_system = buildParticleSystem(); THREE_scene.add(particle_system);

  THREE_ready = true;

  // Start loading real ship models in the background
  _preloadAllModels();
}


function rebuildPlayerMesh() {
  if (!THREE_ready) return;
  if (mesh_defiant) THREE_scene.remove(mesh_defiant);

  const key = G.playerShipKey || 'defiant';
  engine_glow_player.color.setHex(0x4477ff);

  function _applyPlayerMesh(group) {
    if (!THREE_ready) return;
    if (mesh_defiant) {
      mesh_defiant.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
      THREE_scene.remove(mesh_defiant);
      mesh_defiant = null;
    }
    mesh_defiant = group;
    mesh_defiant.position.set(-28, 0, 0);
    THREE_scene.add(mesh_defiant);
    shield_player.position.copy(mesh_defiant.position);
    _cleanupSaucerSep();
  }

  // Use procedural geometry immediately so scene is never empty
  _applyPlayerMesh(key === 'enterprise_e' ? buildSovereignGeometry() : buildDefiantGeometry());

  // Replace with real model when loaded (instant if already cached)
  _loadShipModel(key, (group) => {
    if (group) _applyPlayerMesh(group);
    // null → model missing/failed — procedural already in place, nothing to do
  });
}

function resizeThreeRenderer() {
  const mount = document.getElementById('spatial-3d-mount');
  if (!mount || !THREE_renderer || !THREE_camera) return;
  const w=mount.clientWidth, h=mount.clientHeight;
  if (w<=0||h<=0) return;
  THREE_camera.aspect=w/h; THREE_camera.updateProjectionMatrix();
  THREE_renderer.setSize(w,h);
}

function rebuildEnemyMesh() {
  if (!THREE_ready || !mesh_enemyGroup) return;

  const arch = G.enemyArchetype;
  const cfg  = ENEMY_CONFIGS[arch];
  engine_glow_enemy.color.setHex(_FACTION_GLOW_COL[cfg?.faction] || 0xff2200);

  function _applyEnemyMesh(group) {
    if (!THREE_ready || !mesh_enemyGroup) return;
    mesh_enemyGroup.children.forEach(c => c.traverse(n => { if (n.isMesh) { n.geometry?.dispose(); n.material?.dispose(); } }));
    while (mesh_enemyGroup.children.length) mesh_enemyGroup.remove(mesh_enemyGroup.children[0]);
    mesh_enemy = group;
    mesh_enemyGroup.add(mesh_enemy);
  }

  // Procedural geometry instantly
  _applyEnemyMesh(buildEnemyGeometry(arch));

  // Replace with real model when loaded
  _loadShipModel(arch, (group) => {
    // Only apply if the archetype hasn't changed since we started loading
    if (group && G.enemyArchetype === arch) _applyEnemyMesh(group);
  });
}

// ── Wolfpack escort meshes ────────────────────────────────────
// One mesh per living non-active pack member (the active member uses the
// existing mesh_enemyGroup). All members are the same fighter model, so the
// meshes are interchangeable "other ship" slots — no rebind needed on a target
// swap; only rebuilt when membership changes (a ship dies) or at battle start.
function _cleanupPackMeshes() {
  mesh_escorts.forEach(e => {
    THREE_scene.remove(e.group);
    e.group.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
  });
  mesh_escorts = [];
}

function rebuildPackMeshes() {
  if (!THREE_ready || !THREE_scene) return;
  _cleanupPackMeshes();
  if (!G.packActive) return;
  const escorts = Math.max(0, (G.pack.filter(m => m.alive).length) - 1);
  for (let i = 0; i < escorts; i++) {
    const group = buildEnemyGeometry(PACK_ARCHETYPE);   // procedural fighter; swapped for model below
    group.rotation.y = Math.PI;
    THREE_scene.add(group);
    const slot = { group };
    mesh_escorts.push(slot);
    _loadShipModel(PACK_ARCHETYPE, (loaded) => {
      if (!loaded || !slot.group || !mesh_escorts.includes(slot)) return;
      THREE_scene.remove(slot.group);
      slot.group.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
      loaded.rotation.y = Math.PI;
      THREE_scene.add(loaded);
      slot.group = loaded;
    });
  }
}

function _cleanupSaucerSep() {
  if (mesh_saucer_sep) {
    THREE_scene.remove(mesh_saucer_sep);
    mesh_saucer_sep.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
    mesh_saucer_sep = null;
  }
  if (engine_glow_saucer) engine_glow_saucer.intensity = 0;
}

// ============================================================
// PER-FRAME RENDER LOOP (_emitHullSparks / _tickHullSparks /
// renderSpatialViewCanvas) — moved to canvas-three-render.js
// ============================================================
