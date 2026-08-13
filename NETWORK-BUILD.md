# NETWORK-BUILD

> **PROVISIONAL ARCHITECTURE — TERRARIUM III**  
> Last updated: 2026-08-13. This document describes the current demo network build, not a final production contract. Every layer here is intentionally replaceable.

## 0. The invariant

TERRARIUM III is a **host-held live vessel**, not a conventional authoritative cloud game server.

The network is split into two planes:

1. **Introduction plane** — Supabase Realtime Presence + Broadcast lets browsers find one another and exchange WebRTC offer/answer/ICE signaling.
2. **World plane** — once linked, world traffic moves browser-to-browser over WebRTC data channels. The host is the live authority.

The database is **optional persistence**. A database failure must never stop movement, building, chat, or peer traffic in the current vessel.

```text
GitHub Pages
    |
    v
TERRARIUM III browser
    |
    +--> Supabase Realtime ---- introduction only
    |        Presence
    |        Broadcast signaling
    |
    +--> Cloudflare TURN/STUN -- traversal when direct P2P needs help
    |
    +<=========================> WebRTC world plane
             reliable channel: builds / chat / world edits / journals
             fast channel: transient state / motion

optional, asynchronous side channel:
    |
    +--> Supabase Postgres / Storage -- prompts, geometries, snapshots, research artifacts
```

## 1. Public Supabase configuration

The demo embeds a browser-public Supabase Project URL and `sb_publishable_...` key in `terrarium-iii-net.js` as `DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_KEY`.

A Supabase `sb_publishable_...` key is explicitly intended for public client code. It is **not a secret**. Security for database access comes from authentication, grants, and Row Level Security.

Never embed or paste:

- `sb_secret_...`
- `service_role`
- database passwords
- private TURN credentials

Official key guidance: https://supabase.com/docs/guides/getting-started/api-keys

## 2. Override hierarchy

Embedded defaults are a fallback, not a lock-in.

Resolution order is:

```text
1. current runtime / invite override
2. localStorage manual override
3. sessionStorage manual override
4. optional HTML meta-tag default
5. embedded demo default
```

Therefore a new Supabase project can be entered through the existing **ONE-TIME HOST SETUP** panel without rebuilding the application.

Persistence behavior is intentionally fail-soft:

```text
try localStorage
    |
    +-- works --> persistent manual override
    |
    +-- quota / unavailable
            |
            v
       try sessionStorage
            |
            +-- works --> tab/session override
            |
            +-- unavailable --> keep config in memory

storage failure never blocks multiplayer
```

`CLEAR` removes the manual override. The next configuration lookup falls back to the embedded public defaults.

## 3. Current resilience rules

The current III network module is hardened for common demo failures.

### Browser storage

A quota failure is non-fatal. Signal credentials can operate from local storage, session storage, or memory.

### Realtime heartbeat

Supabase Realtime is configured with:

- Web Worker heartbeats
- a 15 second heartbeat interval
- explicit reconnect when heartbeat status reports disconnection
- reconnect on browser `online`
- reconnect when a hidden tab becomes visible again

Supabase recommends Web Worker heartbeats plus explicit reconnect for backgrounded browser applications:

https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794

### Host disappearance

A missing host Presence record no longer destroys a guest immediately.

Guests allow an **8 second grace window** for Presence / WebSocket recovery. If the host is still absent after the grace period, the vessel closes as designed.

This preserves the core rule:

> transient network loss is recoverable; a truly departed host ends the current vessel.

### WebRTC link failure

When a guest data channel or peer connection fails, the guest asks the host for a **fresh PeerConnection** rather than reusing a stale offer/answer pair.

The host discards its old half of that guest link and creates a new offer.

### TURN

TURN credentials are fetched from the existing Cloudflare worker endpoint in `terrarium-iii-net.js`.

If TURN credentials cannot be obtained, III falls back to Cloudflare STUN. That fallback is useful, but **STUN-only is not considered demo-ready on restrictive campus, hotel, conference, or enterprise Wi-Fi**.

The `TEST SIGNAL + TURN` control should be treated as a preflight, not a debugging curiosity.

