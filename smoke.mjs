import fs from "node:fs/promises";
import {
  FACES,
  applyPermutation,
  createSolvedState,
  expandToQuarters,
  inverseTokens,
  isSolved,
  parseAlgorithm,
  positionsForActive,
  prepareQuarter,
  validateData,
} from "./core.mjs";
import { verifyMoveGeometry } from "./cube-math.mjs";
import { verifyGraphLayouts } from "./graph-layouts.mjs";

const data = JSON.parse(
  await fs.readFile(new URL("./data/c001-browser.json", import.meta.url), "utf8"),
);

validateData(data);
verifyMoveGeometry(data);
verifyGraphLayouts(data);

for (const face of FACES) {
  const move = data.moves[face];
  let state = createSolvedState();

  for (let i = 0; i < 4; i += 1) {
    state = applyPermutation(state, move.permutation);
  }
  if (!isSolved(state)) throw new Error(`${face}^4 did not return to identity.`);

  state = createSolvedState();
  state = applyPermutation(state, move.permutation);
  state = applyPermutation(state, move.inverse_permutation);
  if (!isSolved(state)) throw new Error(`${face} inverse cancellation failed.`);

  const active = prepareQuarter(data, createSolvedState(), face, 1);
  for (const t of [0, 0.125, 0.5, 0.875, 1]) {
    for (const position of positionsForActive(data, active, t)) {
      const radius = Math.hypot(position.x, position.y);
      if (Math.abs(radius - 1) > 1e-12) {
        throw new Error(`${face} left the unit circle at t=${t}.`);
      }
    }
  }
}

const algorithm = parseAlgorithm("R U R' U' F2 D L2 B'");
const inverse = inverseTokens(algorithm);
let state = createSolvedState();

for (const quarter of expandToQuarters([...algorithm, ...inverse])) {
  const active = prepareQuarter(data, state, quarter.face, quarter.sign);
  state = applyPermutation(active.old, active.permutation);
}

if (!isSolved(state)) {
  throw new Error("Algorithm followed by its inverse did not restore identity.");
}

console.log("rubik-graph-lab smoke: ok");
