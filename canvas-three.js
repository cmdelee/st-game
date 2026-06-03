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
  // Y-up native STL; nose empirically requires y:π to face +X
  ktinga:               { x:0,            y:Math.PI,     z:0 },
  // Y-up native STL; nose at +Z facing −X in STL → y:−π/2 maps to +X
  vor_cha:              { x:0,            y:-Math.PI/2,  z:0 },
  // Long axis X already = forward, height Z → x:-π/2 makes Z→Y(up)
  romulan_bop:          { x:-Math.PI/2,   y:0,           z:0 },
  // Z-up STL; x:-π/2 corrects up, y:π/2 faces nose +X
  romulan_warbird:      { x:-Math.PI/2,   y:Math.PI/2,  z:0 },
  // Empirically verified: nose+up both 1.000
  cardassian_scout:     { x:Math.PI/2,    y:0,          z:-Math.PI/2 },
  // Y-up native STL; nose at −Y in STL → y:−π/2 maps to +X
  galor_class:          { x:0,            y:-Math.PI/2,  z:0 },
  // Empirically verified: nose+up both 1.000
  jem_hadar_fighter:    { x:Math.PI/2,    y:0,           z:Math.PI/2 },
  // OBJ; Y-up native; nose at +X after x:-π/2 rotation
  jem_hadar_battleship: { x:-Math.PI/2,   y:0,           z:0 },
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

function buildDefiantGeometry() {
  // USS Defiant NX-74205 — Defiant-class escort
  // Key canon facts: quad nacelles mounted flush to hull flanking the bridge;
  // boxy 3-deck slab; wedge/arrowhead bow with deflector; aft impulse engines.
  const group = new THREE.Group();
  const hullMat   = new THREE.MeshPhongMaterial({ color:0x1e2f5a, emissive:0x080e20, specular:0x5577dd, shininess:80 });
  const darkMat   = new THREE.MeshPhongMaterial({ color:0x0e1a36, emissive:0x040810, specular:0x334499, shininess:40 });
  const nacMat    = new THREE.MeshPhongMaterial({ color:0x0e1a36, emissive:0x080e1e, specular:0x4466cc, shininess:50 });
  const glowMat   = new THREE.MeshPhongMaterial({ color:0x4488ff, emissive:0x2255cc, emissiveIntensity:3 });
  const detailMat = new THREE.MeshPhongMaterial({ color:0x283860, emissive:0x0a1228, specular:0x667799, shininess:120 });
  const impMat    = new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xcc2200, emissiveIntensity:2.5 });
  const deflMat   = new THREE.MeshPhongMaterial({ color:0x88bbff, emissive:0x3366cc, emissiveIntensity:1.8 });

  // ── Main hull — squat 3-deck slab ─────────────────────────────
  const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 1.8, 5.0), hullMat);
  group.add(hull);

  // Upper deck plate (bridge level) — slightly narrower, sits on top
  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.5, 3.6), darkMat);
  upperDeck.position.set(0.5, 1.15, 0);
  group.add(upperDeck);

  // ── Bow — angular wedge (6-segment for rounded look) ──────────
  // The Defiant bow is a flattened arrowhead: wide-flat, not a tall pyramid
  const bowGeo = new THREE.CylinderGeometry(0, 2.6, 5.5, 6);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(7.2, 0, 0);
  bow.scale.set(1, 0.28, 0.82);   // very flat, slightly narrower than hull
  group.add(bow);

  // Deflector housing on bow face — glowing blue oval
  const defl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 7), deflMat);
  defl.scale.set(0.5, 0.55, 0.7);
  defl.position.set(9.6, -0.1, 0);
  group.add(defl);

  // ── Aft section — heavier engineering block ────────────────────
  const aft = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.4, 4.2), darkMat);
  aft.position.set(-4.5, 0.1, 0);
  group.add(aft);

  // ── Bridge dome ───────────────────────────────────────────────
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.0, 0.9, 8), detailMat);
  bridge.position.set(2.0, 1.3, 0);
  bridge.scale.set(1, 1, 0.8);
  group.add(bridge);

  // ── Quad nacelles — the Defiant's defining feature ────────────
  // Four nacelles mounted flush to the hull sides, two per side:
  //   Upper pair: just above hull mid-line, z = ±1.5
  //   Lower pair: below hull mid-line,     z = ±2.6
  // Each nacelle is short and stubby (not long swept nacelles)
  const nacGeo = new THREE.CylinderGeometry(0.30, 0.42, 4.8, 8);
  const bussGeo = new THREE.SphereGeometry(0.36, 8, 6);
  const bussMat = new THREE.MeshPhongMaterial({ color:0xff5500, emissive:0xcc2200, emissiveIntensity:2.2 });

  [
    { z: 2.6,  y: 0.0,  label:'upper_port'  },  // outer upper
    { z: -2.6, y: 0.0,  label:'upper_stbd'  },
    { z: 1.5,  y:-0.9,  label:'lower_port'  },  // inner lower (slightly tucked)
    { z:-1.5,  y:-0.9,  label:'lower_stbd'  },
  ].forEach(({ z, y }) => {
    // Short stubby nacelle pod — horizontal, slightly angled
    const nac = new THREE.Mesh(nacGeo, nacMat);
    nac.rotation.z = Math.PI / 2;
    nac.position.set(-1.5, y, z);
    group.add(nac);

    // Bussard collector (forward — positive X end of nacelle)
    const buss = new THREE.Mesh(bussGeo, bussMat);
    buss.position.set(0.8, y, z);
    group.add(buss);

    // Warp field grille (glowing blue strip along nacelle body)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.44), glowMat);
    grille.position.set(-1.5, y, z);
    group.add(grille);

    // Aft nacelle exhaust glow
    const endGlow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), glowMat);
    endGlow.position.set(-3.1, y, z);
    group.add(endGlow);
  });

  // ── Aft impulse engines — glowing red, recessed into hull ─────
  [-1.2, 1.2].forEach(z => {
    const imp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.8), impMat);
    imp.position.set(-6.1, 0.2, z);
    group.add(imp);
  });

  // ── Forward torpedo launcher — under bow ──────────────────────
  const tLaunch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), detailMat);
  tLaunch.position.set(7.0, -0.7, 0);
  group.add(tLaunch);

  // ── Ventral sensor pod (below aft hull) ───────────────────────
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.8), detailMat);
  sensor.position.set(-2.5, -1.2, 0);
  group.add(sensor);

  return group;
}

