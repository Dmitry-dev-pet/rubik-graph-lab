# Rubik Graph Lab

Interactive comparison of one exact Rubik's Cube state in four visual forms:

- a Three.js/WebGL 3D cube;
- **1 circle** — the established W8 minimum;
- **3 rings** — center / edge / corner readability baseline;
- **9 rings** — Jevspin/MathFlow-style intersection layout.

## Live site

https://dmitry-dev-pet.github.io/rubik-graph-lab/

## Source of truth

The browser does not maintain an independent Rubik move table. The exact 48-sticker state,
permutations, phases, and reviewed one-circle collision data are copied from:

https://github.com/Dmitry-dev-pet/rubik-physics-intern

The initial standalone snapshot was synced from the visualizer on `rubik-physics-intern/main`
after the Three.js + multi-graph redesign.

## Visual references

The 3D renderer follows the architecture of the pinned Jevspin implementation
(Three.js, RoundedBoxGeometry, OrbitControls and pivot layer turns), with materials and studio
lighting informed by the earlier `apatch-blender-demo` Rubik render.

The 9-ring mode is a visual prior-art comparison. It is not evidence for the W8 one-circle theorem.

## Local preview

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/

## Verification

```bash
node smoke.mjs
```

The smoke test validates the C-001 schema, move/inverse tables, `g^4 = I`, inverse restoration,
sampled W8 circle membership, exact 3D destination geometry, and routes in all graph layouts.

## Vercel migration

This repository is the preferred standalone visualizer source. The current production visualizer is still served by the transitional `Dmitry-dev-pet/mytest` Vercel project.

Import this repository into Vercel as `rubik-graph-lab`:

https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDmitry-dev-pet%2Frubik-graph-lab&project-name=rubik-graph-lab

No application secret is required for the static visualizer.
