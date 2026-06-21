'use strict';

// ============================================================
// NETPLAY — host-authoritative networked bridge crew (Phase 1)
// See docs/MULTIPLAYER_DESIGN.md. One client is the HOST (runs the authoritative
// G + sim loop, may also man a station). Others are TERMINALS (render from
// snapshots, forward their station's inputs to the host).
//
// Transport-agnostic: the controller talks to a small interface so the same
// logic runs over a real PeerJS/WebRTC link OR an in-page LOOPBACK transport
// used for testing without any network.
// Depends on: state.js (G), main.js (_simStep/_renderStep), and the action fns.
// ============================================================

// ── Net state ────────────────────────────────────────────────
G.net = {
  role: 'off',            // 'off' | 'host' | 'terminal'
  roomId: null,
  you: { name: '', station: null },
  crew: { tactical: null, engineering: null, helm: null, captain: null }, // station -> {id,name}
  transport: null,
  snapHz: 15,
  _lastSnap: 0,
  _inputSeq: 0,
  _evq: [],          // host: queued one-shot events (log lines, …) flushed with each snapshot
  _beamSeq: 0,       // host: unique id per weapon-beam so terminals spawn each once
  _seenBeams: {},    // terminal: beam id -> arrival time (dedupe + prune)
  _rejoin: null,     // terminal: {code,station,name} for auto-reconnect
  _reattempts: 0,
};

// Host queues a one-shot event for terminals (no-op off-host). Bounded.
function netEmit(ev) { if (G.net.role === 'host') { G.net._evq.push(ev); if (G.net._evq.length > 100) G.net._evq.shift(); } }

function netRole() { return G.net.role; }
function netActive() { return G.net.role !== 'off'; }
function netIsHost() { return G.net.role === 'host'; }
function netIsTerminal() { return G.net.role === 'terminal'; }

// Actions a terminal forwards to the host instead of executing locally. The host
// holds the real implementations; on a terminal each is replaced by a forwarder.
const NET_ACTIONS = [
  // tactical
  'fireSelectedArray','fireEnergyWeapons','fireTorpedoBanks','fireAllWeapons',
  'executeBurstFireSalvo','executeAlphaSalvoFire','executeConcentratedPhaserFire',
  'executeCannonOvercharge','executeUnstableTorpedo','executeEmergencyPowerDump',
  'executeMaximumPulseBurst','executeMaxPhaserOutput','executeTricobalWarhead',
  'toggleCloakingDevice','toggleSaucerSeparation','rotateShieldFrequency',
  'executeEvasivePattern','startDeepScan','setEnemyTarget',
  'pumpShieldSector','rebalanceShieldArrays','attemptEmergencyWarp',
  // engineering
  'tuneBusAllocation','applyPowerPreset','assignRepairTeam','activateEmergencyBattery',
  'adjustShieldRegenMode','masterConduitFlush','repairCloakingDevice',
  'emergencyRepairWeapons','emergencyRepairSystems',
  'divertPowerToWeapons','toggleFireCoordination','engageEmergencyForcefields',
  // helm
  'setHelmSpeed','setHelmAttackVector','setHelmPitch','setPlayerRangeBracket',
  'executeAttackRun','executeComeAbout','executePicardManoeuver',
  'executeAttackPatternOmega','executeEvasivePatternAlpha',
  // captain orders (cap* are all forwarded wholesale)
];

let _NET_ORIG = {};   // host/terminal: original implementations by name

// On a terminal, replace each networked action with a forwarder that sends an
// `input` to the host. Captain orders (cap*) are wrapped dynamically by prefix.
function _installTerminalForwarders() {
  _NET_ORIG = {};
  const wrap = (name) => {
    if (typeof window[name] !== 'function') return;
    _NET_ORIG[name] = window[name];
    window[name] = function (...args) { netSendInput(name, args); };
  };
  NET_ACTIONS.forEach(wrap);
  Object.keys(window).forEach(k => { if (/^cap[A-Z]/.test(k) && typeof window[k] === 'function') wrap(k); });
}
function _removeTerminalForwarders() {
  Object.keys(_NET_ORIG).forEach(name => { window[name] = _NET_ORIG[name]; });
  _NET_ORIG = {};
}

