# NETWORK-BUILD

> **PROVISIONAL ARCHITECTURE — TERRARIUM III**  
> Last updated: 2026-08-13. This is the current demo architecture, not a final production contract. Every cloud and persistence layer is replaceable.

## 0. Governing invariant

TERRARIUM III is a **host-held live vessel**.

The live world must continue even if durable persistence is unavailable.

```text
GitHub Pages
    |
    v
TERRARIUM III browser
    |
    +--> Supabase Realtime ------- introduction plane only
    |        Presence
    |        WebRTC offer / answer / ICE signaling
    |
    +--> Cloudflare TURN / STUN -- traversal
    |
    +<===========================> WebRTC world plane
    |        reliable: builds / edits / chat / journals
    |        fast: transient motion / state
    |
    +--> III_STORE --------------- asynchronous durable sidecar
             |
             +--> IndexedDB retry queue
             +--> Supabase Auth (anonymous identity)
             +--> Postgres iii_artifacts

THE DATABASE NEVER SITS IN THE WORLD'S CRITICAL PATH.
```

The host remains authoritative. Guests do not become a replacement host automatically. A genuinely departed host still ends the current vessel.

## 1. Current implementation files

```text
unset-04-hartsoe-iii.html   current III application
terrarium-iii-net.js        signaling + WebRTC network layer
terrarium-iii-store.js      provisional durable artifact sidecar
supabase/iii-artifacts.sql  base artifact schema
supabase/iii-artifacts-hardening.sql
                             least-privilege/RLS hardening
NETWORK-BUILD.md            this architecture record
```

## 2. Signal configuration

The demo has an embedded browser-public Supabase Project URL and publishable key in `terrarium-iii-net.js`.

Those values are defaults, not lock-in. The existing host setup UI can replace them without rebuilding the page.

Resolution order:

```text
1. current runtime / invite override
2. localStorage manual override
3. sessionStorage manual override
4. optional HTML meta values
5. embedded demo defaults
```

Storage failure is fail-soft:

```text
localStorage full
      |
      v
sessionStorage
      |
      v
memory
      |
      v
MULTIPLAYER STILL RUNS
```

`CLEAR` removes the manual override and returns to the embedded default.

Only browser-public Supabase configuration belongs in client code. Administrative database credentials do not.

## 3. Current network resilience

`terrarium-iii-net.js` currently includes:

- Web Worker Realtime heartbeat
- 15 second heartbeat interval
- explicit Realtime reconnect after heartbeat loss
- reconnect on browser `online`
- reconnect when a backgrounded tab becomes visible
- 8 second host-Presence grace window
- guest peer-link retry after data-channel/PeerConnection failure
- fresh WebRTC offer/answer handshake instead of recycling a dead PeerConnection
- TURN fetch with STUN fallback
- a visible `TEST SIGNAL + TURN` preflight
- storage quota failure isolation

### Host loss rule

```text
Presence flicker
      |
      v
8 second grace
      |
      +--> host returns --> continue vessel
      |
      +--> host absent  --> close vessel
```

This is recovery, not host migration.

## 4. Supabase's role

### Live role

Supabase Realtime introduces browsers and carries temporary Presence/signaling.

It does **not** carry routine world traffic after WebRTC links are established.

### Durable role

Supabase Postgres now has a provisional `public.iii_artifacts` table for semantically meaningful authored artifacts.

Current durable artifact types:

```text
prompt
geometry
build
world_snapshot
```

Do not store frame-by-frame motion, camera transforms, physics ticks, or other transient telemetry in Postgres.

Raw chat is **not captured by default**. If chat becomes research data, that is a separate consent/data-governance decision.

## 5. III_STORE: provisional durable sidecar

`terrarium-iii-store.js` is loaded by the network module but is deliberately independent from networking.

The durable write path is:

```text
USER COMMITS BUILD
      |
      +--> page commits build immediately
      |
      +--> III_STORE snapshots authored artifact
                |
                v
          IndexedDB queue
                |
                +--> Supabase works --> persisted
                |
                +--> offline / auth / DB failure
                         |
                         v
                    retain + retry
```

A persistence failure must never turn a successful world operation into a failed world operation.

### Local queue

The sidecar uses IndexedDB as its durable retry queue. If IndexedDB is unavailable, it degrades to an in-memory queue.

Retries use backoff and also resume on browser `online` and foreground restoration.

### Artifact IDs

Artifacts use client-generated UUIDs. The ID is created before upload so retries can be made idempotent and provenance can refer to stable artifacts.

### Size boundaries

The client currently keeps compact JSON inline and declines to inline very large geometry. Large binary/geometry Storage handoff remains future work.

## 6. What is captured today

III_STORE hooks the existing **COMMIT** boundary, not draft generation.

That means a blueprint a user previews and discards is not intended to become durable research data merely because a model generated it.

For a committed WG build, the sidecar captures approximately:

```text
prompt
WG executable code
WG certificate / build metadata
world anchor
session id
room code when present
client/store version
created_at
```

For the older AI blueprint path, it captures the build prompt and model-produced blueprint/reply at commit time.

There is also a generic integration seam:

```js
window.dispatchEvent(new CustomEvent('terrarium:artifact', {
  detail: { /* semantic artifact */ }
}))
```

Future builders can use that without depending directly on III_STORE internals.

## 7. Database model

Current table:

```text
<iii_artifacts>
    id              uuid primary key
    created_at      timestamptz
    user_id         auth.users foreign key
    room_code       optional
    session_id      optional
    artifact_type   prompt | geometry | build | world_snapshot
    prompt          text
    geometry_json   jsonb
    metadata_json   jsonb
    client_version  text
    parent_id       optional artifact lineage
```

