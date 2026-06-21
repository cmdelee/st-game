'use strict';

// ============================================================
// NETPLAY TRANSPORTS — pluggable links for netplay.js
//   • PeerJsTransport — real WebRTC via PeerJS (host = room code = peer id).
//   • MockTransport    — in-page, no network: records sent messages and lets a
//                        test inject incoming ones. Used to validate the
//                        host/terminal protocol without two devices.
// Each transport: start(controller, onReady), send(peerId,msg), broadcast(msg),
// stop(). The controller is netplay.js's `_net` ({onMessage,onJoin,onLeave}).
// ============================================================

// ── Real WebRTC (PeerJS) ─────────────────────────────────────
function PeerJsTransport(opts) {
  opts = opts || {};
  const isHost = !!opts.host;
  const hostId = opts.hostId || null;   // terminals: the room code to dial
  let peer = null, ctrl = null;
  const conns = {};                     // host: peerId -> DataConnection

  function _bindHostConn(conn) {
    conns[conn.peer] = conn;
    conn.on('data', m => ctrl.onMessage(conn.peer, m));
    conn.on('open', () => { if (ctrl.onJoin) ctrl.onJoin(conn.peer); });
    conn.on('close', () => { delete conns[conn.peer]; if (ctrl.onLeave) ctrl.onLeave(conn.peer); });
    conn.on('error', () => { delete conns[conn.peer]; if (ctrl.onLeave) ctrl.onLeave(conn.peer); });
  }

  return {
    start(controller, onReady) {
      ctrl = controller;
      if (typeof Peer === 'undefined') { alert('PeerJS not loaded — multiplayer unavailable.'); return; }
      const status = (m) => { try { console.log('[netplay] ' + m); } catch (e) {} if (opts.onStatus) opts.onStatus(m); };
      // ICE servers: STUN to discover public IPs + a free TURN relay so devices on
      // different/restrictive networks (mobile, symmetric NAT) can still connect.
      const popts = { debug: 1 };
      if (opts.config) popts.config = opts.config;
      // Host may claim a short, human-friendly id (the room code); terminals use a random id.
      peer = (isHost && opts.id) ? new Peer(opts.id, popts) : new Peer(undefined, popts);
      status(isHost ? 'Registering room…' : 'Connecting to signalling…');
      peer.on('open', (id) => {
        if (isHost) { status('Room ready — share the code, waiting for crew.'); onReady && onReady(id); }
        else {
          status('Dialling host…');
          const c = peer.connect(hostId, { reliable: true });
          conns['host'] = c;
          c.on('open', () => { status('Connected to host.'); onReady && onReady(id); });
          c.on('data', m => ctrl.onMessage('host', m));
          c.on('close', () => { status('Host link closed.'); if (ctrl.onLeave) ctrl.onLeave('host'); });
          c.on('error', (e) => { status('Link error: ' + (e && e.type)); if (ctrl.onLeave) ctrl.onLeave('host'); });
        }
      });
      if (isHost) peer.on('connection', (conn) => { status('Crew member connecting…'); _bindHostConn(conn); });
      peer.on('disconnected', () => { status('Signalling dropped — retrying…'); try { peer.reconnect(); } catch (e) {} });
      peer.on('error', (e) => { status('Error: ' + (e && e.type)); if (opts.onError) opts.onError(e); else console.warn('PeerJS error', e && e.type); });
    },
    send(peerId, msg) { const c = conns[peerId]; if (c && c.open) c.send(msg); },
    broadcast(msg) { Object.values(conns).forEach(c => { if (c.open) c.send(msg); }); },
    stop() { try { Object.values(conns).forEach(c => c.close()); peer && peer.destroy(); } catch (e) {} },
  };
}

// ── In-page mock (testing) ───────────────────────────────────
function MockTransport(opts) {
  opts = opts || {};
  let ctrl = null;
  const sent = [];          // [{to, msg}] — everything this side "sent"
  return {
    sent,
    start(controller, onReady) { ctrl = controller; if (onReady) onReady(opts.roomId || 'MOCK'); },
    send(peerId, msg) { sent.push({ to: peerId, msg }); },
    broadcast(msg) { sent.push({ to: '*', msg }); },
    stop() {},
    // test helpers
    _inject(fromId, msg) { ctrl.onMessage(fromId, msg); },
    _join(id) { ctrl.onJoin && ctrl.onJoin(id); },
    _leave(id) { ctrl.onLeave && ctrl.onLeave(id); },
    _last(t) { for (let i = sent.length - 1; i >= 0; i--) if (!t || sent[i].msg.t === t) return sent[i]; return null; },
    _clear() { sent.length = 0; },
  };
}