// ── Snapshot (host → terminals) ──────────────────────────────
// Whole G minus transient visual buffers + the unbounded log (those ride the
// event channel / are regenerated locally). G holds only JSON-safe values.
const _SNAP_SKIP = new Set(['net','renderedBeamsVector','damageParticles','historicalLogTracks']);
function serializeG() {
  const out = {};
  for (const k in G) {
    if (_SNAP_SKIP.has(k)) continue;
    if (typeof G[k] === 'function') continue;
    out[k] = G[k];
  }
  return JSON.parse(JSON.stringify(out));
}
function applySnapshot(snap) {
  for (const k in snap) { if (_SNAP_SKIP.has(k)) continue; G[k] = snap[k]; }
}

// ── Transport interface ──────────────────────────────────────
// A transport implements: send(peerId,msg), broadcast(msg), and calls the
// controller's _net.onMessage(fromId,msg) / onJoin(id) / onLeave(id).
const _net = {
  onMessage(fromId, msg) {
    if (netIsHost()) _hostHandle(fromId, msg);
    else _terminalHandle(msg);
  },
  onJoin(id)  { /* host: wait for the peer's `join` message before assigning */ },
  onLeave(id) { if (netIsHost()) _hostPeerLeft(id); else _terminalHostLost(); },
};

// ── HOST ─────────────────────────────────────────────────────
function netHost(name, transport) {
  G.net.role = 'host';
  G.net.transport = transport;
  G.net.you = { name: name || 'Captain', station: null };
  G.net.crew = { tactical: null, engineering: null, helm: null, captain: null };
  G.net._snapCache = {}; G.net._snapFrame = 0; G.net._needKeyframe = true;  // fresh delta baseline
  transport.start(_net, (roomId) => { G.net.roomId = roomId; _updateLobbyUI(); });
  _updateLobbyUI();
}

function _hostHandle(fromId, msg) {
  switch (msg.t) {
    case 'join': {
      const s = msg.station;
      if (!STATIONS.includes(s) || G.net.crew[s]) {
        G.net.transport.send(fromId, { t: 'reject', reason: G.net.crew[s] ? 'station taken' : 'bad station' });
        return;
      }
      G.net.crew[s] = { id: fromId, name: msg.name || s };
      G.stationControl[s] = 'remote';
      G.net._needKeyframe = true;   // next broadcast is full so the new joiner gets complete state
      G.net.transport.send(fromId, { t: 'welcome', youAre: s, crew: _crewSummary(), running: G.running });
      _broadcast({ t: 'crew_update', crew: _crewSummary() });
      postLogEvent(`${msg.name || 'A teammate'} took ${s.toUpperCase()} station.`, 'good');
      _updateLobbyUI();
      break;
    }
    case 'input': {
      // Validate: sender owns the station; then apply the real implementation.
      const crew = G.net.crew[msg.station];
      if (!crew || crew.id !== fromId) return;
      _applyRemoteInput(msg.station, msg.action, msg.args);
      break;
    }
    case 'ping': G.net.transport.send(fromId, { t: 'pong', t0: msg.t0 }); break;
  }
}

// Apply an action a remote teammate requested, as if their station issued it.
// `G._actingStation` lets station-gated functions accept it (see _canAct).
function _applyRemoteInput(station, action, args) {
  if (!NET_ACTIONS.includes(action) && !/^cap[A-Z]/.test(action)) return; // whitelist
  const fn = window[action];
  if (typeof fn !== 'function') return;
  const prev = G._actingStation;
  G._actingStation = station;
  try { fn.apply(null, args || []); } catch (e) { console.warn('remote input failed', action, e); }
  finally { G._actingStation = prev; }
}

function _hostPeerLeft(id) {
  STATIONS.forEach(s => {
    if (G.net.crew[s] && G.net.crew[s].id === id) {
      postLogEvent(`${G.net.crew[s].name} left ${s.toUpperCase()} — reverting to auto.`, 'warn');
      G.net.crew[s] = null;
      G.stationControl[s] = 'auto';   // graceful degradation
    }
  });
  _broadcast({ t: 'crew_update', crew: _crewSummary() });
  _updateLobbyUI();
}

