'use strict';

// ============================================================
// THREE.JS 3D SPATIAL BATTLE VIEW
// Ship meshes, weapon beams, torpedoes, particles, camera.
// Depends on: state.js (G, C, ENEMY_CONFIGS, HELM_SPEED_CONFIG)
// ============================================================

// Faction colour palettes — engine glow (deep) vs weapon beams (bright)
const _FACTION_GLOW_COL  = { Klingon:0xff2200, Romulan:0x00cc44, Cardassian:0xffaa00, Dominion:0x8822ff, Borg:0x00cc66 };
const _FACTION_BEAM_COL  = { Klingon:0xff4422, Romulan:0x44ff44, Cardassian:0xffaa00, Dominion:0xaa44ff, Borg:0x00ff88 };
// Nacelle end offsets per ship (local space, relative to group origin)
const _NAC_OFFSET = { defiant:{ x:-5.2, y:-0.5 }, enterprise_e:{ x:-8.4, y:-2.4 } };
// Player weapon beam colours — canon-accurate
// Defiant pulse cannons + Type-XII phasers: amber-orange. Nose emitter: deep orange.
// Quantum torpedoes: blue-white. Photon torpedoes: orange-red.
const _PLAYER_BEAM_COL = {
  cannon_pu: 0xff9900, cannon_pl: 0xff9900, cannon_su: 0xff9900, cannon_sl: 0xff9900,
  nose_beam: 0xff6600, torpedoes: 0x99ccff, photon: 0xff6600,
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
  const group = new THREE.Group();
  const hullMat  = new THREE.MeshPhongMaterial({ color:0x1e2f5a, emissive:0x080e20, specular:0x5577dd, shininess:80 });
  const darkMat  = new THREE.MeshPhongMaterial({ color:0x0e1a36, emissive:0x040810, specular:0x334499, shininess:40 });
  const nacMat   = new THREE.MeshPhongMaterial({ color:0x0e1a36, emissive:0x080e1e, specular:0x4466cc, shininess:50 });
  const glowMat  = new THREE.MeshPhongMaterial({ color:0x4488ff, emissive:0x2255cc, emissiveIntensity:3 });
  const detailMat= new THREE.MeshPhongMaterial({ color:0x283860, emissive:0x0a1228, specular:0x667799, shininess:120 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 1.6, 4.5), hullMat);
  group.add(hull);

  const bowGeo = new THREE.CylinderGeometry(0, 2.5, 5, 4);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.rotation.z = -Math.PI/2; bow.position.set(6.5, 0, 0);
  bow.scale.set(1, 0.32, 0.9);
  group.add(bow);

  const aft = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 3.8), darkMat);
  aft.position.set(-4, 0.1, 0);
  group.add(aft);

  const strut = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 1.2), darkMat);
  strut.position.set(-1, -1.1, 0);
  group.add(strut);

  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 1.0, 8), detailMat);
  bridge.position.set(3.5, 1.1, 0); bridge.scale.set(1, 1, 0.8);
  group.add(bridge);

  const emitter = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.3), new THREE.MeshPhongMaterial({ color:0xcc4400, emissive:0x881100, emissiveIntensity:1.5 }));
  emitter.position.set(5, 0.9, 0);
  group.add(emitter);

  const nacGeo = new THREE.CylinderGeometry(0.35, 0.5, 5.5, 10);
  [-3.0, 3.0].forEach(z => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.8), darkMat);
    pylon.position.set(-2.5, -0.6, z * 0.7);
    group.add(pylon);

    const nac = new THREE.Mesh(nacGeo, nacMat);
    nac.rotation.z = Math.PI/2; nac.position.set(-2.5, -0.5, z);
    group.add(nac);

    const buss = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xcc2200, emissiveIntensity:2 }));
    buss.position.set(0.2, -0.5, z); group.add(buss);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 0.55), glowMat);
    grille.position.set(-2.5, -0.5, z);
    group.add(grille);

    const endGlow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), glowMat);
    endGlow.position.set(-5.2, -0.5, z); group.add(endGlow);
  });

  const tLaunch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), detailMat);
  tLaunch.position.set(5.5, -0.5, 0);
  group.add(tLaunch);

  return group;
}

