// IMAGERY — the photograph of the actual ground, on the actual ground.
//
// The reference (Henry House, Johnson County) makes the case: a hillside drawn
// in palette colours is a diagram, and a hillside wearing its own aerial is a
// PLACE — you recognise the tree line, the cut of the drive, the bare rock. The
// difference is not prettiness. It is whether a person can check the model
// against what they know.
//
// It costs nothing structural here because CREO's terrain already asks for a
// colour per lattice cell — `terrainColor(h, t, water, x, y)`, with the world
// coordinates already in hand. So the aerial enters as an ANSWER TO THAT
// QUESTION, not as a new pipeline: no UV attribute, no sampler in the shader,
// no second mesh. Photograph in, vertex colour out, one call site.
//
// Source: Esri World Imagery (keyless XYZ). Attribution is not decoration —
// see meta.attribution and keep it on screen, the way OSM's is.
//
// Ceilings: z17, ≤ 4×4 tiles, one place at a time, 2048² working canvas.

const ATTRIB = 'Aerial: Esri World Imagery — Esri, Maxar, Earthstar Geographics';
const URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const t2x = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
const t2y = (lat, z) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z);
const load = (u) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('tile')); i.src = u; });

const S = { on: false, px: null, w: 0, h: 0, x0: 0, y0: 0, x1: 0, y1: 0, warm: 0.0, rev: 0 };

export const IMAGERY = {
  attribution: ATTRIB,
  get on() { return S.on; },
  get rev() { return S.rev; },      // bumps per load, so the ground cache notices

  /** Fetch the aerial covering this world's bbox and index it in LOCAL metres. */
  async load(world, z = 17) {
    let bbox = world?.place?.meta?.bbox;                    // [south, west, north, east]
    const P = world?.place?.projection;
    // A saved or synthetic place carries no import bbox — but it does know
    // where it is (anchor) and how far it reaches (terrain bounds). That is
    // the same fact in two pieces, so reassemble it rather than refuse.
    // Ask the projection to invert the ground's own corners. This is the one
    // source that is always present when a place has terrain at all — an
    // import bbox may be missing, an anchor may be named something else, but a
    // projection that can place a point can also un-place one.
    if (!bbox && P && typeof P.toWGS84 === 'function' && world?.place?.terrain) {
      const b = world.place.terrain.bounds;
      const nw = P.toWGS84(b[0], b[3]), se = P.toWGS84(b[2], b[1]);
      if (nw && se && isFinite(nw[0]) && isFinite(se[0])) {
        bbox = [Math.min(nw[0], se[0]), Math.min(nw[1], se[1]),
                Math.max(nw[0], se[0]), Math.max(nw[1], se[1])];
      }
    }
    if (!bbox && (world?.place?.anchor || P?.anchor) && world?.place?.terrain) {
      const [lat, lon] = world.place.anchor || P.anchor, b = world.place.terrain.bounds;
      const dLat = ((b[3] - b[1]) / 2) / 111320;
      const dLon = ((b[2] - b[0]) / 2) / (111320 * Math.cos(lat * Math.PI / 180) || 1);
      bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
    }
    if (!bbox) console.warn('[imagery] no bbox, no projection inverse — cannot place the photograph');
    if (!bbox || !P) { console.warn('[imagery] this place knows no coordinates — nothing to drape'); return false; }
    const [s, w, n, e] = bbox;
    let tx0 = Math.floor(t2x(w, z)), tx1 = Math.floor(t2x(e, z));
    let ty0 = Math.floor(t2y(n, z)), ty1 = Math.floor(t2y(s, z));
    while ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 16 && z > 13) {   // hold the ceiling
      z--; tx0 = Math.floor(t2x(w, z)); tx1 = Math.floor(t2x(e, z));
      ty0 = Math.floor(t2y(n, z)); ty1 = Math.floor(t2y(s, z));
    }
    const cv = document.createElement('canvas');
    cv.width = (tx1 - tx0 + 1) * 256; cv.height = (ty1 - ty0 + 1) * 256;
    const g = cv.getContext('2d', { willReadFrequently: true });
    let got = 0;
    for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) {
      try { g.drawImage(await load(URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)), (x - tx0) * 256, (y - ty0) * 256); got++; }
      catch (_) { /* a missing tile is a hole, not a failure */ }
    }
    if (!got) { console.warn('[imagery] no tiles arrived'); return false; }
    // the canvas spans these tile corners; convert both to LOCAL metres once,
    // so sampling later is two subtractions and a lookup
    const geo = (tx, ty) => {
      const nn = Math.pow(2, z);
      return [Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / nn))) * 180 / Math.PI, tx / nn * 360 - 180];
    };
    const [latA, lonA] = geo(tx0, ty0);                     // north-west corner
    const [latB, lonB] = geo(tx1 + 1, ty1 + 1);             // south-east corner
    const a = P.toLocal(latA, lonA), b = P.toLocal(latB, lonB);
    S.px = g.getImageData(0, 0, cv.width, cv.height).data;
    S.w = cv.width; S.h = cv.height;
    S.x0 = Math.min(a[0], b[0]); S.x1 = Math.max(a[0], b[0]);
    S.y0 = Math.min(a[1], b[1]); S.y1 = Math.max(a[1], b[1]);
    S.flipY = a[1] > b[1];                                  // does local +y run north?
    S.on = true;
    S.rev++;
    console.info('%c[imagery] ' + got + ' tiles at z' + z + ' · ' + ATTRIB, 'color:#6fe0c0');
    return true;
  },

  /**
   * The colour of the ground at a world point, or null if the photo does not
   * reach it — null means "you answer", so CREO's palette still owns the edges.
   */
  sample(x, y) {
    if (!S.on) return null;
    const u = (x - S.x0) / (S.x1 - S.x0);
    let v = (y - S.y0) / (S.y1 - S.y0);
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    if (S.flipY) v = 1 - v;                                 // image rows run north→south
    const px = Math.min(S.w - 1, (u * S.w) | 0), py = Math.min(S.h - 1, (v * S.h) | 0);
    const i = (py * S.w + px) * 4;
    if (S.px[i + 3] === 0) return null;
    // lifted a little: raw satellite under CREO's sun reads muddy, and the
    // point is recognition, not photographic fidelity
    const k = 1 / 255 * 1.06;
    return [Math.min(1, S.px[i] * k), Math.min(1, S.px[i + 1] * k), Math.min(1, S.px[i + 2] * k)];
  },

  off() { S.on = false; S.px = null; },
};

if (typeof window !== 'undefined') window.IMAGERY = IMAGERY;