function buildKtingaGeometry(sz) {
  // K't'inga-class Battle Cruiser — evolved D7 design
  // Distinctive: spherical command pod, long thin neck, swept delta wings
  // with paired nacelle pods on wingtips, aft engineering hull.
  const group   = new THREE.Group();
  const mat     = new THREE.MeshPhongMaterial({ color:0x2a0808, emissive:0x180202, specular:0x882222, shininess:50, transparent:true, opacity:1 });
  const darkMat = new THREE.MeshPhongMaterial({ color:0x1a0404, emissive:0x0e0101, specular:0x661111, shininess:30, transparent:true, opacity:1 });
  const glowMat = new THREE.MeshPhongMaterial({ color:0xff2200, emissive:0xcc1100, emissiveIntensity:2 });

  // Spherical command pod (the "head") — the K't'inga's most distinctive feature
  const pod = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.14, 10, 8), mat);
  pod.scale.set(1.3, 0.85, 0.95);
  pod.position.set(sz * 0.38, 0, 0);
  group.add(pod);

  // Long thin neck connecting pod to engineering hull
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.05, sz*0.08, sz*0.52, 6), darkMat);
  neck.rotation.z = Math.PI / 2; neck.position.set(sz*0.09, 0, 0);
  group.add(neck);

  // Engineering hull — aft blocky section
  const engHull = new THREE.Mesh(new THREE.BoxGeometry(sz*0.28, sz*0.12, sz*0.22), mat);
  engHull.position.set(-sz*0.18, 0, 0);
  group.add(engHull);

  // Aft drum / secondary hull
  const aftDrum = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.09, sz*0.12, sz*0.14, 8), darkMat);
  aftDrum.rotation.z = Math.PI / 2; aftDrum.position.set(-sz*0.34, 0, 0);
  group.add(aftDrum);

  // Delta wings — sweep back from the neck/engineering hull junction
  [1, -1].forEach(side => {
    const wGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      sz*0.05, 0,         0,              // forward root (at neck)
      -sz*0.22, -sz*0.05, side*sz*0.50,  // wingtip aft-outer
      -sz*0.10, 0,        side*sz*0.18,  // inner trailing edge
    ]);
    wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    wGeo.computeVertexNormals();
    group.add(new THREE.Mesh(wGeo, mat));

    // Nacelle pod on wingtip — paired cylinders (upper + lower)
    [0.08, -0.08].forEach(dy => {
      const pod2 = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.04, sz*0.055, sz*0.26, 7), darkMat);
      pod2.rotation.z = Math.PI / 2;
      pod2.position.set(-sz*0.20, dy, side*sz*0.46);
      group.add(pod2);
    });
    // Disruptor tip glow at wingtip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(sz*0.038, 6, 5), glowMat);
    tip.position.set(sz*0.06, 0, side*sz*0.50);
    group.add(tip);
  });

  // Impulse engine — aft glow
  const impMat = new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xdd2200, emissiveIntensity:3 });
  const imp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, sz*0.16), impMat);
  imp.position.set(-sz*0.34, 0, 0);
  group.add(imp);

  return group;
}