## 4. What Supabase is and is not doing

### Supabase currently does

- Realtime Presence
- Realtime Broadcast signaling
- optional future Auth
- optional future Postgres persistence
- optional future object Storage

### Supabase does not carry the live world

The following are designed to remain WebRTC traffic after peers link:

- movement
- world state
- builds
- edits
- chat
- journals
- geometry exchange

This keeps the demo inexpensive and avoids making database latency part of the interaction loop.

## 5. Current Free-plan envelope

These values are documented here as a **2026-08-13 snapshot** and must be rechecked before relying on them in a future deployment.

Supabase Free currently includes approximately:

- **500 MB Postgres database size per project**
- **5 GB egress**
- **1 GB object/file storage**
- **2 million Realtime messages per month**
- **200 peak Realtime connections**
- **100 Realtime messages/second**
- **20 Presence messages/second**
- **500,000 Edge Function invocations**
- **50,000 MAU**
- **2 active Free projects**
- Free projects can be paused after about **1 week of inactivity**
- Free does not include the same automatic backup retention as Pro

Sources:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/realtime/limits
- https://supabase.com/docs/guides/platform/database-size

### Operational consequence

For an eight-person demo, connection/message quota is not the likely bottleneck.

The more realistic risks are:

1. Free project paused after inactivity.
2. Host laptop sleeps or leaves the network.
3. Browser background throttling.
4. TURN unavailable on a restrictive network.
5. Wi-Fi transition / captive portal.
6. GitHub Pages deployment/cache lag after a last-minute commit.
7. Local browser storage filling with unrelated world caches.

## 6. Can we store prompts and geometries for free?

**Yes.** The Free Postgres database is sufficient for a substantial research/demo corpus if records stay compact.

The recommended model is **append-only artifacts**, not frame-by-frame telemetry.

Store things that have semantic value:

- user prompt that caused a build
- compiled architecture/geometry JSON
- build/world snapshot
- provenance / parent artifact
- room/session identifier
- timestamp
- client/compiler version
- optional research metadata

Do **not** write every vehicle transform, physics tick, camera frame, or transient multiplayer state to Postgres.

A useful boundary:

```text
live transient state --> WebRTC only
meaningful authored artifact --> optional durable record
large binary snapshot --> Supabase Storage + metadata row
```

## 7. Provisional durable artifact model

Suggested logical record:

```text
<ARTIFACT>
    id
    created_at
    user_id
    room_code
    session_id
    artifact_type
    prompt
    geometry_json
    metadata_json
    client_version
    parent_id
```

Suggested artifact types:

```text
prompt
geometry
build
world_snapshot
```

Raw chat should **not** be captured by default. If chat becomes research data, that should be a separate explicit data/consent decision rather than an accidental side effect of networking.

## 8. Identity and RLS

Because the publishable key is public, the database must never rely on possession of that key as authorization.

Recommended demo path:

1. Enable Supabase **Anonymous Sign-Ins**.
2. Each browser calls `signInAnonymously()` once.
3. The browser gets a unique authenticated user id without requiring email/PII.
4. RLS lets that user insert/select only their own artifact rows.
5. Administrative/research export happens through a trusted backend/dashboard path, not through a public broad SELECT policy.

Supabase documents anonymous users as authenticated users with unique IDs, suitable for demos:

https://supabase.com/docs/guides/auth/auth-anonymous

Supabase recommends CAPTCHA / abuse controls if anonymous sign-in is exposed publicly.

RLS guidance:

https://supabase.com/docs/guides/database/postgres/row-level-security

### Important abuse boundary

Do **not** create a policy equivalent to "anyone with the publishable key may insert anything forever." The key is intentionally public and can be copied from source. Authentication + RLS and/or a validating Edge Function is the security boundary.

## 9. Large geometry

Postgres JSONB is appropriate for compact declarative geometry and compiled plans.

For large payloads, prefer:

```text
Postgres row
  id
  prompt
  metadata
  storage_path
  geometry_hash

Supabase Storage
  compressed JSON / GLB / binary snapshot
```

