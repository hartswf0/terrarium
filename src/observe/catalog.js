// CORE SOURCE CATALOG — boring, keyless, attributable foundations first.
//
// These policies are intentionally conservative. `mayRedistribute: false` does
// not mean a source forbids redistribution; it means this catalog is not making
// that promise until the exact dataset/product terms have been pinned. Access,
// retention, derivation and redistribution are separate questions.

import { makeSourcePolicy } from './source-policy.js';

export const CORE_SOURCES = Object.freeze([
  makeSourcePolicy({
    id: 'nws', name: 'NOAA / National Weather Service',
    acquisition: 'LIVE', retention: 'SNAPSHOT', keyRequired: false,
    license: 'U.S. government open data', attribution: 'NOAA / National Weather Service',
    sourceUrl: 'https://api.weather.gov', mayRedistribute: true, mayDerive: true,
    notes: 'Keyless; identifying User-Agent required. Policy checked 2026-08-25.',
  }),
  makeSourcePolicy({
    id: 'usgs-earthquakes', name: 'USGS Earthquake Hazards Program',
    acquisition: 'LIVE', retention: 'MIRROR', keyRequired: false,
    license: 'U.S. public domain', attribution: 'U.S. Geological Survey',
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/', mayRedistribute: true, mayDerive: true,
    notes: 'Realtime GeoJSON feeds; policy checked 2026-08-25.',
  }),
  makeSourcePolicy({
    id: 'usgs-water', name: 'USGS Water Data',
    acquisition: 'LIVE', retention: 'SNAPSHOT', keyRequired: false,
    license: 'U.S. public data', attribution: 'U.S. Geological Survey',
    sourceUrl: 'https://api.waterdata.usgs.gov/', mayRedistribute: true, mayDerive: true,
    notes: 'Current OGC-style Water Data APIs; policy checked 2026-08-25.',
  }),
  makeSourcePolicy({
    id: 'usaspending', name: 'USAspending',
    acquisition: 'LIVE', retention: 'SNAPSHOT', keyRequired: false,
    license: 'U.S. federal public data', attribution: 'USAspending.gov',
    sourceUrl: 'https://api.usaspending.gov/', mayRedistribute: false, mayDerive: true,
    notes: 'API currently requires no authorization. Redistribution deliberately left conservative.',
  }),
  makeSourcePolicy({
    id: 'fema', name: 'FEMA OpenFEMA / public GIS',
    acquisition: 'LIVE', retention: 'SNAPSHOT', keyRequired: false,
    license: 'U.S. federal public data; product-specific terms still apply', attribution: 'FEMA',
    sourceUrl: 'https://www.fema.gov/about/openfema', mayRedistribute: false, mayDerive: true,
    notes: 'Public REST/ArcGIS services. Pin exact service terms in each adapter.',
  }),
  makeSourcePolicy({
    id: 'osm', name: 'OpenStreetMap',
    acquisition: 'BULK', retention: 'MIRROR', keyRequired: false,
    license: 'ODbL 1.0', attribution: '© OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/copyright', mayRedistribute: true, mayDerive: true,
    notes: 'Redistribution/derived databases must preserve ODbL obligations.',
  }),
  makeSourcePolicy({
    id: 'natural-earth', name: 'Natural Earth',
    acquisition: 'BULK', retention: 'MIRROR', keyRequired: false,
    license: 'Public domain', attribution: 'Made with Natural Earth',
    sourceUrl: 'https://www.naturalearthdata.com/', mayRedistribute: true, mayDerive: true,
  }),
  makeSourcePolicy({
    id: 'usgs-3dep', name: 'USGS 3D Elevation Program',
    acquisition: 'BULK', retention: 'MIRROR', keyRequired: false,
    license: 'U.S. public domain', attribution: 'U.S. Geological Survey 3DEP',
    sourceUrl: 'https://www.usgs.gov/3d-elevation-program', mayRedistribute: true, mayDerive: true,
  }),
  makeSourcePolicy({
    id: 'adsb-lol', name: 'adsb.lol',
    acquisition: 'LIVE', retention: 'SNAPSHOT', keyRequired: false,
    license: 'ODbL 1.0', attribution: 'adsb.lol contributors',
    sourceUrl: 'https://api.adsb.lol/', mayRedistribute: true, mayDerive: true,
    notes: 'Open flight data; preserve ODbL attribution/share-alike obligations.',
  }),
]);

export function registerCoreSources(geonosis) {
  for (const source of CORE_SOURCES) geonosis.registerSource(source);
  return geonosis;
}