function buildVorchaGeometry(sz) {
  // Vor'cha-class Attack Cruiser — ~500m, nearly twice a K't'inga
  // Distinctive: HEAVY angular forward assault module (not a round pod),
  // thick horizontal connecting neck, large secondary hull, less-swept nacelles.
  // Designed to blend Klingon aesthetics with Federation nacelle influence.
  const group   = new THREE.Group();
  const mat     = new THREE.MeshPhongMaterial({ color:0x200606, emissive:0x140202, specular:0x771111, shininess:45, transparent:true, opacity:1 });
  const darkMat = new THREE.MeshPhongMaterial({ color:0x160404, emissive:0x0c0101, specular:0x551111, shininess:25, transparent:true, opacity:1 });
  const glowMat = new THREE.MeshPhongMaterial({ color:0xff2200, emissive:0xcc1100, emissiveIntensity:2.2 });

  // Heavy forward assault module — angular, not spherical (key Vor'cha difference)
  const fwd = new THREE.Mesh(new THREE.BoxGeometry(sz*0.32, sz*0.14, sz*0.24), mat);
  fwd.position.set(sz*0.36, 0, 0);
  group.add(fwd);
  // Forward module nose — truncated wedge
  const fwdNose = new THREE.Mesh(new THREE.CylinderGeometry(0, sz*0.11, sz*0.18, 4), mat);
  fwdNose.rotation.z = -Math.PI / 2;
  fwdNose.position.set(sz*0.55, 0, 0);
  fwdNose.scale.set(1, 0.7, 1.4);
  group.add(fwdNose);
  // Forward disruptor cannon — prominent centerline weapon
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.025, sz*0.04, sz*0.22, 6), darkMat);
  cannon.rotation.z = Math.PI / 2;
  cannon.position.set(sz*0.53, -sz*0.04, 0);
  group.add(cannon);
  const cannonTip = new THREE.Mesh(new THREE.SphereGeometry(sz*0.032, 6, 5), glowMat);
  cannonTip.position.set(sz*0.66, -sz*0.04, 0);
  group.add(cannonTip);

  // Thick horizontal neck — much heavier than K't'inga
  const neck = new THREE.Mesh(new THREE.BoxGeometry(sz*0.42, sz*0.13, sz*0.18), darkMat);
  neck.position.set(sz*0.06, 0, 0);
  group.add(neck);

  // Main engineering hull — large secondary body
  const engHull = new THREE.Mesh(new THREE.BoxGeometry(sz*0.35, sz*0.18, sz*0.30), mat);
  engHull.position.set(-sz*0.20, 0, 0);
  group.add(engHull);

  // Aft section
  const aftHull = new THREE.Mesh(new THREE.BoxGeometry(sz*0.18, sz*0.14, sz*0.26), darkMat);
  aftHull.position.set(-sz*0.42, 0, 0);
  group.add(aftHull);

  // Swept wings — broader and more angular than K't'inga
  [1, -1].forEach(side => {
    const wGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      sz*0.08,  0,         0,            // forward root
      -sz*0.28, -sz*0.04,  side*sz*0.52, // outer tip
      -sz*0.12, 0,         side*sz*0.22, // inner trailing
    ]);
    wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    wGeo.computeVertexNormals();
    group.add(new THREE.Mesh(wGeo, mat));

    // Nacelle struts — heavier, less angled than K't'inga
    const strut = new THREE.Mesh(new THREE.BoxGeometry(sz*0.12, sz*0.05, sz*0.06), darkMat);
    strut.position.set(-sz*0.22, -sz*0.08, side*sz*0.42);
    group.add(strut);

    // Nacelle pods — elongated, more Starfleet-influenced
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.055, sz*0.072, sz*0.38, 9), darkMat);
    nac.rotation.z = Math.PI / 2;
    nac.position.set(-sz*0.22, -sz*0.14, side*sz*0.45);
    group.add(nac);
    // Bussard collector
    const buss = new THREE.Mesh(new THREE.SphereGeometry(sz*0.058, 7, 6), glowMat);
    buss.position.set(sz*0.02, -sz*0.14, side*sz*0.45);
    group.add(buss);
    // Warp grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(sz*0.25, sz*0.022, sz*0.07),
      new THREE.MeshPhongMaterial({ color:0xff2200, emissive:0xaa1100, emissiveIntensity:1.5 }));
    grille.position.set(-sz*0.22, -sz*0.14, side*sz*0.45);
    group.add(grille);
  });

  // Impulse engines — large glowing aft block (Vor'cha has prominent impulse deck)
  const impMat = new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xdd2200, emissiveIntensity:3 });
  [-sz*0.08, 0, sz*0.08].forEach(z => {
    const imp = new THREE.Mesh(new THREE.BoxGeometry(0.4, sz*0.1, sz*0.07), impMat);
    imp.position.set(-sz*0.40, sz*0.02, z);
    group.add(imp);
  });

  return group;
}

function buildRomulanWarbirdGeometry(sz) {
  // D'Deridex-class Warbird — the most distinctive Romulan capital ship
  // DEFINING FEATURE: horizontally split "shell" hull forming a closed loop —
  // two large booms sweep back from the forward neck, meeting at the tail AND
  // at the nacelle pylons, creating a hollow inner ring you could fly through.
  const group   = new THREE.Group();
  const mat     = new THREE.MeshPhongMaterial({ color:0x0a2a0a, emissive:0x021402, specular:0x224422, shininess:40, transparent:true, opacity:1 });
  const darkMat = new THREE.MeshPhongMaterial({ color:0x061806, emissive:0x010e01, specular:0x112211, shininess:20, transparent:true, opacity:1 });
  const plasMat = new THREE.MeshPhongMaterial({ color:0x00cc44, emissive:0x008833, emissiveIntensity:2.2 });

  // ── Forward neck + head section ──────────────────────────────
  // The "beak" — long horizontal neck connecting head to the ring body
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.07, sz*0.10, sz*0.55, 7), mat);
  neck.rotation.z = Math.PI / 2; neck.position.set(sz*0.32, 0, 0);
  group.add(neck);

  // Head — forward command pod, slightly flattened ovoid
  const head = new THREE.Mesh(new THREE.SphereGeometry(sz*0.14, 10, 7), mat);
  head.scale.set(1.4, 0.7, 0.85);
  head.position.set(sz*0.62, 0, 0);
  group.add(head);

  // Plasma torpedo launcher on head underbelly
  const plas1 = new THREE.Mesh(new THREE.SphereGeometry(sz*0.07, 8, 6), plasMat);
  plas1.position.set(sz*0.62, -sz*0.10, 0);
  group.add(plas1);

  // ── The iconic dual-boom ring structure ───────────────────────
  // Two large angled booms sweep back from the neck on each side,
  // curving inward to meet at the tail — forming a hollow loop.
  [1, -1].forEach(side => {
    // Upper-outer boom — sweeps back and outward from neck
    const upperBoom = new THREE.Mesh(new THREE.BoxGeometry(sz*0.72, sz*0.09, sz*0.11), mat);
    upperBoom.position.set(-sz*0.04, sz*0.08, side*sz*0.40);
    upperBoom.rotation.y = side * 0.20;
    group.add(upperBoom);

    // Lower-inner boom — sweeps back and downward, closing the loop at aft
    const lowerBoom = new THREE.Mesh(new THREE.BoxGeometry(sz*0.70, sz*0.09, sz*0.11), mat);
    lowerBoom.position.set(-sz*0.04, -sz*0.08, side*sz*0.40);
    lowerBoom.rotation.y = side * 0.20;
    group.add(lowerBoom);

    // Lateral connecting strut — joins upper/lower booms at mid-span
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.04, sz*0.06, sz*0.20, 6), darkMat);
    strut.position.set(-sz*0.06, 0, side*sz*0.52);
    group.add(strut);

    // Aft nacelle pod — where the two booms converge at the tail
    const nacPod = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.085, sz*0.10, sz*0.42, 8), mat);
    nacPod.rotation.z = Math.PI / 2;
    nacPod.position.set(-sz*0.40, 0, side*sz*0.46);
    group.add(nacPod);

    // Warp plasma glow on nacelle pod
    const nacGlow = new THREE.Mesh(new THREE.SphereGeometry(sz*0.065, 7, 6), plasMat);
    nacGlow.position.set(-sz*0.62, 0, side*sz*0.46);
    group.add(nacGlow);

    // Aft closure bar — connects the two nacelle pods across the tail,
    // forming the bottom of the ring loop
    if (side === 1) {
      const aftBar = new THREE.Mesh(new THREE.BoxGeometry(sz*0.14, sz*0.09, sz*0.92), mat);
      aftBar.position.set(-sz*0.40, 0, 0);
      group.add(aftBar);
    }

    // Forward plasma torpedo emitter on outer boom leading edge
    const plas2 = new THREE.Mesh(new THREE.SphereGeometry(sz*0.055, 7, 6), plasMat);
    plas2.position.set(sz*0.34, sz*0.08, side*sz*0.28);
    group.add(plas2);
  });

  // ── Inner hull fill — gives depth to the hollow ring ─────────
  // A dark recessed panel visible through the loop
  const innerPanel = new THREE.Mesh(new THREE.BoxGeometry(sz*0.60, sz*0.06, sz*0.20), darkMat);
  innerPanel.position.set(-sz*0.06, 0, 0);
  group.add(innerPanel);

  return group;
}

