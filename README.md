# Terrarium

Terrarium combines [Unsettled Atlas](https://github.com/hartswf0/unsettled-atlas) with [MOTOR](https://hartswf0.github.io/motor/): an accountable, conversational ground inhabited by a drivable body, where movement leaves traces and the standing arrangement can be unsettled without erasing its history.

The application is browser-native and dependency-free. It includes real-place import, terrain and building geometry, driving, flood simulation, journaled changes, branches, testimony, and the Unsettled Atlas normalization layer.

## Run locally

```sh
python3 serve.py
```

Then open <http://localhost:8000>.

## Test

```sh
node tests/run.js
node tests/audit-geometry.mjs
```

The longer design account is in [TERRARIUM.md](TERRARIUM.md).