// Called from the game loop on the host; throttled to snapHz.
// DELTA snapshots: only top-level G fields whose serialized value changed since
// the last send are transmitted (most fields are static frame-to-frame, so this
// cuts bandwidth/TURN data ~80–90%). A FULL keyframe is sent periodically (~every
// 2 s), when a new crew member joins, and at the start of each battle, so late
// joiners and any drift self-correct. Terminals ignore deltas until their first
// full keyframe.
function netHostBroadcastSnapshot(nowMs) {
  if (!netIsHost()) return;
  const iv = 1000 / G.net.snapHz;
  if (nowMs - G.net._lastSnap < iv) return;
  G.net._lastSnap = nowMs;

  if (G.net._snapSession !== G.gameSessionId) { G.net._snapSession = G.gameSessionId; G.net._needKeyframe = true; }
  const full = G.net._needKeyframe || ((G.net._snapFrame = (G.net._snapFrame || 0) + 1) % 30 === 0);
  G.net._needKeyframe = false;
  if (full) G.net._snapCache = {};

  const d = {};
  for (const k in G) {
    if (_SNAP_SKIP.has(k) || typeof G[k] === 'function') continue;
    const js = JSON.stringify(G[k]);
    if (G.net._snapCache[k] !== js) { d[k] = G[k]; G.net._snapCache[k] = js; }
  }
  // Weapon beams ride alongside (skipped by the field loop): tag each with a
  // stable id so terminals spawn it exactly once on their own clock.
  const beams = (G.renderedBeamsVector || []).map(b => { if (!b._bid) b._bid = ++G.net._beamSeq; return b; });
  const evs = G.net._evq; G.net._evq = [];
  _broadcast({ t: 'snapshot', full, d: JSON.parse(JSON.stringify(d)), beams: JSON.parse(JSON.stringify(beams)), evs });
}

function _broadcast(msg) { if (G.net.transport) G.net.transport.broadcast(msg); }
function _crewSummary() { const c = {}; STATIONS.forEach(s => c[s] = G.net.crew[s] ? { name: G.net.crew[s].name } : null); return c; }

// ── TERMINAL ─────────────────────────────────────────────────
function netJoin(name, station, transport) {
  G.net.role = 'terminal';
  G.net.transport = transport;
  G.net.you = { name: name || 'Crew', station };
  G.net._haveKeyframe = false;   // ignore deltas until the first full keyframe arrives
  _installTerminalForwarders();
  transport.start(_net, () => {
    transport.send('host', { t: 'join', name: G.net.you.name, station });
  });
}

function _terminalHandle(msg) {
  switch (msg.t) {
    case 'welcome':
      G.net._welcomed = true; clearTimeout(G.net._joinWatch); G.net.status = 'In crew — manning ' + msg.youAre.toUpperCase();
      G.net.you.station = msg.youAre;
      G.net.crew = msg.crew || G.net.crew;
      G.activePanel = msg.youAre; G.playerChosenStation = msg.youAre;
      _startTerminalLoop();
      _updateLobbyUI();
      break;
    case 'reject':
      alert('Could not join: ' + (msg.reason || 'unknown'));
      netLeave();
      break;
    case 'crew_update': G.net.crew = msg.crew || G.net.crew; _updateLobbyUI(); break;
    case 'snapshot':
      if (msg.full) G.net._haveKeyframe = true;
      if (!G.net._haveKeyframe) break;           // wait for the first full keyframe
      applySnapshot(msg.d);                       // merge changed fields (or all, if full)
      if (msg.beams) _terminalMergeBeams(msg.beams);
      if (msg.evs && msg.evs.length) _applyEvents(msg.evs);
      G.net._reattempts = 0;  // a snapshot = healthy link
      _terminalBootstrap();   // build this terminal's station UI once (after first snapshot)
      if (!G.net._loopOn) _startTerminalLoop();
      break;
    case 'pong': G.net._ping = performance.now() - msg.t0; break;
  }
}

