// hlidarendi/src/living-ground.js — THE LIVING GROUND, shared.
//
// The place stack that makes a terrarium a terrarium: the same sources the
// Terrarium builds read — elevation already baked (terrain-data.js), imagery
// from Esri World Imagery, ways and buildings from OpenStreetMap via Overpass —
// registered onto the baked height window through its geographic meta
// (TERRAIN.geo). Deep integration, not parasitism: one module owns the
// mercator math and the dressing pipeline; the page consumes it at boot and
// on /goto; nothing here duplicates the height authority.
//
// Attribution: imagery © Esri, Maxar, Earthstar Geographics; ways/buildings
// © OpenStreetMap contributors (ODbL). Keep these visible wherever dressed.
export const LIVING_GROUND = {
  sources: {
    imagery: [
      (z, x, y) => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x,
      (z, x, y) => 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/' + z + '/' + y + '/' + x + '.jpg',
    ],
    overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'],
    nominatim: 'https://nominatim.openstreetmap.org/search',
    // THE LIVE CONDITIONS — keyless, attribution-only feeds. The land you are
    // standing on is not a backdrop: it is shaking, and things are crossing
    // the sky above it, right now. (Source list read off bilawalsidhu's
    // gods-eye-view, MIT; the code there is CesiumJS-bound and stays there —
    // what travels is the list and the registration, which is ours already.)
    quakes: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    adsb: (lat, lon, nm) => 'https://api.adsb.lol/v2/lat/' + lat.toFixed(4) + '/lon/' + lon.toFixed(4) + '/dist/' + Math.round(nm),
  },
  // ---- web-mercator: lon/lat ↔ global pixels at zoom z (256px tiles)
  lonToPx(lon, z) { return (lon + 180) / 360 * Math.pow(2, z) * 256; },
  latToPx(lat, z) { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z) * 256; },
  pxToLon(px, z) { return px / (Math.pow(2, z) * 256) * 360 - 180; },
  pxToLat(py, z) { const n = Math.PI - 2 * Math.PI * py / (Math.pow(2, z) * 256); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); },
  // the baked window's global-pixel rect at its own zoom (1 sample = 1 px)
  windowPx(T) { const g = T.geo; return { z: g.z, x0: g.tx * 256 + g.wx, y0: g.ty * 256 + g.wy, w: T.n, h: T.n }; },
  loadTile(url) {
    return new Promise((ok, bad) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      const t = setTimeout(() => { im.src = ''; bad(new Error('tile timeout')); }, 12000);
      im.onload = () => { clearTimeout(t); ok(im); };
      im.onerror = () => { clearTimeout(t); bad(new Error('tile failed')); };
      im.src = url;
    });
  },
  // ---- IMAGERY: paint the window with satellite tiles at zi (default bake z + 2)
  async imagery(T, zi) {
    const W = this.windowPx(T);
    zi = zi || W.z + 2;
    const s = Math.pow(2, zi - W.z);
    const px0 = W.x0 * s, py0 = W.y0 * s, pw = W.w * s, ph = W.h * s;
    const cv = document.createElement('canvas'); cv.width = Math.round(pw); cv.height = Math.round(ph);
    const c2 = cv.getContext('2d');
    const tx0 = Math.floor(px0 / 256), tx1 = Math.floor((px0 + pw - 1) / 256);
    const ty0 = Math.floor(py0 / 256), ty1 = Math.floor((py0 + ph - 1) / 256);
    let okCount = 0, jobs = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
      jobs.push((async () => {
        for (const src of this.sources.imagery) {
          try {
            const im = await this.loadTile(src(zi, tx, ty));
            c2.drawImage(im, tx * 256 - px0, ty * 256 - py0);
            okCount++; return;
          } catch (e) { /* next source */ }
        }
      })());
    }
    await Promise.all(jobs);
    if (!okCount) throw new Error('no imagery reachable');
    return { canvas: cv, zi, px0, py0, scale: s, tiles: okCount };
  },
  // ---- WAYS: roads, water, buildings for the window bbox via Overpass
  async ways(T) {
    const W = this.windowPx(T);
    const lat0 = this.pxToLat(W.y0 + W.h, W.z), lat1 = this.pxToLat(W.y0, W.z);
    const lon0 = this.pxToLon(W.x0, W.z), lon1 = this.pxToLon(W.x0 + W.w, W.z);
    const bbox = lat0 + ',' + lon0 + ',' + lat1 + ',' + lon1;
    const q = '[out:json][timeout:20];(way["highway"](' + bbox + ');way["waterway"](' + bbox + ');way["building"](' + bbox + '););out geom;';
    let data = null;
    for (const host of this.sources.overpass) {
      try {
        const r = await fetch(host, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
        if (r.ok) { data = await r.json(); break; }
      } catch (e) { /* next host */ }
    }
    if (!data) throw new Error('overpass unreachable');
    const roads = [], waters = [], buildings = [];
    for (const el of data.elements || []) {
      if (!el.geometry) continue;
      const pts = el.geometry.map(g => [this.lonToPx(g.lon, W.z) - W.x0, this.latToPx(g.lat, W.z) - W.y0]); // window px
      if (el.tags && el.tags.building) buildings.push({ pts, tags: el.tags });
      else if (el.tags && el.tags.waterway) waters.push({ pts, tags: el.tags });
      else if (el.tags && el.tags.highway) roads.push({ pts, tags: el.tags });
    }
    return { roads, waters, buildings };
  },
  drawWays(img, w) {   // paint ways into the imagery canvas (window px × scale)
    const c2 = img.canvas.getContext('2d'), s = img.scale;
    c2.lineCap = 'round'; c2.lineJoin = 'round';
    const stroke = (pts, style, width) => {
      c2.strokeStyle = style; c2.lineWidth = width * s;
      c2.beginPath();
      pts.forEach((p, i) => { const x = p[0] * s, y = p[1] * s; if (i) c2.lineTo(x, y); else c2.moveTo(x, y); });
      c2.stroke();
    };
    for (const wt of w.waters) stroke(wt.pts, 'rgba(90,120,138,.85)', wt.tags.waterway === 'river' ? 3.5 : 1.6);
    for (const rd of w.roads) {
      const t = rd.tags.highway;
      const main = /^(primary|secondary|tertiary|trunk|motorway)/.test(t);
      stroke(rd.pts, main ? 'rgba(238,234,226,.95)' : 'rgba(205,196,178,.8)', main ? 2.6 : 1.2);
    }
  },
  // ---- REGISTRATION: any lat/lon becomes a place on this ground, and any
  // place on this ground becomes a lat/lon. The window's own mercator meta is
  // the only authority — nothing here re-derives the height or the extent.
  localXZ(T, lat, lon) {
    const g = T.geo; if (!g) throw new Error('no geographic registration');
    const W = this.windowPx(T);
    const i = this.lonToPx(lon, g.z) - W.x0, j = this.latToPx(lat, g.z) - W.y0;
    return { x: (i - T.cx) * T.res, z: (j - T.cy) * T.res };
  },
  latLonAt(T, x, z) {
    const g = T.geo; if (!g) throw new Error('no geographic registration');
    const W = this.windowPx(T);
    return { lat: this.pxToLat(W.y0 + z / T.res + T.cy, g.z), lon: this.pxToLon(W.x0 + x / T.res + T.cx, g.z) };
  },
  // great-circle offset — true metres and true bearing, no mercator stretch,
  // so a contact 300 km off still lies in exactly the right direction
  geoDelta(lat0, lon0, lat, lon) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (lat - lat0) * r, dLon = (lon - lon0) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat0 * r) * Math.cos(lat * r) * Math.sin(dLon / 2) ** 2;
    const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    const y = Math.sin(dLon) * Math.cos(lat * r);
    const x = Math.cos(lat0 * r) * Math.sin(lat * r) - Math.sin(lat0 * r) * Math.cos(lat * r) * Math.cos(dLon);
    return { d, brg: Math.atan2(y, x) };
  },
  // ---- THE GROUND IS SHAKING: USGS, last 24 h, public domain, keyless
  async quakes(T, withinKm) {
    const g = T.geo; if (!g) throw new Error('no geographic registration');
    const r = await fetch(this.sources.quakes, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('quakes ' + r.status);
    const j = await r.json();
    const cap = (withinKm || 600) * 1000, out = [];
    for (const f of (j.features || [])) {
      const c = f.geometry && f.geometry.coordinates; if (!c) continue;
      const lon = +c[0], lat = +c[1], depth = +c[2] || 0;
      const dd = this.geoDelta(g.lat, g.lon, lat, lon);
      if (dd.d > cap) continue;
      out.push({ lat, lon, depthKm: depth, mag: +(f.properties && f.properties.mag) || 0,
        place: (f.properties && f.properties.place) || '', time: (f.properties && f.properties.time) || 0,
        d: dd.d, brg: dd.brg });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  },
  // ---- THINGS CROSSING THE SKY: adsb.lol, keyless, attribution-only
  async aircraft(T, withinKm) {
    const g = T.geo; if (!g) throw new Error('no geographic registration');
    const nm = Math.max(5, Math.min(250, (withinKm || 180) / 1.852));
    const r = await fetch(this.sources.adsb(g.lat, g.lon, nm), { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('aircraft ' + r.status);
    const j = await r.json();
    const list = j.ac || j.aircraft || [];
    const out = [];
    for (const a of list) {
      const lat = +a.lat, lon = +a.lon; if (!isFinite(lat) || !isFinite(lon)) continue;
      const altFt = +(a.alt_baro === 'ground' ? 0 : a.alt_baro || a.alt_geom || 0);
      const dd = this.geoDelta(g.lat, g.lon, lat, lon);
      out.push({ lat, lon, altM: altFt * 0.3048, track: (+a.track || 0) * Math.PI / 180,
        flight: String(a.flight || a.r || a.hex || '').trim(), d: dd.d, brg: dd.brg,
        gs: +a.gs || 0 });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  },
  async geocode(name) {
    const r = await fetch(this.sources.nominatim + '?format=json&limit=1&q=' + encodeURIComponent(name), { headers: { 'accept': 'application/json' } });
    if (!r.ok) throw new Error('geocode ' + r.status);
    const j = await r.json();
    if (!j.length) throw new Error('no such place');
    return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
  },
};
