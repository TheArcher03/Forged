# FORGED — Stone Age village prototype

A throwaway web 3D prototype of Greyford, the first village in FORGED: a first-person walk
from the creek ford up the street to the knapping workshop. Three.js and plain JavaScript,
nothing to install. This is a look-and-feel prototype only; it does not lock in the game's engine.

## Play it

https://thearcher03.github.io/Forged/ (best in Chrome or Safari on a laptop or desktop; the first load fetches about 110 MB).

## Run it locally

Double-click `forged-village/start.command`, or:

```bash
python3 forged-village/serve.py 8137
```

Then open http://localhost:8137 in Chrome or Safari.

**Controls:** click to start · WASD walk · Shift jog · mouse look · E trade at a doorway · R back to the ford · Esc release the mouse.

## What's in here

- `forged-village/src/world.js` — the shape of the land, building positions and collisions
- `forged-village/src/` — terrain, grass, forest, creek, village, sky and effects
- `forged-village/src/hearths.js` — the village fire, the pit kiln and the oven
- `forged-village/src/entrances.js` — porches, plank doors and drystone footings for each hut
- `forged-village/src/shops.js` — trading in the world: each family's table, its goods, the keepers' lines (wares, prices and lines are placeholders)
- `forged-village/src/wildlife.js` — heron, red kites, swallows, butterflies, dragonflies and rising fish
- `forged-village/assets/` — photo-scanned textures and models
- `forged-village/lib/` — a local copy of Three.js

## Credits

- Scanned textures and models: [Poly Haven](https://polyhaven.com), CC0
- [Three.js](https://threejs.org), MIT licence (see `forged-village/lib/LICENSE`)