function buildEnemyGeometry(archetype) {
  const sz = { romulan_warbird:10, ktinga:8, vor_cha:10, romulan_bop:7, jem_hadar_battleship:9 }[archetype] || 7;

  // ── Borg Probe ────────────────────────────────────────────────
  if (archetype === 'borg_probe') {
    const group = new THREE.Group();
    const cubeMat = new THREE.MeshPhongMaterial({ color:0x001a10, emissive:0x003020, specular:0x00cc66, shininess:30, transparent:true, opacity:1 });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(7,7,7), cubeMat); group.add(cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.2,7.2,7.2)), new THREE.LineBasicMaterial({ color:0x00cc66, transparent:true, opacity:0.7 }));
    group.add(edges);
    [[7,0.3,0.3,0,0,0],[0.3,7,0.3,0,0,0],[0.3,0.3,7,0,0,0]].forEach(([w,h,d,x,y,z])=>{
      const r = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshPhongMaterial({ color:0x003322, emissive:0x002211, shininess:5, transparent:true, opacity:1 }));
      r.position.set(x,y,z); group.add(r);
    });
    [[3.6,0,0],[-3.6,0,0],[0,3.6,0],[0,-3.6,0],[0,0,3.6],[0,0,-3.6]].forEach(([x,y,z])=>{
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.5,6,5), new THREE.MeshPhongMaterial({ color:0x00ff88, emissive:0x00cc44, emissiveIntensity:3 }));
      g.position.set(x,y,z); group.add(g);
    });
    return group;
  }

  // ── Klingon ships — distinct geometries ───────────────────────
  if (archetype === 'ktinga')  return buildKtingaGeometry(sz);
  if (archetype === 'vor_cha') return buildVorchaGeometry(sz);

  // ── Romulan Bird-of-Prey ──────────────────────────────────────
  // Oval/ovoid central body with swept delta wings, cloaking device housing aft
  if (archetype === 'romulan_bop') {
    const group   = new THREE.Group();
    const mat     = new THREE.MeshPhongMaterial({ color:0x0d2a0d, emissive:0x041404, specular:0x336633, shininess:50, transparent:true, opacity:1 });
    const glowMat = new THREE.MeshPhongMaterial({ color:0x00cc44, emissive:0x008833, emissiveIntensity:2 });
    const darkMat = new THREE.MeshPhongMaterial({ color:0x061806, emissive:0x020e02, specular:0x223322, shininess:20, transparent:true, opacity:1 });

    // Central ovoid body — wider than tall, slightly bird-shaped from above
    const body = new THREE.Mesh(new THREE.SphereGeometry(sz*0.16, 10, 8), mat);
    body.scale.set(2.5, 0.65, 1.1);
    body.position.set(0, 0, 0);
    group.add(body);

    // Forward command pod / beak — narrower protrusion
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0, sz*0.09, sz*0.28, 5), mat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(sz*0.33, -sz*0.03, 0);
    beak.scale.set(1, 0.7, 0.8);
    group.add(beak);

    // Swept delta wings
    [1, -1].forEach(side => {
      const wGeo = new THREE.BufferGeometry();
      const verts = new Float32Array([
        sz*0.12, 0,         0,            // forward root
        -sz*0.22, -sz*0.05, side*sz*0.48, // wingtip
        -sz*0.08, 0,        side*sz*0.18, // inner trailing
      ]);
      wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wGeo.computeVertexNormals();
      group.add(new THREE.Mesh(wGeo, mat));

      // Wingtip disruptor/plasma emitter
      const tip = new THREE.Mesh(new THREE.SphereGeometry(sz*0.042, 6, 5), glowMat);
      tip.position.set(-sz*0.18, -sz*0.04, side*sz*0.44);
      group.add(tip);
    });

    // Cloaking device housing — aft dorsal fin/blister
    const cloak = new THREE.Mesh(new THREE.BoxGeometry(sz*0.18, sz*0.08, sz*0.10), darkMat);
    cloak.position.set(-sz*0.22, sz*0.06, 0);
    group.add(cloak);

    // Impulse engine glow
    const imp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, sz*0.14),
      new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xcc2200, emissiveIntensity:3 }));
    imp.position.set(-sz*0.30, 0, 0);
    group.add(imp);

    return group;
  }

  // ── Romulan D'Deridex Warbird ─────────────────────────────────
  if (archetype === 'romulan_warbird') return buildRomulanWarbirdGeometry(sz);

  // ── Cardassian ships ──────────────────────────────────────────
  // Galor: large ankh-shaped warship with crescent wing structure
  // Scout: smaller, same lineage but more elongated and less wing mass
  if (archetype === 'cardassian_scout' || archetype === 'galor_class') {
    const group     = new THREE.Group();
    const isGalor   = archetype === 'galor_class';
    const mat       = new THREE.MeshPhongMaterial({ color:0x2a1800, emissive:0x140c00, specular:0x886622, shininess:60, transparent:true, opacity:1 });
    const accentMat = new THREE.MeshPhongMaterial({ color:0xcc6600, emissive:0x883300, emissiveIntensity:1.4, transparent:true, opacity:1 });
    const darkMat   = new THREE.MeshPhongMaterial({ color:0x1a1000, emissive:0x0c0800, specular:0x553311, shininess:30, transparent:true, opacity:1 });

    // Central spine — narrows toward tail (ankh body)
    const spine = new THREE.Mesh(new THREE.BoxGeometry(sz*0.88, sz*0.13, sz*0.16), mat);
    group.add(spine);

    // Forward command sphere/dome — sits atop the forward spine (the ankh top)
    const cmd = new THREE.Mesh(new THREE.SphereGeometry(sz*0.13, 9, 7), mat);
    cmd.scale.set(1.6, 0.75, 1.0);
    cmd.position.set(sz*0.34, sz*0.10, 0);
    group.add(cmd);

    // Triple forward phaser array housing (Galor's most distinctive feature)
    if (isGalor) {
      const phasHousing = new THREE.Mesh(new THREE.BoxGeometry(sz*0.08, sz*0.06, sz*0.32), accentMat);
      phasHousing.position.set(sz*0.44, -sz*0.04, 0);
      group.add(phasHousing);
    }

    // Crescent/half-moon wing structure — the most Cardassian feature
    // Wings sweep forward-outward then curve back (not straight delta wings)
    [1, -1].forEach(side => {
      // Outer wing blade — broad crescent shape
      const blade = new THREE.Mesh(new THREE.BoxGeometry(sz*(isGalor?0.5:0.38), sz*0.06, sz*(isGalor?0.26:0.20)), mat);
      blade.position.set(sz*0.06, 0, side*sz*(isGalor?0.28:0.22));
      group.add(blade);

      // Wing leading edge strake — the curved forward sweep
      const strake = new THREE.Mesh(new THREE.BoxGeometry(sz*0.22, sz*0.05, sz*0.08), mat);
      strake.position.set(sz*0.28, sz*0.04, side*sz*(isGalor?0.24:0.18));
      strake.rotation.y = side * 0.35;
      group.add(strake);

      // Warp field coil — built into wing, not a separate nacelle (Cardassian design)
      const coil = new THREE.Mesh(new THREE.BoxGeometry(sz*(isGalor?0.38:0.28), sz*0.04, sz*0.06), accentMat);
      coil.position.set(sz*0.05, -sz*0.04, side*sz*(isGalor?0.28:0.21));
      group.add(coil);

      // Wingtip accent glow
      const glow = new THREE.Mesh(new THREE.SphereGeometry(sz*(isGalor?0.045:0.035), 6, 5), accentMat);
      glow.position.set(-sz*0.10, 0, side*sz*(isGalor?0.32:0.24));
      group.add(glow);
    });

    // Aft engine nozzle
    const aft = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.06, sz*0.10, sz*0.18, 7), darkMat);
    aft.rotation.z = Math.PI / 2; aft.position.set(-sz*0.46, 0, 0);
    group.add(aft);
    const impMat = new THREE.MeshPhongMaterial({ color:0xff5500, emissive:0xcc3300, emissiveIntensity:2.5 });
    const imp = new THREE.Mesh(new THREE.BoxGeometry(0.35, sz*0.1, sz*0.12), impMat);
    imp.position.set(-sz*0.46, 0, 0);
    group.add(imp);

    return group;
  }

  // ── Jem'Hadar ships — scarab/insect profile ───────────────────
  // Fighter: compact scarab shape, smaller than Defiant in every dimension
  // Battleship: same lineage but wider, heavier forward section, more cannons
  if (archetype === 'jem_hadar_fighter' || archetype === 'jem_hadar_battleship') {
    const group      = new THREE.Group();
    const isBig      = archetype === 'jem_hadar_battleship';
    const mat        = new THREE.MeshPhongMaterial({ color:0x1a0a28, emissive:0x0e0518, specular:0x8833cc, shininess:70, transparent:true, opacity:1 });
    const polaronMat = new THREE.MeshPhongMaterial({ color:0x8822ff, emissive:0x4411aa, emissiveIntensity:2.5 });
    const darkMat    = new THREE.MeshPhongMaterial({ color:0x12071c, emissive:0x090310, specular:0x661199, shininess:40, transparent:true, opacity:1 });

    // Central body — scarab-like dorsal carapace
    const carapace = new THREE.Mesh(new THREE.SphereGeometry(sz*0.18, 10, 8), mat);
    carapace.scale.set(2.2, 0.60, isBig?1.4:1.1);
    group.add(carapace);

    // Forward attack wedge — pointed nose section
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0, sz*(isBig?0.12:0.09), sz*0.42, 4), mat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(sz*0.45, -sz*0.04, 0);
    nose.scale.set(1, 0.6, 1.2);
    group.add(nose);

    // Delta wings — wider on battleship
    [1, -1].forEach(side => {
      const wGeo = new THREE.BufferGeometry();
      const wingZ = isBig ? sz*0.55 : sz*0.42;
      const verts = new Float32Array([
        sz*0.15, -sz*0.04, 0,           // forward root
        -sz*0.32, -sz*0.05, side*wingZ, // outer wingtip
        -sz*0.05, -sz*0.06, side*sz*0.16, // inner trailing
      ]);
      wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wGeo.computeVertexNormals();
      group.add(new THREE.Mesh(wGeo, mat));

      // Polaron cannon pairs (battleship has more)
      const cannonCount = isBig ? 2 : 1;
      for (let c = 0; c < cannonCount; c++) {
        const cz = side * (isBig ? sz*0.20 + c*sz*0.10 : sz*0.18);
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.025, sz*0.038, sz*0.48, 5), darkMat);
        cannon.rotation.z = Math.PI / 2;
        cannon.position.set(sz*0.14, -sz*0.06, cz);
        group.add(cannon);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(sz*0.032, 6, 5), polaronMat);
        tip.position.set(sz*0.40, -sz*0.06, cz);
        group.add(tip);
      }
    });

    // Aft engine cluster — battleship has a wider bank
    const impMat = new THREE.MeshPhongMaterial({ color:0x8822ff, emissive:0x4411bb, emissiveIntensity:3 });
    const engCount = isBig ? 3 : 2;
    for (let e = 0; e < engCount; e++) {
      const ez = (e - (engCount-1)/2) * sz * 0.12;
      const eng = new THREE.Mesh(new THREE.BoxGeometry(0.38, sz*0.10, sz*0.09), impMat);
      eng.position.set(-sz*0.40, -sz*0.04, ez);
      group.add(eng);
    }

    return group;
  }

  // Fallback generic
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color:0x1a0808, emissive:0x0a0000, specular:0x882222, shininess:40, transparent:true, opacity:1 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.4, sz, 6), mat);
  body.rotation.z = Math.PI/2; group.add(body);
  return group;
}

