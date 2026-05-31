'use strict';

// ============================================================
// CANVAS REFERENCES & STAR FIELD
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
  // Three.js resize
  resizeThreeRenderer();
}


// ============================================================
// THREE.JS 3D SPATIAL BATTLE VIEW — WebGL renderer
// Ships are genuine 3D meshes; camera follows Defiant.
// Designed for helm expansion: move mesh_defiant, camera follows.
// ============================================================
let THREE_scene, THREE_camera, THREE_renderer, THREE_clock;
let mesh_defiant, mesh_enemy, mesh_enemyGroup;
let shield_player, shield_enemy;
let grid_helper;
let beam_lines = [];
let torp_meshes = [];
let particle_system, particle_positions, particle_colours, particle_velocities, particle_life;
const PARTICLE_COUNT = 300;
let engine_glow_player, engine_glow_enemy;
let THREE_ready = false;

function buildDefiantGeometry() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color:0x1a2a50, emissive:0x0a1428, specular:0x4466cc, shininess:60 });
  const nacMat  = new THREE.MeshPhongMaterial({ color:0x112244, emissive:0x0a1428, specular:0x4466cc, shininess:40 });
  // Main hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9,1.8,3.5), hullMat);
  group.add(hull);
  // Bridge
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.9,8,6), new THREE.MeshPhongMaterial({ color:0x223366, emissive:0x112244, specular:0x6688ff, shininess:80 }));
  bridge.position.set(2.5,1.1,0); bridge.scale.set(1,0.5,0.8);
  group.add(bridge);
  // Nacelles
  const nacGeo = new THREE.CylinderGeometry(0.4,0.5,4.5,8);
  [2.8,-2.8].forEach(z => {
    const n = new THREE.Mesh(nacGeo, nacMat); n.rotation.z = Math.PI/2; n.position.set(-1.5,-0.2,z); group.add(n);
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.45,8,6), new THREE.MeshPhongMaterial({ color:0x4477ff, emissive:0x2244cc, emissiveIntensity:2 }));
    g.position.set(-3.5,-0.2,z); group.add(g);
  });
  return group;
}

function buildEnemyGeometry(archetype) {
  const cfg = ENEMY_CONFIGS[archetype];
  const fCol = { Klingon:0x3a0a0a, Romulan:0x0a200a, Cardassian:0x2a1a00, Dominion:0x1a0a2a, Borg:0x001a10 };
  const fEmi = { Klingon:0x1a0000, Romulan:0x001a00, Cardassian:0x1a0a00, Dominion:0x0a001a, Borg:0x002010 };
  const mat  = new THREE.MeshPhongMaterial({ color:fCol[cfg.faction]||0x1a0808, emissive:fEmi[cfg.faction]||0x0a0000, specular:0x882222, shininess:40, transparent:true, opacity:1 });
  const group = new THREE.Group();
  if (archetype === 'borg_probe') {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(7,7,7), new THREE.MeshPhongMaterial({ color:0x001a10, emissive:0x003020, specular:0x00cc66, shininess:30 }));
    group.add(cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7.1,7.1,7.1)), new THREE.LineBasicMaterial({ color:0x00cc66, transparent:true, opacity:0.6 }));
    group.add(edges);
  } else {
    const sz = { romulan_warbird:10, ktinga:8, vor_cha:9, romulan_bop:7, jem_hadar_battleship:9 }[archetype] || 7;
    const body = new THREE.Mesh(new THREE.ConeGeometry(1.4,sz,6), mat);
    body.rotation.z = Math.PI/2;
    group.add(body);
    if (['ktinga','vor_cha','romulan_bop','romulan_warbird'].includes(archetype)) {
      const wSz = archetype === 'romulan_warbird' ? 10 : 7;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(sz*0.5, 0.5, wSz), mat.clone());
      wing.position.set(-sz*0.15, 0, 0);
      group.add(wing);
    }
  }
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
  const N=1500, pos=new Float32Array(N*3), col=new Float32Array(N*3);
  for (let i=0;i<N;i++) {
    const r=400+Math.random()*200, t=Math.random()*Math.PI*2, p=Math.random()*Math.PI;
    pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
    const br=0.5+Math.random()*0.5, tint=Math.random();
    col[i*3]=br*(tint>0.7?0.7:1); col[i*3+1]=br*(tint>0.8?0.7:1); col[i*3+2]=br*(tint<0.3?0.7:1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',   new THREE.BufferAttribute(col,3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size:0.8, vertexColors:true, sizeAttenuation:true }));
}

function initThreeScene() {
  const mount = document.getElementById('spatial-3d-mount');
  if (!mount || typeof THREE === 'undefined') { console.warn('Three.js not available'); return; }
  const w = mount.clientWidth || 500, h = mount.clientHeight || 300;

  THREE_scene  = new THREE.Scene();
  THREE_scene.background = new THREE.Color(0x000008);
  THREE_scene.fog        = new THREE.FogExp2(0x000010, 0.0018);
  THREE_clock  = new THREE.Clock();

  THREE_camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 1000);
  THREE_camera.position.set(-55, 28, 0);
  THREE_camera.lookAt(30, 0, 0);

  THREE_renderer = new THREE.WebGLRenderer({ antialias:true });
  THREE_renderer.setPixelRatio(window.devicePixelRatio || 1);
  THREE_renderer.setSize(w, h);
  THREE_renderer.shadowMap.enabled = true;
  mount.appendChild(THREE_renderer.domElement);
  THREE_renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';

  // Lighting
  THREE_scene.add(new THREE.AmbientLight(0x0a1020, 0.8));
  const keyL = new THREE.DirectionalLight(0xfff8f0, 1.2); keyL.position.set(80,60,20); keyL.castShadow=true; THREE_scene.add(keyL);
  const rimL = new THREE.DirectionalLight(0x1133ff, 0.4); rimL.position.set(-40,-10,0); THREE_scene.add(rimL);
  const redF = new THREE.PointLight(0xff2200, 1.5, 80); redF.position.set(35,5,0); THREE_scene.add(redF);

  // Static scene
  THREE_scene.add(buildStarfield());
  grid_helper = new THREE.GridHelper(200, 40, 0x1133aa, 0x0a1a44);
  grid_helper.position.y = -8; grid_helper.material.transparent=true; grid_helper.material.opacity=0.35;
  THREE_scene.add(grid_helper);

  // Nebula planes
  [[0x200040,-0.06,60,30,0],[0x002040,-0.04,50,25,1]].forEach(([col,y,sx,sy,side]) => {
    const neb = new THREE.Mesh(new THREE.PlaneGeometry(sx,sy), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.12, side:THREE.DoubleSide, depthWrite:false }));
    neb.position.set(20+side*30, y*80+60, -80+side*40); neb.rotation.x=-Math.PI/8;
    THREE_scene.add(neb);
  });

  // Player
  mesh_defiant = buildDefiantGeometry();
  mesh_defiant.position.set(-28,0,0);
  THREE_scene.add(mesh_defiant);
  engine_glow_player = new THREE.PointLight(0x4477ff, 2.5, 20); engine_glow_player.position.set(-33,0,0); THREE_scene.add(engine_glow_player);
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
  const glow = { Klingon:0xff2200, Romulan:0x00cc44, Cardassian:0xffaa00, Dominion:0x8822ff, Borg:0x00cc66 };
  engine_glow_enemy.color.setHex(glow[cfg.faction] || 0xff2200);
}