Indexes support user chronology, room chronology, and parent lineage.

## 8. Identity, grants, and RLS

The intended browser identity is Supabase **Anonymous Sign-In**: a browser gets an authenticated user id without asking for email or other identifying account information.

Current live database hardening:

```text
anon role
    no iii_artifacts table privileges

authenticated role
    SELECT
    INSERT
    no UPDATE
    no DELETE

RLS SELECT
    user_id = auth.uid()

RLS INSERT
    user_id = auth.uid()
```

Thus possession of the browser-public publishable key is not database authorization.

The RLS policies use `(select auth.uid())` so Supabase can evaluate identity once per query instead of once per row.

The project security advisor currently reports no database security lints after hardening.

### Required Auth setting

Anonymous Sign-Ins must be enabled in the Supabase Dashboard for III_STORE browser writes to succeed.

Current official guidance:

https://supabase.com/docs/guides/auth/auth-anonymous

If Anonymous Sign-Ins are disabled, the sidecar remains non-fatal: artifacts queue locally and the live vessel still works.

Anonymous public sign-in is provisional demo infrastructure. Before wider public deployment, add abuse protection such as CAPTCHA/Turnstile and review retention/cleanup of anonymous users.

## 9. Automatic-RLS project hardening

The project was created with an automatic-RLS event trigger named `public.rls_auto_enable()`.

That event trigger remains useful internally, but client roles do not need to call it as an RPC. The live project therefore revokes function execution from public browser roles while leaving the event trigger itself intact.

This removed the security-advisor warnings that were present immediately after table creation.

## 10. Current Free-tier operating envelope

This is a **2026-08-13 snapshot** and should be rechecked before a later deployment.

The demo is designed so normal multiplayer use consumes very little Supabase database or Realtime capacity because world traffic is WebRTC.

The important operational risks are more likely to be:

1. Free project paused after inactivity.
2. Host laptop sleeps or loses network.
3. Browser background throttling.
4. TURN unavailable on a restrictive venue network.
5. Wi-Fi/captive-portal transitions.
6. GitHub Pages deployment/cache lag after last-minute edits.
7. Local browser caches filling storage.
8. Anonymous Auth disabled or rate-limited.
9. Artifact DB temporarily unavailable.

A durable-write failure is deliberately lower severity than a networking failure.

## 11. Large geometry

Current implementation stores compact declarative geometry/build material as Postgres JSONB.

Future large-payload path:

```text
Postgres iii_artifacts row
      id
      prompt
      metadata
      storage_path
      geometry_hash
             |
             v
Supabase Storage
      compressed JSON / GLB / binary world snapshot
```

That Storage handoff is **not implemented yet**.

## 12. Failure matrix

| Failure | Expected behavior |
|---|---|
| localStorage quota full | config uses session/memory; multiplayer continues |
| manual signal override bad | clear override and fall back to embedded defaults |
| Realtime heartbeat drops | explicitly reconnect |
| tab backgrounds | Worker heartbeat reduces throttling failure |
| host Presence flickers | wait 8 seconds before declaring host gone |
| guest WebRTC link dies | request fresh peer handshake |
| TURN endpoint unavailable | STUN fallback; preflight should warn |
| IndexedDB unavailable | use in-memory artifact queue |
| Anonymous Auth disabled | artifact persistence faults/queues; world continues |
| artifact INSERT fails | retain queue and retry; world continues |
| Supabase project paused | signal + durable cloud paths unavailable until restored |
| host actually leaves | vessel closes by design |

## 13. Demo preflight

The day before and again immediately before a presentation:

1. Confirm Supabase project status is `ACTIVE_HEALTHY`.
2. Confirm Anonymous Sign-Ins if durable capture is part of the demo.
3. Load the production GitHub Pages URL in a fresh browser.
4. Run `TEST SIGNAL + TURN`.
5. Require signal success and preferably TURN, not STUN-only.
6. Host from a plugged-in laptop with sleep disabled.
7. Join from a phone on the actual venue network.
8. Background and restore the phone once.
9. Briefly toggle guest Wi-Fi and confirm peer re-handshake.
10. Commit a build and verify both browsers converge.
11. Inspect `III_STORE.stats()`.
12. If persistence is enabled, confirm a row appears in `iii_artifacts`.

## 14. Security and data invariants

1. The live world does not wait for the database.
2. Client-public configuration is not treated as authorization.
3. Browser database access is protected by Auth + grants + RLS.
4. Browser artifact access is append-only.
5. Each browser reads only its own artifact rows through the client path.
6. Raw chat is not captured by default.
7. Draft generation is not intended to equal research capture; commit is the current semantic capture boundary.
8. Durable research capture remains separable from multiplayer transport.
9. Administrative corpus export must use a trusted path, not broad client SELECT.
10. All of this remains provisional until research governance, abuse protection, retention, and production requirements are settled.

## 15. What remains provisional / unfinished

- Anonymous Sign-In dashboard enablement must be confirmed.
- CAPTCHA/Turnstile for broader public anonymous use.
- automatic cleanup/retention policy for anonymous users.
- Supabase Storage path for oversized geometry.
- trusted research export/analysis tooling.
- visible in-product persistence status, if desired.
- explicit user-facing research-consent language, if this becomes research data collection rather than demo logging.
- host migration.
- durable rooms after host departure.
- production monitoring/SLA.
- offline multi-host conflict resolution.

The architecture should stay small until one of those requirements becomes real.