// Terminal: spawn each new beam once, re-based to the local clock (the host's
// trackingStartTime is on a different epoch and would be filtered out instantly).
function _terminalMergeBeams(beams) {
  const now = performance.now();
  beams.forEach(b => {
    if (G.net._seenBeams[b._bid]) return;
    G.net._seenBeams[b._bid] = now;
    b.trackingStartTime = now;     // rebase onto this client's clock
    b._three_spawned = false;      // let the render loop spawn it
    G.renderedBeamsVector.push(b);
  });
  // Prune old ids (beams are short-lived; the render loop drops them by duration).
  for (const id in G.net._seenBeams) if (now - G.net._seenBeams[id] > 5000) delete G.net._seenBeams[id];
}

// Terminal: apply host one-shot events (battle log, etc.).
function _applyEvents(evs) {
  evs.forEach(ev => { if (ev.k === 'log' && typeof postLogEvent === 'function') postLogEvent(ev.msg, ev.tier); });
}

// Mirror the host's battle log to terminals: wrap postLogEvent once so host logs
// queue an event. Harmless off-host (the netIsHost gate skips the queue).
(function _wrapPostLog() {
  if (typeof postLogEvent !== 'function' || postLogEvent._netWrapped) return;
  const orig = postLogEvent;
  window.postLogEvent = function (msg, tier) { orig(msg, tier); if (G.net.role === 'host') netEmit({ k: 'log', msg, tier }); };
  window.postLogEvent._netWrapped = true;
})();

function netSendInput(action, args) {
  if (!netIsTerminal() || !G.net.transport) return;
  G.net.transport.send('host', { t: 'input', station: G.net.you.station, action, args, seq: ++G.net._inputSeq });
}

