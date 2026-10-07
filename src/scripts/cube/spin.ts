import { mul, rotX, rotY, type Mat3 } from './mat';

// The menu cube's spin, ported from Cubic (client/src/cube/spin.ts).

/** How far the cube is tipped towards the viewer, so its top shows. */
export const SPIN_TILT = (27 * Math.PI) / 180;
/** How often the cube moves: it is redrawn live, a small step each time. */
export const SPIN_FPS = 15;

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
/** How much of the turn one roll takes. */
const ROLL = 0.16;

/**
 * The view at a fraction (0..1) of the turn. The cube turns once on the spot like a
 * turntable, top and two sides in view. A plain turntable would show the rooftop the whole
 * way round and never the cave underneath, so twice per turn the cube also rolls half over
 * on its own x axis: first the cave comes up on top, then the rooftop again. All six
 * biomes come past, and the last frame leads back into the first.
 */
export function spinView(turn: number): Mat3 {
  const yaw = turn * Math.PI * 2 + Math.PI / 5;
  const roll = Math.PI * (smooth((turn - 0.25 + ROLL / 2) / ROLL) + smooth((turn - 0.75 + ROLL / 2) / ROLL));
  return mul(rotX(SPIN_TILT), mul(rotY(yaw), rotX(roll)));
}

/** The smallest frame that holds a cube with this half-edge at any angle. */
export const frameSize = (half: number): number => 2 * Math.ceil(half * Math.sqrt(3)) + 2;
