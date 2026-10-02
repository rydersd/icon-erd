// Browser-only output adapters. JSON interchange stays in library-io.js.
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click();
  setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 2000);
}
export async function svgToPNG(svg, size) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('SVG could not be rasterized')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    canvas.getContext('2d').drawImage(image, 0, 0, size, size);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