// Terminals render from the latest snapshot every frame (no sim).
function _startTerminalLoop() {
  if (G.net._loopOn) return;
  G.net._loopOn = true;
  const loop = () => {
    if (!netIsTerminal()) { G.net._loopOn = false; return; }
    try { _renderStep(); } catch (e) {}
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Build this terminal's station UI once, from the first snapshot's state (the
// terminal never ran initiateVesselSimulation, so its DOM/meshes are unbuilt).
function _terminalBootstrap() {
  if (G.net._booted || !G.net.you.station) return;
  G.net._booted = true;
  const st = G.net.you.station;
  try {
    if (typeof selectPlayerShip === 'function')      selectPlayerShip(G.playerShipKey || 'defiant');
    if (typeof rebuildEnemyMesh === 'function')      rebuildEnemyMesh();
    if (typeof rebuildPlayerMesh === 'function')     rebuildPlayerMesh();
    if (typeof rebuildPackMeshes === 'function')     rebuildPackMeshes();
    if (typeof rebuildWeaponFireMatrix === 'function') rebuildWeaponFireMatrix();
    if (typeof _buildELCache === 'function')         _buildELCache();
    if (typeof _rebuildCapBarCache === 'function')   _rebuildCapBarCache();
    if (typeof _updateSpecialAbilityButtons === 'function') _updateSpecialAbilityButtons();
    if (typeof buildCaptainSignaturePanel === 'function')   buildCaptainSignaturePanel();
    if (typeof buildEnemySubsystemTargetGrid === 'function') buildEnemySubsystemTargetGrid();
    if (st === 'captain' && typeof initCaptainStation === 'function') initCaptainStation();
    const ov = document.getElementById('overlay');             if (ov) ov.style.display = 'none';
    const pb = document.getElementById('pre-battle-overlay');  if (pb) pb.style.display = 'none';
    toggleActiveDeck(st);   // show this terminal's deck (control stays host-driven)
    postLogEvent(`Connected — manning ${st.toUpperCase()}. Receiving telemetry from the host.`, 'good');
  } catch (e) { console.warn('terminal bootstrap error', e); }
}

function _terminalHostLost() {
  G.net._loopOn = false;
  const rj = G.net._rejoin;
  if (rj && G.net._reattempts < 4) {
    G.net._reattempts++;
    if (typeof postLogEvent === 'function') postLogEvent(`Link to host lost — reconnecting (${G.net._reattempts}/4)…`, 'warn');
    try { if (G.net.transport && G.net.transport.stop) G.net.transport.stop(); } catch (e) {}
    G.net._booted = false;   // re-bootstrap UI from the next snapshot
    const realST = window.setTimeout;   // sim-clock shim may be active during play
    realST(async () => { netJoin(rj.name, rj.station, PeerJsTransport({ hostId: _roomPeerId(rj.code), config: { iceServers: await _fetchIce() }, onStatus: _netStatus })); }, 1500 + G.net._reattempts * 1000);
    return;
  }
  alert('Lost connection to host.');
  netLeave();
}

function netLeave() {
  if (G.net.transport && G.net.transport.stop) G.net.transport.stop();
  if (netIsTerminal()) _removeTerminalForwarders();
  G.net.role = 'off'; G.net.transport = null; G.net._loopOn = false;
  _updateLobbyUI();
}

// (_canAct/_opStation live in state.js so early-loading modules can use them.)

// ── Lobby UI (host/join buttons in the setup overlay) ────────
// ICE servers — STUN (public-IP discovery) + a free TURN relay so peers on
// different / restrictive networks (mobile data, symmetric NAT) can connect when
// direct P2P fails. TURN is the Open Relay Project (free, best-effort).
// Build the ICE server list: STUN + best-effort free TURN, PLUS any custom TURN
// the user has supplied (localStorage 'stg_turn') — e.g. a free metered.ca key.
// TURN over TCP:443 relays through VPNs / strict NATs when direct P2P fails.
function _iceServers() {
  const base = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ];
  try {
    const c = localStorage.getItem('stg_turn');
    if (c) { const j = JSON.parse(c); return { iceServers: base.concat(Array.isArray(j) ? j : [j]) }; }
  } catch (e) {}
  return { iceServers: base };
}
// Console helpers: paste your own TURN (e.g. metered.ca) without editing code.
//   netSetTurn('{"urls":"turn:…:443?transport=tcp","username":"u","credential":"p"}')
function netSetTurn(json) { try { JSON.parse(json); localStorage.setItem('stg_turn', json); return 'TURN saved — re-host / re-join to use it.'; } catch (e) { return 'Invalid JSON: ' + e.message; } }
function netClearTurn() { localStorage.removeItem('stg_turn'); return 'Custom TURN cleared.'; }

function _netStatus(msg) { G.net.status = msg; renderNetLobby(); }

// Fetch fresh (time-limited) STUN+TURN credentials from metered.live so online
// play works through VPNs and strict/mobile NATs (TURN relays the traffic when a
// direct path is blocked). Falls back to the static _iceServers() set on failure.
const METERED_TURN_URL = 'https://st-game.metered.live/api/v1/turn/credentials?apiKey=cfdd5653742f8b5081e98b0c1be8be5327c2';
async function _fetchIce() {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 4000);
    const resp = await fetch(METERED_TURN_URL, { signal: ctl.signal });
    clearTimeout(to);
    if (resp.ok) {
      const servers = await resp.json();
      if (Array.isArray(servers) && servers.length) {
        console.log('[netplay] metered.live TURN loaded (' + servers.length + ' ICE servers)');
        let extra = [];   // also honour a console-supplied custom TURN
        try { const c = localStorage.getItem('stg_turn'); if (c) { const j = JSON.parse(c); extra = Array.isArray(j) ? j : [j]; } } catch (e) {}
        return servers.concat(extra);
      }
    }
  } catch (e) { console.warn('[netplay] metered.live TURN fetch failed — using fallback', e && e.name); }
  return _iceServers().iceServers;
}

