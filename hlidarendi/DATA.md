# The data this world reads

HLIÐARENDI stands on public data. Everything here is keyless or key-optional,
attribution-only, and registered onto the one baked height window through
`TERRAIN.geo` by [`src/living-ground.js`](src/living-ground.js) — one module
owns the mercator math, and nothing duplicates the height authority.

## The ground

| What | Source | Terms |
|---|---|---|
| Elevation (baked) | AWS Terrain Tiles (`terrarium` format) | open data, attribution |
| Imagery | Esri World Imagery, EOX s2cloudless fallback | © Esri, Maxar, Earthstar Geographics |
| Roads, water, buildings | OpenStreetMap via Overpass | © OpenStreetMap contributors (ODbL) |
| Place names | Nominatim | © OpenStreetMap contributors |

## The live conditions (`/live`)

| What | Source | Terms |
|---|---|---|
| Earthquakes, last 24 h | USGS GeoJSON summary feed | public domain (USGS) |
| Aircraft aloft | adsb.lol | keyless, attribution |

Both are read once on `/live`, refreshed every 90 s while lit, and registered
by great-circle bearing and distance from the window's own latitude and
longitude — no mercator stretch, so a contact 300 km out still lies in exactly
the right direction. Distant contacts are **presented, not faked**: true
bearing, true elevation angle, range squashed into the world's depth, and the
real distance/magnitude/altitude always stated in the log. It is the same
presentation law the dog's nose already uses on a scent.

## On gods-eye-view

The live-source list was read off
[bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)
(MIT), a CesiumJS geospatial-intelligence globe. **No code was taken.** That
project draws a whole earth on an ellipsoid with 3D tiles; this one is a
single kilometre of Fljótshlíð in three.js with a body standing on it, and
porting its modules would be exactly the parasitism this project already
corrected once. What travels between them is a list of open endpoints and the
idea that a place should keep its conditions visible — and the registration
that lands them here was already ours.

Deliberately **not** taken: anything key-gated or metered (Google
Photorealistic 3D Tiles, TomTom traffic, OpenAI Realtime), and the
surveillance layers (CCTV, AIS vessels, radio, bikeshare) — a different
project's thesis, and not one a farm in Fljótshlíð asks.
