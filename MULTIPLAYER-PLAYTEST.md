# TERRARIUM III · REAL MULTIPLAYER PLAYTEST

Use the live Pages build with playtest telemetry enabled:

`https://hartswf0.github.io/terrarium/unset-04-hartsoe-iii.html?playtest=1`

The playtest sidecar is opt-in. It does **not** record raw chat. It records network/render telemetry and explicit notes players choose to save.

## One session

1. Every player hard-refreshes the playtest URL.
2. One person hosts the normal TERRARIUM multiplayer room.
3. Everyone else joins that room with the normal room-code flow.
4. The host creates one Supabase `iii_playtest_sessions` row automatically after the network is active.
5. The session id is announced over the existing WebRTC channel; guests adopt it and write their own `iii_playtest_events` rows.
6. Tap the small `TEST` badge to see RTT/FPS/loss and save a REACTION, LAG, BUG, or IDEA note.

## What is measured

Every client samples, asynchronously:

- application round-trip time to the host / peers
- RTT median and p95
- RTT jitter
- ping loss
- FPS
- long frames (>50 ms)
- peer count
- WebRTC connection / ICE / reliable / fast-channel state
- reliable queue depth
- network reconnect/retry counters when exposed by `III_NET.stats()`
- browser online/offline and visibility transitions
- uncaught client errors / rejected promises
- current architecture stage when available

Supabase writes are batched and fail-soft. They never run inside the movement/render loop.

## Console

```js
III_PLAYTEST.stats()
III_PLAYTEST.open()
III_PLAYTEST.note('Steering felt late when the other player built a house', 'lag')
await III_PLAYTEST.flush()
await III_PLAYTEST.events() // host can read all events for the current session
```

Without `?playtest=1`:

```js
await III_PLAYTEST.start({title:'Brothers NC test'})
```

Stop/close the host session:

```js
await III_PLAYTEST.stop()
```

## Practical quality bands

These are playtest alarms, not universal networking laws:

- RTT median < 80 ms: good
- RTT median 80–150 ms: usually playable, increasingly noticeable
- RTT median > 150 ms: likely noticeable for driving/combat
- RTT p95 < 150 ms: healthy target
- ping loss < 2%: healthy target
- ping loss > 5%: investigate Wi-Fi / relay / channel pressure
- FPS >= 55: ideal
- FPS 45–55: usually usable
- FPS < 40: investigate rendering / build complexity
- long-frame percentage < 2%: healthy target

## Test matrix

Run these as separate sessions or mark them with explicit notes:

1. **Same-network baseline** — two devices on one Wi-Fi network.
2. **Atlanta ↔ North Carolina** — normal home Wi-Fi on both sides.
3. **Cellular guest** — one player on phone hotspot/cellular.
4. **Reconnect** — guest toggles airplane mode/network for 10–20 seconds and returns.
5. **Background/foreground** — guest backgrounds the tab for 30 seconds and returns.
6. **Soak** — 30–60 minutes of normal play.
7. **Authoring stress** — one player generates/commits a structure while everyone else keeps moving/playing.
8. **Build propagation** — note the moment COMMIT is pressed and whether remote players hitch or wait.

## Hardening rule

The **play plane** is WebRTC state/control and must remain responsive.

The **authoring plane** is image generation, LLM calls, architecture critique, artifact persistence, and telemetry. It may take seconds, fail, retry, or be cancelled without blocking the play plane.

Use the fast unordered channel for high-rate transform/state traffic. Use the reliable channel for discrete gameplay events, committed build artifacts, chat, room control, and telemetry/session coordination.

Do not broadcast every architecture repair iteration. Only accepted/committed artifacts should become multiplayer world state.

## Supabase

Telemetry tables:

- `iii_playtest_sessions`
- `iii_playtest_events`

Each anonymous Supabase user writes its own events. The host may read every event attached to a session it owns. Guests may read their own rows. Raw chat is not captured by the playtest sidecar.
