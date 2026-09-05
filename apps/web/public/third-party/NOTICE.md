# Dark Forest Renderer and Procedural Notices

Source: [darkforest-eth/darkforest-v0.6](https://github.com/darkforest-eth/darkforest-v0.6/tree/d1e25ead311697ecaa27ff648dac16a0d8cea15c),
pinned commit `d1e25ead311697ecaa27ff648dac16a0d8cea15c`.

The repository root license is GPL-3.0. The specific packages reused here each
carry their own MIT license, copyright 2022 0xPARC <ivan@0xPARC.org>:

- `packages/renderer`: original `PlanetProgram.ts` fragment shader and required
  `ShaderMixins.ts` routines; complete license in `df-renderer-LICENSE.txt`.
- `packages/procedural`: biome land/ocean/beach palettes from `ProcgenUtils.ts`;
  complete license in `df-procedural-LICENSE.txt`.

The expanded shader is `src/rendering/df-planet.frag.glsl` in the web client.
`ops/import-df-planet-shader.mjs` reproducibly extracts it from a local pinned
checkout without downloading or executing upstream code. Spherical square
roots are clamped outside the disk to avoid undefined fragment values. The
Sui/React camera adapter, resource UI and shared-canvas lifecycle are local.
The renderer retains upstream 4D simplex-noise routines and source comments.

Only the normal Planet body is currently rendered with the upstream shader.
Special facilities retain their separate presentation. This adaptation does
not claim to include the entire upstream game or renderer package.
