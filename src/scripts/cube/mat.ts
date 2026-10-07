// 3x3 matrices for the cube renderer, ported from Cubic (client/src/cube/mat.ts).
//
// A view matrix is row-major and its three ROWS are the screen axes written in cube space:
// row 0 = screen right, row 1 = screen up, row 2 = towards the viewer. So `apply(m, v)` is
// where the cube-space vector v lands on screen.

export type V3 = readonly [number, number, number];
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

// ("+ 0" turns -0 into 0)
export const apply = (m: Mat3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + 0, m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + 0, m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + 0];

/** a after b: `apply(mul(a, b), v) = apply(a, apply(b, v))`. */
export function mul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  return out as unknown as Mat3;
}

/** Turn about the screen's x axis. Positive tips the top of the cube towards the viewer. */
export function rotX(rad: number): Mat3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

/** Turn about the screen's y axis. Positive brings the left side of the cube to the front. */
export function rotY(rad: number): Mat3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
