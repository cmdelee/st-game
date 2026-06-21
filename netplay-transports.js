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
      // Host may claim a short, human-friendly id (the room code); terminals use a random id.
      peer = (isHost && opts.id) ? new Peer(opts.id) : new Peer();
      peer.on('open', (id) => {
        if (isHost) { onReady && onReady(id); }
        else {
          const c = peer.connect(hostId, { reliable: true });
          conns['host'] = c;
          c.on('open', () => { onReady && onReady(id); });
          c.on('data', m => ctrl.onMessage('host', m));
          c.on('close', () => { if (ctrl.onLeave) ctrl.onLeave('host'); });
          c.on('error', () => { if (ctrl.onLeave) ctrl.onLeave('host'); });
        }
      });
      if (isHost) peer.on('connection', _bindHostConn);
      peer.on('error', (e) => { if (opts.onError) opts.onError(e); else console.warn('PeerJS error', e && e.type); });
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
