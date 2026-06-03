'use strict';

// ============================================================
// CANVAS-THREE-GEOMETRY.JS — Three.js mesh/geometry builders
// Split out of canvas-three.js. Pure geometry: each builder returns a
// THREE.Group. Reads colour/offset consts (_FACTION_*, _NAC_OFFSET, etc.)
// and helpers declared in canvas-three.js, so that file MUST load first.
// Builders are only invoked at runtime (initThreeScene / rebuild*) so
// relative load order with the render file does not matter.
// ============================================================

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

  // ── Twin nacelles — the Defiant's defining feature ────────────
  // The Defiant-class mounts two large warp nacelles recessed into the aft
  // hull flanks. Each is modelled as a stacked upper+lower pod pair per side,
  // which together read as the tall, wide nacelle structures of the Defiant
  // (rather than thin external tubes):
  //   Upper pods: hull mid-line,        z = ±2.6
  //   Lower pods: below hull mid-line,  z = ±1.5
  const nacGeo = new THREE.CylinderGeometry(0.30, 0.42, 4.8, 8);
  const bussGeo = new THREE.SphereGeometry(0.36, 8, 6);
  const bussMat = new THREE.MeshPhongMaterial({ color:0xff5500, emissive:0xcc2200, emissiveIntensity:2.2 });

  [
    { z: 2.6,  y: 0.0,  label:'port_upper' },  // port nacelle — upper pod
    { z: -2.6, y: 0.0,  label:'stbd_upper' },  // starboard nacelle — upper pod
    { z: 1.5,  y:-0.9,  label:'port_lower' },  // port nacelle — lower pod (tucked)
    { z:-1.5,  y:-0.9,  label:'stbd_lower' },  // starboard nacelle — lower pod
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
