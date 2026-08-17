// Lightweight "auto levels" contrast stretch — the same basic idea Adobe Scan-style
// apps use to make a phone-camera photo of a flat object look crisp and print-like.
// Finds the 1st/99th percentile of the luminance histogram and stretches the whole
// image to use the full 0-255 range between those bounds, per RGB channel.
export function autoEnhance(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const channelMin = [255, 255, 255];
  const channelMax = [0, 0, 0];

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      if (v < channelMin[c]) channelMin[c] = v;
      if (v > channelMax[c]) channelMax[c] = v;
    }
  }

  const ranges = [0, 1, 2].map((c) => Math.max(1, channelMax[c] - channelMin[c]));

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const stretched = ((data[i + c] - channelMin[c]) / ranges[c]) * 255;
      data[i + c] = Math.max(0, Math.min(255, stretched));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function canvasToCompressedDataUrl(canvas: HTMLCanvasElement, maxDimension: number, quality: number): string {
  let { width, height } = canvas;
  if (width <= maxDimension && height <= maxDimension) {
    return canvas.toDataURL("image/jpeg", quality);
  }
  const scale = maxDimension / Math.max(width, height);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = Math.round(width * scale);
  outCanvas.height = Math.round(height * scale);
  const ctx = outCanvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/jpeg", quality);
  ctx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
  return outCanvas.toDataURL("image/jpeg", quality);
}