function buildKlingonBoPGeometry(sz) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color:0x2a0808, emissive:0x180202, specular:0x882222, shininess:50, transparent:true, opacity:1 });
  const darkMat = new THREE.MeshPhongMaterial({ color:0x1a0404, emissive:0x0e0101, specular:0x661111, shininess:30, transparent:true, opacity:1 });
  const glowMat = new THREE.MeshPhongMaterial({ color:0xff2200, emissive:0xcc1100, emissiveIntensity:2 });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, sz * 0.55, 6), mat);
  neck.rotation.z = Math.PI/2; group.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.28, sz * 0.12, sz * 0.18), mat);
  head.position.set(sz * 0.35, 0, 0); group.add(head);

  [1, -1].forEach(side => {
    const wGeo = new THREE.BufferGeometry();
    const w = sz * 0.55, d = sz * 0.42;
    const verts = new Float32Array([
      0, 0, 0,
      -sz*0.3, -sz*0.08, side*w,
      sz*0.1, 0, side*d*0.45,
    ]);
    wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    wGeo.computeVertexNormals();
    const wing = new THREE.Mesh(wGeo, mat);
    group.add(wing);

    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, sz*0.18, 6), darkMat);
    pod.rotation.z = Math.PI/2;
    pod.position.set(-sz*0.12, -sz*0.06, side*w*0.7);
    group.add(pod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), glowMat);
    tip.position.set(sz*0.07, -sz*0.06, side*w*0.7);
    group.add(tip);
  });

  const imp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.2), new THREE.MeshPhongMaterial({ color:0xff4400, emissive:0xdd2200, emissiveIntensity:3 }));
  imp.position.set(-sz*0.3, 0, 0); group.add(imp);

  return group;
}

function buildRomulanWarbirdGeometry(sz) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color:0x0a2a0a, emissive:0x021402, specular:0x224422, shininess:40, transparent:true, opacity:1 });
  const plasMat = new THREE.MeshPhongMaterial({ color:0x00cc44, emissive:0x008833, emissiveIntensity:2 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.12, sz*0.18, sz*0.85, 8), mat);
  body.rotation.z = Math.PI/2; group.add(body);

  [1, -1].forEach(side => {
    const boom = new THREE.Mesh(new THREE.BoxGeometry(sz*0.75, sz*0.08, sz*0.12), mat);
    boom.position.set(-sz*0.05, 0, side*sz*0.42);
    boom.rotation.y = side * 0.18;
    group.add(boom);

    const pod = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.08, sz*0.12, sz*0.5, 6), mat);
    pod.rotation.z = Math.PI/2;
    pod.position.set(-sz*0.28, 0, side*sz*0.62);
    group.add(pod);

    const plas = new THREE.Mesh(new THREE.SphereGeometry(sz*0.1, 8, 6), plasMat);
    plas.position.set(sz*0.38, 0, side*sz*0.42);
    group.add(plas);
  });

  const head = new THREE.Mesh(new THREE.ConeGeometry(sz*0.14, sz*0.4, 6), mat);
  head.rotation.z = -Math.PI/2; head.position.set(sz*0.6, 0, 0);
  group.add(head);

  return group;
}

