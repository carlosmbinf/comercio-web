// Optimización local: no se transmite el archivo original ni sus metadatos.
export async function prepareAppearanceImage(file, slot) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  }
  let bitmap;
  try {
    // El original puede tener cualquier peso o resolución; solo se transmite una
    // versión WebP reducida. El límite práctico depende del decodificador del navegador.
    bitmap = await createImageBitmap(file);
    const maxSize = slot === 'logo' ? 400 : 1600;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen en este navegador.');

    let edge = Math.min(maxSize, Math.max(bitmap.width, bitmap.height));
    while (edge >= 96) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28]) {
        const data = canvas.toDataURL('image/webp', quality);
        if (data.startsWith('data:image/webp;base64,') && data.length <= 330000) return data;
      }
      edge = Math.floor(edge * 0.8);
    }
    throw new Error('No se pudo optimizar esta imagen. Prueba con otro formato JPG, PNG o WebP.');
  } finally {
    bitmap?.close();
  }
}
