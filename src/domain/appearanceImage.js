// Optimización local: no se transmite el archivo original ni sus metadatos.
export async function prepareAppearanceImage(file, slot) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  }
  let bitmap;
  try {
    // Solo se transmite una versión reducida. El formato final se normaliza en
    // el servidor; algunos navegadores devuelven PNG cuando se solicita WebP.
    bitmap = await createImageBitmap(file);
    const maxSize = slot === 'logo' ? 400 : 1600;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen en este navegador.');

    let edge = Math.min(maxSize, Math.max(bitmap.width, bitmap.height));
    const minEdge = Math.min(96, edge);
    while (true) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const format of ['image/webp', 'image/jpeg', 'image/png']) {
        if (format === 'image/jpeg') {
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let transparent = false;
          for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] < 255) { transparent = true; break; }
          }
          if (transparent) continue;
        }
        for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28]) {
          const data = canvas.toDataURL(format, quality);
          if (/^data:image\/(webp|jpeg|png);base64,/.test(data) && data.length <= 330000) return data;
          // PNG ignora la calidad: repetirla no reduce el peso.
          if (data.startsWith('data:image/png;')) break;
        }
      }
      if (edge === minEdge) break;
      edge = Math.max(minEdge, Math.floor(edge * 0.8));
    }
    throw new Error('No se pudo optimizar esta imagen. Prueba con otro formato JPG, PNG o WebP.');
  } finally {
    bitmap?.close();
  }
}
