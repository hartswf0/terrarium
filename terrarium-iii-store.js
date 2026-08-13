/* TERRARIUM III durable artifact sidecar
 *
 * PROVISIONAL. This module is intentionally outside the live networking path.
 * A world/build operation succeeds before persistence is attempted.
 * Persistence failure may queue a durable copy, but must never stop the vessel.
 */
(function terrariumIIIStore(global) {
  'use strict';

  const TABLE = 'iii_artifacts';
  const CLIENT_VERSION = 'iii-store-0.3-provisional';
  const IDB_NAME = 'terrarium-iii-store';
  const IDB_STORE = 'queue';
  const IDB_VERSION = 1;
  const MAX_PROMPT_CHARS = 20000;
  const MAX_GEOMETRY_CHARS = 1500000;
  const MAX_METADATA_CHARS = 250000;
  const FLUSH_BATCH = 20;
  const RETRY_STEPS = [1500, 5000, 15000, 30000, 60000];
  const ALLOWED_TYPES = new Set(['prompt', 'geometry', 'build', 'world_snapshot']);
  const SESSION_ID = crypto.randomUUID
    ? crypto.randomUUID()
    : ('s-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

  let client = null;
  let clientKey = '';
  let userId = '';
  let authState = 'idle';
  let readyPromise = null;
  let flushPromise = null;
  let retryTimer = null;
  let retryStep = 0;
  let idbPromise = null;
  let persistenceAvailable = false;
  let lastError = '';
  let lastWriteAt = 0;
  let lastFlushAt = 0;
  let written = 0;
  let failed = 0;
  let autoCaptured = 0;
  const memoryQueue = new Map();
  const authMemory = new Map();

  function randomId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  function emit(name, detail) {
    try { global.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function stats() {
    return {
      version: CLIENT_VERSION,
      table: TABLE,
      sessionId: SESSION_ID,
      auth: authState,
      userId: userId || null,
      queueMemory: memoryQueue.size,
      queuePersistence: persistenceAvailable ? 'indexeddb' : 'memory',
      written,
      failed,
      autoCaptured,
      lastWriteAt: lastWriteAt || null,
      lastFlushAt: lastFlushAt || null,
      lastError: lastError || null
    };
  }

  function logError(where, err) {
    lastError = String(err?.message || err || where);
    console.warn('[III STORE] ' + where, err);
    emit('terrarium:store-status', { ok: false, where, error: lastError, stats: stats() });
  }

  function storage(name) {
    try { return global[name] || null; } catch (_) { return null; }
  }

  function currentConfig() {
    const cfg = global.III_NET?.config?.() || {};
    return {
      url: String(cfg.url || '').trim().replace(/\/+$/, ''),
      key: String(cfg.key || '').trim()
    };
  }

  function projectRef(url) {
    try {
      return new URL(url).hostname.split('.')[0].replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'default';
    } catch (_) {
      return 'default';
    }
  }

  function authStorageFor(ref) {
    const prefix = 'terrarium-iii-auth:' + ref + ':';
    return {
      getItem(key) {
        const namespaced = prefix + key;
        try {
          const value = storage('localStorage')?.getItem(namespaced);
          if (value != null) return value;
        } catch (_) {}
        try {
          const value = storage('sessionStorage')?.getItem(namespaced);
          if (value != null) return value;
        } catch (_) {}
        return authMemory.get(namespaced) || null;
      },
      setItem(key, value) {
        const namespaced = prefix + key;
        const text = String(value);
        try {
          storage('localStorage')?.setItem(namespaced, text);
          authMemory.set(namespaced, text);
          return;
        } catch (_) {}
        try {
          storage('sessionStorage')?.setItem(namespaced, text);
          authMemory.set(namespaced, text);
          return;
        } catch (_) {}
        authMemory.set(namespaced, text);
      },
      removeItem(key) {
        const namespaced = prefix + key;
        try { storage('localStorage')?.removeItem(namespaced); } catch (_) {}
        try { storage('sessionStorage')?.removeItem(namespaced); } catch (_) {}
        authMemory.delete(namespaced);
      }
    };
  }

  function makeClient() {
    const factory = global.supabase?.createClient;
    if (typeof factory !== 'function') throw new Error('SUPABASE CLIENT NOT AVAILABLE');

    const cfg = currentConfig();
    if (!/^https?:\/\//i.test(cfg.url) || cfg.key.length < 20) {
      throw new Error('SUPABASE CONFIG NOT READY');
    }

    const identity = cfg.url + '|' + cfg.key;
    if (client && clientKey === identity) return client;

    clientKey = identity;
    client = null;
    userId = '';
    authState = 'idle';
    const ref = projectRef(cfg.url);

    client = factory(cfg.url, cfg.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: authStorageFor(ref),
        storageKey: 'session'
      },
      realtime: { params: { eventsPerSecond: 2 } }
    });
    return client;
  }

  async function ensureAnonymousUser() {
    const sb = makeClient();
    authState = 'opening';

    const sessionResult = await sb.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    let session = sessionResult.data?.session || null;

    if (!session?.user?.id) {
      const signed = await sb.auth.signInAnonymously();
      if (signed.error) throw signed.error;
      session = signed.data?.session || null;
    }

    if (!session?.user?.id) throw new Error('ANONYMOUS AUTH DID NOT RETURN A USER');
    userId = session.user.id;
    authState = 'ready';
    return { client: sb, userId };
  }

  function openQueueDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error('INDEXEDDB UNAVAILABLE'));
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onerror = () => reject(request.error || new Error('INDEXEDDB OPEN FAILED'));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
      request.onsuccess = () => {
        persistenceAvailable = true;
        resolve(request.result);
      };
    }).catch(err => {
      persistenceAvailable = false;
      console.warn('[III STORE] IndexedDB queue unavailable; using memory queue', err);
      return null;
    });
    return idbPromise;
  }

  async function idbPut(record) {
    const db = await openQueueDB();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  async function idbDelete(id) {
    const db = await openQueueDB();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  async function idbList(limit = FLUSH_BATCH) {
    const db = await openQueueDB();
    if (!db) return [];
    return new Promise(resolve => {
      const out = [];
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const index = tx.objectStore(IDB_STORE).index('created_at');
        const request = index.openCursor();
        request.onerror = () => resolve(out);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || out.length >= limit) return resolve(out);
          out.push(cursor.value);
          cursor.continue();
        };
      } catch (_) { resolve(out); }
    });
  }

  async function idbCount() {
    const db = await openQueueDB();
    if (!db) return memoryQueue.size;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const request = tx.objectStore(IDB_STORE).count();
        request.onsuccess = () => resolve(Number(request.result || 0));
        request.onerror = () => resolve(memoryQueue.size);
      } catch (_) { resolve(memoryQueue.size); }
    });
  }

  function safeJSON(value, maxChars) {
    if (value == null) return { value: null, chars: 0, omitted: false };
    let parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); }
      catch (_) { parsed = { raw: value }; }
    }
    let text = '';
    try { text = JSON.stringify(parsed); } catch (_) {}
    if (!text) return { value: null, chars: 0, omitted: false };
    if (text.length > maxChars) return { value: null, chars: text.length, omitted: true };
    try { return { value: JSON.parse(text), chars: text.length, omitted: false }; }
    catch (_) { return { value: null, chars: 0, omitted: false }; }
  }

  function normalizeArtifact(input = {}) {
    const type = ALLOWED_TYPES.has(input.artifact_type)
      ? input.artifact_type
      : (ALLOWED_TYPES.has(input.type) ? input.type : 'build');
    const prompt = input.prompt == null ? null : String(input.prompt).slice(0, MAX_PROMPT_CHARS);
    const geometry = safeJSON(input.geometry_json ?? input.geometry ?? null, MAX_GEOMETRY_CHARS);
    const metaBase = safeJSON(input.metadata_json ?? input.metadata ?? {}, MAX_METADATA_CHARS);
    const metadata = metaBase.value && typeof metaBase.value === 'object' ? metaBase.value : {};

    if (geometry.omitted) {
      metadata.persistence = {
        ...(metadata.persistence || {}),
        geometry_omitted: true,
        geometry_chars: geometry.chars,
        inline_limit_chars: MAX_GEOMETRY_CHARS,
        reason: 'geometry exceeds provisional inline limit; object Storage handoff is not implemented yet'
      };
    }
    if (metaBase.omitted) {
      Object.keys(metadata).forEach(key => delete metadata[key]);
      metadata.persistence = {
        metadata_omitted: true,
        metadata_chars: metaBase.chars,
        inline_limit_chars: MAX_METADATA_CHARS
      };
    }

    return {
      id: String(input.id || randomId()),
      created_at: input.created_at || new Date().toISOString(),
      artifact_type: type,
      room_code: String(input.room_code ?? input.roomCode ?? global.III_NET?.room ?? '').slice(0, 64) || null,
      session_id: String(input.session_id ?? input.sessionId ?? SESSION_ID).slice(0, 128) || SESSION_ID,
      prompt,
      geometry_json: geometry.value,
      metadata_json: metadata,
      client_version: String(input.client_version ?? input.clientVersion ?? CLIENT_VERSION).slice(0, 96),
      parent_id: input.parent_id ?? input.parentId ?? null
    };
  }

  async function enqueue(record) {
    memoryQueue.set(record.id, record);
    await idbPut(record).catch(() => false);
    emit('terrarium:store-status', { ok: true, state: 'queued', id: record.id, stats: stats() });
  }

  async function removeQueued(id) {
    memoryQueue.delete(id);
    await idbDelete(id).catch(() => false);
  }

  async function queuedBatch() {
    const indexed = await idbList(FLUSH_BATCH).catch(() => []);
    const merged = new Map(indexed.map(record => [record.id, record]));
    for (const [id, record] of memoryQueue) {
      if (!merged.has(id)) merged.set(id, record);
      if (merged.size >= FLUSH_BATCH) break;
    }
    return Array.from(merged.values())
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, FLUSH_BATCH);
  }

  function scheduleRetry() {
    if (retryTimer || !navigator.onLine) return;
    const delay = RETRY_STEPS[Math.min(retryStep, RETRY_STEPS.length - 1)];
    retryStep = Math.min(retryStep + 1, RETRY_STEPS.length - 1);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      flush().catch(() => {});
    }, delay);
  }

  async function flush() {
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      if (!navigator.onLine) return { ok: false, offline: true };

      // Critical: do not create an anonymous Auth user for a spectator who has
      // never authored anything. Identity is created only if something is queued.
      const batch = await queuedBatch();
      if (!batch.length) {
        retryStep = 0;
        lastFlushAt = Date.now();
        return { ok: true, flushed: 0, remaining: 0 };
      }

      let identity;
      try {
        identity = await ensureAnonymousUser();
      } catch (err) {
        authState = 'fault';
        failed++;
        logError('anonymous auth unavailable; artifacts remain queued', err);
        scheduleRetry();
        return { ok: false, auth: false, remaining: batch.length };
      }

      let flushed = 0;
      for (const queued of batch) {
        const row = { ...queued, user_id: identity.userId };
        try {
          const result = await identity.client.from(TABLE).insert(row);
          if (result.error) {
            // If the network lost the successful response, retrying the same
            // client UUID can produce a primary-key collision. Treat that as
            // already durable instead of retrying forever.
            if (String(result.error.code || '') !== '23505') throw result.error;
          }
          await removeQueued(queued.id);
          written++;
          flushed++;
          lastWriteAt = Date.now();
        } catch (err) {
          failed++;
          logError('artifact write failed; record remains queued', err);
          scheduleRetry();
          break;
        }
      }

      lastFlushAt = Date.now();
      if (flushed === batch.length) retryStep = 0;
      const remaining = await idbCount().catch(() => memoryQueue.size);
      if (remaining > 0) scheduleRetry();
      emit('terrarium:store-status', { ok: true, state: 'flush', flushed, remaining, stats: stats() });
      return { ok: true, flushed, remaining };
    })().finally(() => { flushPromise = null; });
    return flushPromise;
  }

  async function recordArtifact(input) {
    try {
      const record = normalizeArtifact(input);
      await enqueue(record);
      queueMicrotask(() => flush().catch(() => {}));
      return { ok: true, queued: true, id: record.id };
    } catch (err) {
      failed++;
      logError('could not queue artifact', err);
      return { ok: false, queued: false, error: String(err?.message || err) };
    }
  }

  function recordBuild(input = {}) {
    return recordArtifact({ ...input, artifact_type: 'build' });
  }
  function recordPrompt(input = {}) {
    return recordArtifact({ ...input, artifact_type: 'prompt' });
  }
  function recordGeometry(input = {}) {
    return recordArtifact({ ...input, artifact_type: 'geometry' });
  }
  function recordWorldSnapshot(input = {}) {
    return recordArtifact({ ...input, artifact_type: 'world_snapshot' });
  }

  async function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      await openQueueDB();
      const pending = await idbCount().catch(() => memoryQueue.size);
      if (pending > 0) queueMicrotask(() => flush().catch(() => {}));
      return {
        ok: true,
        userId: userId || null,
        pending,
        persistence: persistenceAvailable ? 'indexeddb' : 'memory'
      };
    })().catch(err => {
      readyPromise = null;
      logError('store queue not ready', err);
      return { ok: false, error: String(err?.message || err) };
    });
    return readyPromise;
  }

  function captureDraftBeforeCommit() {
    const proposal = document.getElementById('proposal-ui');
    if (!proposal || proposal.classList.contains('gone')) return null;

    const wgDraft = global.__wgDraft;
    if (wgDraft?.code) {
      let anchor = null;
      try {
        const p = wgDraft.wg?.root?.position;
        if (p) anchor = { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 };
      } catch (_) {}
      return {
        prompt: String(global.__lastDraftPrompt || 'construction'),
        geometry: {
          format: 'terrarium-wg-code',
          code: String(wgDraft.code),
          cert: wgDraft.cert || null,
          anchor
        },
        metadata: {
          source: 'wg-blueprint',
          capture: 'commit-boundary',
          cert: wgDraft.cert || null
        }
      };
    }

    const ai = global.__ai?.last;
    if (ai && (ai.task === 'arena' || ai.task === 'forge') && (ai.reply || ai.prompt)) {
      return {
        prompt: String(ai.prompt || ''),
        geometry: {
          format: 'model-reply',
          task: String(ai.task || 'arena'),
          reply: String(ai.reply || '')
        },
        metadata: {
          source: 'legacy-ai-blueprint',
          capture: 'commit-boundary',
          task: String(ai.task || 'arena')
        }
      };
    }
    return null;
  }

  function installCommitCapture() {
    const attach = () => {
      const button = document.getElementById('btn-draft-commit');
      if (!button || button.__iiiStoreCaptureInstalled) return !!button;
      button.__iiiStoreCaptureInstalled = true;

      button.addEventListener('click', () => {
        const candidate = captureDraftBeforeCommit();
        if (!candidate) return;
        setTimeout(() => {
          const proposal = document.getElementById('proposal-ui');
          if (!proposal || !proposal.classList.contains('gone')) return;
          autoCaptured++;
          recordBuild(candidate).catch(() => {});
        }, 0);
      }, true);
      return true;
    };

    if (attach()) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach, { once: true });
    } else {
      setTimeout(attach, 0);
    }
  }

  global.III_STORE = {
    ready,
    flush,
    recordArtifact,
    recordBuild,
    recordPrompt,
    recordGeometry,
    recordWorldSnapshot,
    stats,
    get userId() { return userId || null; },
    get sessionId() { return SESSION_ID; }
  };

  global.addEventListener('terrarium:artifact', event => {
    recordArtifact(event?.detail || {}).catch(() => {});
  });
  global.addEventListener('online', () => flush().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) flush().catch(() => {});
  });

  installCommitCapture();
  setTimeout(() => ready().catch(() => {}), 0);
})(window);