// Short, human-friendly room code (no ambiguous chars). Namespaced into the peer
// id so it stays unique on the shared PeerJS server while the player types ~4 chars.
function _genRoomCode(n) { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < (n || 4); i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function _roomPeerId(code) { return 'stg-' + String(code).trim().toLowerCase(); }

async function netHostGame() {
  if (typeof Peer === 'undefined') { alert('PeerJS failed to load — online crew unavailable.'); return; }
  const name = (prompt('Your name (host / captain):', 'Captain') || 'Captain').slice(0, 16);
  const code = _genRoomCode(4);
  G.net.roomCode = code;   // short display code (the full peer id is "stg-<code>")
  const iceServers = await _fetchIce();
  netHost(name, PeerJsTransport({ host: true, id: _roomPeerId(code), config: { iceServers }, onStatus: _netStatus, onError: (e) => {
    if (e && e.type === 'unavailable-id') { alert('Room code already in use — please click HOST CREW again.'); netLeave(); }
    else console.warn('PeerJS error', e && e.type);
  } }));
  // Host then proceeds through normal setup; teammates join while it sets up.
}

async function netJoinPrompt() {
  if (typeof Peer === 'undefined') { alert('PeerJS failed to load — online crew unavailable.'); return; }
  const code = (prompt('Room code from the host:', (window._inviteCode || '')) || '').trim();
  if (!code) return;
  const station = (prompt('Station to man — tactical / engineering / helm / captain:', 'tactical') || '').trim().toLowerCase();
  if (!STATIONS.includes(station)) { alert('Unknown station: ' + station); return; }
  const name = (prompt('Your name:', station) || station).slice(0, 16);
  G.net._rejoin = { code, station, name };   // for auto-reconnect on a dropped link
  G.net._reattempts = 0;
  const iceServers = await _fetchIce();
  netJoin(name, station, PeerJsTransport({ hostId: _roomPeerId(code), config: { iceServers }, onStatus: _netStatus, onError: (e) => {
    if (e && (e.type === 'peer-unavailable')) { alert('No room with code "' + code.toUpperCase() + '" — check the code, and make sure the host clicked HOST CREW.'); netLeave(); }
    else console.warn('PeerJS error', e && e.type);
  } }));
  // Join watchdog: if no welcome lands in time, surface a hint.
  clearTimeout(G.net._joinWatch);
  G.net._joinWatch = setTimeout(() => {
    if (netIsTerminal() && !G.net._welcomed) _netStatus('No response from host yet — check the code, and that the host clicked HOST CREW & is online.');
  }, 12000);
}

// Share an invite — a link with the code prefilled (?join=CODE) so a teammate
// taps it and only picks a station. Uses the native share sheet on mobile,
// clipboard otherwise.
function netShareInvite() {
  const code = G.net.roomCode; if (!code) return;
  const url = location.origin + location.pathname + '?join=' + code;
  const text = `Join my Starship bridge crew — room code ${code}`;
  if (navigator.share) { navigator.share({ title: 'Starship Bridge Crew', text, url }).catch(() => {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(
      () => { const b = document.getElementById('net-share-btn'); if (b) { const t = b.textContent; b.textContent = '✓ Link copied!'; setTimeout(() => b.textContent = t, 1800); } },
      () => prompt('Copy this invite link:', url));
  } else prompt('Copy this invite link:', url);
}

function renderNetLobby() {
  const box = document.getElementById('net-lobby-status');
  if (!box) return;
  if (!netActive()) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const roster = STATIONS.map(s => {
    const c = G.net.crew[s];
    const who = c ? c.name : (G.net.role === 'host' && G.net.you.station === s ? G.net.you.name + ' (you)' : '— auto —');
    const mine = (G.net.role === 'terminal' && G.net.you.station === s) ? ' ◀ you' : '';
    return `<div>${s.toUpperCase().padEnd(12).replace(/ /g,'&nbsp;')} ${who}${mine}</div>`;
  }).join('');
  const head = G.net.role === 'host'
    ? `<div style="color:var(--green);">HOSTING — room code: <b style="color:#fff;font-size:15px;letter-spacing:2px;">${G.net.roomCode || '…'}</b>
        <button id="net-share-btn" class="pill-action-btn" style="padding:3px 10px;font-size:10px;background:var(--t);margin-left:8px;" onclick="netShareInvite()">📤 Share invite</button></div>`
    : `<div style="color:var(--t);">TERMINAL — ${G.net.you.station ? 'manning ' + G.net.you.station.toUpperCase() : 'connecting…'}</div>`;
  const status = G.net.status ? `<div style="margin-top:4px;color:var(--warn);font-size:9px;">${G.net.status}</div>` : '';
  box.innerHTML = head + status + `<div style="margin-top:4px;color:#7799aa;">CREW:</div>` + roster +
    `<div style="margin-top:6px;"><button class="pill-action-btn" style="padding:4px 10px;font-size:10px;background:var(--dim2);color:#aabbcc;" onclick="netLeave()">Disconnect</button></div>`;
}

function _updateLobbyUI() { renderNetLobby(); }