function buildEnemyGeometry(archetype) {
  const cfg = ENEMY_CONFIGS[archetype];
  const sz = { romulan_warbird:10, ktinga:8, vor_cha:9, romulan_bop:7, jem_hadar_battleship:9 }[archetype] || 7;

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

  if (archetype === 'ktinga' || archetype === 'vor_cha') {
    return buildKlingonBoPGeometry(sz);
  }

  if (archetype === 'romulan_bop') {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color:0x0d2a0d, emissive:0x041404, specular:0x336633, shininess:50, transparent:true, opacity:1 });
    const glowMat = new THREE.MeshPhongMaterial({ color:0x00cc44, emissive:0x008833, emissiveIntensity:2 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, sz*0.75, 5), mat);
    body.rotation.z = Math.PI/2; group.add(body);
    [1,-1].forEach(side => {
      const wGeo = new THREE.BufferGeometry();
      const verts = new Float32Array([0,0,0, -sz*0.25,-sz*0.06,side*sz*0.45, sz*0.18,0,side*sz*0.2]);
      wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wGeo.computeVertexNormals();
      group.add(new THREE.Mesh(wGeo, mat));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), glowMat);
      tip.position.set(-sz*0.12, -sz*0.04, side*sz*0.4); group.add(tip);
    });
    return group;
  }

  if (archetype === 'romulan_warbird') {
    return buildRomulanWarbirdGeometry(sz);
  }

  if (archetype === 'cardassian_scout' || archetype === 'galor_class') {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color:0x2a1800, emissive:0x140c00, specular:0x886622, shininess:60, transparent:true, opacity:1 });
    const accentMat = new THREE.MeshPhongMaterial({ color:0xcc6600, emissive:0x883300, emissiveIntensity:1.2, transparent:true, opacity:1 });
    const spine = new THREE.Mesh(new THREE.BoxGeometry(sz*0.9, sz*0.14, sz*0.18), mat);
    group.add(spine);
    const cmd = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.09, sz*0.14, sz*0.35, 6), mat);
    cmd.rotation.z = Math.PI/2; cmd.position.set(sz*0.32, sz*0.1, sz*0.08);
    group.add(cmd);
    [1,-1].forEach(side => {
      const ext = new THREE.Mesh(new THREE.BoxGeometry(sz*0.4, sz*0.08, sz*0.3), mat);
      ext.position.set(sz*0.05, 0, side*sz*0.26); group.add(ext);
      const accentBar = new THREE.Mesh(new THREE.BoxGeometry(sz*0.3, sz*0.04, sz*0.06), accentMat);
      accentBar.position.set(sz*0.1, sz*0.06, side*sz*0.26); group.add(accentBar);
    });
    const aft = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.07, sz*0.1, sz*0.2, 6), mat);
    aft.rotation.z = Math.PI/2; aft.position.set(-sz*0.45, 0, 0); group.add(aft);
    return group;
  }

  if (archetype === 'jem_hadar_fighter' || archetype === 'jem_hadar_battleship') {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color:0x1a0a28, emissive:0x0e0518, specular:0x8833cc, shininess:70, transparent:true, opacity:1 });
    const polaronMat = new THREE.MeshPhongMaterial({ color:0x8822ff, emissive:0x4411aa, emissiveIntensity:2.5 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(sz*0.14, sz*0.82, 4), mat);
    body.rotation.z = Math.PI/2; group.add(body);
    [1,-1].forEach(side => {
      const wGeo = new THREE.BufferGeometry();
      const verts = new Float32Array([0,0,0, -sz*0.35,0,side*sz*0.48, -sz*0.05,-sz*0.05,side*sz*0.15]);
      wGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wGeo.computeVertexNormals();
      group.add(new THREE.Mesh(wGeo, mat));
    });
    [1,-1].forEach(side => {
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, sz*0.45, 5), mat);
      cannon.rotation.z = Math.PI/2; cannon.position.set(sz*0.1, -sz*0.04, side*sz*0.2); group.add(cannon);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), polaronMat);
      tip.position.set(sz*0.32, -sz*0.04, side*sz*0.2); group.add(tip);
    });
    return group;
  }

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
}