// ── Saucer section for Enterprise-E separation ───────────────
function buildSaucerSepGeometry() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color:0x1a2a50, emissive:0x060e20, specular:0x5577cc, shininess:90 });
  const emitMat = new THREE.MeshPhongMaterial({ color:0xcc8800, emissive:0x994400, emissiveIntensity:1.8 });

  // Saucer disc
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.8, 20), hullMat);
  disc.rotation.z = Math.PI / 2;
  group.add(disc);

  // Bridge module
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), hullMat);
  bridge.scale.set(1.1, 0.65, 0.85);
  bridge.position.set(4.3, 0.7, 0);
  group.add(bridge);

  // Phaser array strip (dorsal)
  const phasD = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.11, 4, 18, Math.PI * 1.2), emitMat);
  phasD.rotation.y = Math.PI / 2;
  phasD.position.set(1.5, 0.55, 0);
  group.add(phasD);

  // Impulse engines (aft of saucer — twin red glows)
  [-0.8, 0.8].forEach(z => {
    const imp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.7),
      new THREE.MeshPhongMaterial({ color:0xff5500, emissive:0xdd2200, emissiveIntensity:2.8 }));
    imp.position.set(-5.1, 0, z);
    group.add(imp);
  });

  return group;
}

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

// ── Sovereign-class (Enterprise-E) geometry ───────────────────
function buildSovereignGeometry() {
  // USS Enterprise NCC-1701-E — Sovereign-class
  // Key canon facts: large saucer with dorsal/ventral phaser arcs; stardrive hull
  // with prominent navigational deflector dish (decks 15-18); swept-back nacelles;
  // minimal neck (flat, elongated "hot rod" profile vs. TNG swan-neck).
  const group   = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color:0x1a2a50, emissive:0x060e20, specular:0x5577cc, shininess:90 });
  const darkMat = new THREE.MeshPhongMaterial({ color:0x0e1a36, emissive:0x040810, specular:0x334488, shininess:40 });
  const nacMat  = new THREE.MeshPhongMaterial({ color:0x0e1932, emissive:0x060a1c, specular:0x3355aa, shininess:50 });
  const glowMat = new THREE.MeshPhongMaterial({ color:0x4488ff, emissive:0x2255cc, emissiveIntensity:3 });
  const emitMat = new THREE.MeshPhongMaterial({ color:0xcc8800, emissive:0x994400, emissiveIntensity:1.8 });
  const deflMat = new THREE.MeshPhongMaterial({ color:0x6699ff, emissive:0x2244cc, emissiveIntensity:2.2 });

  // ── Saucer — large 24-sided disc, slightly forward ────────────
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.0, 1.0, 24), hullMat);
  saucer.rotation.z = Math.PI / 2; saucer.position.set(2, 0.5, 0);
  group.add(saucer);

  // Saucer rim torus
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.25, 8, 24), darkMat);
  rim.rotation.y = Math.PI / 2; rim.position.set(2, 0.5, 0);
  group.add(rim);

  // Bridge module — flattened dome at saucer leading edge
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), hullMat);
  bridge.scale.set(1.2, 0.65, 0.85); bridge.position.set(7.2, 1.2, 0);
  group.add(bridge);

  // Dorsal phaser array — arc strip on top of saucer
  const phasD = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.12, 4, 20, Math.PI * 1.2), emitMat);
  phasD.rotation.y = Math.PI / 2; phasD.position.set(2, 1.1, 0);
  group.add(phasD);

  // Ventral phaser array — semicircle on bottom of saucer
  const phasV = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.12, 4, 18, Math.PI), emitMat);
  phasV.rotation.y = Math.PI / 2; phasV.position.set(2, -0.1, 0);
  group.add(phasV);

  // ── Neck — slim connector between saucer and stardrive ────────
  // Sovereign has a very short, low-profile neck (almost no neck vs Galaxy)
  const neck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.8), darkMat);
  neck.position.set(1.0, -0.5, 0);
  group.add(neck);
  // Neck side fairings — tapered wedges for a cleaner transition
  [-0.85, 0.85].forEach(z => {
    const fairing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.5), darkMat);
    fairing.position.set(1.0, -0.3, z);
    group.add(fairing);
  });

  // ── Stardrive hull — elongated, flat engineering section ──────
  const stardrive = new THREE.Mesh(new THREE.BoxGeometry(13, 1.9, 3.6), darkMat);
  stardrive.position.set(-3.2, -1.5, 0);
  group.add(stardrive);

  // Stardrive forward taper — gives the "hot rod" pointed nose
  const sdNose = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.8, 5, 8), hullMat);
  sdNose.rotation.z = -Math.PI / 2; sdNose.position.set(3.8, -1.5, 0);
  sdNose.scale.set(1, 0.52, 0.9);
  group.add(sdNose);

  // ── Navigational deflector dish — the most prominent stardrive feature
  // Large glowing blue dish set into the forward stardrive section
  const deflRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 8, 18), deflMat);
  deflRing.rotation.y = Math.PI / 2; deflRing.position.set(2.2, -1.5, 0);
  group.add(deflRing);
  const deflDish = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), deflMat);
  deflDish.scale.set(0.35, 0.9, 0.9); deflDish.position.set(2.45, -1.5, 0);
  group.add(deflDish);
  // Deflector housing — box surround
  const deflHousing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 3.0), darkMat);
  deflHousing.position.set(2.1, -1.5, 0);
  group.add(deflHousing);

  // ── Torpedo launcher — just forward of deflector ──────────────
  const tLaunch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), hullMat);
  tLaunch.position.set(3.0, -1.1, 0);
  group.add(tLaunch);

  // ── Aft impulse engines ───────────────────────────────────────
  const impMat = new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xdd2200, emissiveIntensity:2.5 });
  [-1.0, 0.0, 1.0].forEach(z => {
    const imp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.75), impMat);
    imp.position.set(-9.4, -0.8, z);
    group.add(imp);
  });

  // ── Nacelles — long swept-back, mounted on angled pylons ──────
  [3.8, -3.8].forEach(z => {
    // Swept pylon — angled outward and slightly aft
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.45, 0.85), darkMat);
    pylon.rotation.z = -0.18; pylon.position.set(-2.8, -2.2, z * 0.92);
    group.add(pylon);

    // Main nacelle cylinder — longer and slimmer than Defiant's
    const nacGeo = new THREE.CylinderGeometry(0.44, 0.58, 9.0, 12);
    const nac = new THREE.Mesh(nacGeo, nacMat);
    nac.rotation.z = Math.PI / 2; nac.position.set(-4.8, -2.4, z);
    group.add(nac);

    // Bussard collector — prominent orange-red sphere at nacelle nose
    const buss = new THREE.Mesh(new THREE.SphereGeometry(0.54, 10, 7),
      new THREE.MeshPhongMaterial({ color:0xff5500, emissive:0xcc2200, emissiveIntensity:2.2 }));
    buss.position.set(-0.35, -2.4, z);
    group.add(buss);

    // Warp field grille — glowing blue stripe along nacelle
    const grille = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 0.68), glowMat);
    grille.position.set(-4.8, -2.4, z);
    group.add(grille);

    // Aft exhaust glow sphere
    const endGlow = new THREE.Mesh(new THREE.SphereGeometry(0.50, 8, 6), glowMat);
    endGlow.position.set(-9.3, -2.4, z);  // updated nacelle end position
    group.add(endGlow);
  });

  return group;
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

