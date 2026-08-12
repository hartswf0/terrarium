/* TERRARIUM III multiplayer
 *
 * Supabase Realtime is used only as an introduction desk. Once introduced,
 * every world message moves browser-to-browser over WebRTC. The host is the
 * live authority and the room intentionally ends when the host leaves.
 */
(function terrariumIIINetwork(global) {
  'use strict';

  const STORE_URL = 'terrarium.iii.supabase.url';
  const STORE_KEY = 'terrarium.iii.supabase.key';
  const TURN_URL = 'https://beflix-call.hartswf0.workers.dev/turn';
  const MAX_PEERS = 8;
  const CHUNK_SIZE = 12000;
  const MAX_BUFFER = 2 * 1024 * 1024;
  const FALLBACK_ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];

  let client = null;
  let signalChannel = null;
  let room = '';
  let peerId = '';
  let role = '';
  let profile = null;
  let hostId = '';
  let sawHost = false;
  let closing = false;
  let iceServers = FALLBACK_ICE;
  let roster = new Map();
  const links = new Map();
  const chunks = new Map();
  const listeners = new Map();
  const metrics = { signals: 0, sent: 0, received: 0, dropped: 0, links: 0 };

  function emit(name, payload) {
    const own = listeners.get(name);
    if (own) own.forEach(fn => { try { fn(payload); } catch (err) { console.error('[III event]', err); } });
    const legacy = {
      message: '__iiiReceive', roster: '__iiiRoster', status: '__iiiStatus',
      hostgone: '__iiiHostGone', peeropen: '__iiiPeerOpen'
    }[name];
    if (legacy && typeof global[legacy] === 'function') {
      try { global[legacy](payload); } catch (err) { console.error('[III callback]', err); }
    }
  }

  function status(text, tone = 'info') { emit('status', { text, tone }); }
  function randomId(prefix) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return prefix + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  function cleanRoom(value) { return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }
  function config() {
    const builtInUrl = document.querySelector('meta[name="terrarium-supabase-url"]')?.content || '';
    const builtInKey = document.querySelector('meta[name="terrarium-supabase-key"]')?.content || '';
    return {
      url: (localStorage.getItem(STORE_URL) || builtInUrl).trim().replace(/\/+$/, ''),
      key: (localStorage.getItem(STORE_KEY) || builtInKey).trim()
    };
  }
  function keyIsSecret(key) {
    if (/^sb_secret_/i.test(key)) return true;
    try {
      const part = String(key).split('.')[1];
      if (!part) return false;
      const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - part.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.role === 'service_role';
    } catch (_) { return false; }
  }
  function configure(url, key, persist = true) {
    url = String(url || '').trim().replace(/\/+$/, '');
    key = String(key || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('SUPABASE PROJECT URL REQUIRED');
    if (key.length < 20) throw new Error('SUPABASE ANON / PUBLISHABLE KEY REQUIRED');
    if (keyIsSecret(key)) throw new Error('SECRET / SERVICE-ROLE KEY BLOCKED — COPY THE PUBLISHABLE KEY');
    if (persist) {
      localStorage.setItem(STORE_URL, url);
      localStorage.setItem(STORE_KEY, key);
    }
    return { url, key };
  }
  function clearConfig() {
    localStorage.removeItem(STORE_URL);
    localStorage.removeItem(STORE_KEY);
  }

  async function getIceServers() {
    try {
      const response = await fetch(TURN_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('TURN HTTP ' + response.status);
      const body = await response.json();
      if (Array.isArray(body.iceServers) && body.iceServers.length) return body.iceServers;
    } catch (err) {
      console.warn('[III] TURN credentials unavailable; trying STUN-only', err);
    }
    return FALLBACK_ICE;
  }

  function supabaseFactory() {
    const api = global.supabase;
    if (!api || typeof api.createClient !== 'function') {
      throw new Error('SUPABASE REALTIME LIBRARY DID NOT LOAD');
    }
    return api.createClient.bind(api);
  }

  function presenceRows() {
    if (!signalChannel || typeof signalChannel.presenceState !== 'function') return [];
    const state = signalChannel.presenceState() || {};
    const byId = new Map();
    Object.values(state).forEach(group => {
      (Array.isArray(group) ? group : []).forEach(row => {
        if (!row || !row.id) return;
        const prior = byId.get(row.id);
        if (!prior || Number(row.joinedAt || 0) < Number(prior.joinedAt || 0)) byId.set(row.id, row);
      });
    });
    return Array.from(byId.values()).sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
  }

  function publicRoster() {
    return Array.from(roster.values()).map(p => ({
      id: p.id,
      name: p.name || 'PLAYER',
      color: p.color || '#ff2e2e',
      rig: p.rig || {},
      role: p.role || 'player',
      connected: p.id === peerId || !!links.get(p.id)?.open
    }));
  }

  async function refreshPresence() {
    if (closing || !peerId) return;
    const rows = presenceRows();
    roster = new Map(rows.map(p => [p.id, p]));
    if (profile && !roster.has(peerId)) roster.set(peerId, profile);

    const hosts = rows.filter(p => p.role === 'host').sort((a, b) => Number(a.joinedAt) - Number(b.joinedAt));
    const chosenHost = hosts[0]?.id || '';
    if (role === 'host') hostId = peerId;
    else if (chosenHost) { hostId = chosenHost; sawHost = true; }

    for (const id of Array.from(links.keys())) {
      if (!roster.has(id)) destroyLink(id);
    }

    if (role === 'host') {
      const guests = rows.filter(p => p.id !== peerId && p.role !== 'host').slice(0, MAX_PEERS - 1);
      for (const guest of guests) await ensureHostLink(guest.id);
    } else if (hostId && hostId !== peerId) {
      await signal({ kind: 'hello' }, hostId);
    } else if (sawHost && !chosenHost) {
      status('HOST LEFT · THIS LIVE VESSEL IS CLOSED', 'error');
      emit('hostgone', { room });
    }
    emit('roster', publicRoster());
  }

  function makeLink(id, pc) {
    const link = {
      id, pc, reliable: null, fast: null, open: false,
      pendingIce: [], reliableQueue: [], createdAt: Date.now()
    };
    links.set(id, link);
    pc.onicecandidate = event => {
      if (event.candidate) signal({ kind: 'ice', candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate }, id);
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'closed') {
        destroyLink(id);
        emit('roster', publicRoster());
      }
    };
    return link;
  }

  function newPeerConnection() {
    return new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
  }

  function bindChannel(link, dc, fast) {
    if (fast) link.fast = dc; else link.reliable = dc;
    dc.binaryType = 'arraybuffer';
    if (!fast) dc.bufferedAmountLowThreshold = 256 * 1024;
    dc.onopen = () => {
      if (!fast) {
        link.open = true;
        metrics.links = Array.from(links.values()).filter(item => item.open).length;
        flushQueue(link);
        status((role === 'host' ? 'GUEST LINKED · ' : 'HOST LINKED · ') + room, 'ok');
        emit('peeropen', { peerId: link.id });
        emit('roster', publicRoster());
      }
    };
    dc.onclose = () => {
      if (!fast) {
        link.open = false;
        metrics.links = Array.from(links.values()).filter(item => item.open).length;
        emit('roster', publicRoster());
      }
    };
    dc.onerror = err => console.warn('[III data channel]', err);
    dc.onmessage = event => receiveWire(link.id, event.data);
  }

  function destroyLink(id) {
    const link = links.get(id);
    if (!link) return;
    links.delete(id);
    try { link.reliable?.close(); } catch (_) {}
    try { link.fast?.close(); } catch (_) {}
    try { link.pc?.close(); } catch (_) {}
    for (const key of Array.from(chunks.keys())) if (key.startsWith(id + ':')) chunks.delete(key);
    metrics.links = Array.from(links.values()).filter(item => item.open).length;
  }

  async function ensureHostLink(id) {
    if (role !== 'host' || id === peerId) return links.get(id);
    const existing = links.get(id);
    if (existing) {
      // A guest can appear in Presence a few milliseconds after the first offer
      // passed it. HELLO asks the host to repeat that same introduction.
      if (!existing.open && existing.pc.localDescription) {
        await signal({ kind: 'offer', sdp: existing.pc.localDescription.toJSON() }, id);
      }
      return existing;
    }
    if (links.size >= MAX_PEERS - 1) return null;
    const pc = newPeerConnection();
    const link = makeLink(id, pc);
    bindChannel(link, pc.createDataChannel('terrarium-reliable', { ordered: true }), false);
    bindChannel(link, pc.createDataChannel('terrarium-state', { ordered: false, maxRetransmits: 0 }), true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await signal({ kind: 'offer', sdp: pc.localDescription.toJSON() }, id);
    return link;
  }

  async function acceptOffer(from, sdp) {
    if (role === 'host') return;
    // The first addressed offer establishes the host even if it races the
    // initial Presence sync. Subsequent offers must come from that same host.
    if (!hostId) { hostId = from; sawHost = true; }
    if (from !== hostId) return;
    const prior = links.get(from);
    if (prior?.pc?.remoteDescription?.sdp === sdp?.sdp) {
      if (prior.pc.localDescription) await signal({ kind: 'answer', sdp: prior.pc.localDescription.toJSON() }, from);
      return;
    }
    destroyLink(from);
    const pc = newPeerConnection();
    const link = makeLink(from, pc);
    pc.ondatachannel = event => bindChannel(link, event.channel, event.channel.label === 'terrarium-state');
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushIce(link);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signal({ kind: 'answer', sdp: pc.localDescription.toJSON() }, from);
  }

  async function acceptAnswer(from, sdp) {
    if (role !== 'host') return;
    const link = links.get(from);
    if (!link || link.pc.signalingState === 'closed') return;
    await link.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushIce(link);
  }

  async function acceptIce(from, candidate) {
    let link = links.get(from);
    if (!link && role === 'host') link = await ensureHostLink(from);
    if (!link) return;
    if (!link.pc.remoteDescription) link.pendingIce.push(candidate);
    else await link.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => console.warn('[III ICE]', err));
  }

  async function flushIce(link) {
    const pending = link.pendingIce.splice(0);
    for (const candidate of pending) {
      await link.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => console.warn('[III ICE queued]', err));
    }
  }

  async function signal(payload, to) {
    if (!signalChannel || closing) return;
    metrics.signals++;
    await signalChannel.send({
      type: 'broadcast', event: 'signal',
      payload: { ...payload, from: peerId, to, room, at: Date.now() }
    });
  }

  async function onSignal(event) {
    const msg = event?.payload || event;
    if (!msg || msg.room !== room || msg.from === peerId) return;
    if (msg.to && msg.to !== peerId) return;
    try {
      if (msg.kind === 'hello' && role === 'host') await ensureHostLink(msg.from);
      else if (msg.kind === 'offer') await acceptOffer(msg.from, msg.sdp);
      else if (msg.kind === 'answer') await acceptAnswer(msg.from, msg.sdp);
      else if (msg.kind === 'ice') await acceptIce(msg.from, msg.candidate);
      else if (msg.kind === 'bye') destroyLink(msg.from);
    } catch (err) {
      console.error('[III signal]', msg.kind, err);
      status('P2P HANDSHAKE RETRYING', 'warn');
    }
  }

  function wireParts(from, msg) {
    const json = JSON.stringify({ from, msg });
    if (json.length <= CHUNK_SIZE) return [json];
    const id = randomId('c');
    const total = Math.ceil(json.length / CHUNK_SIZE);
    const out = [];
    for (let index = 0; index < total; index++) {
      out.push(JSON.stringify({ __iii: 'chunk', id, from, index, total, data: json.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE) }));
    }
    return out;
  }

  function sendRaw(link, wire, fast) {
    const dc = fast ? link.fast : link.reliable;
    if (!dc || dc.readyState !== 'open') {
      if (!fast && link.reliableQueue.length < 2048) link.reliableQueue.push(wire);
      else metrics.dropped++;
      return false;
    }
    if (dc.bufferedAmount > MAX_BUFFER) {
      if (!fast && link.reliableQueue.length < 2048) link.reliableQueue.push(wire);
      else metrics.dropped++;
      return false;
    }
    try { dc.send(wire); metrics.sent++; return true; }
    catch (err) { console.warn('[III send]', err); metrics.dropped++; return false; }
  }

  function flushQueue(link) {
    if (!link.reliable || link.reliable.readyState !== 'open') return;
    while (link.reliableQueue.length && link.reliable.bufferedAmount < MAX_BUFFER) {
      const wire = link.reliableQueue.shift();
      try { link.reliable.send(wire); metrics.sent++; }
      catch (_) { link.reliableQueue.unshift(wire); break; }
    }
    if (link.reliableQueue.length) setTimeout(() => flushQueue(link), 60);
  }

  function sendToLink(link, from, msg) {
    const fast = msg?.type === 'state';
    const parts = wireParts(from, msg);
    for (const part of parts) sendRaw(link, part, fast && parts.length === 1);
  }

  function deliver(from, msg) {
    metrics.received++;
    emit('message', { from, msg });
  }

  function receiveWire(linkId, raw) {
    if (typeof raw !== 'string') return;
    let packet;
    try { packet = JSON.parse(raw); } catch (_) { metrics.dropped++; return; }
    if (packet?.__iii === 'chunk') {
      const key = linkId + ':' + packet.id;
      let bundle = chunks.get(key);
      if (!bundle) {
        bundle = { total: packet.total, parts: [], expires: Date.now() + 30000 };
        chunks.set(key, bundle);
      }
      bundle.parts[packet.index] = packet.data;
      if (bundle.parts.filter(part => typeof part === 'string').length === bundle.total) {
        chunks.delete(key);
        receiveWire(linkId, bundle.parts.join(''));
      }
      return;
    }
    if (!packet || !packet.msg || !packet.msg.type) return;
    const from = role === 'host' ? linkId : String(packet.from || hostId);
    deliver(from, packet.msg);
    if (role === 'host') {
      links.forEach((link, id) => { if (id !== linkId) sendToLink(link, from, packet.msg); });
    }
  }

  function send(msg) {
    if (!room || !peerId || !msg || !msg.type) return Promise.resolve(null);
    if (role === 'host') links.forEach(link => sendToLink(link, peerId, msg));
    else {
      const link = links.get(hostId);
      if (link) sendToLink(link, peerId, msg);
      else metrics.dropped++;
    }
    return Promise.resolve({ ok: true });
  }

  function waitForSubscribed(channel, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SIGNAL DESK TIMED OUT')), timeout);
      channel.subscribe(async state => {
        if (state === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          clearTimeout(timer); reject(new Error('SIGNAL DESK ' + state.replace('_', ' ')));
        }
      });
    });
  }

  async function join(options) {
    if (!global.isSecureContext && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) {
      throw new Error('WEBRTC NEEDS HTTPS');
    }
    await leave();
    closing = false;
    const cfg = configure(options.url || config().url, options.key || config().key, options.persist !== false);
    room = cleanRoom(options.room);
    if (room.length < 8) throw new Error('ROOM CODE TOO SHORT');
    peerId = randomId('p_');
    role = options.host ? 'host' : 'player';
    hostId = role === 'host' ? peerId : '';
    sawHost = false;
    profile = {
      id: peerId, role,
      name: String(options.name || 'PLAYER').slice(0, 24),
      color: String(options.color || '#ff2e2e').slice(0, 16),
      rig: options.rig || {}, joinedAt: Date.now()
    };
    iceServers = await getIceServers();
    client = supabaseFactory()(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    signalChannel = client.channel('terrarium-iii:' + room, {
      config: { broadcast: { self: false, ack: true }, presence: { key: peerId } }
    });
    signalChannel
      .on('broadcast', { event: 'signal' }, onSignal)
      .on('presence', { event: 'sync' }, refreshPresence)
      .on('presence', { event: 'join' }, refreshPresence)
      .on('presence', { event: 'leave' }, refreshPresence);
    status('OPENING SIGNAL DESK…', 'warn');
    await waitForSubscribed(signalChannel);
    await signalChannel.track(profile);
    roster.set(peerId, profile);
    status(role === 'host' ? 'VESSEL OPEN · WAITING FOR A GUEST' : 'FINDING HOST…', 'ok');
    setTimeout(refreshPresence, 100);
    return { peerId, role, peers: publicRoster(), maxPeers: MAX_PEERS };
  }

  async function leave() {
    if (closing) return;
    closing = true;
    const oldLinks = Array.from(links.keys());
    if (signalChannel && peerId) {
      try { await signal({ kind: 'bye' }); } catch (_) {}
      try { await signalChannel.untrack(); } catch (_) {}
    }
    oldLinks.forEach(destroyLink);
    if (client && signalChannel) {
      try { await client.removeChannel(signalChannel); } catch (_) {}
    }
    signalChannel = null; client = null; room = ''; peerId = ''; role = '';
    profile = null; hostId = ''; sawHost = false; roster.clear(); chunks.clear();
    metrics.links = 0;
    closing = false;
  }

  async function selfTest(url, key) {
    const cfg = configure(url || config().url, key || config().key, true);
    const started = performance.now();
    const turn = await getIceServers();
    const probe = supabaseFactory()(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const channel = probe.channel('terrarium-iii:probe-' + randomId(''), { config: { broadcast: { ack: true } } });
    await waitForSubscribed(channel, 10000);
    await channel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'probe' } });
    await probe.removeChannel(channel);
    return {
      ok: true,
      signalingMs: Math.round(performance.now() - started),
      iceServers: turn.length,
      hasTurn: turn.some(server => JSON.stringify(server.urls || '').includes('turn:'))
    };
  }

  global.TERRARIUM_III = true;
  global.III_NET = {
    configure, clearConfig, config, join, leave, send, selfTest,
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name)?.delete(fn);
    },
    get active() { return !!room && !!peerId; },
    get room() { return room; },
    get peerId() { return peerId; },
    get role() { return role; },
    stats() {
      return {
        ...metrics, room, peerId, role, peers: publicRoster(),
        connections: Array.from(links.values()).map(link => ({
          peerId: link.id,
          connection: link.pc.connectionState,
          ice: link.pc.iceConnectionState,
          reliable: link.reliable?.readyState || 'missing',
          fast: link.fast?.readyState || 'missing',
          queued: link.reliableQueue.length
        }))
      };
    }
  };

  // A host invite carries only browser-public configuration in its fragment.
  // Consuming it here makes scan → ritual → join a one-tap path for guests.
  try {
    const invite = new URLSearchParams(location.hash.replace(/^#/, ''));
    const inviteUrl = invite.get('sb');
    const inviteKey = invite.get('pk');
    if (inviteUrl && inviteKey) configure(inviteUrl, inviteKey, true);
  } catch (err) {
    console.warn('[III] invite signal configuration rejected', err);
  }
})(window);