Free Storage currently includes 1 GB and a 50 MB maximum file upload size according to current pricing documentation.

Storage pricing/limits:
https://supabase.com/docs/guides/storage/pricing

## 10. Database availability must not become world availability

Durable writes should be asynchronous and queued locally when necessary.

Desired behavior:

```text
user builds geometry
      |
      +--> world changes immediately over WebRTC
      |
      +--> enqueue durable artifact
                |
                +--> Supabase works --> mark persisted
                |
                +--> Supabase fails --> retain local retry queue

NEVER:
user builds geometry
      |
      v
wait for database
      |
      X database down --> build fails
```

A future persistence module should expose states such as:

```text
LOCAL
QUEUED
SYNCING
PERSISTED
FAILED_RETRYABLE
```

and should use idempotent artifact IDs so retries do not create duplicates.

## 11. Proposed storage implementation stages

### Phase A — network hardening

**Current.**

- embedded browser-public signal defaults
- manual override remains available
- local/session/memory fallback
- Web Worker heartbeat
- signal reconnect
- host Presence grace window
- guest peer-link reset/retry
- TURN preflight

### Phase B — schema only

Create the provisional artifact table and RLS policies, but leave capture disabled in the UI.

### Phase C — explicit artifact capture

Add a small persistence module that records only semantic artifacts such as prompts + compiled geometries.

Capture should be visibly documented and, where this is used as research data, aligned with the appropriate consent/data-governance process.

### Phase D — export / analysis

Build a trusted export path for research analysis. Do not give anonymous clients broad read access to the corpus.

## 12. Suggested pre-demo ritual

The day before and again immediately before a presentation:

1. Open the Supabase dashboard and confirm the Free project is **ACTIVE**, not paused.
2. Load the production GitHub Pages URL in a fresh/incognito browser.
3. Confirm signal configuration is already available from the embedded default.
4. Run `TEST SIGNAL + TURN`.
5. Require `SIGNAL OK` and preferably `TURN READY`, not STUN-only.
6. Host from the plugged-in laptop.
7. Disable system/browser sleep for the demo window.
8. Join from a phone on the actual venue network.
9. Background and restore the guest once to test heartbeat recovery.
10. Toggle Wi-Fi briefly on the guest to test re-handshake.
11. Build/edit something and verify both peers converge.
12. If durable capture is enabled, verify persistence separately; failure there must not affect the vessel.

## 13. Failure matrix

| Failure | Expected behavior |
|---|---|
| localStorage quota full | use sessionStorage or memory; multiplayer continues |
| manual Supabase override invalid | reject override; embedded default remains available after clear/reload |
| Supabase heartbeat drops | reconnect Realtime |
| browser tab backgrounds | worker heartbeat reduces timer-throttling failure |
| host Presence flickers | wait 8 seconds before declaring host gone |
| guest WebRTC link fails | request fresh host offer / peer connection |
| TURN endpoint fails | STUN fallback; preflight warns |
| database write fails | live world continues; durable artifact remains queued |
| Supabase Free project paused | signal/database unavailable until project is resumed |
| host actually closes/leaves | live vessel closes by design |

## 14. Security invariants

1. Publishable client key may be public.
2. Secret/service-role credentials never enter browser source, invites, localStorage, or logs.
3. Database tables exposed to the Data API use RLS.
4. Anonymous public clients do not receive administrative read/write powers.
5. Persistent research capture is separable from the multiplayer transport.
6. Invite fragments may contain only browser-public configuration.
7. No durable-storage feature is allowed to block the live interaction path.

## 15. Why this is provisional

III currently optimizes for a research/demo vessel: very low infrastructure, visible failure modes, host-held authority, direct browser traffic, and replaceable cloud dependencies.

It does **not yet promise**:

- host migration
- durable rooms after host departure
- globally ordered cloud event logs
- offline-first multi-host conflict resolution
- guaranteed long-term data retention on the Free tier
- production abuse protection
- production monitoring/SLA

Those are separate architectural commitments. They should be added only if the project actually requires them rather than quietly turning the demo stack into a conventional game backend.