// ── Sovereign-class (Enterprise-E) geometry ───────────────────
function buildSovereignGeometry() {
  const group   = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color:0x1a2a50, emissive:0x060e20, specular:0x5577cc, shininess:90 });
  const darkMat = new THREE.MeshPhongMaterial({ color:0x0e1a36, emissive:0x040810, specular:0x334488, shininess:40 });
  const nacMat  = new THREE.MeshPhongMaterial({ color:0x0e1932, emissive:0x060a1c, specular:0x3355aa, shininess:50 });
  const glowMat = new THREE.MeshPhongMaterial({ color:0x4488ff, emissive:0x2255cc, emissiveIntensity:3 });
  const emitMat = new THREE.MeshPhongMaterial({ color:0xcc8800, emissive:0x994400, emissiveIntensity:1.8 });

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.0, 1.0, 24), hullMat);
  saucer.rotation.z = Math.PI/2; saucer.position.set(2, 0.5, 0);
  group.add(saucer);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.25, 8, 24), darkMat);
  rim.rotation.y = Math.PI/2; rim.position.set(2, 0.5, 0);
  group.add(rim);

  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), hullMat);
  bridge.scale.set(1.2, 0.7, 0.9); bridge.position.set(6.5, 1.2, 0);
  group.add(bridge);

  const stardrive = new THREE.Mesh(new THREE.BoxGeometry(12, 1.8, 3.2), darkMat);
  stardrive.position.set(-3, -1.5, 0);
  group.add(stardrive);

  const sdNose = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.6, 4, 6), hullMat);
  sdNose.rotation.z = -Math.PI/2; sdNose.position.set(3.5, -1.5, 0);
  sdNose.scale.set(1, 0.55, 1);
  group.add(sdNose);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.6), darkMat);
  neck.position.set(1.5, -0.4, 0);
  group.add(neck);

  [3.8, -3.8].forEach(z => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.5, 0.9), darkMat);
    pylon.rotation.z = -0.15; pylon.position.set(-2.5, -2.2, z * 0.95);
    group.add(pylon);

    const nacGeo = new THREE.CylinderGeometry(0.45, 0.6, 8.5, 12);
    const nac = new THREE.Mesh(nacGeo, nacMat);
    nac.rotation.z = Math.PI/2; nac.position.set(-4.5, -2.4, z);
    group.add(nac);

    const buss = new THREE.Mesh(new THREE.SphereGeometry(0.52, 8, 6),
      new THREE.MeshPhongMaterial({ color:0xff5500, emissive:0xcc2200, emissiveIntensity:2.2 }));
    buss.position.set(-0.15, -2.4, z); group.add(buss);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.2, 0.7), glowMat);
    grille.position.set(-4.5, -2.4, z); group.add(grille);

    const endGlow = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), glowMat);
    endGlow.position.set(-8.4, -2.4, z); group.add(endGlow);
  });

  const phasD = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.12, 4, 20, Math.PI*1.2), emitMat);
  phasD.rotation.y = Math.PI/2; phasD.position.set(2, 1.1, 0);
  group.add(phasD);

  const phasV = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.12, 4, 18, Math.PI), emitMat);
  phasV.rotation.y = Math.PI/2; phasV.position.set(2, -0.1, 0);
  group.add(phasV);

  const tLaunch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), hullMat);
  tLaunch.position.set(2.5, -1.1, 0); group.add(tLaunch);

  return group;
}

function rebuildPlayerMesh() {
  if (!THREE_ready) return;
  if (mesh_defiant) { THREE_scene.remove(mesh_defiant); }
  if (G.playerShipKey === 'enterprise_e') {
    mesh_defiant = buildSovereignGeometry();
    engine_glow_player.color.setHex(0x4477ff);
  } else {
    mesh_defiant = buildDefiantGeometry();
    engine_glow_player.color.setHex(0x4477ff);
  }
  mesh_defiant.position.set(-28, 0, 0);
  THREE_scene.add(mesh_defiant);
  shield_player.position.copy(mesh_defiant.position);
  // Clean up any lingering saucer sep from previous game
  _cleanupSaucerSep();
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
  while (mesh_enemyGroup.children.length) mesh_enemyGroup.remove(mesh_enemyGroup.children[0]);
  mesh_enemy = buildEnemyGeometry(G.enemyArchetype);
  mesh_enemyGroup.add(mesh_enemy);
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];
  engine_glow_enemy.color.setHex(_FACTION_GLOW_COL[cfg.faction] || 0xff2200);
}