function renderSpatialViewCanvas() {
  if (!THREE_ready || !THREE_renderer) return;
  const dt  = Math.min(THREE_clock.getDelta(), 0.05);
  const now = THREE_clock.getElapsedTime();
  const cfg = ENEMY_CONFIGS[G.enemyArchetype];

  // Camera follow
  const desiredCam = new THREE.Vector3(mesh_defiant.position.x-55, mesh_defiant.position.y+28, mesh_defiant.position.z);
  THREE_camera.position.lerp(desiredCam, 0.04);
  THREE_camera.lookAt(new THREE.Vector3(mesh_enemyGroup.position.x*0.4+mesh_defiant.position.x*0.6, 0, 0));

  // Defiant drift
  mesh_defiant.position.y = Math.sin(now*0.4)*0.6;
  mesh_defiant.position.z = Math.sin(now*0.25)*0.8;
  mesh_defiant.rotation.z = Math.sin(now*0.3)*0.03;

  // Hull damage colouring
  const hullPct = G.player.hull / G.player.maxHull;
  mesh_defiant.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive) {
      child.material.emissive.setRGB(hullPct<0.35?0.12+(1-hullPct)*0.1:0.04, hullPct<0.35?0.02:0.08, hullPct<0.35?0.02:0.16);
    }
  });

  // Engine glow
  engine_glow_player.intensity = G.cloaked ? 0.1 : 1.5+Math.sin(now*3)*0.8*(G.systems.engines.health/100);
  engine_glow_enemy.intensity  = G.enemyCloaked ? 0.1 : 1.5+Math.sin(now*2.8)*0.6;

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

  // Enemy movement
  if (G.running) {
    const _eDist = G.enemyRangeBracket==='close'?22:G.enemyRangeBracket==='medium'?38:55;
    const _pDist = G.playerRangeBracket==='close'?22:G.playerRangeBracket==='medium'?38:55;
    const rangeDist = Math.min(_eDist, _pDist);
    mesh_enemyGroup.position.x = THREE.MathUtils.lerp(mesh_enemyGroup.position.x, mesh_defiant.position.x+rangeDist, 0.008);
    mesh_enemyGroup.position.y = Math.sin(now*0.35+1.2)*0.7;
    mesh_enemyGroup.position.z = Math.sin(now*0.22+0.7)*1.1;

    if (G.enemyManeuverState==='angling') {
      const roll={fore:0,aft:Math.PI*0.15,port:0.2,starboard:-0.2}[G.enemyPreferredSector]||0;
      mesh_enemyGroup.rotation.y=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.y,Math.PI+roll*0.5,0.04);
      mesh_enemyGroup.rotation.z=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.z,roll*0.4,0.04);
    } else if (G.enemyManeuverState==='torpedocharge') {
      mesh_enemyGroup.rotation.z=Math.sin(now*8)*0.06;
    } else {
      mesh_enemyGroup.rotation.y=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.y,Math.PI,0.03);
      mesh_enemyGroup.rotation.z=THREE.MathUtils.lerp(mesh_enemyGroup.rotation.z,0,0.03);
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

  // Weapon beams
  const elapsed=THREE_clock.getElapsedTime();
  G.renderedBeamsVector.forEach(b=>{
    if (b._three_spawned||b.type==='burst_flash') return;
    b._three_spawned=true;
    const fromV=mesh_defiant.position.clone().add(new THREE.Vector3(5,0,0));
    const toV=mesh_enemyGroup.position.clone().add(new THREE.Vector3(-5,0,0));
    const bCols={cannon_pu:0x66ccff,cannon_pl:0x66ccff,cannon_su:0x66ccff,cannon_sl:0x66ccff,nose_beam:0xff9900,torpedoes:0xcc66ff,photon:0x4488ff};
    const geo=new THREE.BufferGeometry().setFromPoints([fromV,toV]);
    const mat=new THREE.LineBasicMaterial({color:bCols[b.type]||0xffffff,transparent:true,opacity:0.9});
    const line=new THREE.Line(geo,mat); line._bornAt=elapsed; line._duration=b.duration/1000;
    THREE_scene.add(line); beam_lines.push(line);
  });
  beam_lines=beam_lines.filter(line=>{
    const f=Math.max(0,1-(elapsed-line._bornAt)/line._duration);
    line.material.opacity=f*0.9;
    if (f<=0){THREE_scene.remove(line);line.geometry.dispose();line.material.dispose();return false;}
    return true;
  });

  // Torpedoes
  G.inFlightTorpedoes.forEach(t=>{
    if (t._three_mesh) return;
    const fromV=t.fromEnemy?mesh_enemyGroup.position.clone():mesh_defiant.position.clone();
    const toV  =t.fromEnemy?mesh_defiant.position.clone():mesh_enemyGroup.position.clone();
    const col  =t.fromEnemy?0xff3333:(t.isPhoton?0x4488ff:0xcc66ff);
    const geo  =new THREE.SphereGeometry(0.5,8,6);
    const mat  =new THREE.MeshPhongMaterial({color:col,emissive:col,emissiveIntensity:2,transparent:true,opacity:0.9});
    const mesh =new THREE.Mesh(geo,mat);
    mesh.position.copy(fromV); mesh._target=toV.clone(); mesh._origin=fromV.clone(); mesh._progress=0;
    THREE_scene.add(mesh); t._three_mesh=mesh; torp_meshes.push(mesh);
  });
  torp_meshes=torp_meshes.filter(m=>{
    const gt=G.inFlightTorpedoes.find(t=>t._three_mesh===m);
    if (!gt){THREE_scene.remove(m);m.geometry.dispose();m.material.dispose();return false;}
    m._progress=1-(gt.timeToImpact/3500);
    m.position.lerpVectors(m._origin,m._target,Math.max(0,Math.min(1,m._progress)));
    m.position.y+=Math.sin(m._progress*Math.PI)*2;
    return true;
  });

  // Particles
  let pDirty=false;
  for (let i=0;i<PARTICLE_COUNT;i++){
    if (particle_life[i]>0){
      particle_life[i]-=dt;
      particle_positions[i*3]  +=particle_velocities[i*3]  *dt*8;
      particle_positions[i*3+1]+=particle_velocities[i*3+1]*dt*8;
      particle_positions[i*3+2]+=particle_velocities[i*3+2]*dt*8;
      const f=Math.max(0,particle_life[i]);
      particle_colours[i*3]*=f<0.1?0.8:1; particle_colours[i*3+1]*=f<0.1?0.8:1; particle_colours[i*3+2]*=f<0.1?0.8:1;
      pDirty=true;
    }
  }
  if (pDirty){particle_system.geometry.attributes.position.needsUpdate=true;particle_system.geometry.attributes.color.needsUpdate=true;}

  // Consume G.damageParticles → Three.js particles
  if (G.damageParticles.length>0){
    G.damageParticles.forEach(p=>{
      const ox=p.target==='player'?mesh_defiant.position.x:mesh_enemyGroup.position.x;
      const oz=p.target==='player'?mesh_defiant.position.z:mesh_enemyGroup.position.z;
      const isRed=p.col===C.red;
      spawnThreeParticles(ox,0,oz,isRed?1:1,isRed?0.2:0.6,isRed?0.1:0.1,3);
    });
    G.damageParticles=[];
  }

  grid_helper.rotation.y=now*0.008;
  G.renderedBeamsVector=G.renderedBeamsVector.filter(b=>performance.now()-b.trackingStartTime<b.duration);
  THREE_renderer.render(THREE_scene,THREE_camera);
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
