// Four-point perspective correction — the "straighten a photo of a flat rectangular
// object" technique scanning apps use (same idea as OpenCV's getPerspectiveTransform +
// warpPerspective). Given four user-adjusted corners on a source image, warps that
// quadrilateral into a flat square output.
export type Point = { x: number; y: number };

// Solves for the 3x3 projective matrix H (as [a,b,c,d,e,f,g,h], with the implicit 1 in
// the bottom-right) such that H * from[i] = to[i] for all four correspondences, via
// Gaussian elimination on the resulting 8x8 linear system.
function solveHomography(from: Point[], to: Point[]): number[] {
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: xp, y: yp } = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp]);
    B.push(xp);
    A.push([0, 0, 0, x, y, 1, -x * yp, -y * yp]);
    B.push(yp);
  }

  // Gaussian elimination with partial pivoting on the augmented [A|B] matrix.
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [B[col], B[pivot]] = [B[pivot], B[col]];

    const pivotVal = A[col][col] || 1e-12;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col] / pivotVal;
      for (let c = col; c < n; c++) A[row][c] -= factor * A[col][c];
      B[row] -= factor * B[col];
    }
  }

  return A.map((row, i) => B[i] / (row[i] || 1e-12));
}

export function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  srcQuad: Point[], // 4 corners on the source image: top-left, top-right, bottom-right, bottom-left
  outputSize: number
): HTMLCanvasElement {
  const dstQuad: Point[] = [
    { x: 0, y: 0 },
    { x: outputSize, y: 0 },
    { x: outputSize, y: outputSize },
    { x: 0, y: outputSize },
  ];

  // Solve the mapping FROM destination square TO source quad directly, so each output
  // pixel can look up its source pixel in one step (inverse warp, avoids resampling gaps).
  const [a, b, c, d, e, f, g, h] = solveHomography(dstQuad, srcQuad);

  const srcCtx = sourceCanvas.getContext("2d");
  if (!srcCtx) return sourceCanvas;
  const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outputSize;
  outCanvas.height = outputSize;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return sourceCanvas;
  const outData = outCtx.createImageData(outputSize, outputSize);

  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  for (let dy = 0; dy < outputSize; dy++) {
    for (let dx = 0; dx < outputSize; dx++) {
      const denom = g * dx + h * dy + 1;
      const sx = (a * dx + b * dy + c) / denom;
      const sy = (d * dx + e * dy + f) / denom;

      const outIdx = (dy * outputSize + dx) * 4;

      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        outData.data[outIdx + 3] = 0; // transparent outside the source bounds
        continue;
      }

      // Bilinear interpolation for a smoother result than nearest-neighbor sampling.
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const idx00 = (y0 * sw + x0) * 4;
      const idx10 = (y0 * sw + x0 + 1) * 4;
      const idx01 = ((y0 + 1) * sw + x0) * 4;
      const idx11 = ((y0 + 1) * sw + x0 + 1) * 4;

      for (let ch = 0; ch < 4; ch++) {
        const top = srcData.data[idx00 + ch] * (1 - fx) + srcData.data[idx10 + ch] * fx;
        const bottom = srcData.data[idx01 + ch] * (1 - fx) + srcData.data[idx11 + ch] * fx;
        outData.data[outIdx + ch] = top * (1 - fy) + bottom * fy;
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}