function _cleanupSaucerSep() {
  if (mesh_saucer_sep) {
    THREE_scene.remove(mesh_saucer_sep);
    mesh_saucer_sep.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
    mesh_saucer_sep = null;
  }
  if (engine_glow_saucer) engine_glow_saucer.intensity = 0;
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
  THREE_camera.lookAt(new THREE.Vector3(
    mesh_enemyGroup.position.x*0.45 + mesh_defiant.position.x*0.55, 0, 0
  ));

  // Defiant drift — amplitude scales with helm speed
  const _speedDrift = { stop:0.2, maneuvering:0.5, half:1.0, full:1.8 }[G.helmSpeed] ?? 1.0;
  mesh_defiant.position.y = Math.sin(now*0.4)*0.6*_speedDrift;
  mesh_defiant.position.z = Math.sin(now*0.25)*0.8*_speedDrift;
  mesh_defiant.rotation.z = Math.sin(now*0.3)*0.03*_speedDrift;

  // Hull damage colouring
  const hullPct = G.player.hull / G.player.maxHull;
  mesh_defiant.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive) {
      child.material.emissive.setRGB(hullPct<0.35?0.12+(1-hullPct)*0.1:0.04, hullPct<0.35?0.02:0.08, hullPct<0.35?0.02:0.16);
    }
  });

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
      const exX = mesh_defiant.position.x + (isEnt ? -8.4 : -5.2);
      const exY = mesh_defiant.position.y + (isEnt ? -2.4 : -0.5);
      const nacZ = isEnt ? 3.8 : 3.0;
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

  // Cloaking — fade Defiant
  const tOp = G.cloaked ? 0.0 : G.cloakVulnTimer>0 ? 0.3+Math.sin(now*20)*0.3 : 1.0;
  mesh_defiant.traverse(child => { if (child.isMesh) { child.material.transparent=tOp<1; child.material.opacity=THREE.MathUtils.lerp(child.material.opacity??1, tOp, 0.12); } });

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

    // Enemy cloaking
    const eOp=G.enemyCloaked?0.0:G.enemyCloakVulnTimer>0?0.25+Math.sin(now*18)*0.25:1.0;
    mesh_enemyGroup.traverse(child=>{ if(child.isMesh&&child.material){child.material.transparent=eOp<1;child.material.opacity=THREE.MathUtils.lerp(child.material.opacity??1,eOp,0.10);} });

    // Enemy hull damage
    const eHullPct=G.running&&G.threat.hull?G.threat.hull/G.threat.maxHull:1;
    if (eHullPct<0.30) {
      mesh_enemyGroup.traverse(child=>{ if(child.isMesh&&child.material&&child.material.emissive) child.material.emissive.setRGB(0.25+Math.sin(now*4)*0.1,0.04,0.04); });
    }

    // Enemy shield bubble
    shield_enemy.position.copy(mesh_enemyGroup.position); shield_enemy.rotation.y=-now*0.25;
    if (G.enemyCloaked) { shield_enemy.material.opacity=0; }
    else if (G.shieldHitFlash.enemy.timer>0) {
      const f=G.shieldHitFlash.enemy.timer/600; shield_enemy.material.opacity=0.40*f;
      shield_enemy.material.emissive.setRGB(1.0,f*0.3,f*0.1); shield_enemy.material.color.setRGB(1.0,0.3,0.1);
    } else {
      const eShAvg=G.threat.shields?['fore','port','starboard','aft'].reduce((a,s)=>a+(G.threat.shields[s]||0),0)/4:0;
      shield_enemy.material.opacity=0.04+(G.running&&cfg.shields?eShAvg/cfg.shields.fore:0)*0.07;
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
    const fromV = isEnemy
      ? mesh_enemyGroup.position.clone().add(new THREE.Vector3(-4,0,0))
      : mesh_defiant.position.clone().add(new THREE.Vector3(5,0,0));
    const toV = isEnemy
      ? mesh_defiant.position.clone().add(new THREE.Vector3(4,0,0))
      : mesh_enemyGroup.position.clone().add(new THREE.Vector3(-4,0,0));
    const col = isEnemy
      ? (_FACTION_BEAM_COL[ENEMY_CONFIGS[G.enemyArchetype]?.faction] || 0xff4422)
      : (bCols[b.type] || 0xffffff);
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
    const fromV = t.fromEnemy ? mesh_enemyGroup.position.clone() : mesh_defiant.position.clone();
    const toV   = t.fromEnemy ? mesh_defiant.position.clone() : mesh_enemyGroup.position.clone();
    // Enemy: red warning. Player quantum: blue-white (First Contact canon). Player photon: orange-red (classic Trek).
    const col   = t.fromEnemy ? 0xff2200 : (t.isPhoton ? 0xff6600 : 0x99ccff);
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
  G.renderedBeamsVector = G.renderedBeamsVector.filter(b => performance.now() - b.trackingStartTime < b.duration);
  THREE_renderer.render(THREE_scene, THREE_camera);
}
