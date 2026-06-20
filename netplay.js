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
};

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
function netHostBroadcastSnapshot(nowMs) {
  if (!netIsHost()) return;
  const iv = 1000 / G.net.snapHz;
  if (nowMs - G.net._lastSnap < iv) return;
  G.net._lastSnap = nowMs;
  _broadcast({ t: 'snapshot', g: serializeG() });
}

function _broadcast(msg) { if (G.net.transport) G.net.transport.broadcast(msg); }
function _crewSummary() { const c = {}; STATIONS.forEach(s => c[s] = G.net.crew[s] ? { name: G.net.crew[s].name } : null); return c; }

// ── TERMINAL ─────────────────────────────────────────────────
function netJoin(name, station, transport) {
  G.net.role = 'terminal';
  G.net.transport = transport;
  G.net.you = { name: name || 'Crew', station };
  _installTerminalForwarders();
  transport.start(_net, () => {
    transport.send('host', { t: 'join', name: G.net.you.name, station });
  });
}

function _terminalHandle(msg) {
  switch (msg.t) {
    case 'welcome':
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
      applySnapshot(msg.g);
      if (!G.net._loopOn) _startTerminalLoop();
      break;
    case 'pong': G.net._ping = performance.now() - msg.t0; break;
  }
}

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

function _terminalHostLost() {
  G.net._loopOn = false;
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
function netHostGame() {
  if (typeof Peer === 'undefined') { alert('PeerJS failed to load — online crew unavailable.'); return; }
  const name = (prompt('Your name (host / captain):', 'Captain') || 'Captain').slice(0, 16);
  netHost(name, PeerJsTransport({ host: true }));
  // Host then proceeds through normal setup; teammates join while it sets up.
}

function netJoinPrompt() {
  if (typeof Peer === 'undefined') { alert('PeerJS failed to load — online crew unavailable.'); return; }
  const code = (prompt('Room code from the host:') || '').trim();
  if (!code) return;
  const station = (prompt('Station to man — tactical / engineering / helm / captain:', 'tactical') || '').trim().toLowerCase();
  if (!STATIONS.includes(station)) { alert('Unknown station: ' + station); return; }
  const name = (prompt('Your name:', station) || station).slice(0, 16);
  netJoin(name, station, PeerJsTransport({ hostId: code }));
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
    ? `<div style="color:var(--green);">HOSTING — room code: <b style="color:#fff;">${G.net.roomId || '…'}</b></div>`
    : `<div style="color:var(--t);">TERMINAL — ${G.net.you.station ? 'manning ' + G.net.you.station.toUpperCase() : 'connecting…'}</div>`;
  box.innerHTML = head + `<div style="margin-top:4px;color:#7799aa;">CREW:</div>` + roster +
    `<div style="margin-top:6px;"><button class="pill-action-btn" style="padding:4px 10px;font-size:10px;background:var(--dim2);color:#aabbcc;" onclick="netLeave()">Disconnect</button></div>`;
}

function _updateLobbyUI() { renderNetLobby(); }