function _cleanupSaucerSep() {
  if (mesh_saucer_sep) {
    THREE_scene.remove(mesh_saucer_sep);
    mesh_saucer_sep.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
    mesh_saucer_sep = null;
  }
  if (engine_glow_saucer) engine_glow_saucer.intensity = 0;
}

// ── Hull damage spark pool ────────────────────────────────────
let _hullSparks = [];            // { mesh, vel, life, maxLife }
let _hullSparkTimer = 0;         // accumulator — emit sparks at intervals

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
  THREE_camera.lookAt(_camLookAtTarget.set(
    mesh_enemyGroup.position.x*0.45 + mesh_defiant.position.x*0.55, 0, 0
  ));

  // Defiant drift — amplitude scales with helm speed
  const _speedDrift = { stop:0.2, maneuvering:0.5, half:1.0, full:1.8 }[G.helmSpeed] ?? 1.0;
  mesh_defiant.position.y = Math.sin(now*0.4)*0.6*_speedDrift;
  mesh_defiant.position.z = Math.sin(now*0.25)*0.8*_speedDrift;
  mesh_defiant.rotation.z = Math.sin(now*0.3)*0.03*_speedDrift;

  // Hull damage colouring — works on both loaded models and procedural geometry
  const hullPct = G.player.hull / G.player.maxHull;
  _applyHullDamageColour(mesh_defiant, hullPct, true);

  // Engine glow — intensity tied to helm speed setting
  const _helmGlow = { stop:0.2, maneuvering:0.7, half:1.5, full:3.2 }[G.helmSpeed] ?? 1.5;
  engine_glow_player.intensity = G.cloaked ? 0.1 : _helmGlow + Math.sin(now*3)*0.4*(G.systems.engines.health/100);
  const _nac = _NAC_OFFSET[G.playerShipKey] || _NAC_OFFSET.defiant;
  engine_glow_player.position.set(mesh_defiant.position.x + _nac.x, mesh_defiant.position.y + _nac.y, mesh_defiant.position.z);
  engine_glow_enemy.intensity  = G.enemyCloaked ? 0.1 : 1.8+Math.sin(now*2.8)*0.9;

  // ── Engine exhaust particles from nacelles ───────────────────
  if (!G.cloaked && G.running) {
    const _exhaustRate = { stop:0, maneuvering:0.12, half:0.28, full:0.55 }[G.helmSpeed] ?? 0.28;
    if (Math.random() < _exhaustRate) {
      const isEnt = G.playerShipKey === 'enterprise_e';
      const exX = mesh_defiant.position.x + (isEnt ? -9.3 : -3.1);
      const exY = mesh_defiant.position.y + (isEnt ? -2.4 : 0.0);
      const nacZ = isEnt ? 3.8 : 2.6;  // Defiant: outer nacelle pair spacing
      [-nacZ, nacZ].forEach(z => {
        spawnThreeParticles(
          exX + (Math.random()-0.5)*0.6,
          exY + (Math.random()-0.5)*0.3,
          mesh_defiant.position.z + z + (Math.random()-0.5)*0.5,
          0.25, 0.48, 1.0, 1
        );
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
    mesh_enemyGroup.position.x = THREE.MathUtils.lerp(mesh_enemyGroup.position.x, mesh_defiant.position.x+rangeDist, 0.025);
    const _baseY = Math.sin(now*0.35+1.2)*2.8;
    const _baseZ = Math.sin(now*0.22+0.7)*2.2;

    if (G.enemyManeuverState==='angling') {
      const roll={fore:0,aft:Math.PI*0.15,port:0.25,starboard:-0.25}[G.enemyPreferredSector]||0;
      const zOff={port:9, starboard:-9, fore:0, aft:0}[G.enemyPreferredSector]||0;
      mesh_enemyGroup.rotation.y=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.y,Math.PI+roll*0.6,0.06);
      mesh_enemyGroup.rotation.z=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.z,roll*0.5,0.06);
      mesh_enemyGroup.position.y=THREE.MathUtils.lerp(mesh_enemyGroup.position.y, _baseY, 0.04);
      mesh_enemyGroup.position.z=THREE.MathUtils.lerp(mesh_enemyGroup.position.z, _baseZ+zOff, 0.04);
    } else if (G.enemyManeuverState==='torpedocharge') {
      mesh_enemyGroup.rotation.z=Math.sin(now*12)*0.12;
      mesh_enemyGroup.position.x=THREE.MathUtils.lerp(mesh_enemyGroup.position.x, mesh_defiant.position.x+rangeDist*0.7, 0.035);
      mesh_enemyGroup.position.y=THREE.MathUtils.lerp(mesh_enemyGroup.position.y, _baseY, 0.05);
      mesh_enemyGroup.position.z=THREE.MathUtils.lerp(mesh_enemyGroup.position.z, _baseZ, 0.05);
    } else {
      mesh_enemyGroup.rotation.y=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.y,Math.PI,0.04);
      mesh_enemyGroup.rotation.z=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.z,0,0.04);
      mesh_enemyGroup.position.y=THREE.MathUtils.lerp(mesh_enemyGroup.position.y, _baseY, 0.03);
      mesh_enemyGroup.position.z=THREE.MathUtils.lerp(mesh_enemyGroup.position.z, _baseZ, 0.03);
    }
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
      fromV = mesh_enemyGroup.position.clone().add(new THREE.Vector3(off[0], off[1], off[2]));
      // Target: player hull biased toward the attacked sector
      const sOff = _PLAYER_SECTOR_HIT[b.targetSector] || [0,0,0];
      toV = mesh_defiant.position.clone().add(new THREE.Vector3(
        sOff[0] + (Math.random()-0.5)*1.5,
        sOff[1] + (Math.random()-0.5)*1.2,
        sOff[2] + (Math.random()-0.5)*1.5
      ));
    } else {
      const shipHp = _PLAYER_HP[G.playerShipKey] || _PLAYER_HP.defiant;
      const wk = b.weaponKey || b.type;
      const off = shipHp[wk] || shipHp[b.type] || [+5, 0, 0];
      fromV = mesh_defiant.position.clone().add(new THREE.Vector3(off[0], off[1], off[2]));
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
      fromV = mesh_enemyGroup.position.clone().add(new THREE.Vector3(off[0], off[1], off[2]));
      toV   = mesh_defiant.position.clone();
    } else {
      // Player torpedo: fire from correct tube
      const shipHp = _PLAYER_HP[G.playerShipKey] || _PLAYER_HP.defiant;
      const wk = t.isAft ? (t.isPhoton ? 'torpedo_photon_aft' : 'torpedo_quantum_aft') : (t.isPhoton ? 'photon' : 'torpedoes');
      const off = shipHp[wk] || [+6.5, -0.7, 0];
      fromV = mesh_defiant.position.clone().add(new THREE.Vector3(off[0], off[1], off[2]));
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
